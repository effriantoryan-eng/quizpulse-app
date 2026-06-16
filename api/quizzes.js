const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher, extractBearer } = require('./auth');
const { assertScope, ScopeError } = require('./shared/authz');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const questionsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);

const MIN_QUIZ_DURATION_MS = 5 * 60 * 1000;     // Security limits table — Quiz min duration (closedAt), 5 min
const MAX_PENDING_SCHEDULED = 50;                // Security limits table — Scheduled quizzes pending, 50 per teacher

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

        const { name, questionIds, classIds, classSize, status, sentAt, durationMinutes, scheduledFor } = body;
        const ALLOWED_STATUSES = ['draft', 'sent', 'scheduled'];

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
        let closedAt = null;
        if (resolvedStatus === 'sent') {
          const minutes = typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) ? durationMinutes : null;
          if (minutes === null || minutes * 60000 < MIN_QUIZ_DURATION_MS) {
            return respond(400, { error: 'durationMinutes is required and must be at least 5 minutes' }, teacherId)
          }
          const base = sentAt ? new Date(sentAt) : new Date();
          closedAt = new Date(base.getTime() + minutes * 60000).toISOString();
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

        const quiz = {
          id: require('crypto').randomUUID(),
          teacherId,
          name: name.trim(),
          questionIds: questionIds.map(id => id.trim()),
          classIds: Array.isArray(classIds) ? classIds.map(id => String(id).trim().slice(0, 100)) : [],
          classSize: typeof classSize === 'number' && Number.isInteger(classSize) && classSize >= 0 ? classSize : 0,
          status: resolvedStatus,
          sentAt: sentAt || null,
          closedAt,
          scheduledFor: resolvedScheduledFor,
          durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : null,
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
