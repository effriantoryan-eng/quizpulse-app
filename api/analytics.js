const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { assertScope, ScopeError } = require('./shared/authz');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const questionsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);
const responsesContainer = database.container(process.env.COSMOS_CONTAINER_RESPONSES);
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');

const CSV_EXPORT_MAX = 10;            // Security limits table — CSV export rate/teacher, 10/hr
const CSV_EXPORT_WINDOW_MS = 3600000;

// Loads the quiz, its questions (ordered, full fields), its responses, and the approved
// students for its target classes. Throws { status, error } on ownership/lookup failure.
async function loadQuizAnalytics(quizId, teacherId) {
  const { resources: quizMatches } = await quizzesContainer.items.query({
    query: 'SELECT * FROM c WHERE c.id = @id',
    parameters: [{ name: '@id', value: quizId }],
  }).fetchAll();
  if (quizMatches.length === 0) throw { status: 404, error: 'Quiz not found' };
  const quiz = quizMatches[0];
  if (quiz.teacherId !== teacherId) throw { status: 404, error: 'Quiz not found' };

  const questionIds = quiz.questionIds || [];
  let questions = [];
  if (questionIds.length > 0) {
    const idParams = questionIds.map((qid, i) => ({ name: `@qid${i}`, value: qid }));
    const idList = idParams.map(p => p.name).join(', ');
    const { resources: qs } = await questionsContainer.items.query({
      query: `SELECT * FROM c WHERE c.id IN (${idList})`,
      parameters: idParams,
    }).fetchAll();
    const byId = new Map(qs.map(q => [q.id, q]));
    questions = questionIds.map(qid => byId.get(qid)).filter(Boolean);
  }

  const { resources: responses } = await responsesContainer.items.query({
    query: 'SELECT * FROM c WHERE c.quizId = @quizId',
    parameters: [{ name: '@quizId', value: quizId }],
  }).fetchAll();

  let approvedStudents = [];
  const classIds = quiz.classIds || [];
  if (classIds.length > 0) {
    const classIdParams = classIds.map((cid, i) => ({ name: `@cid${i}`, value: cid }));
    const classIdList = classIdParams.map(p => p.name).join(', ');
    const { resources } = await joinRequestsContainer.items.query({
      query: `SELECT c.deviceId, c.studentName FROM c WHERE c.status = "approved" AND c.classId IN (${classIdList})`,
      parameters: classIdParams,
    }).fetchAll();
    approvedStudents = resources;
  }

  return { quiz, questions, responses, approvedStudents };
}

function buildQuestionBreakdown(questions, responses) {
  return questions.map(q => {
    const optionCount = (q.options || []).length;
    const counts = Array(optionCount).fill(0);
    responses.forEach(r => {
      const answer = (r.answers || []).find(a => a.questionId === q.id);
      if (answer && answer.selectedIndex >= 0 && answer.selectedIndex < optionCount) {
        counts[answer.selectedIndex]++;
      }
    });
    return { id: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex, counts };
  });
}

// Returns cumulative response counts in 5-minute buckets from sentAt.
// Each entry: { minutesElapsed: number, cumulativeCount: number }
function buildTimeline(responses, sentAt) {
  if (!sentAt || responses.length === 0) return [];
  const origin = new Date(sentAt).getTime();
  const BUCKET_MS = 5 * 60 * 1000;

  const counts = new Map();
  for (const r of responses) {
    const completedAt = r.completedAt ? new Date(r.completedAt).getTime() : null;
    if (!completedAt || completedAt < origin) continue;
    const bucket = Math.floor((completedAt - origin) / BUCKET_MS);
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  }

  if (counts.size === 0) return [];
  const maxBucket = Math.max(...counts.keys());
  let cumulative = 0;
  const timeline = [];
  for (let b = 0; b <= maxBucket; b++) {
    cumulative += counts.get(b) || 0;
    timeline.push({ minutesElapsed: b * 5, cumulativeCount: cumulative });
  }
  return timeline;
}

