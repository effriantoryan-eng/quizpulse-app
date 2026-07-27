// v4.6.0 Task 2/6 — POST /api/questions/starter-seed. Seeds the 5 generic starter-pack questions
// into the caller's own questions container. Called by the first-run chain (api/shared/firstRun.js)
// AND directly by the Build/Question Bank empty-state CTA (Task 6) for a teacher who skipped the
// first-run finale. Idempotent (see api/shared/starterPack.js) so either caller can hit it safely.
const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { FEATURE_FIRST_RUN } = require('./shared/features');
const { seedStarterQuestions } = require('./shared/starterPack');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const questionsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);

app.http('questionsStarterSeed', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'questions/starter-seed',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'questions/starter-seed', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      if (!FEATURE_FIRST_RUN) return respond(404, { error: 'Not found' });

      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`starter-seed:${getClientIp(request)}`, 10, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const questions = await seedStarterQuestions(teacherId, questionsContainer);
      return respond(201, questions, teacherId);
    } catch (err) {
      context.error('questionsStarterSeed error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
