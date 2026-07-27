// v4.6.0 Task 1 — pure resume-resolver + idempotency tests for the first-run chain, using
// injected fake containers (no Cosmos, no func host) so the offline unit suite exercises the
// retry-safety guarantees before the integration retry test does.
// Must be hoisted above the require() below — firstRun.js pulls in api/sendNotification.js,
// which constructs a real CosmosClient at module load time. Mocking it here keeps this suite
// Cosmos-free (mirrors sendNotification.test.js's own approach for the same reason).
jest.mock('../../../api/sendNotification', () => ({
  sendNotificationForQuiz: jest.fn(async (quiz) => {
    quiz.notificationSentAt = new Date().toISOString();
    return { sent: 0, total: 24, simulated: 24 };
  }),
}));

const { runFirstRun, firstRunDemoClassId, firstRunQuizId } = require('../../../api/shared/firstRun');

// Minimal in-memory fakes covering just what firstRun.js and its dependencies (starterPack,
// sendNotification's demo branch, runSimulation) touch.
function makeFakeContainers({ teacherId }) {
  const classes = new Map();
  const questions = new Map();
  const quizzes = new Map();
  const responses = new Map();

  const classesContainer = {
    items: {
      query: ({ parameters }) => ({
        fetchAll: async () => ({ resources: [...classes.values()].filter(c => c.teacherId === teacherId && c.isDemo === true) }),
      }),
      create: async (doc) => {
        if (classes.has(doc.id)) { const e = new Error('conflict'); e.code = 409; throw e; }
        classes.set(doc.id, doc);
        return { resource: doc };
      },
    },
    item: (id) => ({
      read: async () => {
        const doc = classes.get(id);
        if (!doc) { const e = new Error('not found'); e.code = 404; throw e; }
        return { resource: doc };
      },
    }),
  };

  const questionsContainer = {
    items: {
      create: async (doc) => {
        if (questions.has(doc.id)) { const e = new Error('conflict'); e.code = 409; throw e; }
        questions.set(doc.id, doc);
        return { resource: doc };
      },
      query: ({ query, parameters }) => ({
        fetchAll: async () => {
          if (query.includes('IN (')) {
            return { resources: [...questions.values()] };
          }
          return { resources: [] };
        },
      }),
    },
    item: (id) => ({
      read: async () => {
        const doc = questions.get(id);
        if (!doc) { const e = new Error('not found'); e.code = 404; throw e; }
        return { resource: doc };
      },
    }),
  };

  const quizzesContainer = {
    items: {
      create: async (doc) => {
        if (quizzes.has(doc.id)) { const e = new Error('conflict'); e.code = 409; throw e; }
        quizzes.set(doc.id, doc);
        return { resource: doc };
      },
      upsert: async (doc) => { quizzes.set(doc.id, doc); return { resource: doc }; },
      query: () => ({ fetchAll: async () => ({ resources: [] }) }),
    },
    item: (id) => ({
      read: async () => {
        const doc = quizzes.get(id);
        if (!doc) { const e = new Error('not found'); e.code = 404; throw e; }
        return { resource: doc };
      },
      patch: async () => ({ resource: quizzes.get(id) }),
    }),
  };

  const responsesContainer = {
    items: {
      create: async (doc) => { responses.set(doc.id, doc); return { resource: doc }; },
      query: () => ({ fetchAll: async () => ({ resources: [[...responses.values()].filter(r => r.simulated).length] }) }),
    },
  };

  return { classes, questions, quizzes, responses, classesContainer, questionsContainer, quizzesContainer, responsesContainer };
}

describe('runFirstRun idempotency (injected fake containers)', () => {
  test('a re-call after the chain already completed creates zero duplicate docs and is a no-op', async () => {
    const teacherId = 'teacher-a';
    const fakes = makeFakeContainers({ teacherId });

    const first = await runFirstRun({
      teacherId,
      schoolId: null,
      context: null,
      deps: fakes,
    });
    expect(first.quizId).toBe(firstRunQuizId(teacherId));
    expect(fakes.classes.size).toBe(1);
    expect(fakes.questions.size).toBe(5);
    expect(fakes.quizzes.size).toBe(1);

    const second = await runFirstRun({
      teacherId,
      schoolId: null,
      context: null,
      deps: fakes,
    });
    expect(second.quizId).toBe(first.quizId);
    expect(fakes.classes.size).toBe(1);
    expect(fakes.questions.size).toBe(5);
    expect(fakes.quizzes.size).toBe(1);
  });

  test('demo class and quiz ids are deterministic per teacher', () => {
    expect(firstRunDemoClassId('t1')).toBe(firstRunDemoClassId('t1'));
    expect(firstRunDemoClassId('t1')).not.toBe(firstRunDemoClassId('t2'));
    expect(firstRunQuizId('t1')).not.toBe(firstRunDemoClassId('t1'));
  });

  test('quiz classSize matches the resolved demo class roster (not a hardcoded constant)', async () => {
    const teacherId = 'teacher-c';
    const fakes = makeFakeContainers({ teacherId });
    // Pre-seed a demo class with a NON-24 roster, as if reused from an earlier/manual create.
    fakes.classes.set('pre-existing', {
      id: 'pre-existing', teacherId, isDemo: true,
      demoStudents: [{ studentId: 's1', name: 'A' }, { studentId: 's2', name: 'B' }, { studentId: 's3', name: 'C' }],
    });

    await runFirstRun({ teacherId, schoolId: null, context: null, deps: fakes });
    const quiz = fakes.quizzes.get(firstRunQuizId(teacherId));
    expect(quiz.classSize).toBe(3); // tracks the reused class's real roster, not 24
    expect(quiz.classIds).toEqual(['pre-existing']);
  });
});
