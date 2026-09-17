const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { authenticateAdmin } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { assertStepUp, StepUpError } = require('./shared/stepUp');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const { writeAudit } = require('./shared/auditLog');
const { eraseDevice, deleteTeacherAccount } = require('./shared/studentDataCleanup');

// Owner-only erasure tool (D2.6). Every route: authenticateAdmin → owner role → 404 on mismatch →
// rate limit keyed by the caller's identity (not IP). The two destructive routes additionally need
// step-up re-auth and write a fail-closed 'requested' audit BEFORE deleting anything.

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);
// One container bag serving the candidates lookup, eraseDevice and deleteTeacherAccount.
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');
const containers = {
  classesContainer,
  joinRequestsContainer,
  subscriptionsContainer: database.container(process.env.COSMOS_CONTAINER_SUBSCRIPTIONS || 'subscriptions'),
  quizzesContainer: database.container(process.env.COSMOS_CONTAINER_QUIZZES || 'quizzes'),
  responsesContainer: database.container(process.env.COSMOS_CONTAINER_RESPONSES || 'responses'),
  pageviewsContainer: database.container(process.env.COSMOS_CONTAINER_PAGEVIEWS || 'pageviews'),
  questionsContainer: database.container(process.env.COSMOS_CONTAINER_QUESTIONS || 'questions'),
  upvotesContainer: database.container(process.env.COSMOS_CONTAINER_QUESTION_UPVOTES || 'question_upvotes'),
  reportsContainer: database.container(process.env.COSMOS_CONTAINER_QUESTION_REPORTS || 'question_reports'),
  sourceMaterialsContainer: database.container(process.env.COSMOS_CONTAINER_SOURCE_MATERIALS || 'source_materials'),
  quizDraftsContainer: database.container(process.env.COSMOS_CONTAINER_QUIZ_DRAFTS || 'quiz_drafts'),
  schoolsContainer: database.container(process.env.COSMOS_CONTAINER_SCHOOLS || 'schools'),
  teachersContainer: database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers'),
};

const HOUR_MS = 60 * 60 * 1000;
const LOOKUP_MAX = 60; // 60/hr lookup per owner
const MUTATE_MAX = 10; // 10/hr mutations per owner (shared across device + teacher erasure)

function isBlank(v) { return typeof v !== 'string' || !v.trim(); }

// Fail-closed erasure core, deps injected so the ordering is unit-testable without Cosmos. The
// 'requested' audit MUST succeed before anything is erased — a throw propagates and `erase` is never
// called. The 'completed' audit is best-effort (the data is already gone). Shared by both the device
// and teacher-account routes; a teacher deletion additionally records identityDeletion:'manual-pending'
// (the Entra sign-in account is a manual runbook step, D2.3).
async function runErasure({ writeAudit, erase, onCompletedAuditError }, { targetType, targetId, requestRef, actor }) {
  await writeAudit({
    actorId: actor.teacherId, actorRole: actor.role,
    action: 'privacy.erasure.requested', targetType, targetId,
    before: { requestRef },
  });

  const counts = await erase();

  try {
    await writeAudit({
      actorId: actor.teacherId, actorRole: actor.role,
      action: 'privacy.erasure.completed', targetType, targetId,
      after: { counts, requestRef, ...(targetType === 'teacher' ? { identityDeletion: 'manual-pending' } : {}) },
    });
  } catch (err) {
    if (onCompletedAuditError) onCompletedAuditError(err);
  }

  return counts;
}

// auth → owner role → 404 on mismatch. Returns { caller, claims } or { error, status }.
async function guardOwner(request) {
  const auth = await authenticateAdmin(request);
  if (auth.error) return { error: auth.error, status: auth.status };
  const caller = getCallerScope(auth.claims);
  try {
    requireRole(caller, [ROLES.OWNER]);
  } catch (err) {
    if (err instanceof ScopeError) return { error: 'Not found', status: 404 };
    throw err;
  }
  return { caller, claims: auth.claims };
}

// Enforce step-up on a destructive route. Returns null when fresh, or a { status, body } to return.
function requireStepUp(claims) {
  try {
    assertStepUp(claims);
    return null;
  } catch (err) {
    if (err instanceof StepUpError) return { status: 401, body: { reauthRequired: true, error: 'Re-authentication required' } };
    throw err;
  }
}

