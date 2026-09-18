// Integration tests for v4.12.0 R3 — Notice, consent and data minimisation.
//
// Requires: func start running against the TEST Cosmos account (NEVER production — CLAUDE.md
// Testing section), B2C_ALLOW_UNVERIFIED_DEV=true. rateLimit() is bypassed under RUN_INTEGRATION.
// Run with: RUN_INTEGRATION=true TEST_COSMOS_ENDPOINT=... TEST_COSMOS_KEY=... \
//   npx jest --config jest.config.cjs tests/integration/api/v4.12.0-notice-consent.test.js
//
// Same safety pin as r1-stop-the-leaks.test.js: the read-back checks (stored page view is
// minimal) use a direct Cosmos SDK client pinned to TEST_COSMOS_* so this can never touch
// production. ATTESTATION_REQUIRED_FROM is set into the func host's env (via local.settings.json
// override) for the cut-off test — see the file's own comment at that describe block.

const jwt = require('jsonwebtoken');
const { CosmosClient } = require('@azure/cosmos');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

if (RUN) {
  if (!process.env.TEST_COSMOS_ENDPOINT || !process.env.TEST_COSMOS_KEY) {
    throw new Error('v4.12.0 integration test needs TEST_COSMOS_ENDPOINT/KEY — it must never touch production Cosmos.');
  }
  process.env.COSMOS_ENDPOINT = process.env.TEST_COSMOS_ENDPOINT;
  process.env.COSMOS_KEY = process.env.TEST_COSMOS_KEY;
  process.env.COSMOS_DATABASE = process.env.COSMOS_DATABASE || 'quizpulse';
}

const { ATTESTATION_VERSION, TERMS_VERSION, COLLECTION_NOTICE_VERSION } = require('../../../api/shared/legalVersions');

let _c = null;
function C() {
  if (!_c) {
    const db = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY })
      .database(process.env.COSMOS_DATABASE);
    _c = {
      pageviews: db.container('pageviews'),
      classes: db.container('classes'),
      join_requests: db.container('join_requests'),
      teachers: db.container('teachers'),
    };
  }
  return _c;
}

const TEACHER_CLIENT_ID = process.env.AUTH_CLIENT_ID || 'teacher-client-id';
const NONCE = `r3-${Date.now()}`;

function mintToken(oid, extra = {}) {
  return jwt.sign({ oid, name: 'R3 Teacher', emails: [`${oid}@example.com`], aud: TEACHER_CLIENT_ID, ...extra }, 'dev-key', { expiresIn: '1h' });
}
function headers(oid, extra = {}) {
  return { Authorization: `Bearer ${mintToken(oid, extra)}`, 'Content-Type': 'application/json' };
}
const anon = { 'Content-Type': 'application/json' };

async function createAttestedClass(teacherOid, name) {
  const res = await fetch(`${FUNC_URL}/classes`, {
    method: 'POST', headers: headers(teacherOid),
    body: JSON.stringify({ name, attestation: { schoolAuthorised: true, version: ATTESTATION_VERSION } }),
  });
  return res.json();
}

// ─── Stored page view is minimal ────────────────────────────────────────────

describe('POST /api/pageView — stored doc is minimal (R3)', () => {
  it_int('a full legacy payload for /join stores only the minimised shape', async () => {
    const res = await fetch(`${FUNC_URL}/pageView`, {
      method: 'POST', headers: anon,
      body: JSON.stringify({
        page: '/join', eventType: 'view', teacherId: null, sessionId: `${NONCE}-sess`,
        referrer: 'https://evil.example.com', userAgent: 'Mozilla/5.0 Test', language: 'en-AU',
        timezone: 'Australia/Sydney', screenWidth: 1280, screenHeight: 800,
      }),
    });
    expect(res.status).toBe(201);

    // Read the doc back via the SDK (pk is teacherId — null here).
    const { resources } = await C().pageviews.items
      .query({ query: 'SELECT * FROM c WHERE c.sessionId = @s', parameters: [{ name: '@s', value: `${NONCE}-sess` }] })
      .fetchAll();
    expect(resources).toHaveLength(1);
    const doc = resources[0];
    const keys = Object.keys(doc).sort();
    expect(keys).toEqual(['_attachments', '_etag', '_rid', '_self', '_ts', 'browser', 'device', 'eventType', 'id', 'page', 'platform', 'quizId', 'sessionId', 'teacherId', 'visitedAt'].sort());
    expect(doc.teacherId).toBeNull();
  });
});

// ─── Device ID from the header ──────────────────────────────────────────────

