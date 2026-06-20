// Unit tests for the admin vs teacher audience separation introduced in Sprint 7.
//
// authenticateTeacher() validates against AUTH_CLIENT_ID (teacher app).
// authenticateAdmin()   validates against ADMIN_AUTH_CLIENT_ID (admin portal).
//
// A token bearing the wrong audience must be rejected with 401 — this is the cryptographic
// gate that prevents teacher-app tokens from reaching admin endpoints and vice versa.
//
// The module caches env vars at load time, so we set all three env vars before require().
// B2C_ALLOW_UNVERIFIED_DEV=true lets us mint arbitrary tokens without JWKS; audience is
// still checked when both decoded.aud and the expected audience are set.

const TEACHER_CLIENT_ID = 'aaaaaaaa-1111-1111-1111-000000000001';
const ADMIN_CLIENT_ID   = 'bbbbbbbb-2222-2222-2222-000000000002';

process.env.B2C_ALLOW_UNVERIFIED_DEV = 'true';
process.env.AUTH_TENANT_SUBDOMAIN    = 'quizpulseid';
process.env.AUTH_TENANT_ID           = 'cccccccc-dddd-eeee-ffff-000000000000';
process.env.AUTH_CLIENT_ID           = TEACHER_CLIENT_ID;
process.env.ADMIN_AUTH_CLIENT_ID     = ADMIN_CLIENT_ID;

const jwt = require('jsonwebtoken');
const { authenticateTeacher, authenticateAdmin } = require('../../../api/auth');

function mint(oid, aud) {
  const payload = { oid, name: 'Test User', emails: [`${oid}@example.com`] };
  if (aud !== undefined) payload.aud = aud;
  return jwt.sign(payload, 'dev-key', { expiresIn: '1h' });
}

function makeRequest(token) {
  const headers = new Map();
  if (token) headers.set('authorization', `Bearer ${token}`);
  return { headers: { get: (k) => headers.get(k.toLowerCase()) } };
}

// ─── authenticateTeacher audience checks ─────────────────────────────────────

describe('authenticateTeacher — audience gate', () => {
  test('accepts a token with the correct teacher audience', async () => {
    const token = mint('teacher-1', TEACHER_CLIENT_ID);
    const result = await authenticateTeacher(makeRequest(token));
    expect(result.teacherId).toBe('teacher-1');
    expect(result.error).toBeUndefined();
  });

  test('rejects a token with the admin audience (401)', async () => {
    const token = mint('admin-1', ADMIN_CLIENT_ID);
    const result = await authenticateTeacher(makeRequest(token));
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/invalid|expired|token/i);
  });

  test('accepts a token with no aud claim (legacy compat — existing tests mint without aud)', async () => {
    const token = mint('teacher-no-aud', undefined);
    const result = await authenticateTeacher(makeRequest(token));
    expect(result.teacherId).toBe('teacher-no-aud');
  });

  test('returns 401 when no Authorization header is present', async () => {
    const result = await authenticateTeacher(makeRequest(null));
    expect(result.status).toBe(401);
  });
});

// ─── authenticateAdmin audience checks ───────────────────────────────────────

describe('authenticateAdmin — audience gate', () => {
  test('accepts a token with the correct admin audience', async () => {
    const token = mint('admin-1', ADMIN_CLIENT_ID);
    const result = await authenticateAdmin(makeRequest(token));
    expect(result.teacherId).toBe('admin-1');
    expect(result.error).toBeUndefined();
  });

  test('rejects a token with the teacher audience (401)', async () => {
    const token = mint('teacher-1', TEACHER_CLIENT_ID);
    const result = await authenticateAdmin(makeRequest(token));
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/invalid|expired|token/i);
  });

  test('accepts a token with no aud claim when ADMIN_AUTH_CLIENT_ID is set (no claim = no gate)', async () => {
    // Tokens without aud bypass the check in DEV_MODE for backward compat.
    // In production JWKS mode the audience is always enforced.
    const token = mint('admin-no-aud', undefined);
    const result = await authenticateAdmin(makeRequest(token));
    expect(result.teacherId).toBe('admin-no-aud');
  });

  test('returns 401 when no Authorization header is present', async () => {
    const result = await authenticateAdmin(makeRequest(null));
    expect(result.status).toBe(401);
  });
});

// ─── Cross-portal isolation ───────────────────────────────────────────────────

describe('cross-portal token isolation', () => {
  test('the same token is accepted by one portal and rejected by the other', async () => {
    const teacherToken = mint('teacher-x', TEACHER_CLIENT_ID);
    const adminToken   = mint('admin-x', ADMIN_CLIENT_ID);

    const [tByTeacher, tByAdmin, aByTeacher, aByAdmin] = await Promise.all([
      authenticateTeacher(makeRequest(teacherToken)),
      authenticateAdmin(makeRequest(teacherToken)),
      authenticateTeacher(makeRequest(adminToken)),
      authenticateAdmin(makeRequest(adminToken)),
    ]);

    expect(tByTeacher.teacherId).toBe('teacher-x'); // correct audience
    expect(tByAdmin.status).toBe(401);               // wrong audience for admin
    expect(aByTeacher.status).toBe(401);             // wrong audience for teacher
    expect(aByAdmin.teacherId).toBe('admin-x');      // correct audience
  });
});
