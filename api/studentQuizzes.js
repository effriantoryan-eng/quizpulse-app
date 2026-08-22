const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { getApprovedJoinRequest } = require('./shared/getApprovedJoinRequest');
const { andExcludeDemo } = require('./shared/excludeDemo');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);

const MAX_QUIZZES = 50;

// GET /api/student/quizzes?deviceId=&classId= — open + recently-closed + scheduled quizzes for an
// approved device, metadata only (never questions/correctIndex — those come from the existing
// stripped GET /api/quizzes/{id}/questions). Anonymous, same posture as /quiz.
// v4.7.0 (T4): also returns status='scheduled' quizzes for the "Coming up" section. Each quiz
// carries a server-computed `state` ('open'|'closed'|'scheduled') so the client renders the three
// sections without re-deriving it.
app.http('studentQuizzes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'student/quizzes',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body) {
      logRequest(context, { endpoint: 'student/quizzes', method: 'GET', status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }
    try {
      if (!rateLimit(`student-quizzes:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' });
      }

      const url = new URL(request.url);
      const deviceId = url.searchParams.get('deviceId');
      const classId = url.searchParams.get('classId');
      if (!deviceId || !classId) {
        return respond(400, { error: 'deviceId and classId query parameters are required' });
      }

      // Never leak whether the class exists — uniform 403, matching the 404/403-on-mismatch
      // convention used everywhere else in this API.
      const joinReq = await getApprovedJoinRequest(joinRequestsContainer, deviceId, classId);
      if (!joinReq) return respond(403, { error: 'Not approved for this class' });

      // No ORDER BY here — Cosmos doesn't support a COALESCE(sentAt, scheduledFor) expression in
      // ORDER BY (only a plain property path), and scheduled quizzes have a null sentAt that would
      // mis-sort under a plain `ORDER BY c.sentAt`. Sort in JS instead, by whichever date is the
      // quiz's "effective" one.
      const now = Date.now();
      const { resources: quizzes } = await quizzesContainer.items.query({
        query: `SELECT c.id, c.name, c.questionIds, c.closedAt, c.status, c.scheduledFor, c.sentAt FROM c
                WHERE c.teacherId = @tid
                  AND c.status IN ('sent', 'scheduled')
                  AND ARRAY_CONTAINS(c.classIds, @cid)
                  AND ${andExcludeDemo('')}`,
        parameters: [
          { name: '@tid', value: joinReq.teacherId },
          { name: '@cid', value: classId },
        ],
      }).fetchAll();

      function stateOf(q) {
        if (q.status === 'scheduled') return 'scheduled';
        if (q.closedAt && new Date(q.closedAt).getTime() < now) return 'closed';
        return 'open';
      }

      const result = quizzes
        .map(q => ({
          id: q.id,
          name: q.name,
          questionCount: (q.questionIds || []).length,
          closedAt: q.closedAt || null,
          scheduledFor: q.scheduledFor || null,
          state: stateOf(q),
          _effectiveDate: q.sentAt || q.scheduledFor || '',
        }))
        .sort((a, b) => (a._effectiveDate < b._effectiveDate ? 1 : a._effectiveDate > b._effectiveDate ? -1 : 0))
        .slice(0, MAX_QUIZZES)
        .map(({ _effectiveDate, ...q }) => q);

      return respond(200, result);
    } catch (err) {
      context.error('studentQuizzes error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});

module.exports = {};
