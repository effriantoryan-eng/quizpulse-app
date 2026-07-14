const { app } = require('@azure/functions');
const { authenticateAdmin } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const { EXCLUDE_DEMO_FRAGMENT } = require('./shared/excludeDemo');
const { computeRangeQuizStats } = require('./shared/rangeQuizStats');
const { getRangeStart, RANGE_DAYS } = require('./shared/trafficAggregate');

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
      schoolsContainer: database.container(process.env.COSMOS_CONTAINER_SCHOOLS || 'schools'),
      teachersContainer: database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers'),
    };
  }
  return _containers;
}

const ALLOWED_RANGES = ['today', '7d', '30d'];
const METRICS_RATE_LIMIT = 60; // Security limits table — Metrics API calls/hr
const METRICS_RATE_WINDOW_MS = 60 * 60 * 1000;

function round2(n) {
  return Math.round(n * 100) / 100;
}

// GET /api/manage/metrics?range=today|7d|30d — owner/support.
//
// v4.4.0 de-stub: usageGrowth (schools, teachers, quizzesPerDay, pushDeliveryRate) and
// engagement.completionRate are now real Cosmos aggregates — see buildRealMetrics() below.
// systemHealth, spending, security, and the remaining engagement/usageGrowth fields are still
// STUBBED: there is no @azure/monitor-query SDK installed and no App Insights App ID/API key
// configured in this environment, so those cannot run a real Kusto query against Application
// Insights yet. Per-group `stubbed` flags (not a single top-level one) reflect this split.
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
      const [totals, real] = await Promise.all([buildRealTotals(), buildRealMetrics(range)]);

      const metrics = buildStubbedMetrics(range);
      metrics.usageGrowth = { ...metrics.usageGrowth, ...real.usageGrowth };
      metrics.engagement = { ...metrics.engagement, ...real.engagement };

      return respond(200, { ...metrics, totals }, caller.teacherId);
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

// v4.4.0 — the real (non-App-Insights) portion of usageGrowth/engagement. `schools`/`teachers`
// are all-time totals (those containers have no isDemo concept and no reliable range field to
// filter on, matching buildRealTotals' existing "count the whole container" precedent above).
// `quizzesPerDay`/`pushDeliveryRate`/`completionRate` are range-scoped via the same
// computeRangeQuizStats helper api/traffic.js's funnel uses, so the two endpoints can never
// drift on what "quizzes sent in range, demo-excluded, legacy-excluded" means.
//
// `usageGrowth.students` and `engagement.avgResponseRate` stay null/stubbed on purpose:
// - students: no student-identity container exists; a platform-wide distinct-device count would
//   require a cross-partition scan of join_requests, the exact anti-pattern the eng review
//   flagged for the traffic funnel (CLAUDE.md v4.4.0, eng review 2A).
// - avgResponseRate: computing "responses / approved roster" per quiz (like api/analytics.js's
//   per-quiz responseRate) across every quiz on the platform means resolving a roster per quiz —
//   an N+1 that's fine for one admin's funnel view but not for every /manage/metrics poll.
//   completionRate below (responses / notifications sent) is the cheap platform-wide proxy.
async function buildRealMetrics(range) {
  const { quizzesContainer, responsesContainer, schoolsContainer, teachersContainer } = getContainers();
  const rangeStart = getRangeStart(range);
  const days = RANGE_DAYS[range];

  const countQuery = 'SELECT VALUE COUNT(1) FROM c';
  const [schoolsResult, teachersResult, rangeStats] = await Promise.all([
    schoolsContainer.items.query(countQuery).fetchAll(),
    teachersContainer.items.query(countQuery).fetchAll(),
    computeRangeQuizStats({ rangeStart, quizzesContainer, responsesContainer }),
  ]);

  const { quizzesSent, notificationsSent, notificationsFailed, responsesSubmitted } = rangeStats;
  const notificationsAttempted = notificationsSent + notificationsFailed;

  return {
    usageGrowth: {
      schools: schoolsResult.resources[0] || 0,
      teachers: teachersResult.resources[0] || 0,
      quizzesPerDay: round2(quizzesSent / days),
      pushDeliveryRate: notificationsAttempted > 0 ? round2((notificationsSent / notificationsAttempted) * 100) : null,
    },
    engagement: {
      completionRate: notificationsSent > 0 ? round2((responsesSubmitted / notificationsSent) * 100) : null,
    },
  };
}

function buildStubbedMetrics(range) {
  return {
    range,
    note: 'Placeholder values — App Insights Kusto wiring not yet built (no @azure/monitor-query, ' +
      'no App Insights credentials in this environment). usageGrowth and engagement now carry ' +
      'real Cosmos-backed values where computable (v4.4.0); systemHealth and spending remain ' +
      'placeholders. See per-group "stubbed" flags.',
    systemHealth: { stubbed: true, errorRate: null, p95LatencyMs: null, activeInstances: null },
    usageGrowth: { stubbed: false, schools: null, teachers: null, students: null, quizzesPerDay: null, pushDeliveryRate: null },
    engagement: { stubbed: false, avgResponseRate: null, avgTimeToRespondSec: null, completionRate: null },
    security: { stubbed: true, rateLimitHits: null, joinRejectionRate: null, failedAuthCount: null },
    spending: { stubbed: true, monthCostUsd: null, budgetUsd: 100, perServiceBreakdown: null },
  };
}

module.exports = { buildStubbedMetrics, buildRealTotals, buildRealMetrics };
