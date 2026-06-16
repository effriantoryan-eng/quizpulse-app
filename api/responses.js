const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { getCallerScope, assertScope, ScopeError } = require('./shared/authz');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER_RESPONSES);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');

const MAX_RESPONSE_BODY = 4 * 1024; // Security limits table — Response body size, 4 KB max

app.http('responses', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const start = Date.now()
    const method = request.method

    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'responses', method, status, durationMs: Date.now() - start, teacherId })
      return { status, jsonBody: body }
    }

    try {
      if (method === 'GET') {
        // Teacher-only — this returns raw student answers, so it requires the same
        // ownership check as /api/analytics. (Sprint 5 security audit: previously this
        // endpoint had no auth check at all.)
        const auth = await authenticateTeacher(request)
        if (auth.error) return respond(auth.status, { error: auth.error })
        const caller = getCallerScope(auth.claims)

        if (!rateLimit(`responses-get:${getClientIp(request)}`, 30, 60000)) {
          return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId)
        }

        const quizId = new URL(request.url).searchParams.get('quizId');
        if (!quizId) {
          return respond(400, { error: 'quizId is required' }, caller.teacherId)
        }

        const { resources: quizMatches } = await quizzesContainer.items.query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: quizId }]
        }).fetchAll();
        if (quizMatches.length === 0) return respond(404, { error: 'Quiz not found' }, caller.teacherId)

        try {
          assertScope(quizMatches[0], caller)
        } catch (err) {
          if (err instanceof ScopeError) return respond(404, { error: 'Quiz not found' }, caller.teacherId)
          throw err
        }

        const { resources } = await container.items
          .query({ query: 'SELECT * FROM c WHERE c.quizId = @quizId', parameters: [{ name: '@quizId', value: quizId }] })
          .fetchAll();

        return respond(200, resources, caller.teacherId)
      }

      if (method === 'POST') {
        const ip = getClientIp(request);
        if (!rateLimit(`responses:${ip}`, 5, 60000)) {
          return respond(429, { error: 'Too many requests. Please try again later.' })
        }

        const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
        if (contentLength > MAX_RESPONSE_BODY) {
          return respond(413, { error: 'Request body too large. Maximum size is 4KB' })
        }

        const rawBody = await request.text();
        if (Buffer.byteLength(rawBody, 'utf8') > MAX_RESPONSE_BODY) {
          return respond(413, { error: 'Request body too large. Maximum size is 4KB' })
        }

        let body;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return respond(400, { error: 'Request body must be valid JSON' })
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return respond(400, { error: 'Request body must be a JSON object' })
        }

        const { quizId, answers, studentId } = body;

        if (typeof quizId !== 'string' || !quizId.trim()) {
          return respond(400, { error: 'quizId is required and must be a string' })
        }
        if (typeof studentId !== 'string' || !studentId.trim()) {
          return respond(400, { error: 'studentId is required and must be a string' })
        }
        if (!Array.isArray(answers) || answers.length === 0) {
          return respond(400, { error: 'answers must be a non-empty array' })
        }
        if (answers.length > 50) {
          return respond(400, { error: 'answers must contain 50 items or fewer' })
        }
        for (const answer of answers) {
          if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
            return respond(400, { error: 'each answer must be an object' })
          }
          if (typeof answer.questionId !== 'string' || !answer.questionId.trim()) {
            return respond(400, { error: 'each answer must have a questionId string' })
          }
          if (typeof answer.selectedIndex !== 'number' || !Number.isInteger(answer.selectedIndex) || answer.selectedIndex < 0 || answer.selectedIndex > 3) {
            return respond(400, { error: 'each answer.selectedIndex must be an integer between 0 and 3' })
          }
        }

        const resolvedQuizId = quizId.trim();
        const resolvedStudentId = studentId.trim().slice(0, 100);

        // Look up the quiz to enforce closedAt and resolve its target classes.
        const { resources: quizMatches } = await quizzesContainer.items.query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: resolvedQuizId }]
        }).fetchAll();

        if (quizMatches.length === 0) {
          return respond(404, { error: 'Quiz not found' })
        }
        const quiz = quizMatches[0];

        if (quiz.closedAt && new Date(quiz.closedAt).getTime() < Date.now()) {
          return respond(410, { error: 'This quiz has closed.' })
        }

        // The student (identified by deviceId) must hold an approved join request for
        // at least one of the quiz's target classes.
        const classIds = Array.isArray(quiz.classIds) ? quiz.classIds : [];
        let hasApproval = false;
        if (classIds.length > 0) {
          const classIdParams = classIds.map((id, i) => ({ name: `@cid${i}`, value: id }));
          const classIdList = classIdParams.map(p => p.name).join(', ');
          const { resources: approved } = await joinRequestsContainer.items.query({
            query: `SELECT TOP 1 c.id FROM c WHERE c.deviceId = @did AND c.status = "approved" AND c.classId IN (${classIdList})`,
            parameters: [{ name: '@did', value: resolvedStudentId }, ...classIdParams]
          }).fetchAll();
          hasApproval = approved.length > 0;
        }
        if (!hasApproval) {
          return respond(403, { error: 'You do not have an approved join request for this quiz\'s class' })
        }

        // Idempotency check — prevent duplicate submissions for the same student + quiz
        const { resources: existing } = await container.items.query({
          query: 'SELECT c.id FROM c WHERE c.quizId = @quizId AND c.studentId = @studentId',
          parameters: [
            { name: '@quizId', value: resolvedQuizId },
            { name: '@studentId', value: resolvedStudentId }
          ]
        }).fetchAll();

        if (existing.length > 0) {
          return respond(409, { error: 'You have already submitted a response for this quiz' })
        }

        const response = {
          id: require('crypto').randomUUID(),
          quizId: resolvedQuizId,
          studentId: resolvedStudentId,
          answers: answers.map(a => ({ questionId: a.questionId.trim(), selectedIndex: a.selectedIndex })),
          completedAt: new Date().toISOString()
        };

        const { resource } = await container.items.create(response);
        return respond(201, resource)
      }

      return respond(405, { error: 'Method not allowed' })

    } catch (err) {
      context.error('responses error:', err.message);
      logRequest(context, { endpoint: 'responses', method, status: 500, durationMs: Date.now() - start })
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});
