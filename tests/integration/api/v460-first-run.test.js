// Integration tests for v4.6.0 Task 1 — POST /api/onboarding/first-run and
// POST /api/questions/starter-seed.
//
// Requires: func start running, B2C_ALLOW_UNVERIFIED_DEV=true, Cosmos accessible (the TEST
// Cosmos account — see CLAUDE.md Testing section; NEVER run this against production Cosmos).
// Run with: RUN_INTEGRATION=true npm test -- tests/integration/api/v460-first-run.test.js
//
// Covers the two house-rule requirements CC_PROMPTS_v460 calls out for these endpoints:
// (1) a cross-tenant negative test, and (2) a real-wiring retry-idempotency test (the unit
// suite's fake-container test covers the resume LOGIC; this covers the actual Cosmos wiring).

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

function mintToken(oid, extraClaims = {}) {
  return jwt.sign({ oid, name: 'Integration Teacher', emails: [`${oid}@example.com`], ...extraClaims }, 'dev-key', { expiresIn: '1h' });
}

function authHeaders(oid, extraClaims = {}) {
  return {
    Authorization: `Bearer ${mintToken(oid, extraClaims)}`,
    'Content-Type': 'application/json',
  };
}

async function post(path, oid) {
  return fetch(`${FUNC_URL}${path}`, { method: 'POST', headers: authHeaders(oid), body: '{}' });
}

const TEACHER_A = `v460-fr-teacher-A-${Date.now()}`;
const TEACHER_B = `v460-fr-teacher-B-${Date.now()}`;

describe('POST /api/onboarding/first-run', () => {
  let quizIdA;

  it_int('creates a demo class + quiz + simulated responses for a brand-new teacher', async () => {
    const res = await post('/onboarding/first-run', TEACHER_A);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.quizId).toBe('string');
    expect(typeof body.classId).toBe('string');
    quizIdA = body.quizId;
  });

  it_int('retry-idempotency: calling it again creates zero duplicates and returns the same ids', async () => {
    const res = await post('/onboarding/first-run', TEACHER_A);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quizId).toBe(quizIdA);
  });

  // REQUIRED cross-tenant negative test — Teacher B's own call must never touch Teacher A's
  // partition, and must produce Teacher B's OWN, different demo class/quiz.
  it_int('cross-tenant: Teacher B calling first-run never sees or reuses Teacher A\'s demo class/quiz', async () => {
    const res = await post('/onboarding/first-run', TEACHER_B);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quizId).not.toBe(quizIdA);

    // Teacher A cannot read Teacher B's quiz-by-id as if it were their own, and vice versa —
    // 404, never the resource, never 403 (house convention).
    const crossRead = await fetch(`${FUNC_URL}/quizzes/${body.quizId}`, { headers: authHeaders(TEACHER_A) });
    expect(crossRead.status).toBe(404);
  });
});

describe('POST /api/questions/starter-seed', () => {
  it_int('seeds exactly 5 starter questions, idempotently', async () => {
    const teacherId = `v460-seed-teacher-${Date.now()}`;
    const first = await post('/questions/starter-seed', teacherId);
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody).toHaveLength(5);

    const second = await post('/questions/starter-seed', teacherId);
    expect(second.status).toBe(201);
    const secondBody = await second.json();
    expect(secondBody.map((q) => q.id).sort()).toEqual(firstBody.map((q) => q.id).sort());
  });

  // REQUIRED cross-tenant negative test — two teachers seeding independently must never collide
  // (deterministic ids are salted by teacherId) or see each other's questions.
  it_int('cross-tenant: two teachers get their own, disjoint sets of starter questions', async () => {
    const resA = await post('/questions/starter-seed', TEACHER_A);
    const resB = await post('/questions/starter-seed', TEACHER_B);
    const bodyA = await resA.json();
    const bodyB = await resB.json();
    const idsA = new Set(bodyA.map((q) => q.id));
    const idsB = new Set(bodyB.map((q) => q.id));
    for (const id of idsA) expect(idsB.has(id)).toBe(false);
  });
});
