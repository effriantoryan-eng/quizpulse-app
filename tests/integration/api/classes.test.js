// Integration tests for /api/classes CRUD endpoints.
// Requires:
//   - func start (api/) running at FUNC_URL (default: http://localhost:7071)
//   - api/local.settings.json with B2C_ALLOW_UNVERIFIED_DEV=true
//   - Cosmos DB (real or emulator) accessible
//
// Run with: RUN_INTEGRATION=true npm test -- tests/integration

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

function mintToken(oid = 'integ-teacher-001') {
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
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${FUNC_URL}${path}`, opts);
}

describe('GET /api/classes', () => {
  it_int('returns 401 without a token', async () => {
    const res = await fetch(`${FUNC_URL}/classes`);
    expect(res.status).toBe(401);
  });

  it_int('returns 200 and an array for a valid teacher', async () => {
    const res = await apiRequest('GET', '/classes');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('POST /api/classes', () => {
  const uniqueOid = `integ-create-${Date.now()}`;
  let createdId;

  it_int('creates a class and returns 201 with the new document', async () => {
    const res = await apiRequest('POST', '/classes', { name: 'Integration Test Class', studentCount: 10 }, uniqueOid);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe('Integration Test Class');
    expect(data.teacherId).toBe(uniqueOid);
    expect(data.studentCount).toBe(10);
    expect(data.joinCode).toHaveLength(8);
    expect(data.cap).toBe(40);
    createdId = data.id;
  });

  it_int('returns 400 when name is missing', async () => {
    const res = await apiRequest('POST', '/classes', { studentCount: 5 }, uniqueOid);
    expect(res.status).toBe(400);
  });

  it_int('returns 400 when name exceeds 80 characters', async () => {
    const res = await apiRequest('POST', '/classes', { name: 'A'.repeat(81) }, uniqueOid);
    expect(res.status).toBe(400);
  });

  it_int('returns 429 on the 21st class for the same teacher', async () => {
    const cappedOid = `integ-cap-${Date.now()}`;
    // Create 20 classes
    for (let i = 0; i < 20; i++) {
      const r = await apiRequest('POST', '/classes', { name: `Class ${i + 1}` }, cappedOid);
      expect(r.status).toBe(201);
    }
    // 21st must be blocked
    const res = await apiRequest('POST', '/classes', { name: 'Class 21' }, cappedOid);
    expect(res.status).toBe(429);
  }, 60000); // may take time for 20 creates

  afterAll(async () => {
    if (createdId) {
      await apiRequest('DELETE', `/classes/${createdId}`, null, uniqueOid);
    }
  });
});

describe('PUT /api/classes/{id}', () => {
  const uniqueOid = `integ-put-${Date.now()}`;
  let classId;

  beforeAll(async () => {
    if (!RUN) return;
    const res = await apiRequest('POST', '/classes', { name: 'Original Name', studentCount: 5 }, uniqueOid);
    const data = await res.json();
    classId = data.id;
  });

  it_int('updates the class name', async () => {
    const res = await apiRequest('PUT', `/classes/${classId}`, { name: 'Updated Name' }, uniqueOid);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('Updated Name');
  });

  it_int('returns 404 when a different teacher tries to update (Sprint 5: 404, not 403)', async () => {
    const otherOid = `integ-other-${Date.now()}`;
    const res = await apiRequest('PUT', `/classes/${classId}`, { name: 'Stolen Name' }, otherOid);
    expect(res.status).toBe(404);
  });

  afterAll(async () => {
    if (classId) {
      await apiRequest('DELETE', `/classes/${classId}`, null, uniqueOid);
    }
  });
});

describe('DELETE /api/classes/{id}', () => {
  const uniqueOid = `integ-del-${Date.now()}`;
  let classId;

  beforeAll(async () => {
    if (!RUN) return;
    const res = await apiRequest('POST', '/classes', { name: 'To Be Deleted' }, uniqueOid);
    const data = await res.json();
    classId = data.id;
  });

  it_int('returns 404 when a different teacher tries to delete (Sprint 5: 404, not 403)', async () => {
    const otherOid = `integ-other-del-${Date.now()}`;
    const res = await apiRequest('DELETE', `/classes/${classId}`, null, otherOid);
    expect(res.status).toBe(404);
  });

  it_int('deletes the class and returns 200', async () => {
    const res = await apiRequest('DELETE', `/classes/${classId}`, null, uniqueOid);
    expect(res.status).toBe(200);
    classId = null;
  });

  it_int('returns 404 for the deleted class', async () => {
    const res = await apiRequest('DELETE', `/classes/nonexistent-id`, null, uniqueOid);
    expect(res.status).toBe(404);
  });
});
