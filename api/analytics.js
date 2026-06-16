const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const questionsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);
const responsesContainer = database.container(process.env.COSMOS_CONTAINER_RESPONSES);
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');

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

      return respond(200, {
        quizId: quiz.id,
        quizName: quiz.name,
        classSize: quiz.classSize || approvedStudents.length,
        totalResponses: responses.length,
        questions: buildQuestionBreakdown(questions, responses),
        nonResponders: nonResponders.map(s => ({ studentName: s.studentName })),
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
