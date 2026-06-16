const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { authenticateTeacher } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { assertStepUp, StepUpError } = require('./shared/stepUp');
const { writeAudit } = require('./shared/auditLog');
const { getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');

// Serialises school merges: only 1 may be in flight at a time platform-wide.
// APIM handles general throughput; this is a concurrency guard, not a rate limit.
let mergeInProgress = false;

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const schoolsContainer = database.container(process.env.COSMOS_CONTAINER_SCHOOLS || 'schools');
const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');

// POST /api/manage/schools/{id}/validate — owner/platform_admin. Marks an unvalidated,
// teacher-created school as validated, same end state as a school created directly via
// POST /api/manage/institutions (institutions.js).
app.http('schoolValidate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/schools/{id}/validate',
  handler: async (request, context) => {
    const start = Date.now();
    const schoolId = request.params.id;
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: `manage/schools/${schoolId}/validate`, method: 'POST', status, durationMs: Date.now() - start, teacherId: actorId });
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

      if (!rateLimit(`manage-schools-validate:${getClientIp(request)}`, 30, 60000)) {
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

      if (school.status === 'validated') {
        return respond(200, school, caller.teacherId); // idempotent
      }

      const before = { status: school.status, validatedAt: school.validatedAt };
      school.status = 'validated';
      school.validatedAt = new Date().toISOString();
      const { resource: updated } = await schoolsContainer.item(schoolId, schoolId).replace(school);

      await writeAudit({
        actorId: caller.teacherId,
        actorRole: caller.role,
        action: 'school.validate',
        targetType: 'school',
        targetId: schoolId,
        before,
        after: { status: updated.status, validatedAt: updated.validatedAt },
        ip: getClientIp(request),
      });

      return respond(200, updated, caller.teacherId);
    } catch (err) {
      context.error('schoolValidate error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/manage/schools/merge — owner ONLY, behind step-up re-auth. Re-points teachers and
// classes (the only containers in this data model that carry a schoolId field — questions,
// quizzes, and responses are scoped by teacherId/quizId, not schoolId, so there is nothing to
// re-point on them) from sourceSchoolId to targetSchoolId, sequentially (not Promise.all), then
// tombstones the source school with mergedIntoId. Nothing is deleted.
app.http('schoolMerge', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/schools/merge',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/schools/merge', method: 'POST', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const caller = getCallerScope(auth.claims);

      try {
        requireRole(caller, [ROLES.OWNER]);
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Not found' }, caller.teacherId);
        throw err;
      }

      try {
        assertStepUp(auth.claims);
      } catch (err) {
        if (err instanceof StepUpError) return respond(401, { error: err.message, reauthRequired: true }, caller.teacherId);
        throw err;
      }

      // Security limits table — "Merges per session: 1 sequential".
      if (mergeInProgress) {
        return respond(429, { error: 'Another merge is already in progress. Try again shortly.' }, caller.teacherId);
      }
      mergeInProgress = true;

      const body = await request.json().catch(() => null);
      const { sourceSchoolId, targetSchoolId } = body || {};
      if (typeof sourceSchoolId !== 'string' || !sourceSchoolId.trim()) {
        return respond(400, { error: 'sourceSchoolId is required' }, caller.teacherId);
      }
      if (typeof targetSchoolId !== 'string' || !targetSchoolId.trim()) {
        return respond(400, { error: 'targetSchoolId is required' }, caller.teacherId);
      }
      if (sourceSchoolId === targetSchoolId) {
        return respond(400, { error: 'sourceSchoolId and targetSchoolId must differ' }, caller.teacherId);
      }

      let source, target;
      try {
        const [sourceRes, targetRes] = await Promise.all([
          schoolsContainer.item(sourceSchoolId, sourceSchoolId).read(),
          schoolsContainer.item(targetSchoolId, targetSchoolId).read(),
        ]);
        source = sourceRes.resource;
        target = targetRes.resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'sourceSchoolId or targetSchoolId not found' }, caller.teacherId);
        throw err;
      }
      if (!source || !target) return respond(404, { error: 'sourceSchoolId or targetSchoolId not found' }, caller.teacherId);
      if (target.status !== 'validated') {
        return respond(400, { error: 'targetSchoolId must already be validated' }, caller.teacherId);
      }
      if (source.mergedIntoId) {
        return respond(409, { error: 'sourceSchoolId has already been merged' }, caller.teacherId);
      }

      // Sequential re-point — deliberately not Promise.all, so a failure partway through leaves
      // a predictable, resumable state rather than a pile of in-flight writes racing each other.
      const { resources: teachersToMove } = await teachersContainer.items.query({
        query: 'SELECT * FROM c WHERE c.schoolId = @schoolId',
        parameters: [{ name: '@schoolId', value: sourceSchoolId }],
      }).fetchAll();
      for (const teacher of teachersToMove) {
        teacher.schoolId = targetSchoolId;
        teacher.schoolStatus = target.status;
        await teachersContainer.item(teacher.id, teacher.id).replace(teacher);
      }

      const { resources: classesToMove } = await classesContainer.items.query({
        query: 'SELECT * FROM c WHERE c.schoolId = @schoolId',
        parameters: [{ name: '@schoolId', value: sourceSchoolId }],
      }).fetchAll();
      for (const cls of classesToMove) {
        cls.schoolId = targetSchoolId;
        await classesContainer.item(cls.id, cls.teacherId).replace(cls);
      }

      source.mergedIntoId = targetSchoolId;
      await schoolsContainer.item(sourceSchoolId, sourceSchoolId).replace(source);

      const after = { teachersRepointed: teachersToMove.length, classesRepointed: classesToMove.length, mergedIntoId: targetSchoolId };
      await writeAudit({
        actorId: caller.teacherId,
        actorRole: caller.role,
        action: 'school.merge',
        targetType: 'school',
        targetId: sourceSchoolId,
        before: { mergedIntoId: null },
        after,
        ip: getClientIp(request),
      });

      mergeInProgress = false;
      return respond(200, after, caller.teacherId);
    } catch (err) {
      mergeInProgress = false;
      context.error('schoolMerge error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
