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
    item: (id) => ({
      patch: async (ops) => {
        const doc = mockStore[name].find((d) => d.id === id);
        if (!doc) { const e = new Error('not found'); e.code = 404; throw e; }
        for (const { op, path, value } of ops) {
          const field = path.replace(/^\//, '');
          if (op === 'incr') doc[field] = (doc[field] || 0) + value;
          else if (op === 'set') doc[field] = value;
        }
        return { resource: doc };
      },
      delete: async () => {
        const arr = mockStore[name] || [];
        const i = arr.findIndex((d) => d.id === id);
        if (i < 0) { const e = new Error('not found'); e.code = 404; throw e; }
        arr.splice(i, 1);
        return {};
      },
    }),
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
process.env.COSMOS_CONTAINER_JOIN_REQUESTS = 'join_requests';

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
  store.join_requests = [];
});

describe('sendNotificationForQuiz — demo class branch', () => {
  test('skips push and writes 24 simulated responses for a demo quiz', async () => {
    const demoStudents = Array.from({ length: 24 }, (_, i) => ({ studentId: `s${i}`, name: `Student ${i}` }));
    store.classes.push({ id: 'c-demo', teacherId: 't1', isDemo: true, demoStudents });
    store.questions.push({ id: 'qa', options: ['a', 'b', 'c', 'd'], correctIndex: 0 });
    const quiz = { id: 'q-demo', teacherId: 't1', classIds: ['c-demo'], questionIds: ['qa'], status: 'sent', sentAt: new Date().toISOString() };
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
    // Regression guard: runSimulation's confidenceResponseCount patch must survive this call —
    // previously a full upsert() of the stale in-memory `quiz` here silently clobbered it back
    // to undefined right after runSimulation set it.
    const persisted = store.quizzes.find((q) => q.id === 'q-demo');
    expect(persisted.confidenceResponseCount).toBe(24);
  });

  test('non-demo quiz still pushes to subscribers with an approved enrolment (control)', async () => {
    store.classes.push({ id: 'c-real', teacherId: 't1', isDemo: false });
    const quiz = { id: 'q-real', teacherId: 't1', classIds: ['c-real'], questionIds: ['qa'], status: 'sent' };
    store.quizzes.push(quiz);
    // R1: the subscriber's device must hold an approved join request to be eligible at send time.
    store.join_requests.push({ id: 'jr1', classId: 'c-real', deviceId: 'D1', status: 'approved' });
    store.subscriptions.push({ id: 'sub1', classId: 'c-real', deviceId: 'D1', endpoint: 'e', keys: { p256dh: 'x', auth: 'y' } });

    const result = await sendNotificationForQuiz(quiz, ctx, { quizTitle: 'Real Quiz', questionCount: 1 });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
    expect(store.responses).toHaveLength(0); // no simulation on the real path
  });

  test('R1: a subscription for a removed student (no approved join request) is not notified and is pruned', async () => {
    store.classes.push({ id: 'c-real', teacherId: 't1', isDemo: false });
    const quiz = { id: 'q-real2', teacherId: 't1', classIds: ['c-real'], questionIds: ['qa'], status: 'sent' };
    store.quizzes.push(quiz);
    // No approved join request for D2 → the leftover subscription is stale.
    store.subscriptions.push({ id: 'sub2', classId: 'c-real', deviceId: 'D2', endpoint: 'e', keys: { p256dh: 'x', auth: 'y' } });

    const result = await sendNotificationForQuiz(quiz, ctx, { quizTitle: 'Real Quiz', questionCount: 1 });

    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, total: 0 });
    expect(store.subscriptions.find((s) => s.id === 'sub2')).toBeUndefined(); // pruned
  });
});
