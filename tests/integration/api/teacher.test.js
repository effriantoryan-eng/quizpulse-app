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

async function apiPut(path, body, oid) {
  return fetch(`${FUNC_URL}${path}`, {
    method: 'PUT',
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

  it_int('rejects a role key in the body — regression for the teacher-facing role-set guard', async () => {
    const oid = `onboard-role-${Date.now()}`;
    const res = await apiPost('/onboarding', { schoolName: 'Role Test', role: 'owner' }, oid);
    expect(res.status).toBe(400);
  });
});

// v4.2.0 — onboarding-wizard profile + progressive-disclosure endpoints.
describe('PUT /api/me/profile', () => {
  it_int('returns 401 with no token', async () => {
    const res = await fetch(`${FUNC_URL}/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classCount: 3 }),
    });
    expect(res.status).toBe(401);
  });

  it_int('returns 404 for a teacher who has not onboarded yet', async () => {
    const oid = `profile-404-${Date.now()}`;
    const res = await apiPut('/me/profile', { classCount: 3 }, oid);
    expect(res.status).toBe(404);
  });

  it_int('accumulates partial profile answers across multiple calls without losing earlier ones', async () => {
    const oid = `profile-accum-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Profile School' }, oid);

    const first = await apiPut('/me/profile', { subjects: ['Science', 'Maths'] }, oid);
    expect(first.status).toBe(200);

    const second = await apiPut('/me/profile', { yearLevels: [7, 8] }, oid);
    expect(second.status).toBe(200);
    const secondData = await second.json();
    expect(secondData.profile.subjects).toEqual(['Science', 'Maths']); // not lost from the first call
    expect(secondData.profile.yearLevels).toEqual([7, 8]);
    expect(secondData.profileComplete).toBe(false); // classCount + registrationStatus still unanswered

    const final = await apiPut('/me/profile', { classCount: 4, registrationStatus: 'undisclosed' }, oid);
    const finalData = await final.json();
    expect(finalData.profileComplete).toBe(true);
  });

  it_int('returns 400 for an invalid subject', async () => {
    const oid = `profile-invalid-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Invalid Profile School' }, oid);
    const res = await apiPut('/me/profile', { subjects: ['Woodwork'] }, oid);
    expect(res.status).toBe(400);
  });

  it_int('does NOT re-gate onboarding — GET /api/me still reports onboarded:true after quitting mid-wizard', async () => {
    const oid = `profile-quit-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Quit Mid Wizard School' }, oid);
    // Simulate quitting after step 1 — no PUT /api/me/profile call at all.
    const res = await apiGet('/me', oid);
    const data = await res.json();
    expect(data.onboarded).toBe(true);
    expect(data.profileComplete).toBe(false);
  });
});

describe('GET /api/me — v4.2.0 fields', () => {
  it_int('is safe for a legacy teacher doc with no profile/featureIntros fields', async () => {
    const oid = `legacy-doc-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Legacy Doc School' }, oid);
    const res = await apiGet('/me', oid);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile).toEqual({});
    expect(data.profileComplete).toBe(false);
    expect(data.featureIntros).toEqual({});
    expect(Array.isArray(data.eligibleIntros)).toBe(true);
    expect(data.eligibleIntros).toContain('demo_intro'); // brand-new teacher, no classes yet
  });
});

describe('PUT /api/me/feature-intros', () => {
  it_int('returns 400 for an unknown key', async () => {
    const oid = `intro-unknown-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Intro School' }, oid);
    const res = await apiPut('/me/feature-intros', { key: 'not_a_real_key', event: 'dismissed' }, oid);
    expect(res.status).toBe(400);
  });

  it_int('a dismissed key no longer appears in eligibleIntros', async () => {
    const oid = `intro-dismiss-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Dismiss School' }, oid);
    const before = await (await apiGet('/me', oid)).json();
    expect(before.eligibleIntros).toContain('demo_intro');

    const dismiss = await apiPut('/me/feature-intros', { key: 'demo_intro', event: 'dismissed' }, oid);
    expect(dismiss.status).toBe(200);

    const after = await (await apiGet('/me', oid)).json();
    expect(after.eligibleIntros).not.toContain('demo_intro');
    expect(after.featureIntros.demo_intro.dismissedAt).toBeDefined();
  });

  it_int('dismissing one key does not clobber a previously dismissed different key (two-tab race)', async () => {
    const oid = `intro-two-keys-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Two Keys School' }, oid);
    await apiPut('/me/feature-intros', { key: 'analytics_intro', event: 'dismissed' }, oid);
    await apiPut('/me/feature-intros', { key: 'demo_intro', event: 'dismissed' }, oid);

    const data = await (await apiGet('/me', oid)).json();
    expect(data.featureIntros.analytics_intro.dismissedAt).toBeDefined();
    expect(data.featureIntros.demo_intro.dismissedAt).toBeDefined();
  });
});

describe('POST /api/classes/shells', () => {
  it_int('creates N "My Class" shells when the teacher has zero real classes', async () => {
    const oid = `shells-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Shells School' }, oid);
    const res = await apiPost('/classes/shells', { count: 3 }, oid);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.created).toBe(3);
  });

  it_int('returns 409 when the teacher already has a real class', async () => {
    const oid = `shells-conflict-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Shells Conflict School' }, oid);
    await apiPost('/classes', { name: 'Existing Class' }, oid);
    const res = await apiPost('/classes/shells', { count: 2 }, oid);
    expect(res.status).toBe(409);
  });

  it_int('demo_intro is still eligible after creating shells — shells must not suppress it', async () => {
    const oid = `shells-demo-intro-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Shells Demo Intro School' }, oid);
    await apiPost('/classes/shells', { count: 2 }, oid);
    const data = await (await apiGet('/me', oid)).json();
    expect(data.eligibleIntros).toContain('demo_intro');
  });

  it_int('returns 400 for count outside 1-20', async () => {
    const oid = `shells-invalid-${Date.now()}`;
    await apiPost('/onboarding', { schoolName: 'Shells Invalid School' }, oid);
    const res = await apiPost('/classes/shells', { count: 0 }, oid);
    expect(res.status).toBe(400);
  });
});
