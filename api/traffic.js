const { app } = require('@azure/functions');
const { authenticateAdmin } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const {
  ALLOWED_RANGES,
  getRangeStart,
  aggregateTraffic,
} = require('./shared/trafficAggregate');

// Lazy container init — mirrors api/metrics.js's getContainers() pattern (keeps
// require('./traffic') from constructing a CosmosClient when no Cosmos env is configured).
let _container = null;
function getContainer() {
  if (!_container) {
    const { CosmosClient } = require('@azure/cosmos');
    const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const database = client.database(process.env.COSMOS_DATABASE);
    _container = database.container(process.env.COSMOS_CONTAINER_PAGEVIEWS || 'pageviews');
  }
  return _container;
}

const TRAFFIC_RATE_LIMIT = 60; // Security limits table — Traffic API calls/hr
const TRAFFIC_RATE_WINDOW_MS = 60 * 60 * 1000;

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
      const container = getContainer();
      // Project only the fields the aggregator needs — a full-range scan of pageviews (see the
      // ponytail note in the sprint prompt), but a narrow one.
      const { resources: docs } = await container.items.query({
        query: `SELECT c.page, c.eventType, c.teacherId, c.sessionId, c.screenWidth, c.userAgent, c.visitedAt
                 FROM c WHERE c.visitedAt >= @rangeStart`,
        parameters: [{ name: '@rangeStart', value: rangeStart.toISOString() }],
      }).fetchAll();

      const result = aggregateTraffic(docs);

      return respond(200, { range, retrievedAt: new Date().toISOString(), ...result }, caller.teacherId);
    } catch (err) {
      context.error('manageTraffic error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
