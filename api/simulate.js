const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const crypto = require('crypto');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER_RESPONSES);

app.http('simulate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const start = Date.now();
    const method = request.method;

    function respond(status, body) {
      logRequest(context, { endpoint: 'simulate', method, status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }

    try {
      const ip = getClientIp(request);
      // Dedicated rate limit for simulation: 10 calls/minute per IP
      if (!rateLimit(`simulate:${ip}`, 10, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' });
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 65536) {
        return respond(413, { error: 'Request body too large.' });
      }

      const body = await request.json();

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' });
      }

      const { quizId, questions, classSize } = body;

      if (typeof quizId !== 'string' || !quizId.trim()) {
        return respond(400, { error: 'quizId is required and must be a string' });
      }
      if (!Array.isArray(questions) || questions.length === 0 || questions.length > 50) {
        return respond(400, { error: 'questions must be a non-empty array of up to 50 items' });
      }
      for (const q of questions) {
        if (typeof q.id !== 'string' || !q.id.trim()) {
          return respond(400, { error: 'each question must have an id string' });
        }
        if (typeof q.optionCount !== 'number' || q.optionCount < 2 || q.optionCount > 4) {
          return respond(400, { error: 'each question must have optionCount between 2 and 4' });
        }
      }
      if (typeof classSize !== 'number' || !Number.isInteger(classSize) || classSize < 1 || classSize > 100) {
        return respond(400, { error: 'classSize must be an integer between 1 and 100' });
      }

      const writes = [];
      for (let i = 0; i < classSize; i++) {
        const studentId = crypto.randomUUID();
        const answers = questions.map(q => ({
          questionId: q.id.trim(),
          selectedIndex: Math.floor(Math.random() * q.optionCount),
        }));
        writes.push(container.items.create({
          id: crypto.randomUUID(),
          quizId: quizId.trim(),
          studentId,
          answers,
          completedAt: new Date().toISOString(),
          simulated: true,
        }));
      }

      await Promise.all(writes);

      return respond(201, { generated: classSize });

    } catch (err) {
      context.error('simulate error:', err.message);
      logRequest(context, { endpoint: 'simulate', method, status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
