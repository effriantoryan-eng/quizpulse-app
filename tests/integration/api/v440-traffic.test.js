// Integration tests for v4.4.0 — Traffic Monitor.
//
// Requires: func start running, B2C_ALLOW_UNVERIFIED_DEV=true, Cosmos accessible (the TEST
// Cosmos account — see CLAUDE.md Testing section; NEVER run this against production Cosmos),
// ADMIN_AUTH_CLIENT_ID set in local.settings.json.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration/api/v440-traffic.test.js

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN      = process.env.RUN_INTEGRATION === 'true';
const it_int   = RUN ? it : it.skip;

// Must match sprint7.test.js's convention — same env vars as local.settings.json.
const TEACHER_CLIENT_ID = process.env.AUTH_CLIENT_ID || 'teacher-client-id';
const ADMIN_CLIENT_ID   = process.env.ADMIN_AUTH_CLIENT_ID || 'admin-client-id';

function mintToken(oid, aud, extraClaims = {}) {
  const payload = { oid, name: 'Integration User', emails: [`${oid}@example.com`], ...extraClaims };
  if (aud) payload.aud = aud;
  return jwt.sign(payload, 'dev-key', { expiresIn: '1h' });
}

function authHeaders(oid, aud, extraClaims = {}) {
  return {
    Authorization: `Bearer ${mintToken(oid, aud, extraClaims)}`,
    'Content-Type': 'application/json',
  };
}

