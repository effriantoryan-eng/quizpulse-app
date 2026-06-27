// Simulated response generation for demo classes (v3.3.0).
//
// A demo class (api/shared/demoNames.js) lets a teacher explore the Send → Analytics loop without
// recruiting real students. When a demo quiz is "sent" — either manually (api/simulateResponses.js,
// or the demo branch of api/sendNotification.js) or by the scheduled-send timer — no push goes out;
// instead this module fabricates one response per demo student so analytics populate realistically.
//
// The sampler functions are pure (Math.random only) and exported for unit testing. Cosmos
// containers are created lazily inside runSimulation() so requiring this module for the samplers
// alone never instantiates a CosmosClient (keeps unit tests env-free).

const crypto = require('crypto');

const CORRECT_PROBABILITY = 0.65;

// Uniform integer in [min, max) — floor of a uniform real.
function uniformInt(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

// Picks an answer index for one question: the correct option with probability 0.65, otherwise a
// uniformly random INCORRECT option. Models a class that mostly knows the material but not perfectly.
function pickAnswer(correctIndex, optionCount) {
  if (!Number.isInteger(optionCount) || optionCount <= 1) return 0;
  const hasValidCorrect = Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < optionCount;
  if (hasValidCorrect && Math.random() < CORRECT_PROBABILITY) {
    return correctIndex;
  }
  // Random incorrect option (excluding the correct one when it's valid).
  let idx = Math.floor(Math.random() * optionCount);
  if (hasValidCorrect) {
    while (idx === correctIndex) idx = Math.floor(Math.random() * optionCount);
  }
  return idx;
}

// Weighted confidence: "sure" 0.40, "pretty_sure" 0.40, "guessing" 0.20.
function pickConfidence() {
  const r = Math.random();
  if (r < 0.40) return 'sure';
  if (r < 0.80) return 'pretty_sure';
  return 'guessing';
}

// Bimodal per-question response time: 30% of answers are fast (2–5s), 70% are deliberate (10–35s).
function pickResponseTimeMs() {
  if (Math.random() < 0.30) return uniformInt(2000, 5000);
  return uniformInt(10000, 35000);
}

// Pure generator — builds one response doc per demo student. No DB access, exported for testing.
function generateSimulatedResponses({ quiz, demoStudents, questions }) {
  const sentAtMs = quiz.sentAt ? new Date(quiz.sentAt).getTime() : Date.now();
  return demoStudents.map((student) => {
    const answers = questions.map((q) => {
      const optionCount = Array.isArray(q.options) ? q.options.length : 4;
      return {
        questionId: q.id,
        selectedIndex: pickAnswer(q.correctIndex, optionCount),
        confidence: pickConfidence(),
        responseTimeMs: pickResponseTimeMs(),
      };
    });
    const quizDurationMs = answers.reduce((sum, a) => sum + a.responseTimeMs, 0);
    const completedAt = new Date(sentAtMs + uniformInt(20000, 40000)).toISOString();
    return {
      id: crypto.randomUUID(),
      quizId: quiz.id,
      studentId: student.studentId,
      answers,
      quizDurationMs,
      completedAt,
      isDemo: true,
      simulated: true,
    };
  });
}

let _containers = null;
function getContainers() {
  if (!_containers) {
    const { CosmosClient } = require('@azure/cosmos');
    const client = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT,
      key: process.env.COSMOS_KEY,
    });
    const database = client.database(process.env.COSMOS_DATABASE);
    _containers = {
      responsesContainer: database.container(process.env.COSMOS_CONTAINER_RESPONSES || 'responses'),
      questionsContainer: database.container(process.env.COSMOS_CONTAINER_QUESTIONS || 'questions'),
    };
  }
  return _containers;
}

// Generates and persists one simulated response per demo student for `quiz`, using the demo
// class `cls` (must carry demoStudents). Idempotent: if any simulated response already exists for
// this quiz, returns { error, status: 409 } and writes nothing. On success returns
// { simulated, total }. Used by both api/simulateResponses.js and the demo branch of
// api/sendNotification.js (and, transitively, the scheduled-send timer).
async function runSimulation(quiz, cls, context, deps) {
  // `deps` lets unit tests inject fake containers; production call sites pass 3 args and use the
  // lazily-created Cosmos containers.
  const { responsesContainer, questionsContainer } = deps || getContainers();

  // Idempotency — never simulate the same quiz twice.
  const { resources: existing } = await responsesContainer.items.query({
    query: 'SELECT VALUE COUNT(1) FROM c WHERE c.quizId = @qid AND c.simulated = true',
    parameters: [{ name: '@qid', value: quiz.id }],
  }).fetchAll();
  if ((existing[0] || 0) > 0) {
    return { error: 'Simulated responses already exist for this quiz', status: 409 };
  }

  const demoStudents = Array.isArray(cls.demoStudents) ? cls.demoStudents : [];

  // Load the quiz's questions (id, options, correctIndex) in their original order.
  const questionIds = quiz.questionIds || [];
  let questions = [];
  if (questionIds.length > 0) {
    const idParams = questionIds.map((qid, i) => ({ name: `@qid${i}`, value: qid }));
    const idList = idParams.map((p) => p.name).join(', ');
    const { resources } = await questionsContainer.items.query({
      query: `SELECT c.id, c.options, c.correctIndex FROM c WHERE c.id IN (${idList})`,
      parameters: idParams,
    }).fetchAll();
    const byId = new Map(resources.map((q) => [q.id, q]));
    questions = questionIds.map((qid) => byId.get(qid)).filter(Boolean);
  }

  const docs = generateSimulatedResponses({ quiz, demoStudents, questions });
  await Promise.all(docs.map((d) => responsesContainer.items.create(d)));

  context?.log?.(`Simulated ${docs.length} response(s) for demo quiz ${quiz.id}`);
  return { simulated: docs.length, total: demoStudents.length };
}

module.exports = {
  runSimulation,
  generateSimulatedResponses,
  pickAnswer,
  pickConfidence,
  pickResponseTimeMs,
  CORRECT_PROBABILITY,
};
