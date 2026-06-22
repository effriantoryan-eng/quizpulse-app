const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { getCallerScope, assertScope, ScopeError } = require('./shared/authz');
const { runSimulation } = require('./shared/runSimulation');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');

const SIMULATE_MAX = 5;            // 5 calls per teacher per minute
const SIMULATE_WINDOW_MS = 60000;
const MAX_BODY = 4 * 1024;

// POST /api/simulate-responses { quizId } — generates simulated responses for a demo quiz.
// Manual trigger used alongside the automatic demo branch of send-notification (both share
// api/shared/runSimulation.js). Only works on quizzes whose target class is a demo class.
app.http('simulateResponses', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'simulate-responses',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'simulate-responses', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const caller = getCallerScope(auth.claims);

      // (a) Rate limit — 5 calls per teacher per minute.
      if (!rateLimit(`simulate-responses:${caller.teacherId}`, SIMULATE_MAX, SIMULATE_WINDOW_MS)) {
        return respond(429, { error: 'Too many requests. Please wait a minute and try again.' }, caller.teacherId);
      }

      // (b) Body type + quizId present.
      const len = Number(request.headers.get('content-length') || 0);
      if (len > MAX_BODY) return respond(413, { error: 'Request body too large.' }, caller.teacherId);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' }, caller.teacherId);
      }
      const { quizId } = body;
      if (typeof quizId !== 'string' || !quizId.trim()) {
        return respond(400, { error: 'quizId is required and must be a string' }, caller.teacherId);
      }

      // (c) Ownership — caller must own the quiz (mutate). 404 on mismatch (Sprint 5 convention).
      const { resources: quizMatches } = await quizzesContainer.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: quizId.trim() }],
      }).fetchAll();
      if (quizMatches.length === 0) return respond(404, { error: 'Quiz not found' }, caller.teacherId);
      const quiz = quizMatches[0];
      try {
        assertScope(quiz, caller, { mutate: true });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Quiz not found' }, caller.teacherId);
        throw err;
      }

      // (d) Resolve the demo class from the quiz's target classes.
      const classIds = quiz.classIds || [];
      let demoClass = null;
      if (classIds.length > 0) {
        const classIdParams = classIds.map((id, i) => ({ name: `@cid${i}`, value: id }));
        const classIdList = classIdParams.map((p) => p.name).join(', ');
        const { resources: cls } = await classesContainer.items.query({
          query: `SELECT * FROM c WHERE c.id IN (${classIdList})`,
          parameters: classIdParams,
        }).fetchAll();
        demoClass = cls.find((c) => c.isDemo === true) || null;
      }
      if (!demoClass) {
        return respond(400, { error: 'Not a demo class' }, caller.teacherId);
      }

      // (e) Idempotency + generation are handled inside runSimulation (409 if already simulated).
      const result = await runSimulation(quiz, demoClass, context);
      if (result.error) return respond(result.status, { error: result.error }, caller.teacherId);

      return respond(201, result, caller.teacherId);
    } catch (err) {
      context.error('simulateResponses error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
