// Unit tests for api/auth.js — JWT extraction, claim parsing, and DEV_MODE verification.
// B2C_ALLOW_UNVERIFIED_DEV=true must be set BEFORE requiring the module (it's read at load time).

process.env.B2C_ALLOW_UNVERIFIED_DEV = 'true';
process.env.B2C_TENANT_NAME = 'testb2c';
process.env.B2C_TENANT_ID  = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
process.env.B2C_CLIENT_ID  = 'ffffffff-0000-1111-2222-333333333333';
process.env.B2C_POLICY     = 'B2C_1_signupsignin';

const jwt = require('jsonwebtoken');
const { authenticateTeacher, verifyToken, teacherIdFromClaims, extractBearer } = require('../../../api/auth');

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeToken(claims = {}, opts = {}) {
  return jwt.sign(
    { oid: 'teacher-oid-001', name: 'Test Teacher', emails: ['teacher@example.com'], ...claims },
    'dev-secret-key',
    { expiresIn: '1h', ...opts }
  );
}

function makeRequest(token) {
  const headers = new Map();
  if (token) headers.set('authorization', `Bearer ${token}`);
  return { headers: { get: (k) => headers.get(k.toLowerCase()) } };
}

// ─── extractBearer ────────────────────────────────────────────────────────────

describe('extractBearer', () => {
  test('returns token from valid Bearer header', () => {
    const req = makeRequest('mytoken123');
    expect(extractBearer(req)).toBe('mytoken123');
  });

  test('returns null when Authorization header is absent', () => {
    const req = makeRequest(null);
    expect(extractBearer(req)).toBeNull();
  });

  test('returns null for non-Bearer schemes', () => {
    const headers = { get: () => 'Basic dXNlcjpwYXNz' };
    expect(extractBearer({ headers })).toBeNull();
  });

  test('is case-insensitive for the Bearer scheme', () => {
    const headers = { get: (k) => k.toLowerCase() === 'authorization' ? 'bearer mytoken' : null };
    expect(extractBearer({ headers })).toBe('mytoken');
  });
});

// ─── teacherIdFromClaims ──────────────────────────────────────────────────────

describe('teacherIdFromClaims', () => {
  test('returns oid when present', () => {
    expect(teacherIdFromClaims({ oid: 'abc-123' })).toBe('abc-123');
  });

  test('falls back to sub when oid is absent', () => {
    expect(teacherIdFromClaims({ sub: 'sub-456' })).toBe('sub-456');
  });

  test('returns null when neither oid nor sub is present', () => {
    expect(teacherIdFromClaims({})).toBeNull();
  });

  test('prefers oid over sub', () => {
    expect(teacherIdFromClaims({ oid: 'oid-val', sub: 'sub-val' })).toBe('oid-val');
  });
});

// ─── verifyToken (DEV_MODE) ───────────────────────────────────────────────────

describe('verifyToken in DEV_MODE', () => {
  test('resolves with decoded claims for a valid token', async () => {
    const token = makeToken({ oid: 'teacher-001' });
    const claims = await verifyToken(token);
    expect(claims.oid).toBe('teacher-001');
  });

  test('rejects with an expired token', async () => {
    const token = makeToken({}, { expiresIn: '-1s' });
    await expect(verifyToken(token)).rejects.toThrow(/expired/i);
  });

  test('rejects with a malformed token string', async () => {
    await expect(verifyToken('not.a.jwt')).rejects.toThrow();
  });

  test('rejects with an empty string', async () => {
    await expect(verifyToken('')).rejects.toThrow();
  });
});

// ─── authenticateTeacher ─────────────────────────────────────────────────────

describe('authenticateTeacher', () => {
  test('returns { error, status: 401 } when no Authorization header is present', async () => {
    const result = await authenticateTeacher(makeRequest(null));
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/authentication required/i);
  });

  test('returns { teacherId, claims } for a valid token with oid', async () => {
    const token = makeToken({ oid: 'teacher-oid-123' });
    const result = await authenticateTeacher(makeRequest(token));
    expect(result.teacherId).toBe('teacher-oid-123');
    expect(result.claims.oid).toBe('teacher-oid-123');
    expect(result.error).toBeUndefined();
  });

  test('returns 401 when token has no oid or sub claim', async () => {
    const token = makeToken({ oid: undefined, sub: undefined });
    const result = await authenticateTeacher(makeRequest(token));
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/subject claim/i);
  });

  test('returns 401 for an expired token', async () => {
    const token = makeToken({}, { expiresIn: '-1s' });
    const result = await authenticateTeacher(makeRequest(token));
    expect(result.status).toBe(401);
  });

  test('returns 401 for a garbage token string', async () => {
    const result = await authenticateTeacher(makeRequest('garbage.not.valid'));
    expect(result.status).toBe(401);
  });
});
