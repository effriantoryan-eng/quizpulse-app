// Unit test for the demo branch of sendNotificationForQuiz (v3.3.0): when the quiz's target class
// is a demo class, push must be SKIPPED entirely and simulated responses generated instead.
//
// We mock 'web-push' (to assert sendNotification is never called) and '@azure/cosmos' (an in-memory
// store shared by sendNotification.js and the lazily-created client inside runSimulation.js).

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(async () => {}),
}));

// In-memory containers shared by sendNotification.js and runSimulation.js (both resolve from the
// same mocked CosmosClient). The store lives on global so the mock factory (which may not reference
// outer-scope variables) and the tests can both reach it.
jest.mock('@azure/cosmos', () => {
  const mockStore = {
    classes: [], quizzes: [], responses: [], questions: [], subscriptions: [],
  };
  global.__demoStore = mockStore;
  const makeContainer = (name) => ({
    items: {
      query: (spec) => ({
        fetchAll: async () => {
          const q = typeof spec === 'string' ? spec : spec.query;
          if (name === 'responses' && /COUNT/i.test(q)) {
            return { resources: [mockStore.responses.filter(r => r.simulated === true).length] };
          }
          return { resources: mockStore[name] || [] };
        },
      }),
      create: async (doc) => { mockStore[name].push(doc); return { resource: doc }; },
      upsert: async (doc) => {
        const arr = mockStore[name];
        const i = arr.findIndex(d => d.id === doc.id);
        if (i >= 0) arr[i] = doc; else arr.push(doc);
        return { resource: doc };
      },
    },
  });
  return {
    CosmosClient: jest.fn().mockImplementation(() => ({
      database: () => ({ container: (name) => makeContainer(name) }),
    })),
  };
});

require('@azure/cosmos'); // force the mock factory to run so global.__demoStore is populated
const store = global.__demoStore;

// Container names default to these when the env vars are unset (see the modules under test).
process.env.COSMOS_CONTAINER_CLASSES = 'classes';
process.env.COSMOS_CONTAINER_QUIZZES = 'quizzes';
process.env.COSMOS_CONTAINER_RESPONSES = 'responses';
process.env.COSMOS_CONTAINER_QUESTIONS = 'questions';
process.env.COSMOS_CONTAINER_SUBSCRIPTIONS = 'subscriptions';

const webpush = require('web-push');
const { sendNotificationForQuiz } = require('../../../api/sendNotification');

const ctx = { log: () => {}, warn: () => {}, error: () => {} };

beforeEach(() => {
  webpush.sendNotification.mockClear();
  store.classes = [];
  store.quizzes = [];
  store.responses = [];
  store.questions = [];
  store.subscriptions = [];
});

describe('sendNotificationForQuiz — demo class branch', () => {
  test('skips push and writes 24 simulated responses for a demo quiz', async () => {
    const demoStudents = Array.from({ length: 24 }, (_, i) => ({ studentId: `s${i}`, name: `Student ${i}` }));
    store.classes.push({ id: 'c-demo', teacherId: 't1', isDemo: true, demoStudents });
    store.questions.push({ id: 'qa', options: ['a', 'b', 'c', 'd'], correctIndex: 0 });
    const quiz = { id: 'q-demo', teacherId: 't1', classIds: ['c-demo'], questionIds: ['qa'], sentAt: new Date().toISOString() };
    store.quizzes.push(quiz);
    // A subscription exists for the class — it must be ignored on the demo path.
    store.subscriptions.push({ id: 'sub1', classId: 'c-demo', endpoint: 'e', keys: {} });

    const result = await sendNotificationForQuiz(quiz, ctx, { quizTitle: 'Demo Quiz', questionCount: 1 });

    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(result.simulated).toBe(24);
    expect(result.sent).toBe(0);
    expect(store.responses).toHaveLength(24);
    expect(store.responses.every(r => r.isDemo === true && r.simulated === true)).toBe(true);
    expect(quiz.notificationSentAt).toBeDefined();
  });

  test('non-demo quiz still pushes to subscribers (control)', async () => {
    store.classes.push({ id: 'c-real', teacherId: 't1', isDemo: false });
    const quiz = { id: 'q-real', teacherId: 't1', classIds: ['c-real'], questionIds: ['qa'] };
    store.quizzes.push(quiz);
    store.subscriptions.push({ id: 'sub1', classId: 'c-real', endpoint: 'e', keys: { p256dh: 'x', auth: 'y' } });

    const result = await sendNotificationForQuiz(quiz, ctx, { quizTitle: 'Real Quiz', questionCount: 1 });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
    expect(store.responses).toHaveLength(0); // no simulation on the real path
  });
});
