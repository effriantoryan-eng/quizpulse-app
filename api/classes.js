const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { getTeacher } = require('./teacher');
const crypto = require('crypto');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');

const CLASS_NAME_MAX = 80;       // Security limits table — Class name length
const CLASSES_PER_TEACHER = 20;  // Security limits table — Classes per teacher

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

      return respond(200, resources, teacherId);
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
      if (typeof name !== 'string' || !name.trim()) {
        return respond(400, { error: 'name is required and must be a non-empty string' }, teacherId);
      }
      if (name.trim().length > CLASS_NAME_MAX) {
        return respond(400, { error: `name must be ${CLASS_NAME_MAX} characters or fewer` }, teacherId);
      }
      if (studentCount !== undefined && (typeof studentCount !== 'number' || studentCount < 0 || !Number.isFinite(studentCount))) {
        return respond(400, { error: 'studentCount must be a non-negative number' }, teacherId);
      }

      // Enforce the 20-class-per-teacher limit before writing.
      const { resources: counts } = await classesContainer.items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid',
        parameters: [{ name: '@tid', value: teacherId }],
      }).fetchAll();
      if ((counts[0] || 0) >= CLASSES_PER_TEACHER) {
        return respond(429, { error: `You can have at most ${CLASSES_PER_TEACHER} classes.` }, teacherId);
      }

      const teacher = await getTeacher(teacherId);
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
      if (!existing || existing.teacherId !== teacherId) {
        return respond(403, { error: 'Forbidden' }, teacherId);
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
      if (!existing || existing.teacherId !== teacherId) {
        return respond(403, { error: 'Forbidden' }, teacherId);
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
