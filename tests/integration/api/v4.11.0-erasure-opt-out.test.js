// Integration tests for v4.11.0 R2 — Erasure and notification opt-out.
//
// Requires: func start running (with RUN_INTEGRATION=true so the in-memory rate limiter is bypassed),
// B2C_ALLOW_UNVERIFIED_DEV=true, and the TEST Cosmos account (never production — see CLAUDE.md Testing).
// Run: RUN_INTEGRATION=true npm test -- tests/integration/api/v4.11.0-erasure-opt-out.test.js
//
// These assert HTTP status + observable endpoint behaviour (a leave makes the next leave 404, a
// deletion empties GET /api/classes, an erasure removes the join request from the candidates list).
// The deep data-state assertions (studentId null, per-container counts, teacher-doc-last ordering)
// are proven exactly in the offline unit suite (studentDataCleanup.test.js) with fakes.

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

const TEACHER_CLIENT_ID = process.env.AUTH_CLIENT_ID || 'teacher-client-id';
const ADMIN_CLIENT_ID = process.env.ADMIN_AUTH_CLIENT_ID || 'admin-client-id';
const NONCE = `r2-${Date.now()}`;

const nowS = () => Math.floor(Date.now() / 1000);
const staleS = () => nowS() - 3600;

function mintToken(oid, aud, extra = {}) {
  return jwt.sign({ oid, name: 'Integration User', emails: [`${oid}@example.com`], aud, ...extra }, 'dev-key', { expiresIn: '1h' });
}
function teacherHeaders(oid, extra = {}) {
  return { Authorization: `Bearer ${mintToken(oid, TEACHER_CLIENT_ID, extra)}`, 'Content-Type': 'application/json' };
}
function adminHeaders(oid, role = 'owner', extra = {}) {
  return { Authorization: `Bearer ${mintToken(oid, ADMIN_CLIENT_ID, { roles: [role], ...extra })}`, 'Content-Type': 'application/json' };
}
const anon = { 'Content-Type': 'application/json' };

async function createClass(teacherOid, name) {
  const res = await fetch(`${FUNC_URL}/classes`, { method: 'POST', headers: teacherHeaders(teacherOid), body: JSON.stringify({ name }) });
  return res.json(); // { id, joinCode, ... }
}
async function seedApprovedStudent(teacherOid, deviceId, studentName = 'Test Student') {
  const cls = await createClass(teacherOid, `Class ${deviceId}`);
  const jrRes = await fetch(`${FUNC_URL}/join-request`, { method: 'POST', headers: anon, body: JSON.stringify({ joinCode: cls.joinCode, studentName, deviceId }) });
  const joinReq = await jrRes.json(); // { id, classId, ... }
  await fetch(`${FUNC_URL}/join-requests/${joinReq.id}/approve?classId=${cls.id}`, { method: 'POST', headers: teacherHeaders(teacherOid) });
  return { classId: cls.id, joinCode: cls.joinCode, joinRequestId: joinReq.id, deviceId };
}
const fakeSubscription = (n) => ({ endpoint: `https://push.example.com/${n}`, keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(16) } });

// ─── Student leave-class ─────────────────────────────────────────────────────

describe('POST /api/student/leave-class', () => {
  it_int('an approved device leaves — 200, and the join request is gone (a second leave 404s)', async () => {
    const teacher = `${NONCE}-t-leave`;
    const device = `${NONCE}-d-leave`;
    const s = await seedApprovedStudent(teacher, device);

    const r1 = await fetch(`${FUNC_URL}/student/leave-class`, { method: 'POST', headers: anon, body: JSON.stringify({ deviceId: device, classId: s.classId }) });
    expect(r1.status).toBe(200);
    expect((await r1.json()).left).toBe(true);

    const r2 = await fetch(`${FUNC_URL}/student/leave-class`, { method: 'POST', headers: anon, body: JSON.stringify({ deviceId: device, classId: s.classId }) });
    expect(r2.status).toBe(404); // join request removed → not approved any more
  });

  it_int('a device that was never enrolled — 404, uniform (no existence leak)', async () => {
    const r = await fetch(`${FUNC_URL}/student/leave-class`, { method: 'POST', headers: anon, body: JSON.stringify({ deviceId: `${NONCE}-unknown`, classId: `${NONCE}-nope` }) });
    expect(r.status).toBe(404);
  });

  it_int('missing fields — 400', async () => {
    const r = await fetch(`${FUNC_URL}/student/leave-class`, { method: 'POST', headers: anon, body: JSON.stringify({ deviceId: '' }) });
    expect(r.status).toBe(400);
  });
});

// ─── Unsubscribe ─────────────────────────────────────────────────────────────

