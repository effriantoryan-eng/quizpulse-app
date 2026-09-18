const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { getTeacher } = require('./teacher');
const { getCallerScope, assertScope, ScopeError } = require('./shared/authz');
const { selectDemoStudents, DEMO_STUDENT_COUNT } = require('./shared/demoNames');
const { CLASS_NAME_MAX, CLASSES_PER_TEACHER, ClassLimitError, AttestationError, generateJoinCode, createRealClass } = require('./shared/createClass');
const { ATTESTATION_VERSION, versionState } = require('./shared/legalVersions');
const { deleteSubscriptions, deleteJoinRequests, deidentifyResponses, removeStudentFromClass } = require('./shared/studentDataCleanup');
const crypto = require('crypto');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');
const subscriptionsContainer = database.container(process.env.COSMOS_CONTAINER_SUBSCRIPTIONS || 'subscriptions');
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES || 'quizzes');
const responsesContainer = database.container(process.env.COSMOS_CONTAINER_RESPONSES || 'responses');

const DEMO_CLASSES_PER_TEACHER = 1;  // v3.3.0 — at most one simulated demo class per teacher
// DEMO_STUDENT_COUNT is imported from shared/demoNames.js (v4.6.0) so classes.js and firstRun.js
// can't disagree on the roster size.

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

      if (!rateLimit(`classes:${teacherId}`, 30, 60000)) {
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

      if (!rateLimit(`classes:${teacherId}`, 30, 60000)) {
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

      // Real class: joinCode/schoolId/cap/attestation logic lives in shared/createClass.js — the
      // single place adopted by both this endpoint and the v4.2.0 onboarding-wizard class shells.
      let resource;
      try {
        resource = await createRealClass(classesContainer, {
          teacherId,
          schoolId: teacher?.schoolId,
          name,
          studentCount,
          attestation: body.attestation,
        });
      } catch (err) {
        if (err instanceof ClassLimitError) return respond(429, { error: err.message }, teacherId);
        if (err instanceof AttestationError) return respond(400, { error: err.message }, teacherId);
        throw err;
      }

      return respond(201, resource, teacherId);
    } catch (err) {
      context.error('classesCreate error:', err.message);
      logRequest(context, { endpoint: 'classes', method: 'POST', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/classes/shells — v4.2.0 onboarding wizard: creates N empty "My Class 1..N" shells
// server-side, named server-side (never client-provided). Only when the caller currently has
// ZERO real classes — this is a first-run convenience, not a way to bulk-create classes later.
// Sequential creates (not Promise.all — same convention as school merge), so the shared 20-class
// cap in createRealClass is respected even mid-batch; a request for more than fit just creates as
// many as fit and reports the real count back.
app.http('classesCreateShells', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'classes/shells',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'classes/shells', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`classes:${teacherId}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const body = await request.json().catch(() => ({}));
      const count = Number(body?.count);
      if (!Number.isInteger(count) || count < 1 || count > CLASSES_PER_TEACHER) {
        return respond(400, { error: `count must be an integer between 1 and ${CLASSES_PER_TEACHER}` }, teacherId);
      }

      const { resources: existingCounts } = await classesContainer.items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND (NOT IS_DEFINED(c.isDemo) OR c.isDemo = false)',
        parameters: [{ name: '@tid', value: teacherId }],
      }).fetchAll();
      if ((existingCounts[0] || 0) > 0) {
        return respond(409, { error: 'Class shells are only created when you have no classes yet.' }, teacherId);
      }

      const teacher = await getTeacher(teacherId);
      let created = 0;
      for (let i = 1; i <= count; i++) {
        try {
          // R3 — shells are empty, server-named batches with no per-class UI to attest with;
          // skipAttestation creates them un-attested. They show the same un-attested banner as any
          // other class on Classes.jsx and are gated by the same join-time cut-off check.
          await createRealClass(classesContainer, {
            teacherId,
            schoolId: teacher?.schoolId,
            name: `My Class ${i}`,
            skipAttestation: true,
          });
          created++;
        } catch (err) {
          if (err instanceof ClassLimitError) break; // hit the cap mid-batch — stop, report what fit
          throw err;
        }
      }

      return respond(201, { created }, teacherId);
    } catch (err) {
      context.error('classesCreateShells error:', err.message);
      logRequest(context, { endpoint: 'classes/shells', method: 'POST', status: 500, durationMs: Date.now() - start });
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
      const caller = getCallerScope(auth.claims);

      if (!rateLimit(`classes:${teacherId}`, 30, 60000)) {
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
        assertScope(existing, caller, { mutate: true });
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
      const caller = getCallerScope(auth.claims);

      if (!rateLimit(`classes:${teacherId}`, 30, 60000)) {
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
        assertScope(existing, caller, { mutate: true });
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

// PUT /api/classes/{id}/attest — a teacher confirms school authorisation for a class created
// before attestation existed (a legacy class, or a server-created onboarding shell). Shares the
// classes rate-limit bucket (Security limits table).
app.http('classesAttest', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'classes/{id}/attest',
  handler: async (request, context) => {
    const start = Date.now();
    const classId = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: `classes/${classId}/attest`, method: 'PUT', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;
      const caller = getCallerScope(auth.claims);

      if (!rateLimit(`classes:${teacherId}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const body = await request.json().catch(() => ({}));
      if (versionState(body.version, ATTESTATION_VERSION) !== 'current') {
        return respond(400, { error: 'Please reload the page and try again.' }, teacherId);
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
        assertScope(existing, caller, { mutate: true });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      existing.attestedAt = new Date().toISOString();
      existing.attestationVersion = ATTESTATION_VERSION;
      const { resource: updated } = await classesContainer.item(classId, teacherId).replace(existing);
      return respond(200, updated, teacherId);
    } catch (err) {
      context.error('classesAttest error:', err.message);
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
      const caller = getCallerScope(auth.claims);

      if (!rateLimit(`classes:${teacherId}`, 30, 60000)) {
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
        assertScope(existing, caller, { mutate: true });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

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

      // R2: the whole mutation (R1 cleanup before the join-request delete, studentCount decrement,
      // queue promotion) lives in the ONE shared helper used by teacher removal, student self-leave
      // and owner erasure — auth/scope/approved-check above stay here.
      const { subscriptions, deidentified, skipped, promoted } = await removeStudentFromClass(
        { classesContainer, joinRequestsContainer, subscriptionsContainer, quizzesContainer, responsesContainer },
        { classId, joinRequestId: studentId },
      );
      context.log(
        `removed student ${studentId} from class ${classId} — subscriptions=${subscriptions}, responses deidentified=${deidentified} skipped=${skipped}, promoted=${promoted}`,
      );

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
      const caller = getCallerScope(auth.claims);

      if (!rateLimit(`classes:${teacherId}`, 30, 60000)) {
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
        assertScope(existing, caller, { mutate: true });
      } catch (err) {
        if (err instanceof ScopeError) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }

      // R1 cascade: a class's student data (join requests, responses, push subscriptions) outlives
      // the class record unless we clean it up here. Order matters — the class document and the join
      // requests are deleted LAST, so a retry after a mid-cascade failure still finds the class and
      // re-runs the (idempotent) cascade. Demo classes have no join requests, so deviceIds is empty
      // and the whole cascade is a no-op for them (no special-casing needed).
      const { resources: jrDevices } = await joinRequestsContainer.items.query({
        query: 'SELECT c.deviceId FROM c WHERE c.classId = @cid',
        parameters: [{ name: '@cid', value: classId }],
      }).fetchAll();
      const deviceIds = [...new Set(jrDevices.map((r) => r.deviceId).filter(Boolean))];

      const { deidentified, skipped } = await deidentifyResponses(
        { quizzesContainer, responsesContainer, joinRequestsContainer },
        { teacherId, classId, deviceIds },
      );
      const subsDeleted = await deleteSubscriptions({ subscriptionsContainer }, { classId });
      const jrDeleted = await deleteJoinRequests({ joinRequestsContainer }, { classId });

      await classesContainer.item(classId, teacherId).delete();
      context.log(
        `class ${classId} deleted — cascade: responses deidentified=${deidentified} skipped=${skipped}, subscriptions=${subsDeleted}, joinRequests=${jrDeleted}`,
      );
      return respond(200, { deleted: true, id: classId }, teacherId);
    } catch (err) {
      context.error('classesDelete error:', err.message);
      logRequest(context, { endpoint: `classes/${classId}`, method: 'DELETE', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
