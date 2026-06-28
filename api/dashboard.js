const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { EXCLUDE_DEMO_FRAGMENT } = require('./shared/excludeDemo');
const { loadQuizAnalytics, buildQuestionBreakdown } = require('./analytics');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const questionsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);
const responsesContainer = database.container(process.env.COSMOS_CONTAINER_RESPONSES);
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');
const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');

const RECENT_RESULTS_LIMIT = 5;   // closed quizzes shown under "Recent results"
const MISCONCEPTION_SCAN = 3;     // most-recent sent quizzes scanned for confident-but-wrong questions
const MISCONCEPTION_LIMIT = 3;    // misconception lines surfaced

async function countResponses(quizId) {
  const { resources } = await responsesContainer.items.query({
    query: 'SELECT VALUE COUNT(1) FROM c WHERE c.quizId = @qid',
    parameters: [{ name: '@qid', value: quizId }],
  }).fetchAll();
  return resources[0] || 0;
}

async function countQuery(container, where, params) {
  const { resources } = await container.items.query({
    query: `SELECT VALUE COUNT(1) FROM c WHERE ${where}`,
    parameters: params,
  }).fetchAll();
  return resources[0] || 0;
}

// GET /api/dashboard — teacher home summary. Every query is scoped by the caller's teacherId
// (from the validated JWT), which is the isolation boundary — a teacher only ever sees their own
// quizzes, classes and counts. No resource-ID input, so no assertScope is needed.
app.http('dashboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dashboard',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'dashboard', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`dashboard:${getClientIp(request)}`, 60, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const now = Date.now();
      const tidParam = [{ name: '@tid', value: teacherId }];

      // All sent quizzes, newest first. Demo-aware (the teacher's own data) — counts below exclude demo.
      const { resources: sentQuizzes } = await quizzesContainer.items.query({
        query: "SELECT * FROM c WHERE c.teacherId = @tid AND c.status = 'sent' ORDER BY c.sentAt DESC",
        parameters: tidParam,
      }).fetchAll();

      const isOpen = q => !q.closedAt || new Date(q.closedAt).getTime() > now;
      const openQuizzes = sentQuizzes.filter(isOpen);
      const closedQuizzes = sentQuizzes.filter(q => !isOpen(q)).slice(0, RECENT_RESULTS_LIMIT);

      const activeQuizzes = await Promise.all(openQuizzes.map(async q => ({
        quizId: q.id,
        name: q.name,
        classSize: q.classSize || 0,
        totalResponses: await countResponses(q.id),
        closedAt: q.closedAt || null,
        isDemo: q.isDemo === true,
      })));

      const recentResults = await Promise.all(closedQuizzes.map(async q => {
        const totalResponses = await countResponses(q.id);
        const classSize = q.classSize || 0;
        return {
          quizId: q.id,
          name: q.name,
          classSize,
          totalResponses,
          responseRate: classSize > 0 ? Math.round((totalResponses / classSize) * 100) : null,
          closedAt: q.closedAt || null,
          isDemo: q.isDemo === true,
        };
      }));

      // Misconceptions: scan the most-recent sent quizzes for confident-but-wrong questions.
      const misconceptions = [];
      for (const q of sentQuizzes.slice(0, MISCONCEPTION_SCAN)) {
        const loaded = await loadQuizAnalytics(q.id, teacherId);
        const breakdown = buildQuestionBreakdown(loaded.questions, loaded.responses);
        for (const qb of breakdown) {
          if (qb.confidentButIncorrect > 0) {
            misconceptions.push({ quizId: q.id, quizName: q.name, questionText: qb.text, confidentButIncorrect: qb.confidentButIncorrect });
          }
        }
      }
      misconceptions.sort((a, b) => b.confidentButIncorrect - a.confidentButIncorrect);

      // Pending approvals across all the teacher's classes (join_requests carries teacherId).
      const pendingRequestCount = await countQuery(
        joinRequestsContainer,
        "c.teacherId = @tid AND (c.status = 'pending' OR c.status = 'queued')",
        tidParam,
      );

      // At-a-glance counts — exclude demo so they read as the real classroom.
      const realQuizzesWhere = `c.teacherId = @tid AND ${EXCLUDE_DEMO_FRAGMENT}`;
      const [classes, students, questions, quizzesSent] = await Promise.all([
        countQuery(classesContainer, realQuizzesWhere, tidParam),
        classesContainer.items.query({
          query: `SELECT VALUE SUM(c.studentCount) FROM c WHERE ${realQuizzesWhere}`,
          parameters: tidParam,
        }).fetchAll().then(r => r.resources[0] || 0),
        countQuery(questionsContainer, 'c.teacherId = @tid', tidParam),
        countQuery(quizzesContainer, `c.teacherId = @tid AND c.status = 'sent' AND ${EXCLUDE_DEMO_FRAGMENT}`, tidParam),
      ]);

      // Teacher display name (best-effort; falls back to null).
      let teacherName = null;
      try {
        const { resources } = await teachersContainer.items.query({
          query: 'SELECT c.name FROM c WHERE c.id = @tid',
          parameters: tidParam,
        }).fetchAll();
        teacherName = resources[0]?.name || null;
      } catch { /* name is cosmetic */ }

      return respond(200, {
        teacherName,
        activeQuizzes,
        recentResults,
        pendingRequestCount,
        misconceptions: misconceptions.slice(0, MISCONCEPTION_LIMIT),
        counts: { classes, students, questions, quizzesSent },
      }, teacherId);
    } catch (err) {
      context.error('dashboard error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
