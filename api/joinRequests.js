const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { getTeacher } = require('./teacher');
const crypto = require('crypto');
const { runFuzzyMatch } = require('./fuzzyMatchHelper');
const { assertScope, ScopeError } = require('./shared/authz');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');

const STUDENT_NAME_MAX = 80;
const STUDENT_CAP = 40;
const REQUESTS_PER_DEVICE_PER_DAY = 5;
const BRUTE_FORCE_MAX = 10;
const BRUTE_FORCE_WINDOW_MS = 3600000; // 1 hour
const PENDING_PER_CLASS_MAX = 60;

async function getClassByJoinCode(joinCode) {
  const { resources } = await classesContainer.items.query({
    query: 'SELECT * FROM c WHERE c.joinCode = @code',
    parameters: [{ name: '@code', value: joinCode }],
  }).fetchAll();
  return resources[0] || null;
}

async function getClassById(classId) {
  try {
    const { resources } = await classesContainer.items.query({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: classId }],
    }).fetchAll();
    return resources[0] || null;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

async function checkDeviceRateLimit(deviceId) {
  const since = new Date(Date.now() - 86400000).toISOString();
  const { resources } = await joinRequestsContainer.items.query({
    query: 'SELECT VALUE COUNT(1) FROM c WHERE c.deviceId = @did AND c.createdAt > @since',
    parameters: [
      { name: '@did', value: deviceId },
      { name: '@since', value: since },
    ],
  }).fetchAll();
  return (resources[0] || 0) < REQUESTS_PER_DEVICE_PER_DAY;
}


