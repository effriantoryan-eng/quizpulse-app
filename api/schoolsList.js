const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { authenticateAdmin } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { EXCLUDE_DEMO_FRAGMENT } = require('./shared/excludeDemo');

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);
const schoolsContainer = database.container(process.env.COSMOS_CONTAINER_SCHOOLS || 'schools');
const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');

const PAGE_SIZE = 50;

// GET /api/manage/schools — owner/support/platform_admin.
// Returns all schools (paginated, searchable, filterable by status) with per-school
// teacher and class counts. Counts are computed in a single pass over all teachers/classes
// rather than N+1 queries; tolerable for the scale of a pilot.
app.http('manageSchoolsList', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/schools',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/schools', method: 'GET', status, durationMs: Date.now() - start, teacherId: actorId });
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

      if (!rateLimit(`manage-schools-list:${getClientIp(request)}`, 60, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId);
      }

      const params = new URL(request.url).searchParams;
      const search = (params.get('search') || '').trim().toLowerCase();
      const status = params.get('status') || 'all'; // 'validated' | 'unvalidated' | 'all'
      const limit = Math.min(parseInt(params.get('limit') || PAGE_SIZE, 10), 200);
      const offset = Math.max(parseInt(params.get('offset') || 0, 10), 0);

      const { resources: allSchools } = await schoolsContainer.items.query(
        'SELECT * FROM c ORDER BY c.createdAt DESC'
      ).fetchAll();

      // Build teacher and class count maps in a single pass. The class query excludes demo
      // classes (Demo class isolation, CLAUDE.md) so a teacher's demo class never inflates a
      // school's class count in this cross-teacher aggregate.
      const [teachersResult, classesResult] = await Promise.all([
        teachersContainer.items.query('SELECT c.schoolId FROM c').fetchAll(),
        classesContainer.items.query(`SELECT c.schoolId FROM c WHERE ${EXCLUDE_DEMO_FRAGMENT}`).fetchAll(),
      ]);

      const teacherCounts = {};
      for (const t of teachersResult.resources) {
        if (t.schoolId) teacherCounts[t.schoolId] = (teacherCounts[t.schoolId] || 0) + 1;
      }
      const classCounts = {};
      for (const c of classesResult.resources) {
        if (c.schoolId) classCounts[c.schoolId] = (classCounts[c.schoolId] || 0) + 1;
      }

      // Filter
      let filtered = allSchools;
      if (search) {
        filtered = filtered.filter((s) => (s.name || '').toLowerCase().includes(search));
      }
      if (status === 'validated') {
        filtered = filtered.filter((s) => s.status === 'validated');
      } else if (status === 'unvalidated') {
        filtered = filtered.filter((s) => s.status !== 'validated');
      }

      const total = filtered.length;
      const page = filtered.slice(offset, offset + limit).map((s) => ({
        ...s,
        teacherCount: teacherCounts[s.id] || 0,
        classCount: classCounts[s.id] || 0,
      }));

      return respond(200, { schools: page, total, limit, offset }, caller.teacherId);
    } catch (err) {
      context.error('manageSchoolsList error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