describe('POST /api/unsubscribe', () => {
  it_int('turning notifications off is idempotent — 200 twice; the join request stays approved', async () => {
    const teacher = `${NONCE}-t-unsub`;
    const device = `${NONCE}-d-unsub`;
    const s = await seedApprovedStudent(teacher, device);
    const subRes = await fetch(`${FUNC_URL}/subscribe`, { method: 'POST', headers: anon, body: JSON.stringify({ classId: s.classId, deviceId: device, subscription: fakeSubscription(1) }) });
    expect(subRes.status).toBe(201);

    const u1 = await fetch(`${FUNC_URL}/unsubscribe`, { method: 'POST', headers: anon, body: JSON.stringify({ deviceId: device, classId: s.classId }) });
    const u2 = await fetch(`${FUNC_URL}/unsubscribe`, { method: 'POST', headers: anon, body: JSON.stringify({ deviceId: device, classId: s.classId }) });
    expect(u1.status).toBe(200);
    expect(u2.status).toBe(200);

    // Join request still approved → a re-subscribe is still allowed (gated on the approved request).
    const reSub = await fetch(`${FUNC_URL}/subscribe`, { method: 'POST', headers: anon, body: JSON.stringify({ classId: s.classId, deviceId: device, subscription: fakeSubscription(2) }) });
    expect(reSub.status).toBe(201);
  });
});

// ─── Teacher account deletion (DELETE /api/me) ───────────────────────────────

describe('DELETE /api/me', () => {
  it_int('no token — 401', async () => {
    const r = await fetch(`${FUNC_URL}/me`, { method: 'DELETE', headers: anon, body: JSON.stringify({ confirm: 'DELETE' }) });
    expect(r.status).toBe(401);
  });

  it_int('a stale sign-in — 401 reauthRequired, nothing deleted', async () => {
    const teacher = `${NONCE}-t-stale`;
    await createClass(teacher, 'Keep me');
    const r = await fetch(`${FUNC_URL}/me`, { method: 'DELETE', headers: teacherHeaders(teacher, { auth_time: staleS() }), body: JSON.stringify({ confirm: 'DELETE' }) });
    expect(r.status).toBe(401);
    expect((await r.json()).reauthRequired).toBe(true);
    // class still there
    const list = await fetch(`${FUNC_URL}/classes`, { headers: teacherHeaders(teacher) });
    expect((await list.json()).length).toBeGreaterThan(0);
  });

  it_int('the wrong confirm word — 400, nothing deleted', async () => {
    const teacher = `${NONCE}-t-confirm`;
    await createClass(teacher, 'Keep me too');
    const r = await fetch(`${FUNC_URL}/me`, { method: 'DELETE', headers: teacherHeaders(teacher, { auth_time: nowS() }), body: JSON.stringify({ confirm: 'delete' }) });
    expect(r.status).toBe(400);
    const list = await fetch(`${FUNC_URL}/classes`, { headers: teacherHeaders(teacher) });
    expect((await list.json()).length).toBeGreaterThan(0);
  });

  it_int('a fresh sign-in with the confirm word — 200, and the teacher’s classes are gone', async () => {
    const teacher = `${NONCE}-t-del`;
    await createClass(teacher, 'Delete me');
    const r = await fetch(`${FUNC_URL}/me`, { method: 'DELETE', headers: teacherHeaders(teacher, { auth_time: nowS() }), body: JSON.stringify({ confirm: 'DELETE' }) });
    expect(r.status).toBe(200);
    const list = await fetch(`${FUNC_URL}/classes`, { headers: teacherHeaders(teacher) });
    expect((await list.json()).length).toBe(0);
    // teacher doc gone → onboarding restarts
    const me = await fetch(`${FUNC_URL}/me`, { headers: teacherHeaders(teacher) });
    expect((await me.json()).onboarded).toBe(false);
  });

  it_int('cross-tenant — deleting A leaves B’s data untouched', async () => {
    const a = `${NONCE}-t-a`;
    const b = `${NONCE}-t-b`;
    await createClass(a, 'A class');
    await createClass(b, 'B class');
    const del = await fetch(`${FUNC_URL}/me`, { method: 'DELETE', headers: teacherHeaders(a, { auth_time: nowS() }), body: JSON.stringify({ confirm: 'DELETE' }) });
    expect(del.status).toBe(200);
    const bList = await fetch(`${FUNC_URL}/classes`, { headers: teacherHeaders(b) });
    expect((await bList.json()).length).toBeGreaterThan(0); // B unaffected
  });
});

// ─── Owner erasure tool ──────────────────────────────────────────────────────

