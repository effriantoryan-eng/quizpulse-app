// v4.6.0 Task 1 — server-orchestrated first-run chain: demo class -> starter pack -> draft quiz
// -> send -> simulate, as ONE endpoint (POST /api/onboarding/first-run) rather than client
// sequential fetches, so a dropped connection mid-chain can't leave a half-built demo behind
// silently. Idempotent by construction (materializeAi.js pattern): every substep id is
// deterministic from teacherId, every create is 409-tolerant, and a resumed call picks up
// wherever the previous attempt stopped.
const { deterministicId } = require('./materializeAi');
const { seedStarterQuestions } = require('./starterPack');
const { selectDemoStudents, DEMO_STUDENT_COUNT } = require('./demoNames');
const { sendNotificationForQuiz } = require('../sendNotification');

const FIRST_RUN_DEMO_CLASS_NAME = 'Practice class';
const FIRST_RUN_QUIZ_NAME = 'Practice quiz';
const FIRST_RUN_DURATION_MINUTES = 60;

function firstRunDemoClassId(teacherId) {
  return deterministicId('first-run-demo-class', teacherId);
}
function firstRunQuizId(teacherId) {
  return deterministicId('first-run-quiz', teacherId);
}

// A teacher may only ever have ONE demo class (Security limits table). Query by teacherId+isDemo
// first (not by our deterministic id) so this reuses a demo class the teacher already made
// manually via POST /api/classes, rather than creating a second one and breaking that invariant.
async function getOrCreateDemoClass({ teacherId, schoolId, classesContainer }) {
  const { resources } = await classesContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.teacherId = @tid AND c.isDemo = true',
      parameters: [{ name: '@tid', value: teacherId }],
    })
    .fetchAll();
  if (resources.length > 0) return resources[0];

  // ponytail: this query-then-create isn't atomic against a concurrent POST /api/classes demo
  // create (that path uses a random-uuid id, so the deterministic-id 409 below only guards two
  // racing first-run calls, not the cross-endpoint case). Accepted for a pre-pilot single-user
  // tool — the window is a double-fire during onboarding, and it degrades gracefully (a later
  // getOrCreate just returns resources[0]). Upgrade path: a Cosmos unique-key policy on
  // (teacherId, isDemo) if two demo classes ever actually show up.
  const doc = {
    id: firstRunDemoClassId(teacherId),
    teacherId,
    schoolId: schoolId || null,
    name: FIRST_RUN_DEMO_CLASS_NAME,
    studentCount: DEMO_STUDENT_COUNT,
    nameListEnabled: false,
    cap: 40,
    isDemo: true,
    demoStudents: selectDemoStudents(DEMO_STUDENT_COUNT),
    createdAt: new Date().toISOString(),
  };
  try {
    const { resource } = await classesContainer.items.create(doc);
    return resource;
  } catch (err) {
    if (err.code === 409) {
      const { resource } = await classesContainer.item(doc.id, teacherId).read();
      return resource;
    }
    throw err;
  }
}

async function getOrCreateQuiz({ teacherId, questionIds, cls, quizzesContainer }) {
  const id = firstRunQuizId(teacherId);
  // Cosmos's item().read() does NOT throw on a missing item in this SDK setup — it resolves with
  // resource: undefined (same reason getTeacher() elsewhere coalesces with `|| null` rather than
  // relying on its catch block for 404). Must check resource truthiness, not just catch(err).
  try {
    const { resource } = await quizzesContainer.item(id, teacherId).read();
    if (resource) return resource;
  } catch (err) {
    if (err.code !== 404) throw err;
  }

  // classSize matches the resolved demo class's actual roster, not a fixed constant — if this
  // reuses a pre-existing demo class whose roster differs, analytics response-rate math stays
  // correct (the denominator tracks the real roster).
  const classSize = Array.isArray(cls.demoStudents) ? cls.demoStudents.length : (cls.studentCount || DEMO_STUDENT_COUNT);
  const now = new Date();
  const doc = {
    id,
    teacherId,
    name: FIRST_RUN_QUIZ_NAME,
    questionIds,
    classIds: [cls.id],
    classSize,
    status: 'sent',
    sentAt: now.toISOString(),
    closedAt: new Date(now.getTime() + FIRST_RUN_DURATION_MINUTES * 60000).toISOString(),
    scheduledFor: null,
    durationMinutes: FIRST_RUN_DURATION_MINUTES,
    isDemo: true,
    topicTag: null,
    schoolId: null,
    createdAt: now.toISOString(),
  };
  try {
    const { resource } = await quizzesContainer.items.create(doc);
    return resource;
  } catch (err) {
    if (err.code === 409) {
      const { resource } = await quizzesContainer.item(id, teacherId).read();
      return resource;
    }
    throw err;
  }
}

// Orchestrates the full chain. `deps` are injected containers (unit tests / retry-idempotency
// integration test); omit only from real handlers, which pass real containers explicitly.
async function runFirstRun({ teacherId, schoolId, context, deps }) {
  const { classesContainer, questionsContainer, quizzesContainer } = deps;

  const cls = await getOrCreateDemoClass({ teacherId, schoolId, classesContainer });
  context?.log?.(`first-run step=create-demo-class teacherId=${teacherId} classId=${cls.id}`);

  const questions = await seedStarterQuestions(teacherId, questionsContainer);
  context?.log?.(`first-run step=seed-questions teacherId=${teacherId} count=${questions.length}`);

  const quiz = await getOrCreateQuiz({
    teacherId,
    questionIds: questions.map((q) => q.id),
    cls,
    quizzesContainer,
  });
  context?.log?.(`first-run step=create-quiz teacherId=${teacherId} quizId=${quiz.id}`);

  // Resume is by construction: every step above is an idempotent get-or-create, so a re-call
  // picks up wherever the previous attempt stopped. Send is the last step — guard on the quiz's
  // own notificationSentAt (runSimulation's 409 guard is the backstop against a double-simulate).
  if (!quiz.notificationSentAt) {
    const simResult = await sendNotificationForQuiz(quiz, context);
    if (simResult.error) {
      context?.error?.(`first-run step=send-and-simulate teacherId=${teacherId} error=${simResult.error}`);
      return { error: simResult.error, status: simResult.status || 500 };
    }
    context?.log?.(`first-run step=send-and-simulate teacherId=${teacherId} simulated=${simResult.simulated}`);
  }

  return { quizId: quiz.id, classId: cls.id };
}

module.exports = {
  runFirstRun,
  getOrCreateDemoClass,
  getOrCreateQuiz,
  firstRunDemoClassId,
  firstRunQuizId,
  FIRST_RUN_DEMO_CLASS_NAME,
  FIRST_RUN_QUIZ_NAME,
  FIRST_RUN_DURATION_MINUTES,
};