// GET /api/manage/erasure/candidates?classId= — the class's join requests, for the operator to pick
// a device to erase. Read-only, 60/hr, fail-closed lookup audit.
app.http('manageErasureCandidates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/erasure/candidates',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/erasure/candidates', method: 'GET', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }
    try {
      const g = await guardOwner(request);
      if (g.error) return respond(g.status, { error: g.error });
      const { caller } = g;

      if (!rateLimit(`manage-erasure-lookup:${caller.teacherId}`, LOOKUP_MAX, HOUR_MS)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId);
      }

      const classId = new URL(request.url).searchParams.get('classId');
      if (isBlank(classId)) return respond(400, { error: 'classId is required' }, caller.teacherId);

      // Resolve the class by id — a cross-partition query is fine for an owner-only admin tool.
      const { resources: classes } = await classesContainer.items.query({
        query: 'SELECT c.id, c.name, c.teacherId FROM c WHERE c.id = @cid',
        parameters: [{ name: '@cid', value: classId }],
      }).fetchAll();
      if (classes.length === 0) return respond(404, { error: 'Not found' }, caller.teacherId);

      const { resources: jrs } = await joinRequestsContainer.items.query({
        query: 'SELECT c.id, c.studentName, c.status, c.createdAt, c.deviceId FROM c WHERE c.classId = @cid',
        parameters: [{ name: '@cid', value: classId }],
      }, { partitionKey: classId }).fetchAll();

      // Fail-closed audit — logging the lookup is the minimum bar for showing student names.
      await writeAudit({
        actorId: caller.teacherId, actorRole: caller.role,
        action: 'privacy.erasure.lookup', targetType: 'class', targetId: classId,
      });

      const candidates = jrs.map(j => ({
        joinRequestId: j.id, studentName: j.studentName, status: j.status, createdAt: j.createdAt, deviceId: j.deviceId,
      }));
      return respond(200, { class: { id: classes[0].id, name: classes[0].name }, candidates }, caller.teacherId);
    } catch (err) {
      context.error('manageErasureCandidates error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

// POST /api/manage/erasure/device { deviceId, requestRef } — erase one device across every container.
app.http('manageErasureDevice', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/erasure/device',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/erasure/device', method: 'POST', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }
    try {
      const g = await guardOwner(request);
      if (g.error) return respond(g.status, { error: g.error });
      const { caller, claims } = g;

      const stepUp = requireStepUp(claims);
      if (stepUp) return respond(stepUp.status, stepUp.body, caller.teacherId);

      if (!rateLimit(`manage-erasure-mutate:${caller.teacherId}`, MUTATE_MAX, HOUR_MS)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId);
      }

      const body = await request.json().catch(() => ({}));
      const { deviceId, requestRef } = body || {};
      if (isBlank(deviceId)) return respond(400, { error: 'deviceId is required' }, caller.teacherId);
      if (isBlank(requestRef) || requestRef.length > 120) {
        return respond(400, { error: 'requestRef is required (max 120 characters)' }, caller.teacherId);
      }

      // Fail-closed 'requested' audit before eraseDevice (a throw → outer catch → 500, nothing erased).
      const counts = await runErasure(
        {
          writeAudit,
          erase: () => eraseDevice(containers, { deviceId }),
          onCompletedAuditError: (err) => context.error('privacy.erasure.completed audit failed (non-fatal):', err.message),
        },
        { targetType: 'device', targetId: deviceId, requestRef, actor: caller },
      );

      return respond(200, { counts }, caller.teacherId);
    } catch (err) {
      context.error('manageErasureDevice error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

// POST /api/manage/teachers/{id}/delete { requestRef } — erase a whole teacher account on request.
app.http('manageErasureTeacher', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/teachers/{id}/delete',
  handler: async (request, context) => {
    const start = Date.now();
    const id = request.params.id;
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/teachers/{id}/delete', method: 'POST', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }
    try {
      const g = await guardOwner(request);
      if (g.error) return respond(g.status, { error: g.error });
      const { caller, claims } = g;

      const stepUp = requireStepUp(claims);
      if (stepUp) return respond(stepUp.status, stepUp.body, caller.teacherId);

      if (!rateLimit(`manage-erasure-mutate:${caller.teacherId}`, MUTATE_MAX, HOUR_MS)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, caller.teacherId);
      }

      const body = await request.json().catch(() => ({}));
      const { requestRef } = body || {};
      if (isBlank(requestRef) || requestRef.length > 120) {
        return respond(400, { error: 'requestRef is required (max 120 characters)' }, caller.teacherId);
      }

      const counts = await runErasure(
        {
          writeAudit,
          erase: () => deleteTeacherAccount(containers, { teacherId: id }),
          onCompletedAuditError: (err) => context.error('privacy.erasure.completed audit failed (non-fatal):', err.message),
        },
        { targetType: 'teacher', targetId: id, requestRef, actor: caller },
      );

      return respond(200, { counts }, caller.teacherId);
    } catch (err) {
      context.error('manageErasureTeacher error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

module.exports = { runErasure };
