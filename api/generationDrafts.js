// v4.3.0 AI Quiz Generation — draft CRUD, regenerate, approve, and expand.
// POST /api/generation/drafts, GET /api/generation/drafts[/{id}], PUT /api/generation/drafts/{id},
// POST /api/generation/drafts/{id}/regenerate-question, POST /api/generation/drafts/{id}/approve,
// POST /api/generation/expand.

const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { countCreatedToday, checkAndIncrRegenQuota } = require('./shared/dailyQuota');
const { generateDraft, MissingProviderKeyError } = require('./shared/llmAdapter');
const { InsufficientContentError } = require('./shared/llmProviders/mock');
const { validateDraftQuestions, validateQuestionShape, MIN_QUESTIONS, MAX_QUESTIONS } = require('./shared/draftSchema');
const { isValidTopicTag } = require('./shared/topicTags');
const { questionIdForDraft, quizIdForDraft, resolveSourceRefLabel } = require('./shared/materializeAi');

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);
const sourcesContainer = database.container(process.env.COSMOS_CONTAINER_SOURCE_MATERIALS || 'source_materials');
const draftsContainer = database.container(process.env.COSMOS_CONTAINER_QUIZ_DRAFTS || 'quiz_drafts');
const questionsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');

const MAX_GENERATIONS_PER_DAY = 10;
const MAX_REGENERATIONS_PER_DAY = 20;
const MAX_DRAFT_STATUS_DRAFTS = 50; // Security limits — 51st doc with status='draft' → 429
const MAX_QUESTIONS_PER_TEACHER = 2000;
const MAX_QUIZZES_PER_TEACHER = 500;