async function post(path, headers, body) {
  return fetch(`${FUNC_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

// ─── POST /api/pageView ───────────────────────────────────────────────────────

describe('POST /api/pageView', () => {
  it_int('valid payload → 201 { ok: true }', async () => {
    const res = await post('/pageView', { 'Content-Type': 'application/json' }, {
      page: '/teacher/home',
      teacherId: `v440-device-${Date.now()}`,
      sessionId: 'v440-session-1',
      screenWidth: 1280,
      screenHeight: 800,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it_int('missing page field → 400', async () => {
    const res = await post('/pageView', { 'Content-Type': 'application/json' }, { teacherId: 'x' });
    expect(res.status).toBe(400);
  });

  it_int('unrecognised eventType → 400', async () => {
    const res = await post('/pageView', { 'Content-Type': 'application/json' }, {
      page: '/', teacherId: 'x', eventType: 'not-a-real-type',
    });
    expect(res.status).toBe(400);
  });

  it_int('unrecognised page is accepted (bucketed to "other" server-side, never rejected)', async () => {
    const res = await post('/pageView', { 'Content-Type': 'application/json' }, {
      page: '/this-route-does-not-exist', teacherId: `v440-device-${Date.now()}`,
    });
    expect(res.status).toBe(201);
  });
});

// ─── GET /api/manage/traffic ───────────────────────────────────────────────────

describe('GET /api/manage/traffic — audience + role gates', () => {
  it_int('teacher-app token (wrong audience) → 401', async () => {
    const res = await fetch(`${FUNC_URL}/manage/traffic?range=today`, {
      headers: authHeaders('a-teacher', TEACHER_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(401);
  });

  // REQUIRED cross-tenant negative test — a 200 or 403 here is a FAILED test.
  it_int('admin token with no/teacher role → 404 (never the resource, never 403)', async () => {
    const res = await fetch(`${FUNC_URL}/manage/traffic?range=today`, {
      headers: authHeaders('plain-admin', ADMIN_CLIENT_ID),
    });
    expect(res.status).toBe(404);
  });

  it_int('admin token with owner role → 200 with the full response shape', async () => {
    const res = await fetch(`${FUNC_URL}/manage/traffic?range=today`, {
      headers: authHeaders('owner-admin', ADMIN_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.range).toBe('today');
    expect(body.totals).toBeDefined();
    expect(Array.isArray(body.topPages)).toBe(true);
    expect(Array.isArray(body.daily)).toBe(true);
    expect(body.audience).toBeDefined();
    expect(body.devices).toBeDefined();
    expect(body.browsers).toBeDefined();
    expect(typeof body.pwaInstalls).toBe('number');
    expect(body.funnel).toBeDefined();
    expect(body.funnel).toHaveProperty('openRate');
    expect(body.funnel).toHaveProperty('completionRate');
  });

  // Proves the READ side of the role matrix — a wrong requireRole list would ship green
  // if only the mismatch case were tested.
  it_int('admin token with support role → 200 (support is read-only, not blocked from reads)', async () => {
    const res = await fetch(`${FUNC_URL}/manage/traffic?range=today`, {
      headers: authHeaders('support-user', ADMIN_CLIENT_ID, { role: 'support' }),
    });
    expect(res.status).toBe(200);
  });

  it_int('invalid range → 400', async () => {
    const res = await fetch(`${FUNC_URL}/manage/traffic?range=yesterday`, {
      headers: authHeaders('owner-admin', ADMIN_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(400);
  });

  it_int('missing range defaults to "today"', async () => {
    const res = await fetch(`${FUNC_URL}/manage/traffic`, {
      headers: authHeaders('owner-admin', ADMIN_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).range).toBe('today');
  });
});

describe('GET /api/manage/traffic — rate limit', () => {
  it_int('61st call within the hour → 429', async () => {
    const headers = authHeaders('rate-limit-admin', ADMIN_CLIENT_ID, { role: 'owner' });
    let lastStatus = 200;
    for (let i = 0; i < 61; i++) {
      const res = await fetch(`${FUNC_URL}/manage/traffic?range=today`, { headers });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  }, 60_000);
});

// ─── GET /api/manage/metrics — v4.4.0 de-stub ─────────────────────────────────

describe('GET /api/manage/metrics — v4.4.0 de-stub', () => {
  it_int('usageGrowth/engagement are no longer top-level stubbed; systemHealth/security/spending still are', async () => {
    const res = await fetch(`${FUNC_URL}/manage/metrics?range=today`, {
      headers: authHeaders('owner-admin', ADMIN_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty('stubbed'); // top-level flag removed
    expect(body.usageGrowth.stubbed).toBe(false);
    expect(body.engagement.stubbed).toBe(false);
    expect(body.systemHealth.stubbed).toBe(true);
    expect(body.security.stubbed).toBe(true);
    expect(body.spending.stubbed).toBe(true);
  });

  it_int('de-stubbed fields are finite numbers or null — never NaN or undefined', async () => {
    const res = await fetch(`${FUNC_URL}/manage/metrics?range=today`, {
      headers: authHeaders('owner-admin', ADMIN_CLIENT_ID, { role: 'owner' }),
    });
    const body = await res.json();
    for (const field of ['schools', 'teachers', 'quizzesPerDay', 'pushDeliveryRate']) {
      const value = body.usageGrowth[field];
      expect(value === null || Number.isFinite(value)).toBe(true);
    }
    expect(body.engagement.completionRate === null || Number.isFinite(body.engagement.completionRate)).toBe(true);
  });

  // Demo data must not corrupt the aggregate (crash, NaN, or otherwise leak in) — same
  // "can't assert an absolute number against a shared DB" acknowledgment as
  // tests/integration/api/v3-3.test.js's existing demo-isolation test for `totals`.
  it_int('a demo-quiz send does not break usageGrowth/engagement aggregation', async () => {
    const teacher = `v440-demo-teacher-${Date.now()}`;
    const teacherHeaders = authHeaders(teacher, TEACHER_CLIENT_ID);

    const demoClass = await (await post('/classes', teacherHeaders, { isDemo: true, name: 'v440 demo' })).json();
    const question = await (await post('/questions', teacherHeaders, {
      text: 'v440 demo question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, topic: 'Science',
    })).json();
    const quiz = await (await post('/quizzes', teacherHeaders, {
      name: 'v440 demo quiz', questionIds: [question.id], classIds: [demoClass.id],
      status: 'sent', durationMinutes: 5, sentAt: new Date().toISOString(),
    })).json();
    expect(quiz.isDemo).toBe(true);

    const send = await post('/send-notification', teacherHeaders, {
      quizId: quiz.id, quizTitle: 'v440 demo quiz', questionCount: 1,
    });
    expect(send.status).toBe(200);
    // Demo branch skips push — no pushSuccessCount/pushFailCount should be written.
    const sendBody = await send.json();
    expect(sendBody.sent).toBe(0);

    const res = await fetch(`${FUNC_URL}/manage/metrics?range=today`, {
      headers: authHeaders('owner-admin', ADMIN_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Number.isFinite(body.usageGrowth.quizzesPerDay)).toBe(true);
  });
});