describe('Owner erasure — auth & role gates', () => {
  it_int('no token — 401', async () => {
    const r = await fetch(`${FUNC_URL}/manage/erasure/candidates?classId=x`);
    expect(r.status).toBe(401);
  });

  it_int('a teacher-audience token — 401 (audience mismatch, can’t reach admin routes)', async () => {
    const r = await fetch(`${FUNC_URL}/manage/erasure/device`, { method: 'POST', headers: teacherHeaders(`${NONCE}-t-x`, { auth_time: nowS() }), body: JSON.stringify({ deviceId: 'd', requestRef: 'r' }) });
    expect(r.status).toBe(401);
  });

  it_int('support and platform_admin roles — 404 on every erasure route (owner only)', async () => {
    for (const role of ['support', 'platform_admin']) {
      const c = await fetch(`${FUNC_URL}/manage/erasure/candidates?classId=x`, { headers: adminHeaders(`${NONCE}-a-${role}`, role) });
      const d = await fetch(`${FUNC_URL}/manage/erasure/device`, { method: 'POST', headers: adminHeaders(`${NONCE}-a-${role}`, role, { auth_time: nowS() }), body: JSON.stringify({ deviceId: 'd', requestRef: 'r' }) });
      const t = await fetch(`${FUNC_URL}/manage/teachers/x/delete`, { method: 'POST', headers: adminHeaders(`${NONCE}-a-${role}`, role, { auth_time: nowS() }), body: JSON.stringify({ requestRef: 'r' }) });
      expect(c.status).toBe(404);
      expect(d.status).toBe(404);
      expect(t.status).toBe(404);
    }
  });
});

describe('Owner erasure — candidates + device erasure + teacher deletion', () => {
  const owner = `${NONCE}-owner`;

  it_int('owner lists candidates for a class — 200 with the student row', async () => {
    const teacher = `${NONCE}-t-cand`;
    const device = `${NONCE}-d-cand`;
    const s = await seedApprovedStudent(teacher, device, 'Cand Student');
    const r = await fetch(`${FUNC_URL}/manage/erasure/candidates?classId=${s.classId}`, { headers: adminHeaders(owner, 'owner') });
    expect(r.status).toBe(200);
    const body = await r.json();
    const row = body.candidates.find(c => c.deviceId === device);
    expect(row).toBeTruthy();
    expect(row.studentName).toBe('Cand Student');
  });

  it_int('device erasure needs a fresh sign-in — stale 401 reauthRequired, fresh 200 with counts; the join request then disappears from candidates', async () => {
    const teacher = `${NONCE}-t-erase`;
    const device = `${NONCE}-d-erase`;
    const s = await seedApprovedStudent(teacher, device, 'Erase Me');

    const stale = await fetch(`${FUNC_URL}/manage/erasure/device`, { method: 'POST', headers: adminHeaders(owner, 'owner', { auth_time: staleS() }), body: JSON.stringify({ deviceId: device, requestRef: 'ticket-1' }) });
    expect(stale.status).toBe(401);
    expect((await stale.json()).reauthRequired).toBe(true);

    const missingRef = await fetch(`${FUNC_URL}/manage/erasure/device`, { method: 'POST', headers: adminHeaders(owner, 'owner', { auth_time: nowS() }), body: JSON.stringify({ deviceId: device }) });
    expect(missingRef.status).toBe(400);

    const fresh = await fetch(`${FUNC_URL}/manage/erasure/device`, { method: 'POST', headers: adminHeaders(owner, 'owner', { auth_time: nowS() }), body: JSON.stringify({ deviceId: device, requestRef: 'ticket-1' }) });
    expect(fresh.status).toBe(200);
    expect((await fresh.json()).counts).toBeTruthy();

    const after = await fetch(`${FUNC_URL}/manage/erasure/candidates?classId=${s.classId}`, { headers: adminHeaders(owner, 'owner') });
    const rows = (await after.json()).candidates || [];
    expect(rows.find(c => c.deviceId === device)).toBeFalsy();
  });

  it_int('owner deletes a teacher account — 200 with counts, and the overview then 404s', async () => {
    const teacher = `${NONCE}-t-owndel`;
    await createClass(teacher, 'Owner-deleted class');
    const del = await fetch(`${FUNC_URL}/manage/teachers/${teacher}/delete`, { method: 'POST', headers: adminHeaders(owner, 'owner', { auth_time: nowS() }), body: JSON.stringify({ requestRef: 'parent-email' }) });
    expect(del.status).toBe(200);
    expect((await del.json()).counts).toBeTruthy();
    const overview = await fetch(`${FUNC_URL}/manage/teachers/${teacher}/overview`, { headers: adminHeaders(owner, 'owner') });
    expect(overview.status).toBe(404);
  });
});
