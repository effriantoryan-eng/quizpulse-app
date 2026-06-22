const { app } = require('@azure/functions');
const { authenticateAdmin } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { EXCLUDE_DEMO_FRAGMENT } = require('./shared/excludeDemo');

// Lazy container init — keeps `require('./metrics')` (e.g. metrics.test.js importing
// buildStubbedMetrics) from constructing a CosmosClient when no Cosmos env is configured.
let _containers = null;
function getContainers() {
  if (!_containers) {
    const { CosmosClient } = require('@azure/cosmos');
    const client = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT,
      key: process.env.COSMOS_KEY,
    });
    const database = client.database(process.env.COSMOS_DATABASE);
    _containers = {
      responsesContainer: database.container(process.env.COSMOS_CONTAINER_RESPONSES || 'responses'),
      quizzesContainer: database.container(process.env.COSMOS_CONTAINER_QUIZZES || 'quizzes'),
      classesContainer: database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes'),
    };
  }
  return _containers;
}

const ALLOWED_RANGES = ['today', '7d', '30d'];
const METRICS_RATE_LIMIT = 60; // Security limits table — Metrics API calls/hr
const METRICS_RATE_WINDOW_MS = 60 * 60 * 1000;

// GET /api/manage/metrics?range=today|7d|30d — owner/support.
//
// STUBBED: there is no @azure/monitor-query SDK installed and no App Insights App ID/API key
// configured in this environment, so this cannot run a real Kusto query against Application
// Insights yet. The route, role gate, validation, and response shape are real and match the
// metric groups documented in CLAUDE.md ("Admin monitoring portal" section); the values are
// placeholders. TODO (real wiring): add @azure/monitor-query, authenticate against the App
// Insights resource (managed identity or API key), and replace buildStubbedMetrics() below with
// actual Kusto queries per metric group.
app.http('manageMetrics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/metrics',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/metrics', method: 'GET', status, durationMs: Date.now() - start, teacherId: actorId });
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

      if (!rateLimit(`manage-metrics:${caller.teacherId}`, METRICS_RATE_LIMIT, METRICS_RATE_WINDOW_MS)) {
        return respond(429, { error: 'Metrics rate limit reached. Try again later.' }, caller.teacherId);
      }

      const range = new URL(request.url).searchParams.get('range') || 'today';
      if (!ALLOWED_RANGES.includes(range)) {
        return respond(400, { error: `range must be one of: ${ALLOWED_RANGES.join(', ')}` }, caller.teacherId);
      }

      // The App Insights metric groups are still stubbed, but the cross-teacher COUNT totals below
      // are real Cosmos aggregates — and every one of them excludes demo-class data via
      // EXCLUDE_DEMO_FRAGMENT (Demo class isolation, CLAUDE.md). A teacher exploring a demo class
      // must never move platform-wide numbers.
      const totals = await buildRealTotals();

      return respond(200, { ...buildStubbedMetrics(range), totals }, caller.teacherId);
    } catch (err) {
      context.error('manageMetrics error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// Real cross-teacher COUNT totals, demo-excluded. Counts the whole container (range filtering
// belongs with the App Insights wiring, not yet built); the point here is the demo-isolation rule.
async function buildRealTotals() {
  const { responsesContainer, quizzesContainer, classesContainer } = getContainers();
  const countQuery = `SELECT VALUE COUNT(1) FROM c WHERE ${EXCLUDE_DEMO_FRAGMENT}`;
  const [resp, quiz, cls] = await Promise.all([
    responsesContainer.items.query(countQuery).fetchAll(),
    quizzesContainer.items.query(countQuery).fetchAll(),
    classesContainer.items.query(countQuery).fetchAll(),
  ]);
  return {
    responses: resp.resources[0] || 0,
    quizzes: quiz.resources[0] || 0,
    classes: cls.resources[0] || 0,
  };
}

function buildStubbedMetrics(range) {
  return {
    range,
    stubbed: true,
    note: 'Placeholder values — App Insights Kusto wiring not yet built (no @azure/monitor-query, no App Insights credentials in this environment).',
    systemHealth: { errorRate: null, p95LatencyMs: null, activeInstances: null },
    usageGrowth: { schools: null, teachers: null, students: null, quizzesPerDay: null, pushDeliveryRate: null },
    engagement: { avgResponseRate: null, avgTimeToRespondSec: null, completionRate: null },
    security: { rateLimitHits: null, joinRejectionRate: null, failedAuthCount: null },
    spending: { monthCostUsd: null, budgetUsd: 100, perServiceBreakdown: null },
  };
}

module.exports = { buildStubbedMetrics, buildRealTotals };
