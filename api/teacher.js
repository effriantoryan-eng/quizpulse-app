const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { validateProfile, isProfileComplete } = require('./shared/profileSchema');
const crypto = require('crypto');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const database = client.database(process.env.COSMOS_DATABASE);
const teachers = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');
const schools = database.container(process.env.COSMOS_CONTAINER_SCHOOLS || 'schools');

const SCHOOL_NAME_MAX = 120; // Security limits table — School name length

// Reads the teacher document by id (= B2C oid). Returns null if not yet onboarded.
async function getTeacher(teacherId) {
  try {
    const { resource } = await teachers.item(teacherId, teacherId).read();
    return resource || null;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

// GET /api/me — returns the signed-in teacher's profile + their school, or { onboarded: false }.
app.http('teacherMe', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'me', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const teacherId = auth.teacherId;

      const teacher = await getTeacher(teacherId);
      if (!teacher) {
        return respond(200, { onboarded: false, teacherId }, teacherId);
      }

      let school = null;
      if (teacher.schoolId) {
        try {
          const { resource } = await schools.item(teacher.schoolId, teacher.schoolId).read();
          school = resource || null;
        } catch (err) {
          if (err.code !== 404) throw err;
        }
      }

      const profile = teacher.profile || {};
      const featureIntros = teacher.featureIntros || {};
      return respond(
        200,
        {
          onboarded: true,
          teacher,
          school,
          profile,
          profileComplete: isProfileComplete(profile),
          featureIntros,
        },
        teacherId
      );
    } catch (err) {
      context.error('teacherMe error:', err.message);
      logRequest(context, { endpoint: 'me', method: 'GET', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// PUT /api/me/profile — accumulates the optional onboarding-wizard profile fields (subjects,
// yearLevels, classCount, registrationStatus). Additive/partial: only keys present in the body
// are validated and merged onto any existing profile — quitting the wizard mid-way and coming
// back later (ProfileNudge) must never lose already-answered steps. Never re-gates onboarding —
// POST /api/onboarding already fired at step 1.
app.http('updateProfile', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'me/profile',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'me/profile', method: 'PUT', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const teacherId = auth.teacherId;

      const ip = getClientIp(request);
      if (!rateLimit(`me-profile:${ip}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 4096) {
        return respond(413, { error: 'Request body too large.' }, teacherId);
      }

      const body = await request.json();
      const { error, profile: incoming } = validateProfile(body);
      if (error) return respond(400, { error }, teacherId);

      const teacher = await getTeacher(teacherId);
      if (!teacher) {
        return respond(404, { error: 'Not found' }, teacherId);
      }

      const mergedProfile = { ...(teacher.profile || {}), ...incoming };
      await teachers.item(teacherId, teacherId).patch([{ op: 'set', path: '/profile', value: mergedProfile }]);

      return respond(200, { profile: mergedProfile, profileComplete: isProfileComplete(mergedProfile) }, teacherId);
    } catch (err) {
      context.error('updateProfile error:', err.message);
      logRequest(context, { endpoint: 'me/profile', method: 'PUT', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/onboarding — first-login: creates an unvalidated school (free-text name) and the
// teacher document, denormalising schoolId + schoolStatus onto the teacher. One school per
// teacher account (Security limits table).
app.http('onboarding', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'onboarding',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'onboarding', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const teacherId = auth.teacherId;
      const claims = auth.claims || {};

      const ip = getClientIp(request);
      if (!rateLimit(`onboarding:${ip}`, 10, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 4096) {
        return respond(413, { error: 'Request body too large.' }, teacherId);
      }

      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' }, teacherId);
      }

      // role is never settable from a teacher-facing request body — role changes go through
      // the dedicated owner-gated PUT /api/manage/teachers/{id}/role endpoint only (teacherRole.js).
      // Reject explicitly here rather than silently dropping it, so a future edit to this
      // handler can't accidentally start trusting it.
      if ('role' in body) {
        return respond(400, { error: 'role cannot be set here' }, teacherId);
      }

      const { schoolName } = body;
      if (typeof schoolName !== 'string' || !schoolName.trim()) {
        return respond(400, { error: 'schoolName is required and must be a string' }, teacherId);
      }
      if (schoolName.trim().length > SCHOOL_NAME_MAX) {
        return respond(400, { error: `schoolName must be ${SCHOOL_NAME_MAX} characters or fewer` }, teacherId);
      }

      // One school per teacher — if already onboarded, return the existing record (idempotent).
      const existing = await getTeacher(teacherId);
      if (existing && existing.schoolId) {
        let school = null;
        try {
          const { resource } = await schools.item(existing.schoolId, existing.schoolId).read();
          school = resource || null;
        } catch (err) { if (err.code !== 404) throw err; }
        return respond(200, { teacher: existing, school, alreadyOnboarded: true }, teacherId);
      }

      const now = new Date().toISOString();
      const school = {
        id: crypto.randomUUID(),
        name: schoolName.trim(),
        status: 'unvalidated',
        sector: null,
        suburb: null,
        state: null,
        mergedIntoId: null,
        createdAt: now,
        validatedAt: null,
      };
      await schools.items.create(school);

      const teacher = {
        id: teacherId,
        teacherId,
        schoolId: school.id,
        schoolStatus: school.status, // denormalised for fast reads / future merge
        name: claims.name || null,
        email: (Array.isArray(claims.emails) ? claims.emails[0] : claims.email) || claims.preferred_username || null,
        idp: claims.idp || 'local',
        role: 'teacher',
        createdAt: now,
      };
      await teachers.items.create(teacher);

      return respond(201, { teacher, school }, teacherId);
    } catch (err) {
      context.error('onboarding error:', err.message);
      logRequest(context, { endpoint: 'onboarding', method: 'POST', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

module.exports = { getTeacher };
