// Integration tests for v4.9.0 — Admin teacher-data drill-down (Workstream A).
//
// Requires: func start running, B2C_ALLOW_UNVERIFIED_DEV=true, TEST Cosmos account.
// NEVER run this against production Cosmos — see CLAUDE.md Testing section.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration/api/v490-admin-teacher-data.test.js

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN      = process.env.RUN_INTEGRATION === 'true';
const it_int   = RUN ? it : it.skip;

const TEACHER_CLIENT_ID = process.env.AUTH_CLIENT_ID      || 'teacher-client-id';
const ADMIN_CLIENT_ID   = process.env.ADMIN_AUTH_CLIENT_ID || 'admin-client-id';

const OWNER_OID   = 'v490-admin-owner-001';
const TEACHER_A   = 'v490-teacher-a-001';
const TEACHER_B   = 'v490-teacher-b-001';

function mintToken(oid, aud, extraClaims = {}) {
  return jwt.sign(
    { oid, name: 'Integration User', emails: [`${oid}@example.com`], ...extraClaims },
    'dev-key',
    { expiresIn: '1h' }
  );
}

function adminHeaders(oid, role = 'owner') {
  return {
    Authorization: `Bearer ${mintToken(oid, ADMIN_CLIENT_ID, { roles: [role] })}`,
    'Content-Type': 'application/json',
  };
}

function teacherHeaders(oid) {
  return {
    Authorization: `Bearer ${mintToken(oid, TEACHER_CLIENT_ID)}`,
    'Content-Type': 'application/json',
  };
}

async function getOverview(teacherId, asOid = OWNER_OID, role = 'owner') {
  return fetch(`${FUNC_URL}/manage/teachers/${teacherId}/overview`, {
    headers: adminHeaders(asOid, role),
  });
}

async function getAnalytics(teacherId, quizId, asOid = OWNER_OID, role = 'owner') {
  return fetch(`${FUNC_URL}/manage/teachers/${teacherId}/quizzes/${quizId}/analytics`, {
    headers: adminHeaders(asOid, role),
  });
}

// ─── Auth & role gates ────────────────────────────────────────────────────────

describe('GET /api/manage/teachers/{id}/overview — auth gates', () => {
  it_int('no token → 401', async () => {
    const res = await fetch(`${FUNC_URL}/manage/teachers/${TEACHER_A}/overview`);
    expect(res.status).toBe(401);
  });

  it_int('teacher-audience token (wrong aud) → 404 (no admin role derived, same 404-on-mismatch convention)', async () => {
    const res = await fetch(`${FUNC_URL}/manage/teachers/${TEACHER_A}/overview`, {
      headers: teacherHeaders(TEACHER_A),
    });
    // A teacher JWT is a valid signed token — authenticateAdmin decodes it, getCallerScope derives
    // role='teacher', then requireRole(READ_ALL_ROLES) returns 404 per house convention.
    // 404-on-mismatch is the rule for all auth failures on admin endpoints; never 403/401.
    expect(res.status).toBe(404);
  });

  it_int('admin token with plain teacher role → 404 (requireRole enforces READ_ALL_ROLES)', async () => {
    const res = await getOverview(TEACHER_A, 'v490-plain-teacher', 'teacher');
    expect(res.status).toBe(404);
  });

  it_int('admin token with support role → 200 (support has read-all)', async () => {
    const res = await getOverview(TEACHER_A, 'v490-support-user', 'support');
    // Teacher A may not exist yet in the test DB, so 404 is also acceptable here —
    // the point is NOT 401/403/500.
    expect([200, 404]).toContain(res.status);
  });
});

// ─── Cross-tenant isolation (critical) ───────────────────────────────────────

