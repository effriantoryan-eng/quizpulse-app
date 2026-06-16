const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const crypto = require('crypto');
const { authenticateTeacher } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { writeAudit } = require('./shared/auditLog');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const schoolsContainer = database.container(process.env.COSMOS_CONTAINER_SCHOOLS || 'schools');
const invitesContainer = database.container(process.env.COSMOS_CONTAINER_INVITES || 'invites');
const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');

const SCHOOL_NAME_MAX = 120; // Security limits table — School name length, same limit as teacher.js
const MAX_PENDING_INVITES = 50; // Security limits table — Pending teacher invites
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // Security limits table — Invite link expiry, 7 days

// POST /api/manage/institutions — owner/platform_admin. Creates a school that's validated from
// the moment it exists, unlike the teacher-onboarding path (teacher.js) which always starts a
// school as 'unvalidated' and requires the separate validate endpoint (schoolAdmin.js).
app.http('institutionCreate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/institutions',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/institutions', method: 'POST', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const caller = getCallerScope(auth.claims);

      try {
        requireRole(caller, [ROLES.OWNER, ROLES.PLATFORM_ADMIN]);
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Not found' }, caller.teacherId);
        throw err;
      }

      if (!rateLimit(`manage-institutions:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId);
      }

      const body = await request.json().catch(() => null);
      const { name, sector, suburb, state } = body || {};
      if (typeof name !== 'string' || !name.trim()) {
        return respond(400, { error: 'name is required and must be a string' }, caller.teacherId);
      }
      if (name.trim().length > SCHOOL_NAME_MAX) {
        return respond(400, { error: `name must be ${SCHOOL_NAME_MAX} characters or fewer` }, caller.teacherId);
      }

      const now = new Date().toISOString();
      const school = {
        id: crypto.randomUUID(),
        name: name.trim(),
        status: 'validated',
        sector: typeof sector === 'string' ? sector.trim() : null,
        suburb: typeof suburb === 'string' ? suburb.trim() : null,
        state: typeof state === 'string' ? state.trim() : null,
        mergedIntoId: null,
        createdAt: now,
        validatedAt: now,
      };
      await schoolsContainer.items.create(school);

      await writeAudit({
        actorId: caller.teacherId,
        actorRole: caller.role,
        action: 'institution.create',
        targetType: 'school',
        targetId: school.id,
        before: null,
        after: school,
        ip: getClientIp(request),
      });

      return respond(201, school, caller.teacherId);
    } catch (err) {
      context.error('institutionCreate error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/manage/institutions/{id}/invite — owner/platform_admin. Creates a one-time,
// 7-day-expiry invite token for a teacher to join the given (validated) school.
app.http('institutionInvite', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/institutions/{id}/invite',
  handler: async (request, context) => {
    const start = Date.now();
    const schoolId = request.params.id;
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: `manage/institutions/${schoolId}/invite`, method: 'POST', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const caller = getCallerScope(auth.claims);

      try {
        requireRole(caller, [ROLES.OWNER, ROLES.PLATFORM_ADMIN]);
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Not found' }, caller.teacherId);
        throw err;
      }

      if (!rateLimit(`manage-institutions-invite:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId);
      }

      let school;
      try {
        const { resource } = await schoolsContainer.item(schoolId, schoolId).read();
        school = resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'School not found' }, caller.teacherId);
        throw err;
      }
      if (!school) return respond(404, { error: 'School not found' }, caller.teacherId);

      const { resources: pending } = await invitesContainer.items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.schoolId = @schoolId AND c.used = false AND c.expiresAt > @now',
        parameters: [{ name: '@schoolId', value: schoolId }, { name: '@now', value: new Date().toISOString() }],
      }).fetchAll();
      if ((pending[0] || 0) >= MAX_PENDING_INVITES) {
        return respond(409, { error: `This school already has ${MAX_PENDING_INVITES} pending invites` }, caller.teacherId);
      }

      const now = Date.now();
      const invite = {
        id: crypto.randomUUID(),
        schoolId,
        token: crypto.randomUUID(),
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + INVITE_EXPIRY_MS).toISOString(),
        used: false,
      };
      await invitesContainer.items.create(invite);

      await writeAudit({
        actorId: caller.teacherId,
        actorRole: caller.role,
        action: 'institution.invite',
        targetType: 'school',
        targetId: schoolId,
        before: null,
        after: { inviteId: invite.id, expiresAt: invite.expiresAt },
        ip: getClientIp(request),
      });

      return respond(201, { id: invite.id, token: invite.token, schoolId, expiresAt: invite.expiresAt }, caller.teacherId);
    } catch (err) {
      context.error('institutionInvite error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/invites/{token}/redeem — teacher-authenticated (any signed-in teacher, not
// role-gated). This is the "first sign-in via the link" hook: sets the caller's own
// teacher.schoolId/schoolStatus to the invited school and marks the invite used. Wiring the
// onboarding *page* to call this when a `?invite=token` link is opened is frontend work, out of
// scope for this backend-only sprint.
app.http('inviteRedeem', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'invites/{token}/redeem',
  handler: async (request, context) => {
    const start = Date.now();
    const token = request.params.token;
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: `invites/${token}/redeem`, method: 'POST', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`invites-redeem:${getClientIp(request)}`, 20, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const { resources: matches } = await invitesContainer.items.query({
        query: 'SELECT * FROM c WHERE c.token = @token',
        parameters: [{ name: '@token', value: token }],
      }).fetchAll();
      const invite = matches[0];
      if (!invite) return respond(404, { error: 'Invite not found' }, teacherId);

      if (invite.used || new Date(invite.expiresAt).getTime() < Date.now()) {
        return respond(410, { error: 'This invite has expired or already been used' }, teacherId);
      }

      let teacher;
      try {
        const { resource } = await teachersContainer.item(teacherId, teacherId).read();
        teacher = resource;
      } catch (err) {
        if (err.code !== 404) throw err;
      }
      if (!teacher) return respond(404, { error: 'Complete onboarding before redeeming an invite' }, teacherId);

      const before = { schoolId: teacher.schoolId, schoolStatus: teacher.schoolStatus };
      teacher.schoolId = invite.schoolId;
      teacher.schoolStatus = 'validated';
      await teachersContainer.item(teacherId, teacherId).replace(teacher);

      invite.used = true;
      await invitesContainer.item(invite.id, invite.schoolId).replace(invite);

      await writeAudit({
        actorId: teacherId,
        actorRole: 'teacher',
        action: 'invite.redeem',
        targetType: 'teacher',
        targetId: teacherId,
        before,
        after: { schoolId: teacher.schoolId, schoolStatus: teacher.schoolStatus },
        ip: getClientIp(request),
      });

      return respond(200, { schoolId: teacher.schoolId }, teacherId);
    } catch (err) {
      context.error('inviteRedeem error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
