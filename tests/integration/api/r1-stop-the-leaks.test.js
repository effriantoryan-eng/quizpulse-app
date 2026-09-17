// Integration tests for v4.9.1 R1 (Stop the leaks).
//
// Requires: func start running against the TEST Cosmos account (NEVER production — CLAUDE.md
// Testing section), B2C_ALLOW_UNVERIFIED_DEV=true. rateLimit() is bypassed under RUN_INTEGRATION.
// Run with: RUN_INTEGRATION=true TEST_COSMOS_ENDPOINT=... TEST_COSMOS_KEY=... \
//   npx jest --config jest.config.cjs tests/integration/api/r1-stop-the-leaks.test.js
//
// Tokens minted as in v490-admin-teacher-data.test.js; subscribe/send flow as in push.test.js.
// This file seeds and verifies with a direct Cosmos SDK client pinned to TEST_COSMOS_* so it can
// NEVER read or write production, and it forces the (founder-run) cleanup script onto the same
// test account before invoking it.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { CosmosClient } = require('@azure/cosmos');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

// Hard safety pin: the cleanup script and our SDK client both read COSMOS_ENDPOINT/KEY. In this
// process's env those point at PRODUCTION (CLAUDE.md), so refuse to run without TEST creds and
// override the whole process onto the test account.
if (RUN) {
  if (!process.env.TEST_COSMOS_ENDPOINT || !process.env.TEST_COSMOS_KEY) {
    throw new Error('R1 integration test needs TEST_COSMOS_ENDPOINT/KEY — it must never touch production Cosmos.');
  }
  process.env.COSMOS_ENDPOINT = process.env.TEST_COSMOS_ENDPOINT;
  process.env.COSMOS_KEY = process.env.TEST_COSMOS_KEY;
  process.env.COSMOS_DATABASE = process.env.COSMOS_DATABASE || 'quizpulse';
}

// require AFTER the env pin above, so the script's module-load (if any) sees test values.
const { main: cleanupMain } = require('../../../api/scripts/cleanupOrphanedStudentData');

let _c = null;
function C() {
  if (!_c) {
    const db = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY })
      .database(process.env.COSMOS_DATABASE);
    _c = {
      classes: db.container('classes'),
      join_requests: db.container('join_requests'),
      subscriptions: db.container('subscriptions'),
      responses: db.container('responses'),
      quizzes: db.container('quizzes'),
    };
  }
  return _c;
}

function mintToken(oid, extra = {}) {
  return jwt.sign({ oid, name: 'R1 Teacher', emails: [`${oid}@example.com`], ...extra }, 'dev-key', { expiresIn: '1h' });
}
function headers(oid, extra = {}) {
  return { Authorization: `Bearer ${mintToken(oid, extra)}`, 'Content-Type': 'application/json' };
}

const uniq = () => Date.now() + '-' + Math.random().toString(36).slice(2, 8);

// ---- HTTP flow helpers --------------------------------------------------------------------------

