const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { getTeacher } = require('./teacher');
const { getCallerScope, assertScope, ScopeError } = require('./shared/authz');
const { selectDemoStudents } = require('./shared/demoNames');
const crypto = require('crypto');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');

const CLASS_NAME_MAX = 80;       // Security limits table — Class name length
const CLASSES_PER_TEACHER = 20;  // Security limits table — Classes per teacher (real classes only)
const DEMO_CLASSES_PER_TEACHER = 1;  // v3.3.0 — at most one simulated demo class per teacher
const DEMO_STUDENT_COUNT = 24;       // v3.3.0 — demo students generated per demo class

// 8-char alphanumeric join code, excluding visually ambiguous characters (0/O, 1/I/L).
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

// GET /api/classes — list all classes for the authenticated teacher, oldest first.
app.http('classesGet', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'classes',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'classes', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`classes:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const { resources } = await classesContainer.items.query({
        query: 'SELECT * FROM c WHERE c.teacherId = @tid ORDER BY c.createdAt ASC',
        parameters: [{ name: '@tid', value: teacherId }],
      }).fetchAll();

      // Normalise the demo fields so the frontend can render the demo pill and student count
      // without leaking the simulated student names: expose isDemo (default false for legacy
      // docs) and demoStudentCount, and drop the raw demoStudents array from the list payload.
      const shaped = resources.map(({ demoStudents, ...rest }) => ({
        ...rest,
        isDemo: rest.isDemo === true,
        demoStudentCount: Array.isArray(demoStudents) ? demoStudents.length : 0,
      }));

      return respond(200, shaped, teacherId);
    } catch (err) {
      context.error('classesGet error:', err.message);
      logRequest(context, { endpoint: 'classes', method: 'GET', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/classes — create a new class. Enforces 20-class limit and 80-char name cap.
app.http('classesCreate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'classes',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'classes', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`classes:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 4096) return respond(413, { error: 'Request body too large.' }, teacherId);

      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' }, teacherId);
      }

      const { name, studentCount } = body;
      const isDemo = body.isDemo === true;
      if (typeof name !== 'string' || !name.trim()) {
        return respond(400, { error: 'name is required and must be a non-empty string' }, teacherId);
      }
      if (name.trim().length > CLASS_NAME_MAX) {
        return respond(400, { error: `name must be ${CLASS_NAME_MAX} characters or fewer` }, teacherId);
      }
      if (studentCount !== undefined && (typeof studentCount !== 'number' || studentCount < 0 || !Number.isFinite(studentCount))) {
        return respond(400, { error: 'studentCount must be a non-negative number' }, teacherId);
      }

      const teacher = await getTeacher(teacherId);

      if (isDemo) {
        // At most one demo class per teacher. Demo classes are deliberately separate from the
        // 20-real-class cap (counted below), so a teacher can always try one without giving up a slot.
        const { resources: demoCounts } = await classesContainer.items.query({
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND c.isDemo = true',
          parameters: [{ name: '@tid', value: teacherId }],
        }).fetchAll();
        if ((demoCounts[0] || 0) >= DEMO_CLASSES_PER_TEACHER) {
          return respond(409, { error: 'Demo class limit reached' }, teacherId);
        }

        // demoStudents is generated server-side, never client-provided — a fresh shuffle of 24
        // distinct curated names, each with its own device UUID. No join code (a demo class is
        // never joinable), no name list.
        const demoStudents = selectDemoStudents(DEMO_STUDENT_COUNT);
        const doc = {
          id: crypto.randomUUID(),
          teacherId,
          schoolId: teacher?.schoolId || null,
          name: name.trim(),
          studentCount: DEMO_STUDENT_COUNT,
          nameListEnabled: false,
          cap: 40,
          isDemo: true,
          demoStudents,
          createdAt: new Date().toISOString(),
        };
        const { resource } = await classesContainer.items.create(doc);
        return respond(201, resource, teacherId);
      }

      // Real class: enforce the 20-real-class-per-teacher limit before writing. Demo classes are
      // excluded from this count (isDemo != true, tolerating legacy docs with no field).
      const { resources: counts } = await classesContainer.items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND (NOT IS_DEFINED(c.isDemo) OR c.isDemo = false)',
        parameters: [{ name: '@tid', value: teacherId }],
      }).fetchAll();
      if ((counts[0] || 0) >= CLASSES_PER_TEACHER) {
        return respond(429, { error: `You can have at most ${CLASSES_PER_TEACHER} classes.` }, teacherId);
      }

      const doc = {
        id: crypto.randomUUID(),
        teacherId,
        schoolId: teacher?.schoolId || null,
        name: name.trim(),
        studentCount: studentCount !== undefined ? Math.floor(studentCount) : 0,
        joinCode: generateJoinCode(),
        nameList: [],
        nameListEnabled: false,
        cap: 40,
        isDemo: false,
        createdAt: new Date().toISOString(),
      };
      const { resource } = await classesContainer.items.create(doc);

      return respond(201, resource, teacherId);
    } catch (err) {
      context.error('classesCreate error:', err.message);
      logRequest(context, { endpoint: 'classes', method: 'POST', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// PUT /api/classes/{id} — update a class's name and/or studentCount.
app.http('classesUpdate', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'classes/{id}',
  handler: async (request, context) => {
    const start = Date.now();
    const classId = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: `classes/${classId}`, method: 'PUT', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`classes:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 4096) return respond(413, { error: 'Request body too large.' }, teacherId);

      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' }, teacherId);
      }

      let existing;
      try {
        const { resource } = await classesContainer.item(classId, teacherId).read();
        existing = resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }
      try {
        assertScope(existing, { teacherId });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      const { name, studentCount } = body;
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) return respond(400, { error: 'name must be a non-empty string' }, teacherId);
        if (name.trim().length > CLASS_NAME_MAX) return respond(400, { error: `name must be ${CLASS_NAME_MAX} characters or fewer` }, teacherId);
        existing.name = name.trim();
      }
      if (studentCount !== undefined) {
        if (typeof studentCount !== 'number' || studentCount < 0 || !Number.isFinite(studentCount)) {
          return respond(400, { error: 'studentCount must be a non-negative number' }, teacherId);
        }
        existing.studentCount = Math.floor(studentCount);
      }

      const { resource: updated } = await classesContainer.item(classId, teacherId).replace(existing);
      return respond(200, updated, teacherId);
    } catch (err) {
      context.error('classesUpdate error:', err.message);
      logRequest(context, { endpoint: `classes/${classId}`, method: 'PUT', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// PUT /api/classes/{id}/regenerate-code — generate a new join code for a class.
app.http('classesRegenerateCode', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'classes/{id}/regenerate-code',
  handler: async (request, context) => {
    const start = Date.now();
    const classId = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: `classes/${classId}/regenerate-code`, method: 'PUT', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`classes:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      let existing;
      try {
        const { resource } = await classesContainer.item(classId, teacherId).read();
        existing = resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }
      try {
        assertScope(existing, { teacherId });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      existing.joinCode = generateJoinCode();
      const { resource: updated } = await classesContainer.item(classId, teacherId).replace(existing);
      return respond(200, updated, teacherId);
    } catch (err) {
      context.error('classesRegenerateCode error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// DELETE /api/classes/{id}/students/{studentId} — remove an approved student.
// studentId is the join_request document id. Decrements studentCount and promotes
// the oldest queued request to pending.
app.http('classesRemoveStudent', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'classes/{id}/students/{studentId}',
  handler: async (request, context) => {
    const start = Date.now();
    const classId = request.params.id;
    const studentId = request.params.studentId;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: `classes/${classId}/students/${studentId}`, method: 'DELETE', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`classes:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      let existing;
      try {
        const { resource } = await classesContainer.item(classId, teacherId).read();
        existing = resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }
      try {
        assertScope(existing, { teacherId });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');

      // Read the join request to verify it is approved and belongs to this class
      let joinReq;
      try {
        const { resource } = await joinRequestsContainer.item(studentId, classId).read();
        joinReq = resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'Student not found' }, teacherId);
        throw err;
      }
      if (!joinReq || joinReq.classId !== classId || joinReq.status !== 'approved') {
        return respond(404, { error: 'Student not found or not approved' }, teacherId);
      }

      // Delete the join request (remove the student)
      await joinRequestsContainer.item(studentId, classId).delete();

      // Decrement studentCount (floor at 0)
      existing.studentCount = Math.max(0, (existing.studentCount || 0) - 1);
      await classesContainer.item(classId, teacherId).replace(existing);

      // Promote the oldest queued request to pending
      const { resources: queued } = await joinRequestsContainer.items.query({
        query: "SELECT * FROM c WHERE c.classId = @cid AND c.status = 'queued' ORDER BY c.createdAt ASC OFFSET 0 LIMIT 1",
        parameters: [{ name: '@cid', value: classId }],
      }).fetchAll();
      if (queued.length > 0) {
        const promote = queued[0];
        promote.status = 'pending';
        await joinRequestsContainer.item(promote.id, classId).replace(promote);
      }

      return respond(200, { removed: true, id: studentId }, teacherId);
    } catch (err) {
      context.error('classesRemoveStudent error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// DELETE /api/classes/{id} — delete a class (ownership enforced via partition key).
app.http('classesDelete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'classes/{id}',
  handler: async (request, context) => {
    const start = Date.now();
    const classId = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: `classes/${classId}`, method: 'DELETE', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`classes:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      let existing;
      try {
        const { resource } = await classesContainer.item(classId, teacherId).read();
        existing = resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }
      try {
        assertScope(existing, { teacherId });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      await classesContainer.item(classId, teacherId).delete();
      return respond(200, { deleted: true, id: classId }, teacherId);
    } catch (err) {
      context.error('classesDelete error:', err.message);
      logRequest(context, { endpoint: `classes/${classId}`, method: 'DELETE', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
