// Integration tests for Sprint 4 endpoints — quiz-taking, responses, analytics, scheduling.
// Requires: func start running, B2C_ALLOW_UNVERIFIED_DEV=true, Cosmos accessible.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

function mintToken(oid = 'sprint4-integ-teacher') {
  return jwt.sign(
    { oid, name: 'Sprint 4 Integration Teacher', emails: ['sprint4integ@example.com'] },
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

// --- GET /api/quizzes/{id}/questions ---

describe('GET /api/quizzes/:id/questions', () => {
  it_int('returns 404 for a nonexistent quiz', async () => {
    const res = await fetch(`${FUNC_URL}/quizzes/nonexistent-quiz-id/questions`);
    expect(res.status).toBe(404);
  });
});

// --- POST /api/responses — Sprint 4 gating ---

describe('POST /api/responses — Sprint 4 gating', () => {
  it_int('returns 404 for a nonexistent quiz', async () => {
    const res = await fetch(`${FUNC_URL}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: 'nonexistent-quiz-id', studentId: 'integ-device', answers: [{ questionId: 'q1', selectedIndex: 0 }] }),
    });
    expect(res.status).toBe(404);
  });

  it_int('returns 413 for an oversized body', async () => {
    const hugeAnswers = Array.from({ length: 50 }, (_, i) => ({ questionId: `q${i}`, selectedIndex: 0, padding: 'x'.repeat(200) }));
    const res = await fetch(`${FUNC_URL}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: 'q1', studentId: 'integ-device', answers: hugeAnswers }),
    });
    expect(res.status).toBe(413);
  });

  it_int('returns 400 when studentId is missing', async () => {
    const res = await fetch(`${FUNC_URL}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: 'q1', answers: [{ questionId: 'q1', selectedIndex: 0 }] }),
    });
    expect(res.status).toBe(400);
  });
});

// --- GET /api/analytics ---

describe('GET /api/analytics', () => {
  it_int('returns 401 without a token', async () => {
    const res = await fetch(`${FUNC_URL}/analytics?quizId=q1`);
    expect(res.status).toBe(401);
  });

  it_int('returns 404 for a nonexistent quiz', async () => {
    const res = await fetch(`${FUNC_URL}/analytics?quizId=nonexistent-quiz-id`, {
      headers: authHeaders('sprint4-integ-teacher'),
    });
    expect(res.status).toBe(404);
  });
});

// --- GET /api/analytics/export ---

describe('GET /api/analytics/export', () => {
  it_int('returns 401 without a token', async () => {
    const res = await fetch(`${FUNC_URL}/analytics/export?quizId=q1`);
    expect(res.status).toBe(401);
  });
});

// --- POST /api/simulate — retired ---

describe('POST /api/simulate — retired in Sprint 4', () => {
  it_int('returns 404 — the endpoint no longer exists', async () => {
    const res = await fetch(`${FUNC_URL}/simulate`, {
      method: 'POST',
      headers: authHeaders('sprint4-integ-teacher'),
      body: JSON.stringify({ quizId: 'q1', questions: [], classSize: 1 }),
    });
    expect(res.status).toBe(404);
  });
});
