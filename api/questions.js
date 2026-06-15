const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);

app.http('questions', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const start = Date.now()
    const method = request.method

    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'questions', method, status, durationMs: Date.now() - start, teacherId })
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
        if (!rateLimit(`questions:${ip}`, 30, 60000)) {
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

        const { text, options, correctIndex, topic, teacherId } = body;
        const ALLOWED_TOPICS = ['Science', 'History', 'Mathematics', 'English', 'Geography'];

        if (typeof text !== 'string' || !text.trim()) {
          return respond(400, { error: 'text is required and must be a string' }, teacherId)
        }
        if (text.trim().length > 500) {
          return respond(400, { error: 'text must be 500 characters or fewer' }, teacherId)
        }
        if (!Array.isArray(options) || options.length !== 4) {
          return respond(400, { error: 'options must be an array of exactly 4 items' }, teacherId)
        }
        if (options.some(o => typeof o !== 'string' || !o.trim())) {
          return respond(400, { error: 'each option must be a non-empty string' }, teacherId)
        }
        if (options.some(o => o.trim().length > 200)) {
          return respond(400, { error: 'each option must be 200 characters or fewer' }, teacherId)
        }
        if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
          return respond(400, { error: 'correctIndex must be an integer between 0 and 3' }, teacherId)
        }
        if (!ALLOWED_TOPICS.includes(topic)) {
          return respond(400, { error: `topic must be one of: ${ALLOWED_TOPICS.join(', ')}` }, teacherId)
        }

        const question = {
          id: require('crypto').randomUUID(),
          teacherId: typeof teacherId === 'string' ? teacherId.trim().slice(0, 100) : 'anonymous',
          text: text.trim(),
          options: options.map(o => o.trim()),
          correctIndex,
          topic,
          createdAt: new Date().toISOString()
        };

        const { resource } = await container.items.create(question);
        return respond(201, resource, question.teacherId)
      }

      return respond(405, { error: 'Method not allowed' })

    } catch (err) {
      context.error('questions error:', err.message);
      logRequest(context, { endpoint: 'questions', method, status: 500, durationMs: Date.now() - start })
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});

app.http('questionById', {
  methods: ['PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'questions/{id}',
  handler: async (request, context) => {
    const start = Date.now()
    const method = request.method
    const id = request.params.id

    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'questions/:id', method, status, durationMs: Date.now() - start, teacherId })
      return { status, jsonBody: body }
    }

    try {
      if (method === 'DELETE') {
        const teacherId = new URL(request.url).searchParams.get('teacherId')
        if (!teacherId || !teacherId.trim()) {
          return respond(400, { error: 'teacherId is required' })
        }

        const { resources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: id }]
        }).fetchAll()

        if (resources.length === 0) return respond(404, { error: 'Question not found' }, teacherId)
        if (resources[0].teacherId !== teacherId.trim()) return respond(403, { error: 'You do not have access to this question' }, teacherId)

        await container.item(id, teacherId.trim()).delete()
        return respond(204, null, teacherId)
      }

      if (method === 'PUT') {
        const ip = getClientIp(request)
        if (!rateLimit(`questions:${ip}`, 30, 60000)) {
          return respond(429, { error: 'Too many requests. Please try again later.' })
        }

        const contentLength = parseInt(request.headers.get('content-length') || '0', 10)
        if (contentLength > 65536) {
          return respond(413, { error: 'Request body too large. Maximum size is 64KB' })
        }

        const body = await request.json()
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return respond(400, { error: 'Request body must be a JSON object' })
        }

        const { text, options, correctIndex, topic, teacherId } = body
        const ALLOWED_TOPICS = ['Science', 'History', 'Mathematics', 'English', 'Geography']

        if (!teacherId || !teacherId.trim()) return respond(400, { error: 'teacherId is required' }, teacherId)
        if (typeof text !== 'string' || !text.trim()) return respond(400, { error: 'text is required and must be a string' }, teacherId)
        if (text.trim().length > 500) return respond(400, { error: 'text must be 500 characters or fewer' }, teacherId)
        if (!Array.isArray(options) || options.length !== 4) return respond(400, { error: 'options must be an array of exactly 4 items' }, teacherId)
        if (options.some(o => typeof o !== 'string' || !o.trim())) return respond(400, { error: 'each option must be a non-empty string' }, teacherId)
        if (options.some(o => o.trim().length > 200)) return respond(400, { error: 'each option must be 200 characters or fewer' }, teacherId)
        if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return respond(400, { error: 'correctIndex must be an integer between 0 and 3' }, teacherId)
        if (!ALLOWED_TOPICS.includes(topic)) return respond(400, { error: `topic must be one of: ${ALLOWED_TOPICS.join(', ')}` }, teacherId)

        const { resources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: id }]
        }).fetchAll()

        if (resources.length === 0) return respond(404, { error: 'Question not found' }, teacherId)
        if (resources[0].teacherId !== teacherId.trim()) return respond(403, { error: 'You do not have access to this question' }, teacherId)

        const updated = {
          ...resources[0],
          text: text.trim(),
          options: options.map(o => o.trim()),
          correctIndex,
          topic,
        }

        const { resource } = await container.items.upsert(updated)
        return respond(200, resource, teacherId)
      }

      return respond(405, { error: 'Method not allowed' })

    } catch (err) {
      context.error('questionById error:', err.message)
      logRequest(context, { endpoint: 'questions/:id', method, status: 500, durationMs: Date.now() - start })
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } }
    }
  }
})