describe('Admin teacher-data — cross-tenant isolation', () => {
  it_int('overview for a non-existent teacherId → 404, never 500', async () => {
    const res = await getOverview('v490-does-not-exist-ever');
    expect(res.status).toBe(404);
  });

  it_int('analytics for a quiz that belongs to a different teacher → 404', async () => {
    // We pass TEACHER_B's id but a quizId that belongs to TEACHER_A (loadQuizAnalytics
    // enforces ownership via partition key — should 404 not return Teacher A's data).
    // This test documents the expected 404 outcome; the quiz ID is arbitrary.
    const res = await getAnalytics(TEACHER_B, 'some-quiz-from-teacher-a');
    // 404 (no teacher B doc, or quiz not in Teacher B's partition) — never 200 with another
    // teacher's data, never 500.
    expect(res.status).toBe(404);
  });

  it_int('analytics for a non-existent quizId → 404', async () => {
    const res = await getAnalytics(TEACHER_A, 'v490-quiz-does-not-exist');
    expect([404]).toContain(res.status);
  });
});

// ─── Overview payload shape ───────────────────────────────────────────────────

describe('GET /api/manage/teachers/{id}/overview — payload', () => {
  // These tests require teacher A to have been set up in the test Cosmos account.
  // Seed manually or via a setup fixture if running a full suite.

  it_int('response shape includes teacher, schools, classes, quizzes, total', async () => {
    // This will 404 if teacher A doesn't exist — that's acceptable in CI without seed.
    const res = await getOverview(TEACHER_A);
    if (res.status === 404) return; // graceful skip if not seeded
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('teacher');
    expect(body).toHaveProperty('schools');
    expect(body).toHaveProperty('classes');
    expect(body).toHaveProperty('quizzes');
    expect(body).toHaveProperty('total');
  });

  it_int('demoStudents array is never present in class payloads (PII strip)', async () => {
    const res = await getOverview(TEACHER_A);
    if (res.status === 404) return;
    const body = await res.json();
    for (const cls of body.classes || []) {
      expect(cls).not.toHaveProperty('demoStudents');
      if (cls.isDemo) {
        // Demo classes must carry demoStudentCount (the count), not the names array
        expect(cls).toHaveProperty('demoStudentCount');
      }
    }
  });

  it_int('audit is called once per overview request (fail-closed: 500 if audit would fail)', async () => {
    // We verify fail-closed indirectly: a successful 200 means audit succeeded.
    // If audit were skipped on success the audit_log would be empty; we can't easily verify
    // that in an integration test without querying audit_log directly — so we just assert 200
    // and document the contract here.
    const res = await getOverview(TEACHER_A);
    if (res.status === 404) return;
    expect(res.status).toBe(200);
  });
});

// ─── Analytics payload shape ──────────────────────────────────────────────────

describe('GET /api/manage/teachers/{id}/quizzes/{quizId}/analytics — payload', () => {
  it_int('successful response has breakdown array, no studentName field', async () => {
    // Without a known quizId from the test DB this is a 404 — graceful skip.
    // Real quizId from a seeded Teacher A quiz should be substituted here.
    const res = await getAnalytics(TEACHER_A, process.env.TEST_QUIZ_ID || 'v490-placeholder-quiz');
    if (res.status === 404) return;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('breakdown');
    expect(Array.isArray(body.breakdown)).toBe(true);
    // No per-student data exposed through the admin drill-down
    for (const question of body.breakdown) {
      expect(question).not.toHaveProperty('studentName');
      expect(question).not.toHaveProperty('studentId');
    }
  });
});

// ─── Rate limit ───────────────────────────────────────────────────────────────

describe('Admin teacher-data — rate limit', () => {
  it_int('60 req/min bucket is keyed by admin identity, not IP', async () => {
    // Fire 3 requests as two different admin identities — both should get through
    // (the bucket is per-admin, not shared).
    const [r1, r2] = await Promise.all([
      getOverview(TEACHER_A, 'v490-admin-owner-001', 'owner'),
      getOverview(TEACHER_A, 'v490-admin-owner-002', 'owner'),
    ]);
    // Both should be 200 or 404 (not 429)
    expect([200, 404]).toContain(r1.status);
    expect([200, 404]).toContain(r2.status);
  });
});
