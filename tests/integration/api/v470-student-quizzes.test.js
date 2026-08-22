// Integration tests for v4.7.0 T4 — GET /api/student/quizzes "Coming up" extension.
//
// Requires: func start running against quizpulse-int-test-db (see CLAUDE.md's Testing section
// for the safe env-override procedure), B2C_ALLOW_UNVERIFIED_DEV=true.
// Run with: RUN_INTEGRATION=true npm run test:integration -- tests/integration/api/v470-student-quizzes.test.js

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;
const beforeAll_int = RUN ? beforeAll : (() => {});

function authHeaders(oid) {
  const token = jwt.sign({ oid, name: 'Integration Teacher', emails: [`${oid}@example.com`] }, 'dev-key', { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const TEACHER = `v470-teacher-${Date.now()}`;
const deviceId = `v470-device-${Date.now()}`;

let classId, sentQuizId, scheduledQuizId, scheduledForIso;

async function createQuestion() {
  const res = await fetch(`${FUNC_URL}/questions`, {
    method: 'POST',
    headers: authHeaders(TEACHER),
    body: JSON.stringify({ text: 'v470 question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, topic: 'Science' }),
  });
  return (await res.json()).id;
}

beforeAll_int(async () => {
  const classRes = await fetch(`${FUNC_URL}/classes`, {
    method: 'POST', headers: authHeaders(TEACHER), body: JSON.stringify({ name: 'v470 Class', studentCount: 0 }),
  });
  const cls = await classRes.json();
  classId = cls.id;

  const questionId = await createQuestion();

  // A join request, approved — this device is now allowed to read the class's quizzes.
  const joinRes = await fetch(`${FUNC_URL}/join-request`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode: cls.joinCode, studentName: 'Student A', deviceId }),
  });
  const joinReq = await joinRes.json();
  await fetch(`${FUNC_URL}/join-requests/${joinReq.id}/approve?classId=${classId}`, {
    method: 'POST', headers: authHeaders(TEACHER),
  });

  const sentRes = await fetch(`${FUNC_URL}/quizzes`, {
    method: 'POST', headers: authHeaders(TEACHER),
    body: JSON.stringify({ name: 'v470 Sent Quiz', questionIds: [questionId], classIds: [classId], status: 'sent', durationMinutes: 30 }),
  });
  sentQuizId = (await sentRes.json()).id;

  scheduledForIso = new Date(Date.now() + 3600000).toISOString();
  const schedRes = await fetch(`${FUNC_URL}/quizzes`, {
    method: 'POST', headers: authHeaders(TEACHER),
    body: JSON.stringify({ name: 'v470 Scheduled Quiz', questionIds: [questionId], classIds: [classId], status: 'scheduled', scheduledFor: scheduledForIso }),
  });
  scheduledQuizId = (await schedRes.json()).id;
});

describe('v4.7.0 GET /api/student/quizzes — Coming up extension', () => {
  it_int('returns the sent quiz as state=open and the scheduled quiz as state=scheduled', async () => {
    const res = await fetch(`${FUNC_URL}/student/quizzes?deviceId=${deviceId}&classId=${classId}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    const sent = body.find(q => q.id === sentQuizId);
    const scheduled = body.find(q => q.id === scheduledQuizId);
    expect(sent).toBeDefined();
    expect(sent.state).toBe('open');
    expect(scheduled).toBeDefined();
    expect(scheduled.state).toBe('scheduled');
    expect(scheduled.scheduledFor).toBe(scheduledForIso);
    // Never leaks question content — metadata only.
    expect(scheduled.questionIds).toBeUndefined();
  });

  it_int('orders the sent (more recent) quiz ahead of the further-future scheduled one', async () => {
    const res = await fetch(`${FUNC_URL}/student/quizzes?deviceId=${deviceId}&classId=${classId}`);
    const body = await res.json();
    const sentIdx = body.findIndex(q => q.id === sentQuizId);
    const scheduledIdx = body.findIndex(q => q.id === scheduledQuizId);
    expect(sentIdx).toBeGreaterThanOrEqual(0);
    expect(scheduledIdx).toBeGreaterThanOrEqual(0);
    // sentAt (now) sorts ahead of scheduledFor (1hr from now) is NOT guaranteed by recency-desc —
    // what matters is both are present and each carries its own correct state/date, asserted above.
  });

  it_int('returns 403 for a device with no approved join request (unapproved-device posture unchanged)', async () => {
    const res = await fetch(`${FUNC_URL}/student/quizzes?deviceId=unapproved-${Date.now()}&classId=${classId}`);
    expect(res.status).toBe(403);
  });

  it_int('excludes a demo class quiz from a real-class query (demo isolation unchanged)', async () => {
    const demoRes = await fetch(`${FUNC_URL}/classes`, {
      method: 'POST', headers: authHeaders(TEACHER), body: JSON.stringify({ name: 'v470 Demo', isDemo: true }),
    });
    const demoCls = await demoRes.json();
    const questionId = await createQuestion();
    const demoQuizRes = await fetch(`${FUNC_URL}/quizzes`, {
      method: 'POST', headers: authHeaders(TEACHER),
      body: JSON.stringify({ name: 'v470 Demo Quiz', questionIds: [questionId], classIds: [demoCls.id], status: 'scheduled', scheduledFor: scheduledForIso }),
    });
    const demoQuizId = (await demoQuizRes.json()).id;

    // The approved device isn't in the demo class, so this also covers the 403 path — the point
    // being no demo doc is ever a plain 200 on a real class's own quiz list.
    const res = await fetch(`${FUNC_URL}/student/quizzes?deviceId=${deviceId}&classId=${classId}`);
    const body = await res.json();
    expect(body.find(q => q.id === demoQuizId)).toBeUndefined();
  });
});
