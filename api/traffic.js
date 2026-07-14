const { app } = require('@azure/functions');
const { authenticateAdmin } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const { resolveApprovedDeviceIds } = require('./shared/resolveApprovedDeviceIds');
const { computeRangeQuizStats } = require('./shared/rangeQuizStats');
const {
  ALLOWED_RANGES,
  getRangeStart,
  aggregateTraffic,
  computeFunnelRates,
} = require('./shared/trafficAggregate');

// Lazy container init — mirrors api/metrics.js's getContainers() pattern (keeps
// require('./traffic') from constructing a CosmosClient when no Cosmos env is configured).
let _containers = null;
function getContainers() {
  if (!_containers) {
    const { CosmosClient } = require('@azure/cosmos');
    const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const database = client.database(process.env.COSMOS_DATABASE);
    _containers = {
      pageviewsContainer: database.container(process.env.COSMOS_CONTAINER_PAGEVIEWS || 'pageviews'),
      quizzesContainer: database.container(process.env.COSMOS_CONTAINER_QUIZZES || 'quizzes'),
      responsesContainer: database.container(process.env.COSMOS_CONTAINER_RESPONSES || 'responses'),
      classesContainer: database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes'),
      joinRequestsContainer: database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests'),
    };
  }
  return _containers;
}

const TRAFFIC_RATE_LIMIT = 60; // Security limits table — Traffic API calls/hr
const TRAFFIC_RATE_WINDOW_MS = 60 * 60 * 1000;

// Funnel: quizzes sent in range -> pushes delivered -> rostered students who opened -> responses
// submitted. Base stats (quizzesSent/notificationsSent/responsesSubmitted, demo-excluded, legacy
// quizzes excluded from denominators) come from the shared computeRangeQuizStats — this layers
// the quizOpens step (roster resolution) on top, which is unique to the funnel.
async function computeFunnel({ rangeStart, quizPageviews, containers }) {
  const { quizzesContainer, responsesContainer, classesContainer, joinRequestsContainer } = containers;

  const { quizzesInRange, quizzesSent, notificationsSent, responsesSubmitted } =
    await computeRangeQuizStats({ rangeStart, quizzesContainer, responsesContainer });

  // Group /quiz pageviews by quizId (pageviews with no quizId — legacy or off-quiz — don't
  // attribute to any single quiz's open count).
  const visitorsByQuizId = new Map();
  for (const pv of quizPageviews) {
    if (!pv.quizId) continue;
    if (!visitorsByQuizId.has(pv.quizId)) visitorsByQuizId.set(pv.quizId, new Set());
    visitorsByQuizId.get(pv.quizId).add(pv.teacherId);
  }

  let quizOpens = 0;
  for (const quiz of quizzesInRange) {
    const visitors = visitorsByQuizId.get(quiz.id);
    if (!visitors || visitors.size === 0) continue;
    const approvedDeviceIds = await resolveApprovedDeviceIds(quiz.classIds, { classesContainer, joinRequestsContainer });
    for (const deviceId of visitors) {
      if (approvedDeviceIds.has(deviceId)) quizOpens++;
    }
  }

  return computeFunnelRates({ quizzesSent, notificationsSent, quizOpens, responsesSubmitted });
}

// GET /api/manage/traffic?range=today|7d|30d — owner/support. Route under manage/, NEVER
// admin/ (Azure Functions reserves that route segment for its own host API — see CLAUDE.md
// Authorization model). Same 404-on-mismatch, rate-limit, and role-gate conventions as
// api/metrics.js.
app.http('manageTraffic', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/traffic',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/traffic', method: 'GET', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateAdmin(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const caller = getCallerScope(auth.claims);

      try {
        requireRole(caller, [ROLES.OWNER, ROLES.SUPPORT]);
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Not found' }, caller.teacherId);
        throw err;
      }

      if (!rateLimit(`manage-traffic:${caller.teacherId}`, TRAFFIC_RATE_LIMIT, TRAFFIC_RATE_WINDOW_MS)) {
        return respond(429, { error: 'Traffic rate limit reached. Try again later.' }, caller.teacherId);
      }

      const range = new URL(request.url).searchParams.get('range') || 'today';
      if (!ALLOWED_RANGES.includes(range)) {
        return respond(400, { error: `range must be one of: ${ALLOWED_RANGES.join(', ')}` }, caller.teacherId);
      }

      const rangeStart = getRangeStart(range);
      const containers = getContainers();
      // Project only the fields the aggregator needs — a full-range scan of pageviews.
      // ponytail: full-range scan + in-code aggregation; move to pre-aggregated daily rollup
      // docs if the container outgrows pilot scale.
      const { resources: docs } = await containers.pageviewsContainer.items.query({
        query: `SELECT c.page, c.eventType, c.teacherId, c.sessionId, c.screenWidth, c.userAgent, c.quizId, c.visitedAt
                 FROM c WHERE c.visitedAt >= @rangeStart`,
        parameters: [{ name: '@rangeStart', value: rangeStart.toISOString() }],
      }).fetchAll();

      const result = aggregateTraffic(docs);

      const quizPageviews = docs.filter(d => d.page === '/quiz' && (!d.eventType || d.eventType === 'view'));
      const funnel = await computeFunnel({ rangeStart, quizPageviews, containers });

      return respond(200, { range, retrievedAt: new Date().toISOString(), ...result, funnel }, caller.teacherId);
    } catch (err) {
      context.error('manageTraffic error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