// Both new containers are partitioned by /teacherId — a point-read with the CALLER's own
// teacherId as the partition key can never return another teacher's doc (it simply isn't in that
// partition), so this is the 404-on-mismatch ownership check for these two containers, same
// guarantee assertScope gives elsewhere, without needing a separate query+compare round trip.
async function readOwnDoc(container, id, teacherId) {
  try {
    const { resource } = await container.item(id, teacherId).read();
    return resource || null;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

function plainMessage(status, error) {
  return { status, jsonBody: { error } };
}

const SOURCE_EXPIRED_MESSAGE = 'The document this quiz came from has expired. Upload it again to draft new practice from it.';

app.http('generationDrafts', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'generation/drafts',
  handler: async (request, context) => {
    const start = Date.now();
    const method = request.method;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'generation/drafts', method, status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (method === 'GET') {
        const { resources } = await draftsContainer.items.query({
          query: 'SELECT * FROM c WHERE c.teacherId = @tid ORDER BY c.createdAt DESC',
          parameters: [{ name: '@tid', value: teacherId }],
        }).fetchAll();
        return respond(200, resources, teacherId);
      }

      // POST — create a draft from a source.
      if (!rateLimit(`generation-drafts:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 65536) return respond(413, { error: 'Request body too large' }, teacherId);

      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') return respond(400, { error: 'Request body must be a JSON object' }, teacherId);

      const { sourceId, questionCount, topicTag, range, unitPlanId } = body;
      if (typeof sourceId !== 'string' || !sourceId.trim()) {
        return respond(400, { error: 'sourceId is required' }, teacherId);
      }
      if (!Number.isInteger(questionCount) || questionCount < MIN_QUESTIONS || questionCount > MAX_QUESTIONS) {
        return respond(400, { error: `questionCount must be an integer between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}` }, teacherId);
      }
      if (topicTag !== undefined && topicTag !== null && !isValidTopicTag(topicTag)) {
        return respond(400, { error: 'topicTag is not a recognised topic' }, teacherId);
      }

      const source = await readOwnDoc(sourcesContainer, sourceId, teacherId);
      if (!source) return respond(400, { error: SOURCE_EXPIRED_MESSAGE }, teacherId);

      let resolvedRange = null;
      if (range !== undefined && range !== null) {
        const { start: rStart, end: rEnd } = range;
        if (!Number.isInteger(rStart) || !Number.isInteger(rEnd) || rStart < 0 || rEnd < rStart || rEnd >= source.chunkCount) {
          return respond(400, { error: 'range is outside the bounds of this document' }, teacherId);
        }
        resolvedRange = { start: rStart, end: rEnd };
      }

      // Quotas
      const generationsToday = await countCreatedToday(draftsContainer, teacherId);
      if (generationsToday >= MAX_GENERATIONS_PER_DAY) {
        return respond(429, { error: "You've reached your daily generation limit. Try again tomorrow." }, teacherId);
      }
      const { resources: draftStatusCount } = await draftsContainer.items.query({
        query: "SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND c.status = 'draft'",
        parameters: [{ name: '@tid', value: teacherId }],
      }).fetchAll();
      if ((draftStatusCount[0] || 0) >= MAX_DRAFT_STATUS_DRAFTS) {
        return respond(429, { error: 'You have too many unreviewed drafts. Approve or discard one first.' }, teacherId);
      }

      let generated;
      try {
        generated = await generateDraft({ context, sourceId, chunks: source.chunks, questionCount, range: resolvedRange, topicTag });
      } catch (err) {
        if (err instanceof MissingProviderKeyError) return respond(503, { error: err.message }, teacherId);
        if (err instanceof InsufficientContentError) return respond(502, { error: err.message }, teacherId);
        context.error('generateDraft error:', err.message);
        return respond(502, { error: "We couldn't create a draft from this document. Try again." }, teacherId);
      }

      const validation = validateDraftQuestions(generated.questions, { chunkCount: source.chunkCount });
      if (!validation.valid) {
        context.error('generated draft failed schema validation', JSON.stringify(validation.errors));
        return respond(502, { error: 'The draft could not be generated correctly. Try again.' }, teacherId);
      }

      const draftId = require('crypto').randomUUID();
      const now = new Date().toISOString();
      const draft = {
        id: draftId,
        teacherId,
        sourceId,
        sourceKind: source.kind,
        chunkPageMap: Object.fromEntries(source.chunks.map(c => [c.index, c.page ?? null])),
        unitPlanId: typeof unitPlanId === 'string' ? unitPlanId : null,
        topicTag: topicTag || null,
        range: resolvedRange,
        provider: generated.provider,
        pagesUsed: generated.pagesUsed,
        questions: generated.questions.map(q => ({ ...q, reviewed: false })),
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
      await draftsContainer.items.create(draft);

      return respond(201, draft, teacherId);
    } catch (err) {
      context.error('generationDrafts error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

app.http('generationDraftById', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  route: 'generation/drafts/{id}',
  handler: async (request, context) => {
    const start = Date.now();
    const method = request.method;
    const id = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'generation/drafts/:id', method, status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      const draft = await readOwnDoc(draftsContainer, id, teacherId);
      if (!draft) return respond(404, { error: 'Draft not found' }, teacherId);

      if (method === 'GET') return respond(200, draft, teacherId);

      // PUT — edit questions (including per-question reviewed flags).
      if (draft.status !== 'draft') {
        return respond(400, { error: 'This draft has already been approved' }, teacherId);
      }
      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 131072) return respond(413, { error: 'Request body too large' }, teacherId);

      const body = await request.json().catch(() => null);
      if (!body || !Array.isArray(body.questions)) {
        return respond(400, { error: 'questions array is required' }, teacherId);
      }

      const chunkCount = Object.keys(draft.chunkPageMap || {}).length;
      const validation = validateDraftQuestions(body.questions, { chunkCount });
      if (!validation.valid) {
        return respond(400, { error: 'One or more questions are invalid', details: validation.errors }, teacherId);
      }

      const updated = {
        ...draft,
        questions: body.questions.map(q => ({ ...q, reviewed: q.reviewed === true })),
        updatedAt: new Date().toISOString(),
      };
      await draftsContainer.items.upsert(updated);
      return respond(200, updated, teacherId);
    } catch (err) {
      context.error('generationDraftById error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

app.http('generationDraftRegenerateQuestion', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'generation/drafts/{id}/regenerate-question',
  handler: async (request, context) => {
    const start = Date.now();
    const id = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'generation/drafts/:id/regenerate-question', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      const draft = await readOwnDoc(draftsContainer, id, teacherId);
      if (!draft) return respond(404, { error: 'Draft not found' }, teacherId);
      if (draft.status !== 'draft') return respond(400, { error: 'This draft has already been approved' }, teacherId);

      const body = await request.json().catch(() => null);
      const questionIndex = body && body.questionIndex;
      if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= draft.questions.length) {
        return respond(400, { error: 'questionIndex is out of range' }, teacherId);
      }

      const allowed = await checkAndIncrRegenQuota(teachersContainer, teacherId, MAX_REGENERATIONS_PER_DAY);
      if (!allowed) return respond(429, { error: "You've reached your daily regeneration limit. Try again tomorrow." }, teacherId);

      const source = await readOwnDoc(sourcesContainer, draft.sourceId, teacherId);
      if (!source) return respond(400, { error: SOURCE_EXPIRED_MESSAGE }, teacherId);

      let generated;
      try {
        generated = await generateDraft({ context, sourceId: draft.sourceId, chunks: source.chunks, questionCount: 1, range: draft.range, topicTag: draft.topicTag });
      } catch (err) {
        if (err instanceof MissingProviderKeyError) return respond(503, { error: err.message }, teacherId);
        if (err instanceof InsufficientContentError) return respond(502, { error: err.message }, teacherId);
        context.error('regenerate-question generateDraft error:', err.message);
        return respond(502, { error: "We couldn't regenerate this question. Try again." }, teacherId);
      }

      const newQuestion = generated.questions[0];
      const errors = validateQuestionShape(newQuestion, 0, { chunkCount: Object.keys(draft.chunkPageMap || {}).length });
      if (errors.length > 0) {
        context.error('regenerated question failed schema validation', JSON.stringify(errors));
        return respond(502, { error: "We couldn't regenerate this question. Try again." }, teacherId);
      }

      const updatedQuestions = draft.questions.slice();
      updatedQuestions[questionIndex] = { ...newQuestion, reviewed: false }; // regenerating resets the tick
      const updated = { ...draft, questions: updatedQuestions, updatedAt: new Date().toISOString() };
      await draftsContainer.items.upsert(updated);

      return respond(200, { question: updatedQuestions[questionIndex] }, teacherId);
    } catch (err) {
      context.error('generationDraftRegenerateQuestion error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

app.http('generationDraftApprove', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'generation/drafts/{id}/approve',
  handler: async (request, context) => {
    const start = Date.now();
    const id = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'generation/drafts/:id/approve', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      const draft = await readOwnDoc(draftsContainer, id, teacherId);
      if (!draft) return respond(404, { error: 'Draft not found' }, teacherId);
      if (draft.status !== 'draft') return respond(400, { error: 'This draft has already been approved' }, teacherId);

      // E5 — server-side enforcement, never trusts a client-claimed "all reviewed" flag.
      const allReviewed = draft.questions.every(q => q.reviewed === true);
      if (!allReviewed) {
        return respond(400, { error: 'Review every question before approving' }, teacherId);
      }

      // Pre-check caps BEFORE writing anything (§3.1/§3.9).
      const [{ resources: qCount }, { resources: quizCount }] = await Promise.all([
        questionsContainer.items.query({
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid',
          parameters: [{ name: '@tid', value: teacherId }],
        }).fetchAll(),
        quizzesContainer.items.query({
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid',
          parameters: [{ name: '@tid', value: teacherId }],
        }).fetchAll(),
      ]);
      if ((qCount[0] || 0) + draft.questions.length > MAX_QUESTIONS_PER_TEACHER) {
        return respond(429, { error: 'Approving this draft would exceed your question bank limit.' }, teacherId);
      }
      if ((quizCount[0] || 0) + 1 > MAX_QUIZZES_PER_TEACHER) {
        return respond(429, { error: 'Approving this draft would exceed your quiz limit.' }, teacherId);
      }

      // Materialise: deterministic ids + sequential 409-tolerant creates (§3.8) — a retried
      // approve after a partial failure just no-ops on the docs that already exist.
      const questionIds = [];
      for (let i = 0; i < draft.questions.length; i++) {
        const q = draft.questions[i];
        const qid = questionIdForDraft(draft.id, i);
        questionIds.push(qid);
        const questionDoc = {
          id: qid,
          teacherId,
          authorId: teacherId,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          topic: q.topicTag || draft.topicTag || 'Other',
          visibility: 'private',
          generatedBy: 'ai',
          sourceId: draft.sourceId,
          sourceRef: q.sourceRef || null,
          sourceRefLabel: resolveSourceRefLabel(q.sourceRef, draft.chunkPageMap, draft.sourceKind),
          createdAt: new Date().toISOString(),
        };
        try {
          await questionsContainer.items.create(questionDoc);
        } catch (err) {
          if (err.code !== 409) throw err;
        }
      }

      let resolvedSchoolId = null;
      if (draft.topicTag) {
        try {
          const { resource: teacherDoc } = await teachersContainer.item(teacherId, teacherId).read();
          resolvedSchoolId = teacherDoc?.schoolId || null;
        } catch (_) { /* leave null */ }
      }

      const quizId = quizIdForDraft(draft.id);
      const quizDoc = {
        id: quizId,
        teacherId,
        name: `AI Quiz — ${draft.topicTag || 'Draft'} — ${new Date().toISOString().slice(0, 10)}`,
        questionIds,
        classIds: [],
        classSize: 0,
        status: 'draft',
        sentAt: null,
        closedAt: null,
        scheduledFor: null,
        durationMinutes: null,
        isDemo: false,
        topicTag: draft.topicTag || null,
        schoolId: resolvedSchoolId,
        draftId: draft.id,
        sourceId: draft.sourceId,
        createdAt: new Date().toISOString(),
      };
      try {
        await quizzesContainer.items.create(quizDoc);
      } catch (err) {
        if (err.code !== 409) throw err;
      }

      // Draft marked approved LAST — if anything above failed and this line never runs, the
      // draft stays 'draft' and a retry is safe (every write above is idempotent).
      await draftsContainer.items.upsert({ ...draft, status: 'approved', updatedAt: new Date().toISOString() });

      return respond(200, { quizId, questionIds }, teacherId);
    } catch (err) {
      context.error('generationDraftApprove error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

app.http('generationExpand', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'generation/expand',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'generation/expand', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`generation-expand:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const body = await request.json().catch(() => null);
      const { quizId, focusQuestionIds } = body || {};
      if (typeof quizId !== 'string' || !quizId.trim()) return respond(400, { error: 'quizId is required' }, teacherId);

      const quiz = await readOwnDoc(quizzesContainer, quizId, teacherId);
      if (!quiz) return respond(404, { error: 'Quiz not found' }, teacherId);
      if (!quiz.sourceId) return respond(400, { error: 'This quiz has no linked source material to expand from' }, teacherId);

      // Lineage survives cleanup and expiry (§5.6): liveness is checked HERE, on click — never
      // gating whether the nudge/button render in the first place.
      const source = await readOwnDoc(sourcesContainer, quiz.sourceId, teacherId);
      if (!source) return respond(400, { error: SOURCE_EXPIRED_MESSAGE }, teacherId);

      const generationsToday = await countCreatedToday(draftsContainer, teacherId);
      if (generationsToday >= MAX_GENERATIONS_PER_DAY) {
        return respond(429, { error: "You've reached your daily generation limit. Try again tomorrow." }, teacherId);
      }

      // Resolve focus chunks from the materialised questions' own sourceRefs — the draft doc is
      // NOT required (it may have been discarded), so draft cleanup never kills this loop.
      let focusChunkIndexes = [];
      if (Array.isArray(focusQuestionIds) && focusQuestionIds.length > 0) {
        const idParams = focusQuestionIds.map((qid, i) => ({ name: `@qid${i}`, value: qid }));
        const idList = idParams.map(p => p.name).join(', ');
        const { resources: focusQuestions } = await questionsContainer.items.query({
          query: `SELECT c.sourceRef FROM c WHERE c.id IN (${idList}) AND c.teacherId = @tid`,
          parameters: [...idParams, { name: '@tid', value: teacherId }],
        }).fetchAll();
        focusChunkIndexes = [...new Set(focusQuestions.flatMap(q => q.sourceRef || []))];
      }

      const chunks = focusChunkIndexes.length > 0
        ? source.chunks.filter(c => focusChunkIndexes.includes(c.index))
        : source.chunks;

      const questionCount = 5;
      let generated;
      try {
        generated = await generateDraft({ context, sourceId: quiz.sourceId, chunks, questionCount, topicTag: quiz.topicTag });
      } catch (err) {
        if (err instanceof MissingProviderKeyError) return respond(503, { error: err.message }, teacherId);
        if (err instanceof InsufficientContentError) return respond(502, { error: err.message }, teacherId);
        context.error('expand generateDraft error:', err.message);
        return respond(502, { error: "We couldn't create follow-up practice from this document. Try again." }, teacherId);
      }

      const validation = validateDraftQuestions(generated.questions, { chunkCount: source.chunkCount });
      if (!validation.valid) {
        context.error('expand draft failed schema validation', JSON.stringify(validation.errors));
        return respond(502, { error: "We couldn't create follow-up practice from this document. Try again." }, teacherId);
      }

      const draftId = require('crypto').randomUUID();
      const now = new Date().toISOString();
      const draft = {
        id: draftId,
        teacherId,
        sourceId: quiz.sourceId,
        sourceKind: source.kind,
        chunkPageMap: Object.fromEntries(source.chunks.map(c => [c.index, c.page ?? null])),
        unitPlanId: null,
        topicTag: quiz.topicTag || null,
        range: null,
        provider: generated.provider,
        pagesUsed: generated.pagesUsed,
        questions: generated.questions.map(q => ({ ...q, reviewed: false })),
        status: 'draft',
        expandedFromQuizId: quiz.id,
        createdAt: now,
        updatedAt: now,
      };
      await draftsContainer.items.create(draft);

      return respond(201, draft, teacherId);
    } catch (err) {
      context.error('generationExpand error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
