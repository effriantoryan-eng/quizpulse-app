// Unit tests for send-notification logic — idempotency key returns 409.
// Sprint 6: throughput rate limiting (5/min/teacher) is now enforced by Azure API Management
// (see docs/azure/APIM_SETUP.md), not in-process. The 429 test for the in-process rate
// limit has been removed. The idempotency gate (409 on duplicate send) is tested here.

const NOTIFICATION_PAYLOAD_MAX = 3 * 1024;

// Minimal handler mirroring sendNotification.js logic for unit testing (rate limit removed).
// v4.4.0: also mirrors the pushSuccessCount/pushFailCount advisory write — persistFn stands in
// for the Cosmos upsert, and its failure must never fail the overall send (the pushes already
// went out by the time it runs).
function makeHandler({ quiz = null, subs = [], sendFn = async () => {}, persistFn = async () => {} } = {}) {
  return async function handler({ teacherId, quizId, quizTitle, questionCount }) {
    if (!quiz) return { status: 404 };
    if (quiz.teacherId !== teacherId) return { status: 404 }; // Sprint 5: 404, not 403
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
    quiz.pushSuccessCount = sent;
    quiz.pushFailCount = subs.length - sent;
    try {
      await persistFn(quiz);
    } catch {
      // Advisory (eng review 3A) — same semantics as confidenceResponseCount: a persistence
      // hiccup here must never surface as a failed send.
    }

    return { status: 200, sent };
  };
}

describe('send-notification — idempotency', () => {
  test('returns 409 on duplicate quizId (quiz already has notificationSentAt)', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'], notificationSentAt: '2026-06-01T00:00:00Z' };
    const handler = makeHandler({ quiz });
    const result = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5 });
    expect(result.status).toBe(409);
  });

  test('returns 200 and marks quiz on first send', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    const handler = makeHandler({ quiz, subs: [{ endpoint: 'e', keys: {} }] });
    const result = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5 });
    expect(result.status).toBe(200);
    expect(quiz.notificationSentAt).toBeDefined();
  });

  test('second call after first send returns 409', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    const handler = makeHandler({ quiz });
    await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5 });
    const second = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5 });
    expect(second.status).toBe(409);
  });

  test('returns 404 when teacherId does not own the quiz (Sprint 5: 404, not 403)', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    const handler = makeHandler({ quiz });
    const result = await handler({ teacherId: 'other', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5 });
    expect(result.status).toBe(404);
  });

  test('payload over 3 KB returns 413', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    const handler = makeHandler({ quiz });
    const longTitle = 'A'.repeat(4000);
    const result = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: longTitle, questionCount: 5 });
    expect(result.status).toBe(413);
  });
});

// CRITICAL REGRESSION TEST (eng review 3A, mandatory): the push-count write is advisory —
// its failure must never surface as a failed send, since the pushes already went out.
describe('send-notification — advisory push-count persistence (v4.4.0)', () => {
  test('still returns 200 when the push-count persistence write throws', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    const throwingPersist = async () => { throw new Error('Cosmos write failed'); };
    const handler = makeHandler({ quiz, subs: [{ endpoint: 'e', keys: {} }], persistFn: throwingPersist });
    const result = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5 });
    expect(result.status).toBe(200);
    expect(result.sent).toBe(1);
  });

  test('computes pushSuccessCount/pushFailCount from actual send outcomes', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    let callCount = 0;
    const sendFn = async () => {
      callCount++;
      if (callCount === 2) throw new Error('stale subscription');
    };
    const handler = makeHandler({ quiz, subs: [{}, {}, {}], sendFn });
    await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5 });
    expect(quiz.pushSuccessCount).toBe(2);
    expect(quiz.pushFailCount).toBe(1);
  });

  test('a successful persistence write still leaves the send at 200', async () => {
    const quiz = { id: 'q1', teacherId: 't1', classIds: ['c1'] };
    const persisted = [];
    const handler = makeHandler({ quiz, subs: [{}], persistFn: async (q) => { persisted.push({ ...q }); } });
    const result = await handler({ teacherId: 't1', quizId: 'q1', quizTitle: 'Quiz', questionCount: 5 });
    expect(result.status).toBe(200);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].pushSuccessCount).toBe(1);
    expect(persisted[0].pushFailCount).toBe(0);
  });
});
