const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER_QUIZZES);

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
      const teacherId = new URL(request.url).searchParams.get('teacherId');

      const { resources } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      }).fetchAll();

      if (resources.length === 0) {
        return respond(404, { error: 'Quiz not found' }, teacherId)
      }

      const quiz = resources[0];

      // Ownership check — only enforced for teacher requests (teacherId present).
      // Student requests via TakeQuiz do not send a teacherId and are allowed through.
      if (teacherId && quiz.teacherId !== teacherId.trim()) {
        return respond(403, { error: 'You do not have access to this quiz' }, teacherId)
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
      if (method === 'GET') {
        const teacherId = new URL(request.url).searchParams.get('teacherId');

        if (!teacherId || !teacherId.trim()) {
          return respond(400, { error: 'teacherId is required' })
        }

        const { resources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.teacherId = @teacherId',
          parameters: [{ name: '@teacherId', value: teacherId.trim() }]
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

        const { name, questionIds, classIds, classSize, teacherId, status, sentAt } = body;
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

        const quiz = {
          id: require('crypto').randomUUID(),
          teacherId: typeof teacherId === 'string' ? teacherId.trim().slice(0, 100) : 'anonymous',
          name: name.trim(),
          questionIds: questionIds.map(id => id.trim()),
          classIds: Array.isArray(classIds) ? classIds.map(id => String(id).trim().slice(0, 100)) : [],
          classSize: typeof classSize === 'number' && Number.isInteger(classSize) && classSize >= 0 ? classSize : 0,
          status: status || 'draft',
          sentAt: sentAt || null,
          scheduledFor: null,
          createdAt: new Date().toISOString()
        };

        const { resource } = await container.items.create(quiz);
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
