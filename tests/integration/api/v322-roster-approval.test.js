// v3.2.2 regression test: roster approval was broken by the Sprint 6 APIM migration
// (commit f72f270), which removed `rateLimit` from the import in api/joinRequests.js but
// left the rateLimit(...) call sites. Every authed handler threw
// `ReferenceError: rateLimit is not defined` → generic 500. See
// docs/fixes/ROSTER_APPROVAL_DIAGNOSIS.md.
//
// This test reproduces the exact failure mode (teacher approves own pending request) and
// asserts it now returns 200 with status "approved", plus the cross-tenant 404 guard.
//
// Requires (same as the rest of the integration suite):
//   - func start (api/) running at FUNC_URL (default: http://localhost:7071/api)
//   - api/local.settings.json with B2C_ALLOW_UNVERIFIED_DEV=true
//   - Cosmos DB (real or emulator) with join_requests + classes containers
//
// Run with: RUN_INTEGRATION=true npm run test:integration -- tests/integration/api/v322-roster-approval.test.js

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

function mintToken(oid) {
  return jwt.sign(
    { oid, name: 'Regression Teacher', emails: ['regress@example.com'] },
    'dev-key',
    { expiresIn: '1h' }
  );
}

async function apiRequest(method, path, body, oid) {
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${mintToken(oid)}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${FUNC_URL}${path}`, opts);
}

async function unauthRequest(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${FUNC_URL}${path}`, opts);
}

describe('v3.2.2 regression: roster approval (rateLimit import restored)', () => {
  let teacherOid;
  let classId;
  let joinCode;

  beforeAll(async () => {
    if (!RUN) return;
    teacherOid = `v322-teacher-${Date.now()}`;
    const res = await apiRequest('POST', '/classes', { name: 'v3.2.2 Roster Class', studentCount: 0 }, teacherOid);
    expect(res.status).toBe(201);
    const cls = await res.json();
    classId = cls.id;
    joinCode = cls.joinCode;
  });

  it_int('owning teacher approves a pending request → 200, status becomes "approved" (was 500 before fix)', async () => {
    // Student submits a join request
    const createRes = await unauthRequest('POST', '/join-request', {
      joinCode, studentName: 'Regression Student', deviceId: `v322-device-${Date.now()}`,
    });
    expect(createRes.status).toBe(201);
    const { id: requestId, status: createStatus } = await createRes.json();
    expect(createStatus).toBe('pending');

    // Teacher approves — this is the line that threw ReferenceError → 500 before the fix.
    const approveRes = await apiRequest('POST', `/join-requests/${requestId}/approve?classId=${classId}`, null, teacherOid);
    expect(approveRes.status).toBe(200);
    const approveData = await approveRes.json();
    expect(approveData.approved).toBe(true);

    // The request document is now approved (visible in the roster list).
    const listRes = await apiRequest('GET', `/join-requests?classId=${classId}`, null, teacherOid);
    expect(listRes.status).toBe(200);
    const requests = await listRes.json();
    const approved = requests.find(r => r.id === requestId);
    expect(approved).toBeDefined();
    expect(approved.status).toBe('approved');
  });

  it_int('cross-tenant: Teacher B approving Teacher A\'s request → 404 (never 200, never 403)', async () => {
    const createRes = await unauthRequest('POST', '/join-request', {
      joinCode, studentName: 'Other Tenant Student', deviceId: `v322-xtenant-${Date.now()}`,
    });
    const { id: requestId } = await createRes.json();

    const otherOid = `v322-teacher-b-${Date.now()}`;
    const res = await apiRequest('POST', `/join-requests/${requestId}/approve?classId=${classId}`, null, otherOid);
    expect(res.status).toBe(404);
  });

  afterAll(async () => {
    if (!RUN || !classId) return;
    await apiRequest('DELETE', `/classes/${classId}`, null, teacherOid);
  });
});