async function createClass(oid, name = `R1 class ${uniq()}`) {
  const res = await fetch(`${FUNC_URL}/classes`, { method: 'POST', headers: headers(oid), body: JSON.stringify({ name }) });
  return res.json(); // { id, joinCode, ... }
}
async function join(joinCode, deviceId, studentName) {
  const res = await fetch(`${FUNC_URL}/join-request`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode, deviceId, studentName }),
  });
  return res.json(); // { id, classId, status }
}
async function approve(jrId, classId, oid) {
  return fetch(`${FUNC_URL}/join-requests/${jrId}/approve?classId=${classId}`, { method: 'POST', headers: headers(oid), body: '{}' });
}
async function subscribe(classId, deviceId) {
  return fetch(`${FUNC_URL}/subscribe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, deviceId, subscription: { endpoint: `https://push.example.com/${deviceId}`, keys: { p256dh: 'x', auth: 'y' } } }),
  });
}
// Seed a sent quiz + one response directly (the send-transition and submit-gate machinery is
// orthogonal to what the cascade does; seeding keeps the verification deterministic).
async function seedSentQuiz(teacherId, classId) {
  const id = 'r1-quiz-' + uniq();
  await C().quizzes.items.create({
    id, teacherId, name: 'R1 quiz', questionIds: [], classIds: [classId], classSize: 1,
    status: 'sent', sentAt: new Date().toISOString(),
    closedAt: new Date(Date.now() + 3600000).toISOString(), createdAt: new Date().toISOString(),
  });
  return id;
}
async function seedResponse(quizId, deviceId) {
  const id = crypto.createHash('sha256').update(`${quizId}:${deviceId}`).digest('hex');
  await C().responses.items.create({
    id, quizId, studentId: deviceId,
    answers: [{ questionId: 'q1', selectedIndex: 0, confidence: 'sure' }],
    completedAt: new Date().toISOString(),
  });
  return id;
}
async function countByClass(container, classId) {
  const { resources } = await C()[container].items.query({
    query: 'SELECT VALUE COUNT(1) FROM c WHERE c.classId = @cid', parameters: [{ name: '@cid', value: classId }],
  }).fetchAll();
  return resources[0] || 0;
}
async function responsesFor(quizId) {
  const { resources } = await C().responses.items.query({
    query: 'SELECT * FROM c WHERE c.quizId = @qid', parameters: [{ name: '@qid', value: quizId }],
  }).fetchAll();
  return resources;
}

const A = 'r1-teacher-A-' + uniq();
const B = 'r1-teacher-B-' + uniq();

// ---- cascade ------------------------------------------------------------------------------------

describe('DELETE /api/classes/{id} — cascade', () => {
  it_int('class delete cascades to join requests, subscriptions and de-identifies responses', async () => {
    const cls = await createClass(A);
    const device = 'dev-' + uniq();
    const jr = await join(cls.joinCode, device, 'Alice');
    expect((await approve(jr.id, cls.id, A)).status).toBe(200);
    expect((await subscribe(cls.id, device)).status).toBe(201);
    const quizId = await seedSentQuiz(A, cls.id);
    await seedResponse(quizId, device);

    const del = await fetch(`${FUNC_URL}/classes/${cls.id}`, { method: 'DELETE', headers: headers(A) });
    expect(del.status).toBe(200);

    expect(await countByClass('join_requests', cls.id)).toBe(0);
    expect(await countByClass('subscriptions', cls.id)).toBe(0);
    const resps = await responsesFor(quizId);
    expect(resps).toHaveLength(1);            // response count unchanged
    expect(resps[0].studentId).toBeNull();    // de-identified

    const list = await (await fetch(`${FUNC_URL}/classes`, { headers: headers(A) })).json();
    expect(list.find((c) => c.id === cls.id)).toBeUndefined();
  });

  it_int('class delete is retry-safe after a partial cascade (no duplicate responses)', async () => {
    const cls = await createClass(A);
    const device = 'dev-' + uniq();
    const jr = await join(cls.joinCode, device, 'Bob');
    await approve(jr.id, cls.id, A);
    await subscribe(cls.id, device);
    const quizId = await seedSentQuiz(A, cls.id);
    await seedResponse(quizId, device);

    // Simulate a partial cascade: delete only the subscriptions via SDK, then delete the class.
    const subs = (await C().subscriptions.items.query({ query: 'SELECT c.id FROM c WHERE c.classId=@c', parameters: [{ name: '@c', value: cls.id }] }).fetchAll()).resources;
    for (const s of subs) await C().subscriptions.item(s.id, cls.id).delete();

    const del = await fetch(`${FUNC_URL}/classes/${cls.id}`, { method: 'DELETE', headers: headers(A) });
    expect(del.status).toBe(200);
    const resps = await responsesFor(quizId);
    expect(resps).toHaveLength(1);         // exactly one — no duplicate copy
    expect(resps[0].studentId).toBeNull();
    const gone = await (await fetch(`${FUNC_URL}/classes`, { headers: headers(A) })).json();
    expect(gone.find((c) => c.id === cls.id)).toBeUndefined();
  });
});

