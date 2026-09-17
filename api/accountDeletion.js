const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { assertStepUp, StepUpError } = require('./shared/stepUp');
const { writeAudit } = require('./shared/auditLog');
const { deleteTeacherAccount } = require('./shared/studentDataCleanup');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const containers = {
  quizzesContainer: database.container(process.env.COSMOS_CONTAINER_QUIZZES || 'quizzes'),
  responsesContainer: database.container(process.env.COSMOS_CONTAINER_RESPONSES || 'responses'),
  classesContainer: database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes'),
  subscriptionsContainer: database.container(process.env.COSMOS_CONTAINER_SUBSCRIPTIONS || 'subscriptions'),
  joinRequestsContainer: database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests'),
  questionsContainer: database.container(process.env.COSMOS_CONTAINER_QUESTIONS || 'questions'),
  upvotesContainer: database.container(process.env.COSMOS_CONTAINER_QUESTION_UPVOTES || 'question_upvotes'),
  reportsContainer: database.container(process.env.COSMOS_CONTAINER_QUESTION_REPORTS || 'question_reports'),
  sourceMaterialsContainer: database.container(process.env.COSMOS_CONTAINER_SOURCE_MATERIALS || 'source_materials'),
  quizDraftsContainer: database.container(process.env.COSMOS_CONTAINER_QUIZ_DRAFTS || 'quiz_drafts'),
  schoolsContainer: database.container(process.env.COSMOS_CONTAINER_SCHOOLS || 'schools'),
  teachersContainer: database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers'),
};

const HOUR_MS = 60 * 60 * 1000;
const DELETE_MAX = 3; // Security limits — DELETE /api/me 3/hr/teacher

// Fail-closed deletion core, deps injected so the ordering is unit-testable without Cosmos. The
// 'requested' audit MUST succeed before anything is deleted — if it throws, this throws and the
// caller deletes nothing and returns 500. The 'completed' audit is best-effort: the data is already
// gone by then, so a failure is logged (via onCompletedAuditError), never surfaced as an error.
async function runAccountDeletion({ writeAudit, deleteTeacherAccount, onCompletedAuditError }, { teacherId, ip }) {
  await writeAudit({
    actorId: teacherId,
    actorRole: 'teacher',
    action: 'account.deletion.requested',
    targetType: 'teacher',
    targetId: teacherId,
    ip,
  });

  const counts = await deleteTeacherAccount({ teacherId });

  try {
    await writeAudit({
      actorId: teacherId,
      actorRole: 'teacher',
      action: 'account.deleted',
      targetType: 'teacher',
      targetId: teacherId,
      after: { counts, identityDeletion: 'manual-pending' },
      ip,
    });
  } catch (err) {
    if (onCompletedAuditError) onCompletedAuditError(err);
  }

  return counts;
}

// DELETE /api/me { confirm: 'DELETE' } — teacher self-service account deletion. Irreversible, so it
// needs a recent sign-in (step-up) and the exact confirm word. Deletes the teacher's classes and
// students' names, quizzes and every answer, questions, drafts and sources, and their school if it's
// unvalidated and unshared. The Entra sign-in account is a manual runbook step (D2.3).
app.http('accountDelete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'me',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'me', method: 'DELETE', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      try {
        assertStepUp(auth.claims);
      } catch (err) {
        if (err instanceof StepUpError) {
          return respond(401, { reauthRequired: true, error: 'Please sign in again to continue.' }, teacherId);
        }
        throw err;
      }

      if (!rateLimit(`account-delete:${teacherId}`, DELETE_MAX, HOUR_MS)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 1024) return respond(413, { error: 'Request body too large.' }, teacherId);

      const body = await request.json().catch(() => ({}));
      if (!body || body.confirm !== 'DELETE') {
        return respond(400, { error: 'Type DELETE to confirm.' }, teacherId);
      }

      await runAccountDeletion(
        {
          writeAudit,
          deleteTeacherAccount: (args) => deleteTeacherAccount(containers, args),
          onCompletedAuditError: (err) => context.error('account.deleted audit failed (non-fatal):', err.message),
        },
        { teacherId, ip: getClientIp(request) },
      );

      return respond(200, { deleted: true }, teacherId);
    } catch (err) {
      // A throw from the fail-closed 'requested' audit, or a mid-cascade delete failure. Either way
      // nothing is returned as deleted — the delete is retry-safe on a later attempt.
      context.error('accountDelete error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

module.exports = { runAccountDeletion };