// POST /api/join-request — student submits a join request (no auth)
app.http('joinRequestCreate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'join-request',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body) {
      logRequest(context, { endpoint: 'join-request', method: 'POST', status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }
    try {
      const ip = getClientIp(request);

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 4096) return respond(413, { error: 'Request body too large.' });

      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' });
      }

      const { joinCode, studentName, deviceId } = body;

      if (typeof deviceId !== 'string' || !deviceId.trim()) {
        return respond(400, { error: 'deviceId is required' });
      }
      if (typeof joinCode !== 'string' || !joinCode.trim()) {
        return respond(400, { error: 'joinCode is required' });
      }
      if (typeof studentName !== 'string' || !studentName.trim()) {
        return respond(400, { error: 'studentName is required' });
      }
      if (studentName.trim().length > STUDENT_NAME_MAX) {
        return respond(400, { error: `studentName must be ${STUDENT_NAME_MAX} characters or fewer` });
      }

      // Brute-force protection: 10 wrong attempts/IP/hr
      const bruteKey = `join-brute:${ip}`;
      const cls = await getClassByJoinCode(joinCode.trim().toUpperCase());
      if (!cls) {
        // Count this as a bad attempt before returning 404
        if (!rateLimit(bruteKey, BRUTE_FORCE_MAX, BRUTE_FORCE_WINDOW_MS)) {
          return respond(429, { error: 'Too many incorrect join code attempts. Try again in an hour.' });
        }
        rateLimit(bruteKey, BRUTE_FORCE_MAX, BRUTE_FORCE_WINDOW_MS); // consume a slot
        return respond(404, { error: 'Class not found. Check your join code.' });
      }

      // Per-device daily rate limit (stored in join_requests with Cosmos query)
      const deviceAllowed = await checkDeviceRateLimit(deviceId.trim());
      if (!deviceAllowed) {
        return respond(429, { error: 'You have reached the maximum of 5 join requests per day.' });
      }

      // Check pending count per class (max 60)
      const { resources: pendingCount } = await joinRequestsContainer.items.query({
        query: "SELECT VALUE COUNT(1) FROM c WHERE c.classId = @cid AND c.status IN ('pending', 'queued')",
        parameters: [{ name: '@cid', value: cls.id }],
      }).fetchAll();
      if ((pendingCount[0] || 0) >= PENDING_PER_CLASS_MAX) {
        return respond(429, { error: 'This class has reached the maximum number of pending requests.' });
      }

      // Determine status: queued if class is full
      const status = cls.studentCount >= STUDENT_CAP ? 'queued' : 'pending';

      // Name list fuzzy match (server-side, only if enabled)
      let matchedName = null;
      let matchScore = 0;
      if (cls.nameListEnabled && Array.isArray(cls.nameList) && cls.nameList.length > 0) {
        ({ matchedName, matchScore } = runFuzzyMatch(cls.nameList, studentName.trim()));
      }

      const doc = {
        id: crypto.randomUUID(),
        classId: cls.id,
        schoolId: cls.schoolId || null,
        teacherId: cls.teacherId,
        studentName: studentName.trim(),
        deviceId: deviceId.trim(),
        status,
        matchedName,
        matchScore,
        createdAt: new Date().toISOString(),
      };
      const { resource } = await joinRequestsContainer.items.create(doc);

      return respond(201, { id: resource.id, classId: cls.id, status: resource.status, className: cls.name });
    } catch (err) {
      context.error('joinRequestCreate error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// GET /api/join-request/status — student polls for their request status (no auth)
app.http('joinRequestStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'join-request/status',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body) {
      logRequest(context, { endpoint: 'join-request/status', method: 'GET', status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }
    try {
      const url = new URL(request.url);
      const deviceId = url.searchParams.get('deviceId');
      const classId = url.searchParams.get('classId');

      if (!deviceId || !classId) {
        return respond(400, { error: 'deviceId and classId query parameters are required' });
      }

      const { resources } = await joinRequestsContainer.items.query({
        query: 'SELECT * FROM c WHERE c.deviceId = @did AND c.classId = @cid ORDER BY c.createdAt DESC OFFSET 0 LIMIT 1',
        parameters: [
          { name: '@did', value: deviceId },
          { name: '@cid', value: classId },
        ],
      }).fetchAll();

      if (resources.length === 0) {
        return respond(404, { error: 'No join request found' });
      }

      const req = resources[0];
      return respond(200, { id: req.id, status: req.status, studentName: req.studentName });
    } catch (err) {
      context.error('joinRequestStatus error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// GET /api/join-requests — teacher lists join requests for a class (auth required)
app.http('joinRequestsList', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'join-requests',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'join-requests', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`join-requests:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const url = new URL(request.url);
      const classId = url.searchParams.get('classId');
      if (!classId) return respond(400, { error: 'classId query parameter is required' }, teacherId);

      // Verify teacher owns this class
      const cls = await getClassById(classId);
      try {
        assertScope(cls, { teacherId });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      const { resources } = await joinRequestsContainer.items.query({
        query: 'SELECT * FROM c WHERE c.classId = @cid ORDER BY c.createdAt ASC',
        parameters: [{ name: '@cid', value: classId }],
      }).fetchAll();

      return respond(200, resources, teacherId);
    } catch (err) {
      context.error('joinRequestsList error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/join-requests/approve-batch — teacher approves multiple requests (auth required)
// Registered before /{id}/approve to avoid route conflicts
app.http('joinRequestApproveBatch', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'join-requests/approve-batch',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'join-requests/approve-batch', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`join-requests:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 4096) return respond(413, { error: 'Request body too large.' }, teacherId);

      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' }, teacherId);
      }

      const { ids, classId } = body;
      if (!classId || !Array.isArray(ids) || ids.length === 0) {
        return respond(400, { error: 'classId and ids array are required' }, teacherId);
      }

      // Verify teacher owns this class
      const cls = await getClassById(classId);
      try {
        assertScope(cls, { teacherId });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      const results = { approved: [], skipped: [], errors: [] };

      // Process sequentially to avoid race conditions on studentCount
      for (const reqId of ids) {
        try {
          const approveResult = await approveRequest(reqId, classId, teacherId, context);
          if (approveResult.ok) {
            results.approved.push(reqId);
          } else {
            results.skipped.push({ id: reqId, reason: approveResult.reason });
          }
        } catch (err) {
          results.errors.push({ id: reqId, error: err.message });
        }
      }

      return respond(200, results, teacherId);
    } catch (err) {
      context.error('joinRequestApproveBatch error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/join-requests/{id}/approve — teacher approves a single request (auth required)
app.http('joinRequestApprove', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'join-requests/{id}/approve',
  handler: async (request, context) => {
    const start = Date.now();
    const reqId = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: `join-requests/${reqId}/approve`, method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`join-requests:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      // We need classId to find the document (partition key)
      const url = new URL(request.url);
      const classId = url.searchParams.get('classId');
      if (!classId) return respond(400, { error: 'classId query parameter is required' }, teacherId);

      // Verify ownership
      const cls = await getClassById(classId);
      try {
        assertScope(cls, { teacherId });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      const result = await approveRequest(reqId, classId, teacherId, context);
      if (!result.ok) return respond(409, { error: result.reason }, teacherId);

      return respond(200, { approved: true, id: reqId }, teacherId);
    } catch (err) {
      context.error('joinRequestApprove error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/join-requests/{id}/reject — teacher rejects a request (auth required)
app.http('joinRequestReject', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'join-requests/{id}/reject',
  handler: async (request, context) => {
    const start = Date.now();
    const reqId = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: `join-requests/${reqId}/reject`, method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`join-requests:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const url = new URL(request.url);
      const classId = url.searchParams.get('classId');
      if (!classId) return respond(400, { error: 'classId query parameter is required' }, teacherId);

      const cls = await getClassById(classId);
      try {
        assertScope(cls, { teacherId });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      let joinReq;
      try {
        const { resource } = await joinRequestsContainer.item(reqId, classId).read();
        joinReq = resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'Join request not found' }, teacherId);
        throw err;
      }
      // Defense-in-depth: re-verify the loaded document belongs to this teacher, not just
      // the class looked up above (Sprint 5 audit finding — approve already does this).
      try {
        assertScope(joinReq, { teacherId });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Join request not found' }, teacherId);
        throw err;
      }
      if (joinReq.status === 'rejected') return respond(200, { rejected: true, id: reqId }, teacherId);

      joinReq.status = 'rejected';
      await joinRequestsContainer.item(reqId, classId).replace(joinReq);

      return respond(200, { rejected: true, id: reqId }, teacherId);
    } catch (err) {
      if (err.code === 404) return { status: 404, jsonBody: { error: 'Join request not found' } };
      context.error('joinRequestReject error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// Shared helper: approves a join request with optimistic concurrency on class studentCount.
// Returns { ok: true } on success or { ok: false, reason } on failure.
async function approveRequest(reqId, classId, teacherId, context) {
  // Read the join request
  let joinReq;
  try {
    const { resource } = await joinRequestsContainer.item(reqId, classId).read();
    joinReq = resource;
  } catch (err) {
    if (err.code === 404) return { ok: false, reason: 'Join request not found' };
    throw err;
  }

  if (!joinReq) return { ok: false, reason: 'Join request not found' };
  if (joinReq.teacherId !== teacherId) return { ok: false, reason: 'Forbidden' };
  if (joinReq.status === 'approved') return { ok: true }; // idempotent
  if (joinReq.status === 'rejected') return { ok: false, reason: 'Request was already rejected' };

  // Optimistic concurrency: read class, increment studentCount, replace with etag check
  const cls = await getClassById(classId);
  if (!cls) return { ok: false, reason: 'Class not found' };

  if (cls.studentCount >= STUDENT_CAP) {
    // Promote this request to queued instead
    joinReq.status = 'queued';
    await joinRequestsContainer.item(reqId, classId).replace(joinReq);
    return { ok: false, reason: 'Class is full — request moved to queue' };
  }

  // Try to increment studentCount with etag guard
  const updatedClass = { ...cls, studentCount: cls.studentCount + 1 };
  try {
    await classesContainer.item(cls.id, cls.teacherId).replace(updatedClass, {
      accessCondition: { type: 'IfMatch', condition: cls._etag },
    });
  } catch (err) {
    if (err.code === 412) {
      // Etag mismatch — concurrent modification, re-read and retry once
      const cls2 = await getClassById(classId);
      if (!cls2 || cls2.studentCount >= STUDENT_CAP) {
        joinReq.status = 'queued';
        await joinRequestsContainer.item(reqId, classId).replace(joinReq);
        return { ok: false, reason: 'Class is full — request moved to queue' };
      }
      const updatedClass2 = { ...cls2, studentCount: cls2.studentCount + 1 };
      await classesContainer.item(cls2.id, cls2.teacherId).replace(updatedClass2, {
        accessCondition: { type: 'IfMatch', condition: cls2._etag },
      });
    } else {
      throw err;
    }
  }

  // Update join request to approved
  joinReq.status = 'approved';
  await joinRequestsContainer.item(reqId, classId).replace(joinReq);

  return { ok: true };
}

module.exports = {};
