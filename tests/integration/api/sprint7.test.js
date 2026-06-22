// Integration tests for Sprint 7 — admin portal audience gate, CORS policy,
// and role-management endpoint (owner-gated + audit write).
//
// Requires: func start running, B2C_ALLOW_UNVERIFIED_DEV=true, Cosmos accessible,
//           ADMIN_AUTH_CLIENT_ID set in local.settings.json.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration/api/sprint7.test.js

const jwt = require('jsonwebtoken');

const FUNC_URL    = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN         = process.env.RUN_INTEGRATION === 'true';
const it_int      = RUN ? it : it.skip;

// These must match the values in local.settings.json / env vars
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

// ─── Audience gate on /api/manage/* ──────────────────────────────────────────

describe('Audience gate — /api/manage/metrics', () => {
  it_int('teacher-app token (wrong audience) is rejected with 401 on admin endpoint', async () => {
    const res = await fetch(`${FUNC_URL}/manage/metrics?range=today`, {
      headers: authHeaders('some-teacher', TEACHER_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(401);
  });

  it_int('admin token with insufficient role is rejected with 404 (role gate, not audience)', async () => {
    const res = await fetch(`${FUNC_URL}/manage/metrics?range=today`, {
      headers: authHeaders('plain-admin', ADMIN_CLIENT_ID),
    });
    // No role claim → defaults to 'teacher' → requireRole([ROLES.OWNER, ROLES.SUPPORT]) → 404
    expect(res.status).toBe(404);
  });

  it_int('admin token with owner role passes the audience and role gates', async () => {
    const res = await fetch(`${FUNC_URL}/manage/metrics?range=today`, {
      headers: authHeaders('owner-admin', ADMIN_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.range).toBe('today');
  });
});

// ─── Audience gate on /api/manage/schools ────────────────────────────────────

describe('Audience gate — /api/manage/schools (new Sprint 7 endpoint)', () => {
  it_int('teacher-app token rejected with 401', async () => {
    const res = await fetch(`${FUNC_URL}/manage/schools`, {
      headers: authHeaders('a-teacher', TEACHER_CLIENT_ID, { role: 'platform_admin' }),
    });
    expect(res.status).toBe(401);
  });

  it_int('admin token with platform_admin role returns 200 with schools array', async () => {
    const res = await fetch(`${FUNC_URL}/manage/schools`, {
      headers: authHeaders('platform-admin', ADMIN_CLIENT_ID, { role: 'platform_admin' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.schools)).toBe(true);
  });
});

// ─── Role management endpoint ─────────────────────────────────────────────────

describe('Role assignment — /api/manage/teachers/{id}/role', () => {
  const TARGET_ID = 'sprint7-role-target';

  it_int('non-owner admin token gets 404 (owner-gated)', async () => {
    const res = await fetch(`${FUNC_URL}/manage/teachers/${TARGET_ID}/role`, {
      method: 'PUT',
      headers: authHeaders('support-user', ADMIN_CLIENT_ID, { role: 'support' }),
      body: JSON.stringify({ role: 'school_admin' }),
    });
    expect(res.status).toBe(404);
  });

  it_int('teacher-app token (wrong audience) gets 401', async () => {
    const res = await fetch(`${FUNC_URL}/manage/teachers/${TARGET_ID}/role`, {
      method: 'PUT',
      headers: authHeaders('a-teacher', TEACHER_CLIENT_ID, { role: 'owner' }),
      body: JSON.stringify({ role: 'support' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── CORS — unknown origin rejected ──────────────────────────────────────────

describe('CORS policy', () => {
  it_int('requests from an unknown origin do not have CORS headers', async () => {
    // The Function App CORS list does not include this origin, so the browser
    // would block the response. We verify the header is absent.
    const res = await fetch(`${FUNC_URL}/manage/metrics?range=today`, {
      headers: {
        Authorization: `Bearer ${mintToken('test', ADMIN_CLIENT_ID, { role: 'owner' })}`,
        Origin: 'https://evil-site.example.com',
      },
    });
    // CORS header should not include the evil origin
    const acao = res.headers.get('Access-Control-Allow-Origin') || '';
    expect(acao).not.toBe('https://evil-site.example.com');
  });

  it_int('requests from the known admin SWA origin include CORS allow header', async () => {
    // The placeholder in host.json must be replaced with the real admin SWA hostname
    // once provisioned. This test is a smoke test; it will only pass after that update.
    const knownOrigin = 'http://localhost:5174';
    const res = await fetch(`${FUNC_URL}/manage/metrics?range=today`, {
      headers: {
        Authorization: `Bearer ${mintToken('owner', ADMIN_CLIENT_ID, { role: 'owner' })}`,
        Origin: knownOrigin,
      },
    });
    const acao = res.headers.get('Access-Control-Allow-Origin') || '';
    expect(acao).toBe(knownOrigin);
  });
});

// ─── Audit log query endpoint ─────────────────────────────────────────────────

describe('Audit log query — /api/manage/audit', () => {
  it_int('teacher-app token rejected with 401', async () => {
    const res = await fetch(`${FUNC_URL}/manage/audit`, {
      headers: authHeaders('t', TEACHER_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(401);
  });

  it_int('admin token with owner role returns paginated entries', async () => {
    const res = await fetch(`${FUNC_URL}/manage/audit?limit=10`, {
      headers: authHeaders('owner', ADMIN_CLIENT_ID, { role: 'owner' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.entries)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  it_int('support role can read audit log', async () => {
    const res = await fetch(`${FUNC_URL}/manage/audit`, {
      headers: authHeaders('support', ADMIN_CLIENT_ID, { role: 'support' }),
    });
    expect(res.status).toBe(200);
  });

  it_int('teacher role (non-privileged) gets 404', async () => {
    const res = await fetch(`${FUNC_URL}/manage/audit`, {
      headers: authHeaders('plain', ADMIN_CLIENT_ID),
    });
    expect(res.status).toBe(404);
  });
});
