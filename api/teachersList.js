const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { authenticateAdmin } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);
const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');

const PAGE_SIZE = 50;

// GET /api/manage/teachers — owner/support/platform_admin.
// Returns all teachers (paginated, searchable by name/email, filterable by schoolId).
// Used by the role management UI to find teachers before assigning a role.
app.http('manageTeachersList', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/teachers',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/teachers', method: 'GET', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateAdmin(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const caller = getCallerScope(auth.claims);

      try {
        requireRole(caller, [ROLES.OWNER, ROLES.SUPPORT, ROLES.PLATFORM_ADMIN]);
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Not found' }, caller.teacherId);
        throw err;
      }

      if (!rateLimit(`manage-teachers-list:${getClientIp(request)}`, 60, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId);
      }

      const params = new URL(request.url).searchParams;
      const search = (params.get('search') || '').trim().toLowerCase();
      const schoolId = (params.get('schoolId') || '').trim();
      const limit = Math.min(parseInt(params.get('limit') || PAGE_SIZE, 10), 200);
      const offset = Math.max(parseInt(params.get('offset') || 0, 10), 0);

      const { resources: allTeachers } = await teachersContainer.items.query(
        'SELECT c.id, c.teacherId, c.name, c.email, c.role, c.schoolId, c.schoolStatus, c.createdAt FROM c ORDER BY c.createdAt DESC'
      ).fetchAll();

      let filtered = allTeachers;
      if (search) {
        filtered = filtered.filter(
          (t) =>
            (t.name || '').toLowerCase().includes(search) ||
            (t.email || '').toLowerCase().includes(search) ||
            (t.id || '').toLowerCase().includes(search)
        );
      }
      if (schoolId) {
        filtered = filtered.filter((t) => t.schoolId === schoolId);
      }

      const total = filtered.length;
      const page = filtered.slice(offset, offset + limit);

      return respond(200, { teachers: page, total, limit, offset }, caller.teacherId);
    } catch (err) {
      context.error('manageTeachersList error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
