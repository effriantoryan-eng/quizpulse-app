// v4.6.0 Task 1 — POST /api/onboarding/first-run. Server-orchestrates the whole first-run chain
// (demo class -> starter questions -> draft quiz -> send -> simulate) in one call so the client
// never has to sequence it itself. See api/shared/firstRun.js for the chain logic.
const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { getTeacher } = require('./teacher');
const { FEATURE_FIRST_RUN } = require('./shared/features');
const { runFirstRun } = require('./shared/firstRun');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');
const questionsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);

app.http('onboardingFirstRun', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'onboarding/first-run',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'onboarding/first-run', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      if (!FEATURE_FIRST_RUN) return respond(404, { error: 'Not found' });

      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      // Every substep this chain runs (class create, question create, quiz create/send) already
      // has its own per-endpoint rate limit; this key just bounds how often the CHAIN itself can
      // be kicked off (retries on failure, or a teacher hitting the finale button twice).
      if (!rateLimit(`first-run:${teacherId}`, 5, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again in a minute.' }, teacherId);
      }

      const teacher = await getTeacher(teacherId);
      const result = await runFirstRun({
        teacherId,
        schoolId: teacher?.schoolId,
        context,
        deps: { classesContainer, questionsContainer, quizzesContainer },
      });

      if (result.error) return respond(result.status, { error: result.error }, teacherId);
      return respond(200, result, teacherId);
    } catch (err) {
      context.error('onboardingFirstRun error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
