// Regression: ISSUE-001 — AI-materialised questions (topic 'Other', api/generationDrafts.js)
// could never be edited or visibility-toggled: the PUT's topic enum check rejected the stored
// value before any other validation ran, so every round-trip 400'd with a misleading topic
// error and the AI-visibility lock message was unreachable.
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-16.md
//
// Exercises the REAL questionById PUT handler (captured from app.http) with mocked
// Cosmos/auth/rateLimit — same technique as demoSendNotification.test.js.

const capturedHandlers = {};

jest.mock('@azure/functions', () => ({
  app: {
    http: (name, cfg) => { capturedHandlers[name] = cfg.handler; },
  },
}));

// One stored doc + captured upserts, reachable from both the mock factory and the tests.
global.__questionsStore = { doc: null, upserts: [] };

jest.mock('@azure/cosmos', () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: () => ({
      container: () => ({
        items: {
          query: () => ({
            fetchAll: async () => ({
              resources: global.__questionsStore.doc ? [global.__questionsStore.doc] : [],
            }),
          }),
          upsert: async (doc) => {
            global.__questionsStore.upserts.push(doc);
            return { resource: doc };
          },
        },
        item: () => ({ delete: async () => {} }),
      }),
    }),
  })),
}));

jest.mock('../../../api/auth', () => ({
  authenticateTeacher: async () => ({ teacherId: 'teacher-A', claims: { oid: 'teacher-A' } }),
}));

jest.mock('../../../api/rateLimit', () => ({
  rateLimit: () => true,
  getClientIp: () => '203.0.113.1',
}));

jest.mock('../../../api/logger', () => ({
  logRequest: () => {},
}));

require('../../../api/questions');

const context = { log: () => {}, warn: () => {}, error: () => {} };

function makePutRequest(id, body) {
  return {
    method: 'PUT',
    params: { id },
    headers: { get: (h) => (h === 'content-length' ? String(JSON.stringify(body).length) : null) },
    json: async () => body,
  };
}

const AI_QUESTION = {
  id: 'q-ai-1',
  teacherId: 'teacher-A',
  authorId: 'teacher-A',
  text: 'According to the document, which is associated with "Photosynthesis"?',
  options: ['convert', 'Photosynthesis', 'process', 'chemical'],
  correctIndex: 1,
  topic: 'Other', // outside ALLOWED_TOPICS — how generationDrafts.js materialises AI questions
  visibility: 'private',
  generatedBy: 'ai',
};

beforeEach(() => {
  global.__questionsStore.doc = { ...AI_QUESTION };
  global.__questionsStore.upserts = [];
});

describe('questionById PUT — out-of-enum stored topic (ISSUE-001)', () => {
  test('an unchanged stored topic outside the enum round-trips (edit save succeeds)', async () => {
    const res = await capturedHandlers.questionById(
      makePutRequest('q-ai-1', {
        text: 'Edited text for the AI question?',
        options: AI_QUESTION.options,
        correctIndex: 1,
        topic: 'Other', // unchanged — must NOT be rejected
        yearLevel: null,
      }),
      context
    );
    expect(res.status).toBe(200);
    expect(global.__questionsStore.upserts).toHaveLength(1);
    expect(global.__questionsStore.upserts[0].topic).toBe('Other');
    expect(global.__questionsStore.upserts[0].text).toBe('Edited text for the AI question?');
  });

  test('changing TO an invalid topic is still rejected', async () => {
    const res = await capturedHandlers.questionById(
      makePutRequest('q-ai-1', {
        text: AI_QUESTION.text,
        options: AI_QUESTION.options,
        correctIndex: 1,
        topic: 'Bogus',
      }),
      context
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toMatch(/topic must be one of/);
    expect(global.__questionsStore.upserts).toHaveLength(0);
  });

  test('the AI-visibility lock message is reachable (no longer masked by the topic error)', async () => {
    const res = await capturedHandlers.questionById(
      makePutRequest('q-ai-1', {
        text: AI_QUESTION.text,
        options: AI_QUESTION.options,
        correctIndex: 1,
        topic: 'Other',
        visibility: 'school',
      }),
      context
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toMatch(/AI-created questions can't be shared/);
    expect(global.__questionsStore.upserts).toHaveLength(0);
  });
});
