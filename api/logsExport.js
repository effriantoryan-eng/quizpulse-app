const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { authenticateTeacher } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const auditLogContainer = database.container(process.env.COSMOS_CONTAINER_AUDIT_LOG || 'audit_log');

const ALLOWED_TYPES = ['errors', 'security', 'usage'];
const MAX_EXPORT_BYTES = 50 * 1024 * 1024; // Security limits table — Log export size, 50 MB per request

// GET /api/manage/logs/export?type=errors|security|usage&from=&to= — owner/support.
//
// type=security streams real JSONL from the audit_log container (Sprint 5's real append-only
// trail). type=errors|usage are NOT wired up — there is no @azure/monitor-query SDK or App
// Insights credentials in this environment (same constraint as manage/metrics — see metrics.js).
// Returning 501 here is deliberate: fabricating zero-filled JSONL would be indistinguishable
// from "no errors occurred," which is worse than an honest "not implemented yet."
app.http('manageLogsExport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/logs/export',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/logs/export', method: 'GET', status, durationMs: Date.now() - start, teacherId: actorId });
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

      if (!rateLimit(`manage-logs-export:${caller.teacherId}`, 10, 60 * 60 * 1000)) {
        return respond(429, { error: 'Too many export requests. Try again later.' }, caller.teacherId);
      }

      const params = new URL(request.url).searchParams;
      const type = params.get('type');
      if (!ALLOWED_TYPES.includes(type)) {
        return respond(400, { error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` }, caller.teacherId);
      }

      const from = params.get('from');
      const to = params.get('to');
      if (from && Number.isNaN(new Date(from).getTime())) {
        return respond(400, { error: 'from must be a valid ISO date' }, caller.teacherId);
      }
      if (to && Number.isNaN(new Date(to).getTime())) {
        return respond(400, { error: 'to must be a valid ISO date' }, caller.teacherId);
      }

      if (type !== 'security') {
        return respond(501, {
          error: `Log export for type=${type} is not implemented yet — no App Insights export wiring in this environment (see metrics.js for the same constraint).`,
        }, caller.teacherId);
      }

      const conditions = [];
      const parameters = [];
      if (from) { conditions.push('c.createdAt >= @from'); parameters.push({ name: '@from', value: new Date(from).toISOString() }); }
      if (to) { conditions.push('c.createdAt <= @to'); parameters.push({ name: '@to', value: new Date(to).toISOString() }); }
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const { resources: entries } = await auditLogContainer.items.query({
        query: `SELECT * FROM c ${whereClause} ORDER BY c.createdAt ASC`,
        parameters,
      }).fetchAll();

      let jsonl = '';
      let truncated = false;
      for (const entry of entries) {
        const line = JSON.stringify(entry) + '\n';
        if (Buffer.byteLength(jsonl, 'utf8') + Buffer.byteLength(line, 'utf8') > MAX_EXPORT_BYTES) {
          truncated = true;
          break;
        }
        jsonl += line;
      }

      logRequest(context, { endpoint: 'manage/logs/export', method: 'GET', status: 200, durationMs: Date.now() - start, teacherId: caller.teacherId });
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Content-Disposition': 'attachment; filename="security-log-export.jsonl"',
          'X-Export-Truncated': String(truncated),
        },
        body: jsonl,
      };
    } catch (err) {
      context.error('manageLogsExport error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
