const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { validateProfile, isProfileComplete } = require('./shared/profileSchema');
const { isValidIntroKey } = require('./shared/featureIntros');
const { computeEligibleIntros } = require('./shared/introEligibility');
const { GETTING_STARTED_STEPS, computeGettingStarted } = require('./shared/gettingStarted');
const crypto = require('crypto');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const database = client.database(process.env.COSMOS_DATABASE);
const teachers = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');
const schools = database.container(process.env.COSMOS_CONTAINER_SCHOOLS || 'schools');
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES || 'quizzes');

const SCHOOL_NAME_MAX = 120; // Security limits table — School name length

// Distinguishes "retries exhausted" (409 — try again) from a plain missing-teacher-doc return
// (null — 404), so a caller can't conflate the two despite both surfacing from the same helper.
class FeatureIntroConflictError extends Error {}

// Shared ETag-replace-with-retry for a single featureIntros[key][field] write. A nested-path
// Cosmos patch (`/featureIntros/{key}/{field}`) requires every ancestor to already exist, which a
// teacher's first-ever intro interaction won't have — so this always reads the current doc and
// replaces only the target key's own sub-object, retried up to 3x on a concurrent-write conflict.
// Used by both PUT /api/me/feature-intros and the getting_started auto-release write below.
async function setFeatureIntroField(teacherId, key, field, value) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { resource: current, etag } = await teachers.item(teacherId, teacherId).read();
    if (!current) return null;
    const featureIntros = { ...(current.featureIntros || {}) };
    featureIntros[key] = { ...(featureIntros[key] || {}), [field]: value };
    try {
      const { resource } = await teachers
        .item(teacherId, teacherId)
        .replace({ ...current, featureIntros }, { accessCondition: { type: 'IfMatch', condition: etag } });
      return resource;
    } catch (err) {
      if (err.code === 412 && attempt < 2) continue; // etag mismatch — another write raced us, retry
      if (err.code === 412) throw new FeatureIntroConflictError('Could not save — please try again.');
      throw err;
    }
  }
  // Unreachable: the final attempt (2) always either returns, continues out of the loop, or
  // throws — never falls through. Left as a defensive default in case the retry count changes.
  return null;
}

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
      const eligibleIntros = await computeEligibleIntros({ teacherId, teacher, classesContainer, quizzesContainer });
      const gettingStarted = await computeGettingStarted({ teacherId, teacher, classesContainer, quizzesContainer });

      // Release is persisted ONE-WAY (never un-released) the FIRST time it's observed true — a
      // marker of when release happened, not a short-circuit (steps are still recomputed live on
      // every call even after release, since the collapsed strip needs an up-to-date "N of 5").
      // Guarded on the existing flag so this write fires exactly once, not on every dashboard load.
      // Advisory/best-effort: a persistence hiccup here just means the marker is missing, never a
      // failed request — same semantics as confidenceResponseCount.
      if (gettingStarted.released && !gettingStarted.dismissed && !teacher.featureIntros?.getting_started?.releasedAt) {
        setFeatureIntroField(teacherId, 'getting_started', 'releasedAt', new Date().toISOString())
          .catch((err) => context.warn(`getting_started release write failed (non-fatal): ${err.message}`));
      }

      return respond(
        200,
        {
          onboarded: true,
          teacher,
          school,
          profile,
          profileComplete: isProfileComplete(profile),
          featureIntros,
          eligibleIntros,
          gettingStarted,
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

// PUT /api/me/feature-intros — records that an intro card was shown or dismissed. One key per
// call, written via an atomic Cosmos PATCH `set` on a single nested field — never a
// read-modify-write of the whole featureIntros object, so two tabs dismissing different cards
// at once can't clobber each other.
app.http('updateFeatureIntros', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'me/feature-intros',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'me/feature-intros', method: 'PUT', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const teacherId = auth.teacherId;

      const ip = getClientIp(request);
      if (!rateLimit(`me-feature-intros:${ip}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 1024) {
        return respond(413, { error: 'Request body too large.' }, teacherId);
      }

      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' }, teacherId);
      }
      const { key, event, step } = body;
      if (!isValidIntroKey(key)) {
        return respond(400, { error: 'Unknown feature-intro key' }, teacherId);
      }

      // v4.6.0 — 'skip-step' is only valid for the getting_started checklist (Task 3's "per-step
      // skipped marker"): it APPENDS to a skippedSteps array rather than setting a single field,
      // so it needs its own branch instead of the generic shown/dismissed field-set below.
      if (event === 'skip-step') {
        if (key !== 'getting_started') {
          return respond(400, { error: "event 'skip-step' is only valid for key 'getting_started'" }, teacherId);
        }
        if (typeof step !== 'string' || !GETTING_STARTED_STEPS.includes(step)) {
          return respond(400, { error: 'step must be a valid getting-started step key' }, teacherId);
        }
        let updated;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { resource: current, etag } = await teachers.item(teacherId, teacherId).read();
          if (!current) return respond(404, { error: 'Not found' }, teacherId);
          const featureIntros = { ...(current.featureIntros || {}) };
          const existingSkipped = featureIntros.getting_started?.skippedSteps || [];
          const skippedSteps = existingSkipped.includes(step) ? existingSkipped : [...existingSkipped, step];
          featureIntros.getting_started = { ...(featureIntros.getting_started || {}), skippedSteps };
          try {
            const { resource } = await teachers
              .item(teacherId, teacherId)
              .replace({ ...current, featureIntros }, { accessCondition: { type: 'IfMatch', condition: etag } });
            updated = resource;
            break;
          } catch (err) {
            if (err.code === 412 && attempt < 2) continue;
            throw err;
          }
        }
        if (!updated) return respond(409, { error: 'Could not save — please try again.' }, teacherId);
        return respond(200, { key, skippedSteps: updated.featureIntros.getting_started.skippedSteps }, teacherId);
      }

      if (event !== 'shown' && event !== 'dismissed') {
        return respond(400, { error: "event must be 'shown', 'dismissed', or (getting_started only) 'skip-step'" }, teacherId);
      }

      const field = event === 'shown' ? 'shownAt' : 'dismissedAt';
      const now = new Date().toISOString();
      let updated;
      try {
        updated = await setFeatureIntroField(teacherId, key, field, now);
      } catch (err) {
        if (err instanceof FeatureIntroConflictError) return respond(409, { error: err.message }, teacherId);
        throw err;
      }
      if (!updated) return respond(404, { error: 'Not found' }, teacherId);

      return respond(200, { key, [field]: now }, teacherId);
    } catch (err) {
      context.error('updateFeatureIntros error:', err.message);
      logRequest(context, { endpoint: 'me/feature-intros', method: 'PUT', status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

module.exports = { getTeacher };
