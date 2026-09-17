const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { getApprovedJoinRequest } = require('./shared/getApprovedJoinRequest');
const { removeStudentFromClass, deleteSubscriptions } = require('./shared/studentDataCleanup');

// Anonymous, same student posture as api/studentQuizzes.js: no login, keyed by the device UUID, and
// a uniform response that never reveals whether a class exists. Student endpoints rate-limit mainly
// per device, with a generous per-IP ceiling — one school network puts many students behind one IP.

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

const HOUR_MS = 60 * 60 * 1000;
const LEAVE_DEVICE_MAX = 5; // Security limits — 5/hr/device
const LEAVE_IP_MAX = 120; // 120/hr/IP (a school network is many students on one IP)
const UNSUB_DEVICE_MAX = 20; // same shape as subscribe (20/hr/device)

function isBlank(v) {
  return typeof v !== 'string' || !v.trim();
}

// POST /api/student/leave-class { deviceId, classId } — the student leaves a class. Same removal as a
// teacher's (R1 cleanup: subscription deleted, responses de-identified, join request deleted,
// studentCount decremented, queue promoted) via the ONE shared helper.
app.http('studentLeaveClass', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'student/leave-class',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body) {
      logRequest(context, { endpoint: 'student/leave-class', method: 'POST', status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }
    try {
      const body = await request.json().catch(() => ({}));
      const { deviceId, classId } = body || {};

      // Rate limit BEFORE any work — per device first, then a generous per-IP ceiling.
      if (!rateLimit(`leave-class:${deviceId}`, LEAVE_DEVICE_MAX, HOUR_MS) ||
          !rateLimit(`leave-class-ip:${getClientIp(request)}`, LEAVE_IP_MAX, HOUR_MS)) {
        return respond(429, { error: 'Too many requests. Please try again later.' });
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 4096) return respond(413, { error: 'Request body too large.' });

      if (isBlank(deviceId) || isBlank(classId)) {
        return respond(400, { error: 'deviceId and classId are required' });
      }

      // Uniform 404 on any not-approved device — never reveal whether the class exists.
      const joinReq = await getApprovedJoinRequest(joinRequestsContainer, deviceId, classId);
      if (!joinReq) return respond(404, { error: 'Not found' });

      await removeStudentFromClass(
        { classesContainer, joinRequestsContainer, subscriptionsContainer, quizzesContainer, responsesContainer },
        { classId, joinRequestId: joinReq.id },
      );

      return respond(200, { left: true });
    } catch (err) {
      context.error('studentLeaveClass error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

// POST /api/unsubscribe { deviceId, classId } — turn off notifications for one class. Deletes this
// device's subscription record for the class. Idempotent: 200 even when nothing matched, and no
// existence leak (the same response whether or not the class/subscription existed).
app.http('unsubscribe', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'unsubscribe',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body) {
      logRequest(context, { endpoint: 'unsubscribe', method: 'POST', status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }
    try {
      const body = await request.json().catch(() => ({}));
      const { deviceId, classId } = body || {};

      if (!rateLimit(`unsubscribe:${deviceId}`, UNSUB_DEVICE_MAX, HOUR_MS)) {
        return respond(429, { error: 'Too many requests. Please try again later.' });
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 4096) return respond(413, { error: 'Request body too large.' });

      if (isBlank(deviceId) || isBlank(classId)) {
        return respond(400, { error: 'deviceId and classId are required' });
      }

      await deleteSubscriptions({ subscriptionsContainer }, { classId, deviceId });
      return respond(200, { unsubscribed: true });
    } catch (err) {
      context.error('unsubscribe error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

module.exports = {};
