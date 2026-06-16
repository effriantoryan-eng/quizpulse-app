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
const teachers = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');

const ALLOWED_ROLES = ['teacher', 'school_admin', 'super_admin'];

// PUT /api/manage/teachers/{id}/role — the ONLY way a teacher's role field may change.
// Owner-only. No caller can reach 'owner' today — that role is granted via the custom claim
// configured in docs/azure/ROLE_CLAIMS_SETUP.md, which hasn't been set up on any account yet.
// This endpoint exists ahead of the Sprint 5/6 admin UI specifically so role changes never get
// bolted onto a teacher-facing endpoint (e.g. onboarding) later — see teacher.js's explicit
// rejection of a `role` field in its request body.
app.http('teacherRoleSet', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  // NOT "admin/..." — Azure Functions reserves the "admin" route segment for the host's own
  // runtime admin API regardless of routePrefix, and refuses to register a conflicting custom
  // route ("The specified route conflicts with one or more built in routes"). Sprint 5/6 admin
  // endpoints (metrics, school merge, log export) must avoid the "admin/" prefix for the same
  // reason — use "manage/..." or similar instead.
  route: 'manage/teachers/{id}/role',
  handler: async (request, context) => {
    const start = Date.now();
    const targetId = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: `manage/teachers/${targetId}/role`, method: 'PUT', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const caller = getCallerScope(auth.claims);

      // 404, not 403 — do not confirm this endpoint or the target teacher exists to a
      // non-owner caller.
      try {
        requireRole(caller, [ROLES.OWNER]);
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Not found' }, caller.teacherId);
        throw err;
      }

      if (!rateLimit(`teacher-role:${getClientIp(request)}`, 10, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId);
      }

      const body = await request.json().catch(() => null);
      const { role } = body || {};
      if (!ALLOWED_ROLES.includes(role)) {
        return respond(400, { error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` }, caller.teacherId);
      }

      let existing;
      try {
        const { resource } = await teachers.item(targetId, targetId).read();
        existing = resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'Teacher not found' }, caller.teacherId);
        throw err;
      }
      if (!existing) return respond(404, { error: 'Teacher not found' }, caller.teacherId);

      existing.role = role;
      const { resource: updated } = await teachers.item(targetId, targetId).replace(existing);
      return respond(200, { id: updated.id, role: updated.role }, caller.teacherId);
    } catch (err) {
      context.error('teacherRoleSet error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
