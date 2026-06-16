// Unit tests for send-notification logic — idempotency key returns 409.

const { rateLimit } = require('../../../api/rateLimit');

let keyCounter = 0;
function freshKey() { return `send-unit:${Date.now()}:${keyCounter++}`; }

// Minimal handler mirroring sendNotification.js logic for unit testing.
function makeHandler({ quiz = null, subs = [], sendFn = async () => {} } = {}) {
  const SEND_MAX = 5;
  const SEND_WINDOW_MS = 60000;
  const NOTIFICATION_PAYLOAD_MAX = 3 * 1024;

  return async function handler({ teacherId, quizId, quizTitle, questionCount, rateLimitKey }) {
    if (!rateLimit(rateLimitKey || `send:${teacherId}`, SEND_MAX, SEND_WINDOW_MS)) {
      return { status: 429 };
    }

    if (!quiz) return { status: 404 };
    if (quiz.teacherId !== teacherId) return { status: 404 }; // Sprint 5: 404, not 403 — see docs/security/SPRINT5_AUDIT.md
    if (quiz.notificationSentAt) return { status: 409 };

    const payload = JSON.stringify({
      title: 'New quiz from your teacher',
      body: `${quizTitle} · ${questionCount} question(s)`,
      url: `/quiz?quizId=${quizId}`,
    });

    if (Buffer.byteLength(payload, 'utf8') > NOTIFICATION_PAYLOAD_MAX) {
      return { status: 413 };
    }

    let sent = 0;
    for (const sub of subs) {
      try {
        await sendFn(sub, payload);
        sent++;
      } catch { /* stale — pruned in real handler */ }
    }

    quiz.notificationSentAt = new Date().toISOString();
    return { status: 200, sent };
  };
}

describe('send-notification — idempotency', () => {
  test('returns 409 on duplicate quizId', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'], notificationSentAt: '2026-06-01T00:00:00Z' };
    const handler = makeHandler({ quiz });
    const result = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5, rateLimitKey: freshKey() });
    expect(result.status).toBe(409);
  });

  test('returns 200 and marks quiz on first send', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    const handler = makeHandler({ quiz, subs: [{ endpoint: 'e', keys: {} }] });
    const result = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5, rateLimitKey: freshKey() });
    expect(result.status).toBe(200);
    expect(quiz.notificationSentAt).toBeDefined();
  });

  test('second call after first send returns 409', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    const handler = makeHandler({ quiz });
    const key = freshKey();
    await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5, rateLimitKey: key });
    const second = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5, rateLimitKey: freshKey() });
    expect(second.status).toBe(409);
  });

  test('returns 404 when teacherId does not own the quiz (Sprint 5: 404, not 403)', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    const handler = makeHandler({ quiz });
    const result = await handler({ teacherId: 'other', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5, rateLimitKey: freshKey() });
    expect(result.status).toBe(404);
  });

  test('returns 429 after 5 calls from the same teacher per minute', async () => {
    const makeQuiz = () => ({ id: 'q1', teacherId: 't1', classIds: ['c1'] });
    const key = freshKey();
    for (let i = 0; i < 5; i++) {
      const quiz = makeQuiz();
      const handler = makeHandler({ quiz });
      await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5, rateLimitKey: key });
    }
    const quiz = makeQuiz();
    const handler = makeHandler({ quiz });
    const result = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5, rateLimitKey: key });
    expect(result.status).toBe(429);
  });
});
