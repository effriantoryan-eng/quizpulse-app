// Integration tests for join request flow.
// Requires:
//   - func start (api/) running at FUNC_URL (default: http://localhost:7071)
//   - api/local.settings.json with B2C_ALLOW_UNVERIFIED_DEV=true
//   - Cosmos DB (real or emulator) accessible
//   - join_requests container created with partition key /classId
//
// Run with: RUN_INTEGRATION=true npm test -- tests/integration

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

function mintToken(oid) {
  return jwt.sign(
    { oid, name: 'Integration Teacher', emails: ['integ@example.com'] },
    'dev-key',
    { expiresIn: '1h' }
  );
}

async function apiRequest(method, path, body, oid) {
  const token = mintToken(oid);
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${FUNC_URL}${path}`, opts);
}

async function unauthRequest(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${FUNC_URL}${path}`, opts);
}

// Shared state across tests
let teacherOid;
let classId;
let joinCode;
const deviceId = `test-device-${Date.now()}`;

describe('Sprint 2 integration: join request flow', () => {
  beforeAll(async () => {
    if (!RUN) return;
    teacherOid = `integ-s2-teacher-${Date.now()}`;

    // Create a class to use in all join request tests
    const res = await apiRequest('POST', '/classes', { name: 'S2 Test Class', studentCount: 0 }, teacherOid);
    expect(res.status).toBe(201);
    const cls = await res.json();
    classId = cls.id;
    joinCode = cls.joinCode;
  });

  describe('POST /api/join-request', () => {
    it_int('returns 400 when joinCode is missing', async () => {
      const res = await unauthRequest('POST', '/join-request', { studentName: 'Alice', deviceId });
      expect(res.status).toBe(400);
    });

    it_int('returns 400 when studentName is missing', async () => {
      const res = await unauthRequest('POST', '/join-request', { joinCode, deviceId });
      expect(res.status).toBe(400);
    });

    it_int('returns 404 for an unknown join code', async () => {
      const res = await unauthRequest('POST', '/join-request', {
        joinCode: 'ZZZZZZZZ', studentName: 'Alice', deviceId: `device-${Date.now()}`,
      });
      expect(res.status).toBe(404);
    });

    it_int('creates a pending join request for a valid join code', async () => {
      const res = await unauthRequest('POST', '/join-request', {
        joinCode, studentName: 'Alice Smith', deviceId,
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.status).toBe('pending');
      expect(data.classId).toBe(classId);
    });

    it_int('queues the 41st student when class is full', async () => {
      const fullOid = `integ-full-${Date.now()}`;
      // Create a class already at cap (use studentCount field to simulate)
      // For a true integration test, we'd need 40 approved requests. Instead we test
      // the queue path by creating a class with studentCount=40.
      const classRes = await apiRequest('POST', '/classes', { name: 'Full Class', studentCount: 40 }, fullOid);
      const fullClass = await classRes.json();

      const reqRes = await unauthRequest('POST', '/join-request', {
        joinCode: fullClass.joinCode,
        studentName: 'Queued Student',
        deviceId: `queue-device-${Date.now()}`,
      });
      expect(reqRes.status).toBe(201);
      const data = await reqRes.json();
      expect(data.status).toBe('queued');

      // Cleanup
      await apiRequest('DELETE', `/classes/${fullClass.id}`, null, fullOid);
    });
  });

  describe('GET /api/join-request/status', () => {
    it_int('returns 400 when deviceId or classId is missing', async () => {
      const res = await unauthRequest('GET', '/join-request/status?deviceId=test');
      expect(res.status).toBe(400);
    });

    it_int('returns status for an existing request', async () => {
      const res = await unauthRequest('GET', `/join-request/status?deviceId=${encodeURIComponent(deviceId)}&classId=${classId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(['pending', 'approved', 'queued', 'rejected']).toContain(data.status);
    });
  });

  describe('GET /api/join-requests (teacher list)', () => {
    it_int('returns 401 without a token', async () => {
      const res = await unauthRequest('GET', `/join-requests?classId=${classId}`);
      expect(res.status).toBe(401);
    });

    it_int('returns 400 without classId', async () => {
      const res = await apiRequest('GET', '/join-requests', null, teacherOid);
      expect(res.status).toBe(400);
    });

    it_int('returns array of requests for the class', async () => {
      const res = await apiRequest('GET', `/join-requests?classId=${classId}`, null, teacherOid);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it_int('returns 404 when a different teacher tries to list (Sprint 5: 404, not 403 — see docs/security/SPRINT5_AUDIT.md)', async () => {
      const otherOid = `integ-other-${Date.now()}`;
      const res = await apiRequest('GET', `/join-requests?classId=${classId}`, null, otherOid);
      expect(res.status).toBe(404);
    });
  });

  describe('Approve and reject flow', () => {
    let requestId;

    beforeAll(async () => {
      if (!RUN) return;
      // Create a fresh request to approve/reject
      const res = await unauthRequest('POST', '/join-request', {
        joinCode,
        studentName: 'Bob Jones',
        deviceId: `approve-device-${Date.now()}`,
      });
      const data = await res.json();
      requestId = data.id;
    });

    it_int('returns 404 when a different teacher tries to approve (Sprint 5: 404, not 403)', async () => {
      const otherOid = `integ-other-approve-${Date.now()}`;
      const res = await apiRequest('POST', `/join-requests/${requestId}/approve?classId=${classId}`, null, otherOid);
      expect(res.status).toBe(404);
    });

    it_int('approves the request and increments studentCount', async () => {
      const res = await apiRequest('POST', `/join-requests/${requestId}/approve?classId=${classId}`, null, teacherOid);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.approved).toBe(true);

      // Verify studentCount incremented
      const classRes = await apiRequest('GET', '/classes', null, teacherOid);
      const classes = await classRes.json();
      const cls = classes.find(c => c.id === classId);
      expect(cls.studentCount).toBeGreaterThan(0);
    });

    it_int('is idempotent — approving again returns 200', async () => {
      const res = await apiRequest('POST', `/join-requests/${requestId}/approve?classId=${classId}`, null, teacherOid);
      expect(res.status).toBe(200);
    });

    it_int('rejects a request and sets status to rejected', async () => {
      const rejectDevice = `reject-device-${Date.now()}`;
      const reqRes = await unauthRequest('POST', '/join-request', {
        joinCode, studentName: 'Carol Williams', deviceId: rejectDevice,
      });
      const { id: rejectId } = await reqRes.json();

      const res = await apiRequest('POST', `/join-requests/${rejectId}/reject?classId=${classId}`, null, teacherOid);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rejected).toBe(true);
    });

    it_int('batch approve returns approved and skipped counts', async () => {
      // Create two fresh requests
      const d1 = `batch-d1-${Date.now()}`;
      const d2 = `batch-d2-${Date.now()}`;
      const [r1, r2] = await Promise.all([
        unauthRequest('POST', '/join-request', { joinCode, studentName: 'Dave Brown', deviceId: d1 }),
        unauthRequest('POST', '/join-request', { joinCode, studentName: 'Eve Davis', deviceId: d2 }),
      ]);
      const [req1, req2] = await Promise.all([r1.json(), r2.json()]);

      const res = await apiRequest('POST', '/join-requests/approve-batch', {
        classId, ids: [req1.id, req2.id],
      }, teacherOid);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.approved.length + data.skipped.length).toBe(2);
    });

    it_int('race condition: last spot is not double-allocated', async () => {
      // Create a class with 39 students (one spot left)
      const raceOid = `integ-race-${Date.now()}`;
      const classRes = await apiRequest('POST', '/classes', { name: 'Race Class', studentCount: 39 }, raceOid);
      const raceClass = await classRes.json();

      // Create two requests
      const [r1, r2] = await Promise.all([
        unauthRequest('POST', '/join-request', { joinCode: raceClass.joinCode, studentName: 'R1', deviceId: `race-d1-${Date.now()}` }),
        unauthRequest('POST', '/join-request', { joinCode: raceClass.joinCode, studentName: 'R2', deviceId: `race-d2-${Date.now()}` }),
      ]);
      const [req1, req2] = await Promise.all([r1.json(), r2.json()]);

      // Approve both simultaneously
      const [a1, a2] = await Promise.all([
        apiRequest('POST', `/join-requests/${req1.id}/approve?classId=${raceClass.id}`, null, raceOid),
        apiRequest('POST', `/join-requests/${req2.id}/approve?classId=${raceClass.id}`, null, raceOid),
      ]);

      // One should succeed (200), the other should be queued (409 or 200 with queued)
      const statuses = [a1.status, a2.status];
      expect(statuses).toContain(200);

      // Verify final studentCount <= 40
      const classCheckRes = await apiRequest('GET', '/classes', null, raceOid);
      const classes = await classCheckRes.json();
      const finalClass = classes.find(c => c.id === raceClass.id);
      expect(finalClass.studentCount).toBeLessThanOrEqual(40);

      // Cleanup
      await apiRequest('DELETE', `/classes/${raceClass.id}`, null, raceOid);
    }, 30000);
  });

  describe('Student removal and queue promotion', () => {
    it_int('promotes oldest queued request when a student is removed', async () => {
      const removeOid = `integ-remove-${Date.now()}`;
      const classRes = await apiRequest('POST', '/classes', { name: 'Remove Class', studentCount: 39 }, removeOid);
      const removeClass = await classRes.json();
      const removeClassId = removeClass.id;

      // Create and approve a student (fills last spot)
      const approveDevice = `remove-app-${Date.now()}`;
      const reqRes = await unauthRequest('POST', '/join-request', {
        joinCode: removeClass.joinCode, studentName: 'To Remove', deviceId: approveDevice,
      });
      const { id: approvedId } = await reqRes.json();
      await apiRequest('POST', `/join-requests/${approvedId}/approve?classId=${removeClassId}`, null, removeOid);

      // Create a queued request (class now at 40)
      const queueDevice = `remove-queue-${Date.now()}`;
      const queueRes = await unauthRequest('POST', '/join-request', {
        joinCode: removeClass.joinCode, studentName: 'Will Be Promoted', deviceId: queueDevice,
      });
      const queueData = await queueRes.json();
      expect(queueData.status).toBe('queued');
      const queuedId = queueData.id;

      // Remove the approved student
      const removeRes = await fetch(`${FUNC_URL}/classes/${removeClassId}/students/${approvedId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${mintToken(removeOid)}` },
      });
      expect(removeRes.status).toBe(200);

      // Check queued request was promoted to pending
      const listRes = await apiRequest('GET', `/join-requests?classId=${removeClassId}`, null, removeOid);
      const requests = await listRes.json();
      const promoted = requests.find(r => r.id === queuedId);
      expect(promoted).toBeDefined();
      expect(promoted.status).toBe('pending');

      // Cleanup
      await apiRequest('DELETE', `/classes/${removeClassId}`, null, removeOid);
    }, 30000);
  });

  afterAll(async () => {
    if (!RUN || !classId) return;
    await apiRequest('DELETE', `/classes/${classId}`, null, teacherOid);
  });
});