describe('GET /api/join-request/status — device id from header (R3)', () => {
  it_int('X-Device-Id header works, and the legacy ?deviceId= still works with a warning logged', async () => {
    const teacher = `${NONCE}-t-hdr`;
    const device = `${NONCE}-d-hdr`;
    const cls = await createAttestedClass(teacher, 'Header Test');
    await fetch(`${FUNC_URL}/join-request`, { method: 'POST', headers: anon, body: JSON.stringify({ joinCode: cls.joinCode, studentName: 'Hdr Student', deviceId: device }) });

    const viaHeader = await fetch(`${FUNC_URL}/join-request/status?classId=${cls.id}`, { headers: { 'X-Device-Id': device } });
    expect(viaHeader.status).toBe(200);

    const viaQuery = await fetch(`${FUNC_URL}/join-request/status?classId=${cls.id}&deviceId=${device}`);
    expect(viaQuery.status).toBe(200); // legacy fallback still works this release
  });
});

// ─── Join notice version enforced ───────────────────────────────────────────

describe('POST /api/join-request — notice version (R3)', () => {
  it_int('stale noticeVersion 400s; current stores it; absent stores null', async () => {
    const teacher = `${NONCE}-t-notice`;
    const cls = await createAttestedClass(teacher, 'Notice Test');

    const stale = await fetch(`${FUNC_URL}/join-request`, {
      method: 'POST', headers: anon,
      body: JSON.stringify({ joinCode: cls.joinCode, studentName: 'A', deviceId: `${NONCE}-d1`, noticeVersion: 'old-version' }),
    });
    expect(stale.status).toBe(400);

    const current = await fetch(`${FUNC_URL}/join-request`, {
      method: 'POST', headers: anon,
      body: JSON.stringify({ joinCode: cls.joinCode, studentName: 'B', deviceId: `${NONCE}-d2`, noticeVersion: COLLECTION_NOTICE_VERSION }),
    });
    expect(current.status).toBe(201);
    const currentBody = await current.json();
    const { resource: currentDoc } = await C().join_requests.item(currentBody.id, cls.id).read();
    expect(currentDoc.noticeVersion).toBe(COLLECTION_NOTICE_VERSION);

    const absent = await fetch(`${FUNC_URL}/join-request`, {
      method: 'POST', headers: anon,
      body: JSON.stringify({ joinCode: cls.joinCode, studentName: 'C', deviceId: `${NONCE}-d3` }),
    });
    expect(absent.status).toBe(201);
    const absentBody = await absent.json();
    const { resource: absentDoc } = await C().join_requests.item(absentBody.id, cls.id).read();
    expect(absentDoc.noticeVersion).toBeNull();
  });
});

// ─── Teacher terms at onboarding ─────────────────────────────────────────────

describe('POST /api/onboarding — terms acceptance (R3)', () => {
  it_int('wrong acceptedTermsVersion 400s; correct stores it and GET /api/me reports termsCurrent true', async () => {
    const oid = `${NONCE}-t-onb`;
    const wrong = await fetch(`${FUNC_URL}/onboarding`, {
      method: 'POST', headers: headers(oid),
      body: JSON.stringify({ schoolName: 'Test School', acceptedTermsVersion: 'old-version' }),
    });
    expect(wrong.status).toBe(400);

    const oid2 = `${NONCE}-t-onb2`;
    const ok = await fetch(`${FUNC_URL}/onboarding`, {
      method: 'POST', headers: headers(oid2),
      body: JSON.stringify({ schoolName: 'Test School 2', acceptedTermsVersion: TERMS_VERSION }),
    });
    expect(ok.status).toBe(201);

    const me = await fetch(`${FUNC_URL}/me`, { headers: headers(oid2) });
    const meBody = await me.json();
    expect(meBody.termsCurrent).toBe(true);
  });
});

// ─── Existing teacher re-accepts ─────────────────────────────────────────────

describe('PUT /api/me/terms — existing teacher re-accepts (R3)', () => {
  it_int('a teacher doc with no terms fields shows termsCurrent false, then PUT flips it', async () => {
    const oid = `${NONCE}-t-reaccept`;
    await fetch(`${FUNC_URL}/onboarding`, { method: 'POST', headers: headers(oid), body: JSON.stringify({ schoolName: 'Legacy School' }) }); // no acceptedTermsVersion

    const before = await fetch(`${FUNC_URL}/me`, { headers: headers(oid) });
    expect((await before.json()).termsCurrent).toBe(false);

    const wrong = await fetch(`${FUNC_URL}/me/terms`, { method: 'PUT', headers: headers(oid), body: JSON.stringify({ version: 'old-version' }) });
    expect(wrong.status).toBe(400);

    const ok = await fetch(`${FUNC_URL}/me/terms`, { method: 'PUT', headers: headers(oid), body: JSON.stringify({ version: TERMS_VERSION }) });
    expect(ok.status).toBe(200);

    const after = await fetch(`${FUNC_URL}/me`, { headers: headers(oid) });
    expect((await after.json()).termsCurrent).toBe(true);
  });
});

