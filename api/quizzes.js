const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher, extractBearer } = require('./auth');
const { assertScope, ScopeError } = require('./shared/authz');
const { isValidTopicTag } = require('./shared/topicTags');
const { cloneIdForQuiz } = require('./shared/materializeAi');
const { sendNotificationForQuiz } = require('./sendNotification');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const questionsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');
const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');

const MIN_QUIZ_DURATION_MS = 5 * 60 * 1000;     // Security limits table — Quiz min duration (closedAt), 5 min
const MAX_PENDING_SCHEDULED = 50;                // Security limits table — Scheduled quizzes pending, 50 per teacher
const MAX_SPACED_REPEATS = 5;                    // Security limits table — Spaced-repeat entries per action (E3)

// GET /api/quizzes/{id}/questions — public, used by the student quiz-taking screen.
// Returns question text/options only (never correctIndex) so the answer key isn't exposed
// in the network response to students.
app.http('getQuizQuestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'quizzes/{id}/questions',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body) {
      logRequest(context, { endpoint: 'quizzes/:id/questions', method: 'GET', status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }
    try {
      if (!rateLimit(`quiz-questions:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' });
      }

      const id = request.params.id;
      const { resources: quizMatches } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      }).fetchAll();

      if (quizMatches.length === 0) return respond(404, { error: 'Quiz not found' });
      const quiz = quizMatches[0];

      const questionIds = quiz.questionIds || [];
      if (questionIds.length === 0) return respond(200, []);

      const idParams = questionIds.map((qid, i) => ({ name: `@qid${i}`, value: qid }));
      const idList = idParams.map(p => p.name).join(', ');
      const { resources: questions } = await questionsContainer.items.query({
        query: `SELECT c.id, c.text, c.options FROM c WHERE c.id IN (${idList})`,
        parameters: idParams,
      }).fetchAll();

      const byId = new Map(questions.map(q => [q.id, q]));
      const ordered = questionIds.map(qid => byId.get(qid)).filter(Boolean);

      return respond(200, ordered);
    } catch (err) {
      context.error('getQuizQuestions error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

app.http('getQuizById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'quizzes/{id}',
  handler: async (request, context) => {
    const start = Date.now()

    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'quizzes/:id', method: 'GET', status, durationMs: Date.now() - start, teacherId })
      return { status, jsonBody: body }
    }

    try {
      const id = request.params.id;

      // If a teacher token is present, validate it and enforce ownership. Student quiz-taking
      // (no token, Sprint 4) is allowed through to read the quiz.
      let teacherId = null
      if (extractBearer(request)) {
        const auth = await authenticateTeacher(request)
        if (auth.error) return respond(auth.status, { error: auth.error })
        teacherId = auth.teacherId
      }

      const { resources } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      }).fetchAll();

      if (resources.length === 0) {
        return respond(404, { error: 'Quiz not found' }, teacherId)
      }

      const quiz = resources[0];

      if (teacherId) {
        try {
          assertScope(quiz, { teacherId })
        } catch (err) {
          if (err instanceof ScopeError) return respond(404, { error: 'Quiz not found' }, teacherId)
          throw err
        }
      }

      return respond(200, quiz, teacherId)
    } catch (err) {
      context.error('quizzes error:', err.message);
      logRequest(context, { endpoint: 'quizzes/:id', method: 'GET', status: 500, durationMs: Date.now() - start })
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});

app.http('quizzes', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const start = Date.now()
    const method = request.method

    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'quizzes', method, status, durationMs: Date.now() - start, teacherId })
      return { status, jsonBody: body }
    }

    try {
      const auth = await authenticateTeacher(request)
      if (auth.error) return respond(auth.status, { error: auth.error })
      const teacherId = auth.teacherId

      if (method === 'GET') {
        const { resources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.teacherId = @teacherId',
          parameters: [{ name: '@teacherId', value: teacherId }]
        }).fetchAll();

        return respond(200, resources, teacherId)
      }

      if (method === 'POST') {
        const ip = getClientIp(request);
        if (!rateLimit(`quizzes:${ip}`, 10, 60000)) {
          return respond(429, { error: 'Too many requests. Please try again later.' })
        }

        const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
        if (contentLength > 65536) {
          return respond(413, { error: 'Request body too large. Maximum size is 64KB' })
        }

        const body = await request.json();

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return respond(400, { error: 'Request body must be a JSON object' })
        }

        const { name, questionIds, classIds, classSize, status, durationMinutes, scheduledFor, topicTag } = body;
        const ALLOWED_STATUSES = ['draft', 'sent', 'scheduled'];

        // topicTag is OPTIONAL (design addendum D3 — the 12-preset taxonomy doesn't cover every
        // Year 7-12 subject, so it must never block send). Omitted -> quiz just doesn't
        // contribute to population benchmarking (see api/analyticsPopulation.js).
        if (topicTag !== undefined && topicTag !== null && !isValidTopicTag(topicTag)) {
          return respond(400, { error: 'topicTag is not a recognised topic' }, teacherId)
        }

        if (typeof name !== 'string' || !name.trim()) {
          return respond(400, { error: 'name is required and must be a string' }, teacherId)
        }
        if (name.trim().length > 200) {
          return respond(400, { error: 'name must be 200 characters or fewer' }, teacherId)
        }
        if (!Array.isArray(questionIds) || questionIds.length === 0) {
          return respond(400, { error: 'questionIds must be a non-empty array' }, teacherId)
        }
        if (questionIds.length > 50) {
          return respond(400, { error: 'questionIds must contain 50 items or fewer' }, teacherId)
        }
        if (questionIds.some(id => typeof id !== 'string' || !id.trim())) {
          return respond(400, { error: 'each questionId must be a non-empty string' }, teacherId)
        }
        if (classIds !== undefined && !Array.isArray(classIds)) {
          return respond(400, { error: 'classIds must be an array' }, teacherId)
        }
        if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
          return respond(400, { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` }, teacherId)
        }

        const resolvedStatus = status || 'draft';

        // closedAt — derived from a teacher-configured duration, enforced server-side at >= 5 minutes.
        // sentAt is server-set, never taken from the body: deriving closedAt from a client-supplied
        // timestamp would let a crafted sentAt hold the quiz open past its duration (and a malformed
        // one made toISOString() throw a 500).
        let closedAt = null;
        let resolvedSentAt = null;
        if (resolvedStatus === 'sent') {
          const minutes = typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) ? durationMinutes : null;
          if (minutes === null || minutes * 60000 < MIN_QUIZ_DURATION_MS) {
            return respond(400, { error: 'durationMinutes is required and must be at least 5 minutes' }, teacherId)
          }
          resolvedSentAt = new Date().toISOString();
          closedAt = new Date(Date.now() + minutes * 60000).toISOString();
        }

        // scheduledFor — validated and capped at 50 pending scheduled quizzes per teacher.
        let resolvedScheduledFor = null;
        if (resolvedStatus === 'scheduled') {
          if (typeof scheduledFor !== 'string' || isNaN(new Date(scheduledFor).getTime())) {
            return respond(400, { error: 'scheduledFor is required and must be a valid date for scheduled quizzes' }, teacherId)
          }
          if (new Date(scheduledFor).getTime() <= Date.now()) {
            return respond(400, { error: 'scheduledFor must be in the future' }, teacherId)
          }

          const { resources: pendingCount } = await container.items.query({
            query: "SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND c.status = 'scheduled'",
            parameters: [{ name: '@tid', value: teacherId }]
          }).fetchAll();
          if ((pendingCount[0] || 0) >= MAX_PENDING_SCHEDULED) {
            return respond(429, { error: `You can have at most ${MAX_PENDING_SCHEDULED} pending scheduled quizzes.` }, teacherId)
          }

          resolvedScheduledFor = scheduledFor;
        }

        const resolvedClassIds = Array.isArray(classIds) ? classIds.map(id => String(id).trim().slice(0, 100)) : [];

        // schoolId is resolved server-side from the teacher's own record — never trusted from the
        // client, and never read from JWT claims (those default to null until the Entra custom
        // claim described in docs/azure/ROLE_CLAIMS_SETUP.md is configured). Only looked up when a
        // topic was actually selected, since it's only used for population benchmarking.
        let resolvedSchoolId = null;
        if (topicTag) {
          try {
            const { resource: teacherDoc } = await teachersContainer.item(teacherId, teacherId).read();
            resolvedSchoolId = teacherDoc?.schoolId || null;
          } catch (_) { /* teacher doc missing or point-read failed — leave schoolId null */ }
        }

        // A quiz targeting a demo class is itself a demo quiz: send-notification simulates rather
        // than pushing, and analytics renders the "Demo data" pill. Resolved at create time so the
        // send path (manual + scheduled) and analytics never have to re-derive it.
        let isDemoQuiz = false;
        if (resolvedClassIds.length > 0) {
          const cParams = resolvedClassIds.map((id, i) => ({ name: `@c${i}`, value: id }));
          const cList = cParams.map(p => p.name).join(', ');
          const { resources: cls } = await classesContainer.items.query({
            query: `SELECT c.id, c.isDemo FROM c WHERE c.id IN (${cList})`,
            parameters: cParams,
          }).fetchAll();
          isDemoQuiz = cls.some(c => c.isDemo === true);
        }

        const quiz = {
          id: require('crypto').randomUUID(),
          teacherId,
          name: name.trim(),
          questionIds: questionIds.map(id => id.trim()),
          classIds: resolvedClassIds,
          classSize: typeof classSize === 'number' && Number.isInteger(classSize) && classSize >= 0 ? classSize : 0,
          status: resolvedStatus,
          sentAt: resolvedSentAt,
          closedAt,
          scheduledFor: resolvedScheduledFor,
          durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : null,
          isDemo: isDemoQuiz,
          topicTag: topicTag || null,
          schoolId: resolvedSchoolId,
          createdAt: new Date().toISOString()
        };

        const { resource } = await container.items.create(quiz);

        // Best-effort: increment usageCount on each referenced question (fire-and-forget)
        const uniqueIds = [...new Set(quiz.questionIds)];
        Promise.all(uniqueIds.map(async (qid) => {
          try {
            const { resources: qMatches } = await questionsContainer.items.query({
              query: 'SELECT * FROM c WHERE c.id = @id',
              parameters: [{ name: '@id', value: qid }]
            }).fetchAll();
            if (qMatches.length > 0) {
              const q = qMatches[0];
              await questionsContainer.items.upsert({ ...q, usageCount: (q.usageCount || 0) + 1 });
            }
          } catch (_) { /* non-fatal */ }
        })).catch(() => {});

        return respond(201, resource, quiz.teacherId)
      }

      return respond(405, { error: 'Method not allowed' })

    } catch (err) {
      context.error('quizzes error:', err.message);
      logRequest(context, { endpoint: 'quizzes', method, status: 500, durationMs: Date.now() - start })
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});

