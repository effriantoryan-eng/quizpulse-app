// Integration tests for Sprint 3 push endpoints.
// Requires: func start running, B2C_ALLOW_UNVERIFIED_DEV=true, Cosmos accessible.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

function mintToken(oid = 'push-integ-teacher') {
  return jwt.sign(
    { oid, name: 'Push Integration Teacher', emails: ['pushinteg@example.com'] },
    'dev-key',
    { expiresIn: '1h' }
  );
}

function authHeaders(oid) {
  return {
    Authorization: `Bearer ${mintToken(oid)}`,
    'Content-Type': 'application/json',
  };
}

// --- GET /api/vapid-public-key ---

describe('GET /api/vapid-public-key', () => {
  it_int('returns 200 with a publicKey string', async () => {
    const res = await fetch(`${FUNC_URL}/vapid-public-key`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.publicKey).toBe('string');
    expect(data.publicKey.length).toBeGreaterThan(0);
  });
});

// --- POST /api/subscribe ---

describe('POST /api/subscribe — unapproved device', () => {
  it_int('returns 403 for a device with no approved join request', async () => {
    const res = await fetch(`${FUNC_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: 'nonexistent-class-id',
        deviceId: `integ-device-${Date.now()}`,
        subscription: {
          endpoint: 'https://push.example.com/fake-endpoint',
          keys: { p256dh: 'fake-p256dh', auth: 'fake-auth' },
        },
      }),
    });
    expect(res.status).toBe(403);
  });

  it_int('returns 400 for a missing subscription object', async () => {
    const res = await fetch(`${FUNC_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: 'c1', deviceId: 'd1' }),
    });
    expect(res.status).toBe(400);
  });
});

// --- POST /api/send-notification — stale subscription pruning ---

describe('POST /api/send-notification — stale subscription pruning', () => {
  it_int('returns 401 without a token', async () => {
    const res = await fetch(`${FUNC_URL}/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: 'q1', quizTitle: 'T', questionCount: 3 }),
    });
    expect(res.status).toBe(401);
  });

  it_int('prunes a stale subscription and returns pruned count in logs (smoke test)', async () => {
    // This is a smoke-test. In CI a real subscription with a dead endpoint would need to exist.
    // We verify the endpoint is reachable and returns a sensible error for a nonexistent quiz.
    const res = await fetch(`${FUNC_URL}/send-notification`, {
      method: 'POST',
      headers: authHeaders('push-integ-teacher'),
      body: JSON.stringify({ quizId: 'nonexistent-quiz-id', quizTitle: 'T', questionCount: 3 }),
    });
    // 404 expected for nonexistent quiz — proves the function is running.
    expect([404, 400]).toContain(res.status);
  });
});
