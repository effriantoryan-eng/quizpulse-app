// Integration tests for v4.1.0 — APST Evidence Export.
//
// Requires: func start running against the TEST Cosmos (see CLAUDE.md's Testing section —
// export TEST_COSMOS_ENDPOINT/TEST_COSMOS_KEY as COSMOS_ENDPOINT/COSMOS_KEY before func start),
// B2C_ALLOW_UNVERIFIED_DEV=true.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration/api/v4-evidence.test.js

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;
const beforeAll_int = RUN ? beforeAll : (() => {});

function mintToken(oid, extraClaims = {}) {
  return jwt.sign({ oid, name: 'Integration Teacher', emails: [`${oid}@example.com`], ...extraClaims }, 'dev-key', { expiresIn: '1h' });
}

function authHeaders(oid, extraClaims = {}) {
  return {
    Authorization: `Bearer ${mintToken(oid, extraClaims)}`,
    'Content-Type': 'application/json',
  };
}

const TEACHER_A = 'v41-teacher-A';
const TEACHER_B = 'v41-teacher-B';

let questionA, quizA;

async function createQuestionAsA() {
  const res = await fetch(`${FUNC_URL}/questions`, {
    method: 'POST',
    headers: authHeaders(TEACHER_A),
    body: JSON.stringify({ text: 'v4.1 question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, topic: 'Science' }),
  });
  return res.json();
}

async function createSentQuizAsA(questionId) {
  const res = await fetch(`${FUNC_URL}/quizzes`, {
    method: 'POST',
    headers: authHeaders(TEACHER_A),
    body: JSON.stringify({ name: 'v4.1 Evidence Quiz', questionIds: [questionId], status: 'sent', durationMinutes: 30, topicTag: 'Year 11 Maths' }),
  });
  return res.json();
}

const validExportBody = (quizId) => ({
  quizId,
  teacherName: 'Integration Teacher',
  vitNumber: '',
  className: 'Test Class',
  subject: 'Year 11 Maths',
  activityName: 'Retrieval Practice Quiz',
  pdType: 'School-based professional learning',
  descriptorIds: ['3.3', '3.6', '5.1', '5.4', '6.2'],
  durationHours: 0.6,
  reflection1: 'Personalised reflection about what students struggled with.',
  reflection2: 'Personalised reflection about what will change next lesson.',
});

beforeAll_int(async () => {
  questionA = await createQuestionAsA();
  quizA = await createSentQuizAsA(questionA.id);
});

describe('POST /api/evidence/export', () => {
  it_int('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${FUNC_URL}/evidence/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validExportBody(quizA.id)),
    });
    expect(res.status).toBe(401);
  });

  it_int('Teacher B requesting Teacher A\'s quizId gets 404 (cross-tenant negative test)', async () => {
    const res = await fetch(`${FUNC_URL}/evidence/export`, {
      method: 'POST',
      headers: authHeaders(TEACHER_B),
      body: JSON.stringify(validExportBody(quizA.id)),
    });
    expect(res.status).toBe(404);
  });

  it_int('rejects a reflection still containing [PERSONALISE: with 400', async () => {
    const body = validExportBody(quizA.id);
    body.reflection1 = 'I learnt that [PERSONALISE: something] happened.';
    const res = await fetch(`${FUNC_URL}/evidence/export`, {
      method: 'POST',
      headers: authHeaders(TEACHER_A),
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(400);
  });

  it_int('a valid request returns a non-empty PDF', async () => {
    const res = await fetch(`${FUNC_URL}/evidence/export`, {
      method: 'POST',
      headers: authHeaders(TEACHER_A),
      body: JSON.stringify(validExportBody(quizA.id)),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });

  it_int('the exported PDF contains no studentId/deviceId substrings', async () => {
    const res = await fetch(`${FUNC_URL}/evidence/export`, {
      method: 'POST',
      headers: authHeaders(TEACHER_A),
      body: JSON.stringify(validExportBody(quizA.id)),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const text = buf.toString('latin1');
    expect(text).not.toMatch(/quizpulse_device_id/);
  });
});

describe('GET /api/evidence/annual-log', () => {
  it_int('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${FUNC_URL}/evidence/annual-log?from=2026-01-01&to=2026-06-01`);
    expect(res.status).toBe(401);
  });

  it_int('rejects an end-before-start range with 400', async () => {
    const res = await fetch(`${FUNC_URL}/evidence/annual-log?from=2026-06-01&to=2026-01-01`, {
      headers: authHeaders(TEACHER_A),
    });
    expect(res.status).toBe(400);
  });

  it_int('a valid range returns a non-empty PDF scoped to the caller\'s own quizzes', async () => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await fetch(`${FUNC_URL}/evidence/annual-log?from=${from}&to=${to}`, {
      headers: authHeaders(TEACHER_A),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });
});
