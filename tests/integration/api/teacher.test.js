// Integration tests for /api/me and /api/onboarding endpoints.
// Requires:
//   - func start (api/) running at FUNC_URL (default: http://localhost:7071)
//   - api/local.settings.json with B2C_ALLOW_UNVERIFIED_DEV=true
//   - Cosmos DB (real or emulator) accessible

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

function mintToken(oid, extra = {}) {
  return jwt.sign(
    { oid, name: 'Integration Teacher', emails: ['teacher@example.com'], ...extra },
    'dev-key',
    { expiresIn: '1h' }
  );
}

async function apiGet(path, oid) {
  return fetch(`${FUNC_URL}${path}`, {
    headers: { Authorization: `Bearer ${mintToken(oid)}` },
  });
}

async function apiPost(path, body, oid) {
  return fetch(`${FUNC_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mintToken(oid)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('GET /api/me', () => {
  it_int('returns 401 with no token', async () => {
    const res = await fetch(`${FUNC_URL}/me`);
    expect(res.status).toBe(401);
  });

  it_int('returns { onboarded: false } for a brand-new teacher', async () => {
    const freshOid = `me-new-${Date.now()}`;
    const res = await apiGet('/me', freshOid);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.onboarded).toBe(false);
    expect(data.teacherId).toBe(freshOid);
  });

  it_int('returns { onboarded: true } with teacher + school after onboarding', async () => {
    const onboardedOid = `me-onboard-${Date.now()}`;
    // First, onboard
    await apiPost('/onboarding', { schoolName: 'Me Test School' }, onboardedOid);
    // Then check /me
    const res = await apiGet('/me', onboardedOid);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.onboarded).toBe(true);
    expect(data.teacher.teacherId).toBe(onboardedOid);
    expect(data.school.name).toBe('Me Test School');
  });
});

describe('POST /api/onboarding', () => {
  it_int('returns 401 with no token', async () => {
    const res = await fetch(`${FUNC_URL}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolName: 'Test' }),
    });
    expect(res.status).toBe(401);
  });

  it_int('creates a teacher + school document and returns 201', async () => {
    const newOid = `onboard-create-${Date.now()}`;
    const res = await apiPost('/onboarding', { schoolName: 'Integration School' }, newOid);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.teacher.teacherId).toBe(newOid);
    expect(data.teacher.role).toBe('teacher');
    expect(data.school.name).toBe('Integration School');
    expect(data.school.status).toBe('unvalidated');
  });

  it_int('is idempotent — second call returns alreadyOnboarded: true', async () => {
    const dupOid = `onboard-dup-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'First School' }, dupOid);
    const res = await apiPost('/onboarding', { schoolName: 'Second School' }, dupOid);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alreadyOnboarded).toBe(true);
    expect(data.school.name).toBe('First School'); // original not overwritten
  });

  it_int('returns 400 when schoolName is missing', async () => {
    const oid = `onboard-val-${Date.now()}`;
    const res = await apiPost('/onboarding', {}, oid);
    expect(res.status).toBe(400);
  });

  it_int('returns 400 when schoolName exceeds 120 characters', async () => {
    const oid = `onboard-long-${Date.now()}`;
    const res = await apiPost('/onboarding', { schoolName: 'S'.repeat(121) }, oid);
    expect(res.status).toBe(400);
  });
});
