const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { authenticateAdmin } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);
const auditLogContainer = database.container(process.env.COSMOS_CONTAINER_AUDIT_LOG || 'audit_log');

const PAGE_SIZE = 50;

// GET /api/manage/audit — owner/support.
// Paginated, filterable audit log query for the admin UI. Distinct from GET /api/manage/logs/export
// (which streams JSONL for download); this returns JSON suitable for in-browser rendering.
app.http('manageAuditQuery', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/audit',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/audit', method: 'GET', status, durationMs: Date.now() - start, teacherId: actorId });
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

      if (!rateLimit(`manage-audit:${getClientIp(request)}`, 60, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId);
      }

      const params = new URL(request.url).searchParams;
      const actorId = (params.get('actorId') || '').trim();
      const action = (params.get('action') || '').trim();
      const from = params.get('from');
      const to = params.get('to');
      const limit = Math.min(parseInt(params.get('limit') || PAGE_SIZE, 10), 200);
      const offset = Math.max(parseInt(params.get('offset') || 0, 10), 0);

      if (from && Number.isNaN(new Date(from).getTime())) {
        return respond(400, { error: 'from must be a valid ISO date' }, caller.teacherId);
      }
      if (to && Number.isNaN(new Date(to).getTime())) {
        return respond(400, { error: 'to must be a valid ISO date' }, caller.teacherId);
      }

      const conditions = [];
      const queryParams = [];
      if (actorId) { conditions.push('c.actorId = @actorId'); queryParams.push({ name: '@actorId', value: actorId }); }
      if (action) { conditions.push('CONTAINS(c.action, @action)'); queryParams.push({ name: '@action', value: action }); }
      if (from) { conditions.push('c.createdAt >= @from'); queryParams.push({ name: '@from', value: new Date(from).toISOString() }); }
      if (to) { conditions.push('c.createdAt <= @to'); queryParams.push({ name: '@to', value: new Date(to).toISOString() }); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countQuery = { query: `SELECT VALUE COUNT(1) FROM c ${where}`, parameters: queryParams };
      const dataQuery = {
        query: `SELECT * FROM c ${where} ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${limit}`,
        parameters: queryParams,
      };

      const [countResult, dataResult] = await Promise.all([
        auditLogContainer.items.query(countQuery).fetchAll(),
        auditLogContainer.items.query(dataQuery).fetchAll(),
      ]);

      return respond(200, {
        entries: dataResult.resources,
        total: countResult.resources[0] || 0,
        limit,
        offset,
      }, caller.teacherId);
    } catch (err) {
      context.error('manageAuditQuery error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
