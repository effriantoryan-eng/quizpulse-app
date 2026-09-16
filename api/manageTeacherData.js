const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { authenticateAdmin } = require('./auth');
const { getCallerScope, requireRole, ScopeError, ROLES } = require('./shared/authz');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const { writeAudit } = require('./shared/auditLog');
const { loadQuizAnalytics, buildQuestionBreakdown } = require('./analytics');

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);
const teachersContainer  = database.container(process.env.COSMOS_CONTAINER_TEACHERS   || 'teachers');
const schoolsContainer   = database.container(process.env.COSMOS_CONTAINER_SCHOOLS    || 'schools');
const classesContainer   = database.container(process.env.COSMOS_CONTAINER_CLASSES    || 'classes');
const quizzesContainer   = database.container(process.env.COSMOS_CONTAINER_QUIZZES    || 'quizzes');
const responsesContainer = database.container(process.env.COSMOS_CONTAINER_RESPONSES  || 'responses');

const READ_ALL_ROLES = [ROLES.OWNER, ROLES.SUPPORT, ROLES.PLATFORM_ADMIN];

// Rate limit: 60/min keyed by caller.teacherId (not IP) — an admin drill-down spends 1 overview
// + several analytics-expand calls per teacher; 60/hr would 429 after ~8 teachers (review E6).
function checkRateLimit(adminId) {
  return rateLimit(`manage-teacher-data:${adminId}`, 60, 60_000);
}

// Guard: auth → role → rate-limit. Returns { caller, error, status } on failure.
async function guardAdmin(request) {
  const auth = await authenticateAdmin(request);
  if (auth.error) return { error: auth.error, status: auth.status };
  const caller = getCallerScope(auth.claims);
  try {
    requireRole(caller, READ_ALL_ROLES);
  } catch (err) {
    if (err instanceof ScopeError) return { error: 'Not found', status: 404 };
    throw err;
  }
  if (!checkRateLimit(caller.teacherId)) {
    return { error: 'Too many requests. Please try again later.', status: 429 };
  }
  return { caller };
}

