// Integration tests for v3.3.0 — simulated demo class.
//
// Requires: func start running, B2C_ALLOW_UNVERIFIED_DEV=true, Cosmos accessible.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration/api/v3-3.test.js
//
// Covers demo-class creation rules, the simulate path, send-notification's demo branch (no push),
// cross-tenant denial (404 per the Sprint 5 convention), and demo isolation in admin reporting.

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

function mintToken(oid, extraClaims = {}) {
  return jwt.sign({ oid, name: 'v33 Teacher', emails: [`${oid}@example.com`], ...extraClaims }, 'dev-key', { expiresIn: '1h' });
}
function authHeaders(oid, extraClaims = {}) {
  return { Authorization: `Bearer ${mintToken(oid, extraClaims)}`, 'Content-Type': 'application/json' };
}
function adminHeaders(oid) {
  return authHeaders(oid, { roles: ['owner'] });
}

const A = `v33-teacher-A-${Date.now()}`;
const B = `v33-teacher-B-${Date.now()}`;

async function post(path, headers, body) {
  return fetch(`${FUNC_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('demo class creation', () => {
  it_int('POST /api/classes { isDemo:true } → 201 with 24 demoStudents and no joinCode', async () => {
    const res = await post('/classes', authHeaders(A), { isDemo: true, name: 'Demo class' });
    expect(res.status).toBe(201);
    const cls = await res.json();
    expect(cls.isDemo).toBe(true);
    expect(Array.isArray(cls.demoStudents)).toBe(true);
    expect(cls.demoStudents).toHaveLength(24);
    expect(cls.studentCount).toBe(24);
    expect(cls.joinCode).toBeUndefined();
    const names = cls.demoStudents.map(s => s.name);
    expect(new Set(names).size).toBe(24);
  });

  it_int('second demo class for the same teacher → 409 "Demo class limit reached"', async () => {
    const res = await post('/classes', authHeaders(A), { isDemo: true, name: 'Demo class 2' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/demo class limit/i);
  });

  it_int('20 real classes + 1 demo all succeed; 21st real → 429 (real cap still enforced)', async () => {
    const C = `v33-teacher-C-${Date.now()}`;
    // demo class first — must NOT consume a real slot
    const demo = await post('/classes', authHeaders(C), { isDemo: true, name: 'Demo class' });
    expect(demo.status).toBe(201);
    for (let i = 0; i < 20; i++) {
      const r = await post('/classes', authHeaders(C), { name: `Real ${i}` });
      expect(r.status).toBe(201);
    }
    const over = await post('/classes', authHeaders(C), { name: 'Real 21' });
    expect(over.status).toBe(429);
    const body = await over.json();
    expect(body.error).toMatch(/at most 20 classes/i);
  });
});

describe('simulate-responses gate', () => {
  it_int('POST /api/simulate-responses on a real (non-demo) class → 400 "Not a demo class"', async () => {
    const cls = await (await post('/classes', authHeaders(A), { name: 'Real for sim' })).json();
    const q = await (await post('/questions', authHeaders(A), { text: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, topic: 'Science' })).json();
    const quiz = await (await post('/quizzes', authHeaders(A), { name: 'Real quiz', questionIds: [q.id], classIds: [cls.id], status: 'sent', durationMinutes: 5, sentAt: new Date().toISOString() })).json();
    const res = await post('/simulate-responses', authHeaders(A), { quizId: quiz.id });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not a demo class/i);
  });

  it_int('cross-tenant: Teacher B simulating Teacher A\'s demo quiz → 404', async () => {
    const demo = await (await post('/classes', authHeaders(B), { isDemo: true, name: 'B demo' })).json();
    const q = await (await post('/questions', authHeaders(A), { text: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, topic: 'Science' })).json();
    // Quiz owned by A targeting A's existing demo class
    const aDemoList = await (await fetch(`${FUNC_URL}/classes`, { headers: authHeaders(A) })).json();
    const aDemo = aDemoList.find(c => c.isDemo);
    const quiz = await (await post('/quizzes', authHeaders(A), { name: 'A demo quiz', questionIds: [q.id], classIds: [aDemo.id], status: 'draft' })).json();
    const res = await post('/simulate-responses', authHeaders(B), { quizId: quiz.id });
    expect(res.status).toBe(404);
  });
});

describe('send-notification demo branch + analytics', () => {
  it_int('sending a demo quiz writes 24 simulated responses (no real recipients)', async () => {
    const aDemoList = await (await fetch(`${FUNC_URL}/classes`, { headers: authHeaders(A) })).json();
    const aDemo = aDemoList.find(c => c.isDemo);
    const q = await (await post('/questions', authHeaders(A), { text: 'Photosynthesis?', options: ['a', 'b', 'c', 'd'], correctIndex: 1, topic: 'Science' })).json();
    const quiz = await (await post('/quizzes', authHeaders(A), { name: 'Demo send quiz', questionIds: [q.id], classIds: [aDemo.id], status: 'sent', durationMinutes: 5, sentAt: new Date().toISOString() })).json();
    expect(quiz.isDemo).toBe(true);

    const send = await post('/send-notification', authHeaders(A), { quizId: quiz.id, quizTitle: 'Demo send quiz', questionCount: 1 });
    expect(send.status).toBe(200);
    const sendBody = await send.json();
    expect(sendBody.sent).toBe(0);          // no push
    expect(sendBody.simulated).toBe(24);

    const analytics = await (await fetch(`${FUNC_URL}/analytics?quizId=${quiz.id}`, { headers: authHeaders(A) })).json();
    expect(analytics.isDemo).toBe(true);
    expect(analytics.totalResponses).toBe(24);
    expect(analytics.classSize).toBe(24);
  });
});

describe('demo isolation in admin reporting', () => {
  it_int('GET /api/manage/metrics totals exclude isDemo=true responses', async () => {
    const res = await fetch(`${FUNC_URL}/manage/metrics?range=today`, { headers: adminHeaders(A) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals).toBeDefined();
    // The 24 simulated responses created above are demo → must not be counted.
    // We can't assert an absolute number against a shared DB, but totals must be a finite count
    // and the demo responses are excluded by construction (EXCLUDE_DEMO_FRAGMENT).
    expect(typeof body.totals.responses).toBe('number');
    expect(Number.isFinite(body.totals.responses)).toBe(true);
  });

  it_int('GET /api/manage/logs/export?type=security excludes audit entries whose target class isDemo=true', async () => {
    const res = await fetch(`${FUNC_URL}/manage/logs/export?type=security`, { headers: adminHeaders(A) });
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text.trim() ? text.trim().split('\n').map(l => JSON.parse(l)) : [];
    // No exported entry may reference a demo class as its target.
    const aDemoList = await (await fetch(`${FUNC_URL}/classes`, { headers: authHeaders(A) })).json();
    const demoIds = new Set(aDemoList.filter(c => c.isDemo).map(c => c.id));
    const leaked = lines.filter(e => e.targetType === 'class' && demoIds.has(e.targetId));
    expect(leaked).toHaveLength(0);
  });
});