// POST /api/quizzes/{id}/send — the v4.3.0 send-transition endpoint. Every draft-status quiz
// (AI-generated approvals, and per E3 any manual quiz that wants spaced repeats) goes through
// SendQuiz, which calls this. Classes/duration are chosen here, exactly like any quiz always has
// been — one send path for generated and manual quizzes (CEO review addendum §3.1/§5.1).
app.http('sendQuizTransition', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'quizzes/{id}/send',
  handler: async (request, context) => {
    const start = Date.now();
    const id = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'quizzes/:id/send', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`quiz-send:${getClientIp(request)}`, 10, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const { resources: matches } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }],
      }).fetchAll();
      if (matches.length === 0) return respond(404, { error: 'Quiz not found' }, teacherId);
      let quiz;
      try {
        quiz = assertScope(matches[0], { teacherId }, { mutate: true });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Quiz not found' }, teacherId);
        throw err;
      }

      if (quiz.status !== 'draft') {
        return respond(400, { error: 'This quiz has already been sent or scheduled' }, teacherId);
      }

      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') return respond(400, { error: 'Request body must be a JSON object' }, teacherId);

      const { classIds, durationMinutes, mode, scheduledFor, spacedRepeats } = body;
      if (mode !== 'now' && mode !== 'schedule') {
        return respond(400, { error: "mode must be 'now' or 'schedule'" }, teacherId);
      }
      const minutes = typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) ? durationMinutes : null;
      if (minutes === null || minutes * 60000 < MIN_QUIZ_DURATION_MS) {
        return respond(400, { error: 'durationMinutes is required and must be at least 5 minutes' }, teacherId);
      }
      if (classIds !== undefined && !Array.isArray(classIds)) {
        return respond(400, { error: 'classIds must be an array' }, teacherId);
      }

      let offsets = [];
      if (spacedRepeats !== undefined && spacedRepeats !== null) {
        if (!Array.isArray(spacedRepeats) || spacedRepeats.length > MAX_SPACED_REPEATS) {
          return respond(400, { error: `spacedRepeats must be an array of at most ${MAX_SPACED_REPEATS} entries` }, teacherId);
        }
        if (spacedRepeats.some(d => !Number.isInteger(d) || d < 1 || d > 365)) {
          return respond(400, { error: 'each spacedRepeats entry must be an integer number of days between 1 and 365' }, teacherId);
        }
        offsets = spacedRepeats;
      }

      const resolvedClassIds = Array.isArray(classIds) ? classIds.map(cid => String(cid).trim().slice(0, 100)) : [];

      // Recompute isDemo + classSize from the classes actually chosen at send time — a
      // draft-status AI quiz has no classIds until now. classSize is derived from the real class
      // docs' studentCount server-side, never trusted from the client (the original POST
      // /api/quizzes accepted a client-supplied classSize; this endpoint doesn't repeat that).
      let isDemoQuiz = false;
      let resolvedClassSize = 0;
      if (resolvedClassIds.length > 0) {
        const cParams = resolvedClassIds.map((cid, i) => ({ name: `@c${i}`, value: cid }));
        const cList = cParams.map(p => p.name).join(', ');
        const { resources: cls } = await classesContainer.items.query({
          query: `SELECT c.id, c.isDemo, c.studentCount FROM c WHERE c.id IN (${cList})`,
          parameters: cParams,
        }).fetchAll();
        isDemoQuiz = cls.some(c => c.isDemo === true);
        resolvedClassSize = cls.reduce((sum, c) => sum + (c.studentCount || 0), 0);
      }

      // Anchor is computed BEFORE any writes so clones can be created first — the parent is
      // marked sent/scheduled LAST (§3.8 idempotency: a retry after a partial failure re-attempts
      // clone creates, which 409-tolerate on anything already written, then reaches the final
      // parent write it never got to).
      let anchorDate, sentAt = null, closedAt = null, scheduledForValue = null, newStatus;
      if (mode === 'now') {
        anchorDate = new Date();
        sentAt = anchorDate.toISOString();
        closedAt = new Date(anchorDate.getTime() + minutes * 60000).toISOString();
        newStatus = 'sent';
      } else {
        if (typeof scheduledFor !== 'string' || isNaN(new Date(scheduledFor).getTime())) {
          return respond(400, { error: 'scheduledFor is required and must be a valid date for scheduled sends' }, teacherId);
        }
        anchorDate = new Date(scheduledFor);
        if (anchorDate.getTime() <= Date.now()) {
          return respond(400, { error: 'scheduledFor must be in the future' }, teacherId);
        }
        scheduledForValue = scheduledFor;
        newStatus = 'scheduled';

        const { resources: pendingCount } = await container.items.query({
          query: "SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND c.status = 'scheduled'",
          parameters: [{ name: '@tid', value: teacherId }],
        }).fetchAll();
        // +1 for this quiz itself going scheduled, plus every clone about to be created — all of
        // them count toward the same pending cap (E3).
        if ((pendingCount[0] || 0) + 1 + offsets.length > MAX_PENDING_SCHEDULED) {
          return respond(429, { error: `You can have at most ${MAX_PENDING_SCHEDULED} pending scheduled quizzes.` }, teacherId);
        }
      }

      let clonesCreated = 0;
      for (let i = 0; i < offsets.length; i++) {
        const cloneScheduledFor = new Date(anchorDate.getTime() + offsets[i] * 86400000).toISOString();
        const cloneDoc = {
          id: cloneIdForQuiz(quiz.id, i),
          teacherId,
          name: quiz.name,
          questionIds: quiz.questionIds,
          classIds: resolvedClassIds,
          classSize: resolvedClassSize,
          status: 'scheduled',
          sentAt: null,
          closedAt: null,
          scheduledFor: cloneScheduledFor,
          durationMinutes: minutes,
          isDemo: isDemoQuiz,
          topicTag: quiz.topicTag || null,
          schoolId: quiz.schoolId || null,
          parentQuizId: quiz.id,
          draftId: quiz.draftId || null,
          sourceId: quiz.sourceId || null,
          createdAt: new Date().toISOString(),
        };
        try {
          await container.items.create(cloneDoc);
          clonesCreated++;
        } catch (err) {
          if (err.code === 409) continue; // already created by a prior retry
          throw err;
        }
      }

      const updatedQuiz = {
        ...quiz,
        classIds: resolvedClassIds,
        classSize: resolvedClassSize,
        durationMinutes: minutes,
        status: newStatus,
        sentAt,
        closedAt,
        scheduledFor: scheduledForValue,
        isDemo: isDemoQuiz,
      };
      await container.items.upsert(updatedQuiz);

      if (mode === 'now') {
        const result = await sendNotificationForQuiz(updatedQuiz, context);
        if (result.error) context.warn(`send-transition push for quiz ${quiz.id} failed: ${result.error}`);
      }

      return respond(200, { quiz: updatedQuiz, clonesCreated }, teacherId);
    } catch (err) {
      context.error('sendQuizTransition error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