// GET /api/manage/teachers/{id}/overview
// Returns teacher doc + schools + classes (no demoStudents names) + quizzes with response counts.
// writeAudit is FAIL-CLOSED: if it throws, the cross-tenant data is NOT returned (review E4).
app.http('manageTeacherOverview', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/teachers/{id}/overview',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/teachers/{id}/overview', method: 'GET', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }

    try {
      const { caller, error, status } = await guardAdmin(request);
      if (error) return respond(status, { error });

      const id = request.params.id;

      // Fetch teacher doc
      const { resources: teacherDocs } = await teachersContainer.items.query({
        query: 'SELECT * FROM c WHERE c.teacherId = @id',
        parameters: [{ name: '@id', value: id }],
      }).fetchAll();
      const teacher = teacherDocs[0];
      if (!teacher) return respond(404, { error: 'Not found' }, caller.teacherId);

      // Fetch school(s) — point-read on the teacher's schoolId (may be null)
      let schools = [];
      if (teacher.schoolId) {
        try {
          const { resource: school } = await schoolsContainer.item(teacher.schoolId, teacher.schoolId).read();
          if (school) schools = [school];
        } catch (err) {
          if (err.code !== 404) throw err;
        }
      }

      // Fetch classes — per-teacher view is demo-inclusive (exempt from EXCLUDE_DEMO_FRAGMENT).
      // Drop the demoStudents names array, exactly as GET /api/classes already does.
      const { resources: allClasses } = await classesContainer.items.query({
        query: 'SELECT c.id, c.name, c.studentCount, c.isDemo, c.joinCode, c.cap, c.createdAt FROM c WHERE c.teacherId = @id',
        parameters: [{ name: '@id', value: id }],
      }).fetchAll();
      // Add demoStudentCount (count of demoStudents) — already dropped from the query above,
      // but we need to compute it. We have to fetch it separately.
      const { resources: classesWithDemo } = await classesContainer.items.query({
        query: 'SELECT c.id, c.isDemo, ARRAY_LENGTH(c.demoStudents) AS demoStudentCount FROM c WHERE c.teacherId = @id AND c.isDemo = true',
        parameters: [{ name: '@id', value: id }],
      }).fetchAll();
      const demoCounts = new Map(classesWithDemo.map(c => [c.id, c.demoStudentCount || 0]));
      const classes = allClasses.map(c => ({
        ...c,
        demoStudentCount: c.isDemo ? (demoCounts.get(c.id) || 0) : undefined,
      }));

      // Fetch quizzes — capped 200, pageable.
      const params = new URL(request.url).searchParams;
      const limit  = Math.min(parseInt(params.get('limit')  || 200, 10), 200);
      const offset = Math.max(parseInt(params.get('offset') ||   0, 10), 0);

      const { resources: allQuizzes } = await quizzesContainer.items.query({
        query: 'SELECT c.id, c.name, c.status, c.classIds, c.sentAt, c.closedAt, c.isDemo, c.topicTag FROM c WHERE c.teacherId = @id ORDER BY c.createdAt DESC',
        parameters: [{ name: '@id', value: id }],
      }).fetchAll();
      const total  = allQuizzes.length;
      const quizzesPage = allQuizzes.slice(offset, offset + limit);

      // Response counts — ONE GROUP BY query, not N COUNTs (review E2).
      // responsesContainer is NOT partitioned by quizId; a per-quiz COUNT would fan out to
      // up to 200 cross-partition queries per page load. One GROUP BY round-trip instead.
      let responseCounts = new Map();
      if (quizzesPage.length > 0) {
        const qParams = quizzesPage.map((q, i) => ({ name: `@q${i}`, value: q.id }));
        const qList   = qParams.map(p => p.name).join(', ');
        const { resources: groups } = await responsesContainer.items.query({
          query: `SELECT c.quizId, COUNT(1) AS n FROM c WHERE c.quizId IN (${qList}) GROUP BY c.quizId`,
          parameters: qParams,
        }).fetchAll();
        for (const g of groups) responseCounts.set(g.quizId, g.n);
      }

      const quizzes = quizzesPage.map(q => ({ ...q, responseCount: responseCounts.get(q.id) || 0 }));

      // Fail-closed audit (review E4): if writeAudit throws, we do NOT return the cross-tenant
      // data — logging access is the minimum bar for granting access to another user's records.
      await writeAudit({
        actorId:   caller.teacherId,
        actorRole: caller.role,
        action:    'admin.teacher.view',
        targetType: 'teacher',
        targetId:   id,
        before:    null,
        after:     null,
      });

      return respond(200, { teacher, schools, classes, quizzes, total, limit, offset }, caller.teacherId);
    } catch (err) {
      context.error('manageTeacherOverview error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

// GET /api/manage/teachers/{id}/quizzes/{quizId}/analytics
// Returns cohort-level breakdown (no studentName, no per-response rows) identical to the
// teacher's own Analytics page — reuses loadQuizAnalytics + buildQuestionBreakdown verbatim.
// writeAudit is also fail-closed here: this route is independently reachable (review E4).
app.http('manageTeacherQuizAnalytics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/teachers/{id}/quizzes/{quizId}/analytics',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, actorId) {
      logRequest(context, { endpoint: 'manage/teachers/{id}/quizzes/{quizId}/analytics', method: 'GET', status, durationMs: Date.now() - start, teacherId: actorId });
      return { status, jsonBody: body };
    }

    try {
      const { caller, error, status } = await guardAdmin(request);
      if (error) return respond(status, { error });

      const { id, quizId } = request.params;

      // loadQuizAnalytics already enforces quiz.teacherId === teacherId via the partition key
      // point-read — a quiz that belongs to a different teacher simply isn't found (404).
      // We additionally verify the teacherId in the URL matches the quiz, so an admin scoped
      // to one teacher can't pivot to a different teacher's quiz by changing only quizId.
      let analytics;
      try {
        analytics = await loadQuizAnalytics(quizId, id);
      } catch (err) {
        if (err && err.status) return respond(err.status, { error: err.error }, caller.teacherId);
        throw err;
      }

      const breakdown = buildQuestionBreakdown(analytics);

      // Strip per-student data: no studentName, no per-response rows, no roster.
      // breakdown already contains only aggregated counts and percentages — safe to return as-is.

      // Fail-closed audit: this route is independently reachable (a direct deep-link), so it
      // needs its own audit row — the overview's row only covers overview loads (review E4).
      await writeAudit({
        actorId:    caller.teacherId,
        actorRole:  caller.role,
        action:     'admin.teacher.quiz.view',
        targetType: 'quiz',
        targetId:   quizId,
        before:     null,
        after:      null,
      });

      return respond(200, { breakdown }, caller.teacherId);
    } catch (err) {
      context.error('manageTeacherQuizAnalytics error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
