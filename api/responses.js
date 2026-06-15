const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER_RESPONSES);

app.http('responses', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const start = Date.now()
    const method = request.method

    function respond(status, body) {
      logRequest(context, { endpoint: 'responses', method, status, durationMs: Date.now() - start })
      return { status, jsonBody: body }
    }

    try {
      if (method === 'GET') {
        const quizId = new URL(request.url).searchParams.get('quizId');

        if (!quizId) {
          return respond(400, { error: 'quizId is required' })
        }

        const { resources } = await container.items
          .query({ query: 'SELECT * FROM c WHERE c.quizId = @quizId', parameters: [{ name: '@quizId', value: quizId }] })
          .fetchAll();

        return respond(200, resources)
      }

      if (method === 'POST') {
        const ip = getClientIp(request);
        if (!rateLimit(`responses:${ip}`, 5, 60000)) {
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

        const { quizId, answers, studentId } = body;

        if (typeof quizId !== 'string' || !quizId.trim()) {
          return respond(400, { error: 'quizId is required and must be a string' })
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

        const resolvedStudentId = typeof studentId === 'string' && studentId.trim()
          ? studentId.trim().slice(0, 100)
          : require('crypto').randomUUID();

        // Idempotency check — prevent duplicate submissions for the same student + quiz
        const { resources: existing } = await container.items.query({
          query: 'SELECT c.id FROM c WHERE c.quizId = @quizId AND c.studentId = @studentId',
          parameters: [
            { name: '@quizId', value: quizId.trim() },
            { name: '@studentId', value: resolvedStudentId }
          ]
        }).fetchAll();

        if (existing.length > 0) {
          return respond(409, { error: 'You have already submitted a response for this quiz' })
        }

        const response = {
          id: require('crypto').randomUUID(),
          quizId: quizId.trim(),
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