// GET /api/analytics?quizId= — live analytics for a quiz, polled by the teacher dashboard.
app.http('analytics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'analytics',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'analytics', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`analytics:${getClientIp(request)}`, 60, 3600000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const quizId = new URL(request.url).searchParams.get('quizId');
      if (!quizId) return respond(400, { error: 'quizId query parameter is required' }, teacherId);

      const { quiz, questions, responses, approvedStudents } = await loadQuizAnalytics(quizId, teacherId);

      const respondedDeviceIds = new Set(responses.map(r => r.studentId));
      const nonResponders = approvedStudents.filter(s => !respondedDeviceIds.has(s.deviceId));

      // Response timeline: cumulative count in 5-minute buckets since sentAt
      const timeline = buildTimeline(responses, quiz.sentAt);

      return respond(200, {
        quizId: quiz.id,
        quizName: quiz.name,
        classSize: quiz.classSize || approvedStudents.length,
        totalResponses: responses.length,
        questions: buildQuestionBreakdown(questions, responses),
        nonResponders: nonResponders.map(s => ({ studentName: s.studentName })),
        timeline,
      }, teacherId);
    } catch (err) {
      if (err && err.status) return respond(err.status, { error: err.error }, null);
      context.error('analytics error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

// GET /api/analytics/export?quizId= — CSV export of raw responses. Rate-limited per teacher.
app.http('analyticsExport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'analytics/export',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'analytics/export', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`analytics-export:${teacherId}`, CSV_EXPORT_MAX, CSV_EXPORT_WINDOW_MS)) {
        return respond(429, { error: 'CSV export limit reached. Try again later.' }, teacherId);
      }

      const quizId = new URL(request.url).searchParams.get('quizId');
      if (!quizId) return respond(400, { error: 'quizId query parameter is required' }, teacherId);

      const { quiz, questions, responses, approvedStudents } = await loadQuizAnalytics(quizId, teacherId);

      const nameByDevice = new Map(approvedStudents.map(s => [s.deviceId, s.studentName]));
      const questionById = new Map(questions.map(q => [q.id, q]));

      const rows = [['studentName', 'question', 'answer', 'timestamp']];
      for (const r of responses) {
        const studentName = nameByDevice.get(r.studentId) || r.studentId;
        for (const a of (r.answers || [])) {
          const q = questionById.get(a.questionId);
          const questionText = q ? q.text : a.questionId;
          const answerText = q && q.options && q.options[a.selectedIndex] !== undefined
            ? q.options[a.selectedIndex]
            : String(a.selectedIndex);
          rows.push([studentName, questionText, answerText, r.completedAt]);
        }
      }

      const csv = rows
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      logRequest(context, { endpoint: 'analytics/export', method: 'GET', status: 200, durationMs: Date.now() - start, teacherId });
      return {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${quiz.id}_responses.csv"`,
        },
        body: csv,
      };
    } catch (err) {
      if (err && err.status) return respond(err.status, { error: err.error }, null);
      context.error('analyticsExport error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

// GET /api/analytics/class/{classId}?topic= — cross-quiz response-rate aggregation.
// Returns all sent quizzes for this class, ordered newest first, with response rates.
// Optional ?topic= filters to quizzes that contain at least one question matching the topic.
app.http('classAnalytics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'analytics/class/{classId}',
  handler: async (request, context) => {
    const start = Date.now();
    const classId = request.params.classId;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'analytics/class/:classId', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      // Ownership check: teacher must own the class
      const { resources: classMatches } = await classesContainer.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: classId }]
      }).fetchAll();
      if (classMatches.length === 0) return respond(404, { error: 'Class not found' }, teacherId);
      try { assertScope(classMatches[0], { teacherId }); } catch (e) {
        if (e instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw e;
      }

      const topicFilter = new URL(request.url).searchParams.get('topic') || null;

      // Load all sent quizzes that target this class
      const { resources: allQuizzes } = await quizzesContainer.items.query({
        query: "SELECT * FROM c WHERE c.teacherId = @tid AND c.status = 'sent' ORDER BY c.sentAt DESC",
        parameters: [{ name: '@tid', value: teacherId }]
      }).fetchAll();

      const classQuizzes = allQuizzes.filter(q => (q.classIds || []).includes(classId));
      if (classQuizzes.length === 0) return respond(200, [], teacherId);

      // Optional topic filter: load question topics and filter quizzes
      let filteredQuizzes = classQuizzes;
      if (topicFilter) {
        const allQuestionIds = [...new Set(classQuizzes.flatMap(q => q.questionIds || []))];
        if (allQuestionIds.length > 0) {
          const idParams = allQuestionIds.map((qid, i) => ({ name: `@qid${i}`, value: qid }));
          const idList = idParams.map(p => p.name).join(', ');
          const { resources: questions } = await questionsContainer.items.query({
            query: `SELECT c.id, c.topic FROM c WHERE c.id IN (${idList}) AND c.topic = @topic`,
            parameters: [...idParams, { name: '@topic', value: topicFilter }]
          }).fetchAll();
          const matchingQids = new Set(questions.map(q => q.id));
          filteredQuizzes = classQuizzes.filter(q => (q.questionIds || []).some(qid => matchingQids.has(qid)));
        } else {
          filteredQuizzes = [];
        }
      }

      // For each quiz, load response count and approved student count
      const results = await Promise.all(filteredQuizzes.map(async (quiz) => {
        const [responsesResult, approvedResult] = await Promise.all([
          responsesContainer.items.query({
            query: 'SELECT VALUE COUNT(1) FROM c WHERE c.quizId = @qid',
            parameters: [{ name: '@qid', value: quiz.id }]
          }).fetchAll(),
          joinRequestsContainer.items.query({
            query: "SELECT VALUE COUNT(1) FROM c WHERE c.status = 'approved' AND c.classId = @cid",
            parameters: [{ name: '@cid', value: classId }]
          }).fetchAll(),
        ]);

        const responseCount = responsesResult.resources[0] || 0;
        const approvedCount = approvedResult.resources[0] || 0;
        const responseRate = approvedCount > 0 ? Math.round((responseCount / approvedCount) * 100) : null;

        return {
          quizId: quiz.id,
          quizName: quiz.name,
          sentAt: quiz.sentAt,
          closedAt: quiz.closedAt,
          questionCount: (quiz.questionIds || []).length,
          approvedStudents: approvedCount,
          responseCount,
          responseRate,
        };
      }));

      return respond(200, results, teacherId);
    } catch (err) {
      context.error('classAnalytics error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
