const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const webpush = require('web-push');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const subscriptionsContainer = database.container(process.env.COSMOS_CONTAINER_SUBSCRIPTIONS || 'subscriptions');
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES || 'quizzes');

const MAX_BODY = 4 * 1024;
const NOTIFICATION_PAYLOAD_MAX = 3 * 1024; // Security limits table — 3 KB max
const SEND_MAX = 5;                         // Security limits table — 5 req/min/teacher
const SEND_WINDOW_MS = 60000;

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_SUBJECT || 'admin@quizpulse.app'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  vapidConfigured = true;
}

// POST /api/send-notification — push a quiz notification to all approved subscribers
// for the quiz's target classes. Requires teacher auth and quiz ownership.
app.http('sendNotification', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'send-notification',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body) {
      logRequest(context, { endpoint: 'send-notification', method: 'POST', status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      // Rate limit: 5 send-notification calls per teacher per minute.
      if (!rateLimit(`send-notification:${teacherId}`, SEND_MAX, SEND_WINDOW_MS)) {
        return respond(429, { error: 'Rate limit exceeded. Wait a minute before sending again.' });
      }

      const len = Number(request.headers.get('content-length') || 0);
      if (len > MAX_BODY) return respond(413, { error: 'Payload too large' });

      const body = await request.json().catch(() => null);
      const { quizId, quizTitle, questionCount } = body || {};

      if (
        typeof quizId !== 'string' ||
        typeof quizTitle !== 'string' ||
        typeof questionCount !== 'number'
      ) {
        return respond(400, { error: 'quizId, quizTitle, questionCount required' });
      }

      // Fetch the quiz and verify ownership.
      const { resources: quizzes } = await quizzesContainer.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: quizId }],
      }).fetchAll();

      if (!quizzes.length) return respond(404, { error: 'Quiz not found' });
      const quiz = quizzes[0];
      if (quiz.teacherId !== teacherId) return respond(403, { error: 'Not your quiz' });

      // Idempotency: if this quiz has already had notifications sent, reject with 409.
      if (quiz.notificationSentAt) {
        return respond(409, { error: 'Notifications already sent for this quiz' });
      }

      // Build the notification payload and enforce 3 KB max.
      const payload = JSON.stringify({
        title: 'New quiz from your teacher',
        body: `${quizTitle} · ${questionCount} question${questionCount !== 1 ? 's' : ''} · ~1 min`,
        url: `/quiz?quizId=${quizId}`,
      });

      if (Buffer.byteLength(payload, 'utf8') > NOTIFICATION_PAYLOAD_MAX) {
        return respond(413, { error: 'Notification payload exceeds 3 KB limit' });
      }

      ensureVapid();

      // Fetch subscriptions for all target classes.
      const classIds = quiz.classIds || [];
      if (!classIds.length) {
        return respond(400, { error: 'Quiz has no target classes' });
      }

      const classIdParams = classIds.map((id, i) => ({ name: `@cid${i}`, value: id }));
      const classIdList = classIdParams.map(p => p.name).join(', ');
      const { resources: subs } = await subscriptionsContainer.items.query({
        query: `SELECT * FROM c WHERE c.classId IN (${classIdList})`,
        parameters: classIdParams,
      }).fetchAll();

      let sent = 0;
      const stale = [];

      await Promise.all(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: sub.keys },
              payload,
            );
            sent++;
          } catch (err) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              stale.push({ id: sub.id, classId: sub.classId });
            } else {
              context.warn(`push failed for ${sub.id}: ${err?.statusCode || err?.message}`);
            }
          }
        }),
      );

      // Prune dead subscriptions (partition key is classId).
      await Promise.all(
        stale.map(({ id, classId }) =>
          subscriptionsContainer.item(id, classId).delete().catch(() => {}),
        ),
      );
      if (stale.length) context.log(`Pruned ${stale.length} stale subscription(s)`);

      // Mark quiz as notified for idempotency.
      quiz.notificationSentAt = new Date().toISOString();
      await quizzesContainer.items.upsert(quiz);

      context.log(`Notification sent to ${sent}/${subs.length} subscriber(s) for quiz ${quizId}`);
      return respond(200, { sent, total: subs.length });
    } catch (err) {
      context.error('send-notification failed', err);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