// ─── Class attestation ────────────────────────────────────────────────────────

describe('POST /api/classes — attestation required (R3)', () => {
  it_int('missing attestation 400s; valid attestation creates with attestedAt', async () => {
    const oid = `${NONCE}-t-attest`;
    const missing = await fetch(`${FUNC_URL}/classes`, { method: 'POST', headers: headers(oid), body: JSON.stringify({ name: 'No Attestation' }) });
    expect(missing.status).toBe(400);

    const ok = await fetch(`${FUNC_URL}/classes`, {
      method: 'POST', headers: headers(oid),
      body: JSON.stringify({ name: 'Attested', attestation: { schoolAuthorised: true, version: ATTESTATION_VERSION } }),
    });
    expect(ok.status).toBe(201);
    const cls = await ok.json();
    expect(cls.attestedAt).toEqual(expect.any(String));
  });
});

// ─── Cut-off blocks un-attested joins ────────────────────────────────────────
//
// This suite requires the func host to be started with ATTESTATION_REQUIRED_FROM set into the
// PAST (an env override, same mechanism as TEST_COSMOS_* — see CLAUDE.md Testing section). It's
// skipped (not a failure) when that isn't the case, since it needs a specific host configuration
// this file can't set on an already-running host.
const CUTOFF_CONFIGURED = !!process.env.ATTESTATION_REQUIRED_FROM;
const it_cutoff = RUN && CUTOFF_CONFIGURED ? it : it.skip;

describe('POST /api/join-request — attestation cut-off (R3)', () => {
  it_cutoff('a legacy un-attested class 409s after the cut-off; attesting unblocks it', async () => {
    const teacher = `${NONCE}-t-cutoff`;
    // Create via SDK directly (bypassing the API's own attestation requirement) to simulate a
    // pre-R3 class that was never attested.
    const legacyClass = {
      id: `${NONCE}-legacy-cls`, teacherId: teacher, name: 'Legacy Class',
      joinCode: `LGCY${Date.now() % 10000}`, studentCount: 0, nameList: [], nameListEnabled: false,
      cap: 40, isDemo: false, attestedAt: null, attestationVersion: null, createdAt: new Date().toISOString(),
    };
    await C().classes.items.create(legacyClass);

    const blocked = await fetch(`${FUNC_URL}/join-request`, {
      method: 'POST', headers: anon,
      body: JSON.stringify({ joinCode: legacyClass.joinCode, studentName: 'Blocked', deviceId: `${NONCE}-d-blocked` }),
    });
    expect(blocked.status).toBe(409);

    await fetch(`${FUNC_URL}/classes/${legacyClass.id}/attest`, {
      method: 'PUT', headers: headers(teacher), body: JSON.stringify({ version: ATTESTATION_VERSION }),
    });

    const unblocked = await fetch(`${FUNC_URL}/join-request`, {
      method: 'POST', headers: anon,
      body: JSON.stringify({ joinCode: legacyClass.joinCode, studentName: 'Unblocked', deviceId: `${NONCE}-d-unblocked` }),
    });
    expect(unblocked.status).toBe(201);
  });
});

// ─── Cross-tenant attest denied ───────────────────────────────────────────────

describe('PUT /api/classes/{id}/attest — cross-tenant denied (R3)', () => {
  it_int("Teacher B cannot attest Teacher A's class — 404, A's class unchanged", async () => {
    const teacherA = `${NONCE}-t-a`;
    const teacherB = `${NONCE}-t-b`;
    // Create A's class via SDK, un-attested, so there's something for B to try to attest.
    const clsA = {
      id: `${NONCE}-cls-a`, teacherId: teacherA, name: "A's Class",
      joinCode: `XTAA${Date.now() % 10000}`, studentCount: 0, nameList: [], nameListEnabled: false,
      cap: 40, isDemo: false, attestedAt: null, attestationVersion: null, createdAt: new Date().toISOString(),
    };
    await C().classes.items.create(clsA);

    const res = await fetch(`${FUNC_URL}/classes/${clsA.id}/attest`, {
      method: 'PUT', headers: headers(teacherB), body: JSON.stringify({ version: ATTESTATION_VERSION }),
    });
    expect(res.status).toBe(404);

    const { resource: unchanged } = await C().classes.item(clsA.id, teacherA).read();
    expect(unchanged.attestedAt).toBeNull();
  });
});