// ---- remove student -----------------------------------------------------------------------------

describe('DELETE /api/classes/{id}/students/{jr} — remove student', () => {
  it_int('removes one student cleanly and leaves the other untouched', async () => {
    const cls = await createClass(A);
    const d1 = 'dev-' + uniq(); const d2 = 'dev-' + uniq();
    const jr1 = await join(cls.joinCode, d1, 'One');
    const jr2 = await join(cls.joinCode, d2, 'Two');
    await approve(jr1.id, cls.id, A);
    await approve(jr2.id, cls.id, A);
    await subscribe(cls.id, d1);
    await subscribe(cls.id, d2);
    const quizId = await seedSentQuiz(A, cls.id);
    await seedResponse(quizId, d1);
    await seedResponse(quizId, d2);
    const before = await (await fetch(`${FUNC_URL}/classes`, { headers: headers(A) })).json();
    const countBefore = before.find((c) => c.id === cls.id).studentCount;

    const rem = await fetch(`${FUNC_URL}/classes/${cls.id}/students/${jr1.id}`, { method: 'DELETE', headers: headers(A) });
    expect(rem.status).toBe(200);

    // d1: subscription gone, response de-identified
    expect(await countByClass('subscriptions', cls.id)).toBe(1); // only d2's remains
    const resps = await responsesFor(quizId);
    const byDevice = Object.fromEntries(resps.map((r) => [r.studentId, r]));
    expect(byDevice[d1]).toBeUndefined();          // d1's original gone
    expect(byDevice[d2]).toBeDefined();            // d2 untouched
    expect(resps.some((r) => r.studentId === null)).toBe(true); // d1 de-identified copy exists
    const after = await (await fetch(`${FUNC_URL}/classes`, { headers: headers(A) })).json();
    expect(after.find((c) => c.id === cls.id).studentCount).toBe(countBefore - 1);
  });

  it_int('a removed student is not notified and their subscription is absent', async () => {
    const cls = await createClass(A);
    const d1 = 'dev-' + uniq(); const d2 = 'dev-' + uniq();
    const jr1 = await join(cls.joinCode, d1, 'One');
    const jr2 = await join(cls.joinCode, d2, 'Two');
    await approve(jr1.id, cls.id, A);
    await approve(jr2.id, cls.id, A);
    await subscribe(cls.id, d1);
    await subscribe(cls.id, d2);
    const quizId = await seedSentQuiz(A, cls.id);

    await fetch(`${FUNC_URL}/classes/${cls.id}/students/${jr1.id}`, { method: 'DELETE', headers: headers(A) });

    const send = await fetch(`${FUNC_URL}/send-notification`, {
      method: 'POST', headers: headers(A),
      body: JSON.stringify({ quizId, quizTitle: 'R1 quiz', questionCount: 1 }),
    });
    expect(send.status).toBe(200);
    const body = await send.json();
    expect(body.total).toBe(1); // only the remaining approved device
    // d1's subscription doc is absent
    const d1subs = (await C().subscriptions.items.query({ query: 'SELECT c.id FROM c WHERE c.classId=@c AND c.deviceId=@d', parameters: [{ name: '@c', value: cls.id }, { name: '@d', value: d1 }] }).fetchAll()).resources;
    expect(d1subs).toHaveLength(0);
  });
});

// ---- cross-tenant -------------------------------------------------------------------------------

