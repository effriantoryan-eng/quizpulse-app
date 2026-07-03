const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const crypto = require('crypto');
const { logRequest } = require('./logger');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER_RESPONSES);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');

const MAX_RESPONSE_BODY = 4 * 1024; // Security limits table — Response body size, 4 KB max
const CONFIDENCE_VALUES = new Set(['sure', 'pretty_sure', 'guessing']);
const RESPONSE_TIME_MAX_MS = 30 * 60 * 1000; // 30 minutes — absurd upper bound for per-question time

// POST only — student quiz submission. The GET variant (raw student-answer dump) was deleted in
// the Sprint 5 audit cleanup: it was unauthenticated dead code unused by the frontend (see
// docs/security/SPRINT5_AUDIT.md, finding #1). Teacher-facing response data is served by
// GET /api/analytics, which has always had the ownership check this endpoint lacked.
app.http('responses', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const start = Date.now()
    const method = request.method

    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'responses', method, status, durationMs: Date.now() - start, teacherId })
      return { status, jsonBody: body }
    }

    try {
      const ip = getClientIp(request);
      if (!rateLimit(`responses:${ip}`, 5, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' })
      }
      // Per-studentId rate limit — partial mitigation for caller-supplied studentId impersonation
      const rawStudentId = (typeof (await request.clone().json().catch(() => ({})))?.studentId === 'string')
        ? null // defer — read once below
        : null;

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

      const { quizId, answers, studentId, quizDurationMs } = body;

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
        if (!CONFIDENCE_VALUES.has(answer.confidence)) {
          return respond(400, { error: 'each answer.confidence must be one of: sure, pretty_sure, guessing' })
        }
        if (answer.responseTimeMs !== undefined) {
          if (typeof answer.responseTimeMs !== 'number' || !Number.isInteger(answer.responseTimeMs) || answer.responseTimeMs < 0 || answer.responseTimeMs > RESPONSE_TIME_MAX_MS) {
            return respond(400, { error: 'each answer.responseTimeMs must be a non-negative integer not exceeding 30 minutes' })
          }
        }
      }

      if (quizDurationMs !== undefined) {
        if (typeof quizDurationMs !== 'number' || !Number.isInteger(quizDurationMs) || quizDurationMs < 0 || quizDurationMs > RESPONSE_TIME_MAX_MS) {
          return respond(400, { error: 'quizDurationMs must be a non-negative integer not exceeding 30 minutes' })
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

      if (quiz.status !== 'sent') {
        return respond(404, { error: 'Quiz not found' })
      }

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
        return respond(404, { error: 'Quiz not found' })
      }

      // Rate-limit by studentId to throttle impersonation of approved students.
      if (!rateLimit(`responses:student:${resolvedStudentId}`, 5, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' })
      }

      // Deterministic doc ID makes the duplicate check atomic — Cosmos rejects a second
      // create with the same id (409) without needing a separate read round-trip.
      // ponytail: replaces the prior SELECT+create pattern which had a race window
      const responseId = require('crypto')
        .createHash('sha256')
        .update(`${resolvedQuizId}:${resolvedStudentId}`)
        .digest('hex')
        .slice(0, 32);

      const response = {
        id: responseId,
        quizId: resolvedQuizId,
        studentId: resolvedStudentId,
        answers: answers.map(a => {
          const stored = { questionId: a.questionId.trim(), selectedIndex: a.selectedIndex, confidence: a.confidence };
          if (a.responseTimeMs !== undefined) stored.responseTimeMs = a.responseTimeMs;
          return stored;
        }),
        ...(quizDurationMs !== undefined && { quizDurationMs }),
        // topicTag/schoolId are copied from the quiz doc, never trusted from the (anonymous)
        // student caller — the student endpoint has no auth, so there's no claim to read these
        // from. Only set when the quiz actually carries a topic (v4.0.0 population benchmarking).
        ...(quiz.topicTag && { topicTag: quiz.topicTag, schoolId: quiz.schoolId || null }),
        completedAt: new Date().toISOString()
      };

      let resource;
      try {
        ({ resource } = await container.items.create(response));
      } catch (err) {
        if (err.code === 409) {
          return respond(409, { error: 'You have already submitted a response for this quiz' });
        }
        throw err;
      }
      return respond(201, resource)

    } catch (err) {
      context.error('responses error:', err.message);
      logRequest(context, { endpoint: 'responses', method, status: 500, durationMs: Date.now() - start })
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});
