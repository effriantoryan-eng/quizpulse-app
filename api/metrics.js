const { app } = require('@azure/functions');
const { authenticateTeacher } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');

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
      const auth = await authenticateTeacher(request);
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

      return respond(200, buildStubbedMetrics(range), caller.teacherId);
    } catch (err) {
      context.error('manageMetrics error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

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

module.exports = { buildStubbedMetrics };