describe('cross-tenant denial (404, never the resource)', () => {
  it_int('Teacher B cannot delete Teacher A\'s class; A\'s data is unchanged', async () => {
    const cls = await createClass(A);
    const device = 'dev-' + uniq();
    const jr = await join(cls.joinCode, device, 'Alice');
    await approve(jr.id, cls.id, A);
    await subscribe(cls.id, device);
    const quizId = await seedSentQuiz(A, cls.id);
    await seedResponse(quizId, device);

    const del = await fetch(`${FUNC_URL}/classes/${cls.id}`, { method: 'DELETE', headers: headers(B) });
    expect(del.status).toBe(404);
    expect(await countByClass('join_requests', cls.id)).toBe(1);
    expect(await countByClass('subscriptions', cls.id)).toBe(1);
    const resps = await responsesFor(quizId);
    expect(resps[0].studentId).toBe(device); // not de-identified
  });

  it_int('Teacher B cannot remove a student from Teacher A\'s class; the join request stays approved', async () => {
    const cls = await createClass(A);
    const device = 'dev-' + uniq();
    const jr = await join(cls.joinCode, device, 'Alice');
    await approve(jr.id, cls.id, A);

    const rem = await fetch(`${FUNC_URL}/classes/${cls.id}/students/${jr.id}`, { method: 'DELETE', headers: headers(B) });
    expect(rem.status).toBe(404);
    const doc = (await C().join_requests.item(jr.id, cls.id).read()).resource;
    expect(doc.status).toBe('approved');
  });
});

// ---- usage log retired --------------------------------------------------------------------------

describe('GET /api/usageLog — retired', () => {
  it_int('returns 404 even with an owner token', async () => {
    const res = await fetch(`${FUNC_URL}/usageLog`, { headers: headers('r1-owner', { roles: ['owner'] }) });
    expect(res.status).toBe(404);
  });
});

// ---- cleanup script end to end ------------------------------------------------------------------

describe('cleanupOrphanedStudentData script', () => {
  it_int('dry run reports seeded orphans; --apply fixes them; a final dry run reports 0', async () => {
    // Seed an orphaned join request + subscription against a non-existent class, and — with a
    // SEPARATE device that holds no approved enrolment anywhere — a response to a quiz that targets
    // that dead class. (If the response's device shared the seeded approved join request, category
    // (c) would correctly treat it as still enrolled, so the two must be distinct devices.)
    const deadClass = 'r1-dead-class-' + uniq();
    const deviceJR = 'r1-orphan-jr-dev-' + uniq();
    const deviceR = 'r1-orphan-resp-dev-' + uniq();
    const jrId = 'r1-orphan-jr-' + uniq();
    const subId = 'r1-orphan-sub-' + uniq();
    const quizId = 'r1-orphan-quiz-' + uniq();
    await C().join_requests.items.create({ id: jrId, classId: deadClass, deviceId: deviceJR, status: 'approved', studentName: 'Ghost', createdAt: new Date().toISOString() });
    await C().subscriptions.items.create({ id: subId, classId: deadClass, deviceId: deviceJR, endpoint: 'e', keys: {} });
    await C().quizzes.items.create({ id: quizId, teacherId: A, name: 'orphan quiz', questionIds: [], classIds: [deadClass], status: 'sent', sentAt: new Date().toISOString(), createdAt: new Date().toISOString() });
    const respId = await seedResponse(quizId, deviceR);

    const dry1 = await cleanupMain({ apply: false });
    expect(dry1.found.orphanJoinRequests).toBeGreaterThanOrEqual(1);
    expect(dry1.found.orphanSubscriptions).toBeGreaterThanOrEqual(1);
    expect(dry1.found.responsesToDeidentify).toBeGreaterThanOrEqual(1);

    await cleanupMain({ apply: true });

    // The orphaned join request + subscription are gone; the response is de-identified.
    await expect(C().join_requests.item(jrId, deadClass).read().then((r) => r.resource)).resolves.toBeUndefined();
    await expect(C().subscriptions.item(subId, deadClass).read().then((r) => r.resource)).resolves.toBeUndefined();
    const resps = await responsesFor(quizId);
    expect(resps).toHaveLength(1);
    expect(resps[0].studentId).toBeNull();
    expect(resps[0].id).not.toBe(respId); // new random id

    const dry2 = await cleanupMain({ apply: false });
    expect(dry2.found.orphanJoinRequests).toBe(0);
    expect(dry2.found.orphanSubscriptions).toBe(0);
    expect(dry2.found.responsesToDeidentify).toBe(0);
  });
});
