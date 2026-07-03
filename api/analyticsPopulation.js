const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { isValidTopicTag } = require('./shared/topicTags');
const { EXCLUDE_DEMO_FRAGMENT } = require('./shared/excludeDemo');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const populationContainer = database.container(process.env.COSMOS_CONTAINER_POPULATION_BENCHMARK || 'population_benchmark');
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
const questionsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);
const responsesContainer = database.container(process.env.COSMOS_CONTAINER_RESPONSES);
const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');

const CONFIDENT_VALUES = new Set(['sure', 'pretty_sure']);

// Aggregates the CALLING TEACHER's own topic-tagged, sent quizzes into the same
// { responseCount, pctCorrect, pctConfidentIncorrect } shape as a population_benchmark rollup, so
// the two are directly comparable in the UI. Answer-level, not response-doc-level (matches the
// seed's units) — a 5-question quiz contributes 5 answers per student, not 1.
async function aggregateSchoolTopic(teacherId, topic) {
  const { resources: quizzes } = await quizzesContainer.items.query({
    query: `SELECT c.id, c.questionIds FROM c WHERE c.teacherId = @tid AND c.topicTag = @topic AND c.status = 'sent' AND ${EXCLUDE_DEMO_FRAGMENT}`,
    parameters: [{ name: '@tid', value: teacherId }, { name: '@topic', value: topic }],
  }).fetchAll();

  if (quizzes.length === 0) return { responseCount: 0, pctCorrect: null, pctConfidentIncorrect: null };

  const quizIds = quizzes.map(q => q.id);
  const questionIds = [...new Set(quizzes.flatMap(q => q.questionIds || []))];

  let correctIndexById = new Map();
  if (questionIds.length > 0) {
    const qParams = questionIds.map((qid, i) => ({ name: `@qid${i}`, value: qid }));
    const qList = qParams.map(p => p.name).join(', ');
    const { resources: questions } = await questionsContainer.items.query({
      query: `SELECT c.id, c.correctIndex FROM c WHERE c.id IN (${qList})`,
      parameters: qParams,
    }).fetchAll();
    correctIndexById = new Map(questions.map(q => [q.id, q.correctIndex]));
  }

  const quizIdParams = quizIds.map((qid, i) => ({ name: `@quizid${i}`, value: qid }));
  const quizIdList = quizIdParams.map(p => p.name).join(', ');
  const { resources: responses } = await responsesContainer.items.query({
    query: `SELECT c.answers FROM c WHERE c.quizId IN (${quizIdList}) AND ${EXCLUDE_DEMO_FRAGMENT}`,
    parameters: quizIdParams,
  }).fetchAll();

  let totalAnswers = 0, correctCount = 0, confidentIncorrectCount = 0;
  for (const r of responses) {
    for (const a of (r.answers || [])) {
      const correctIndex = correctIndexById.get(a.questionId);
      if (correctIndex === undefined) continue;
      totalAnswers++;
      const isCorrect = a.selectedIndex === correctIndex;
      if (isCorrect) correctCount++;
      else if (CONFIDENT_VALUES.has(a.confidence)) confidentIncorrectCount++;
    }
  }

  return {
    responseCount: totalAnswers,
    pctCorrect: totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 1000) / 10 : null,
    pctConfidentIncorrect: totalAnswers > 0 ? Math.round((confidentIncorrectCount / totalAnswers) * 1000) / 10 : null,
  };
}

// GET /api/analytics/population?topic= — population benchmarking (v4.0.0).
//
// schoolId is NEVER read from the client — it is resolved server-side from the caller's own
// teacher record. The original sprint plan design accepted schoolId as a query parameter with no
// ownership check, which is an IDOR (any teacher could read another school's real aggregate by
// changing the id) — see DESIGN_REVIEW_v400_v410_addendum.md §E2. Only `topic` is client input,
// and it is validated against the preset enum.
app.http('analyticsPopulation', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'analytics/population',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'analytics/population', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`analytics-population:${getClientIp(request)}`, 60, 3600000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const topic = new URL(request.url).searchParams.get('topic');
      if (!isValidTopicTag(topic)) {
        return respond(400, { error: 'topic query parameter must be a recognised topic' }, teacherId);
      }

      let schoolId = null;
      try {
        const { resource: teacherDoc } = await teachersContainer.item(teacherId, teacherId).read();
        schoolId = teacherDoc?.schoolId || null;
      } catch (_) { /* teacher doc missing — schoolId stays null, "your school" will be all zeros */ }

      const [populationResult, school] = await Promise.all([
        populationContainer.item(topic, topic).read().catch(() => ({ resource: null })),
        aggregateSchoolTopic(teacherId, topic),
      ]);

      const population = populationResult.resource
        ? {
            responseCount: populationResult.resource.responseCount,
            pctCorrect: populationResult.resource.pctCorrect,
            pctConfidentIncorrect: populationResult.resource.pctConfidentIncorrect,
          }
        : { responseCount: 0, pctCorrect: null, pctConfidentIncorrect: null };

      return respond(200, { topic, schoolId, population, school }, teacherId);
    } catch (err) {
      context.error('analyticsPopulation error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});

module.exports = { aggregateSchoolTopic };
