const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const crypto = require('crypto');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const subscriptionsContainer = database.container(process.env.COSMOS_CONTAINER_SUBSCRIPTIONS || 'subscriptions');
const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');

const MAX_BODY = 8 * 1024;
const SUBSCRIBE_MAX = 20;           // Security limits table — subscribe attempts per deviceId per hour
const SUBSCRIBE_WINDOW_MS = 3600000;

// POST /api/subscribe — store a browser PushSubscription for an approved student.
app.http('subscribe', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'subscribe',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body) {
      logRequest(context, { endpoint: 'subscribe', method: 'POST', status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }

    try {
      const len = Number(request.headers.get('content-length') || 0);
      if (len > MAX_BODY) return respond(413, { error: 'Payload too large' });

      const body = await request.json().catch(() => null);
      const { classId, deviceId, subscription } = body || {};

      if (
        typeof classId !== 'string' || !classId.trim() ||
        typeof deviceId !== 'string' || !deviceId.trim() ||
        !subscription ||
        typeof subscription.endpoint !== 'string' ||
        !subscription.keys ||
        typeof subscription.keys.p256dh !== 'string' ||
        typeof subscription.keys.auth !== 'string'
      ) {
        return respond(400, { error: 'classId, deviceId, and a valid subscription object are required' });
      }
      // ponytail: SSRF guard — push send makes an outbound HTTP request to this URL
      if (!subscription.endpoint.startsWith('https://')) {
        return respond(400, { error: 'Subscription endpoint must use HTTPS' });
      }

      // Rate limit by deviceId — 20 attempts per hour.
      if (!rateLimit(`subscribe:${deviceId}`, SUBSCRIBE_MAX, SUBSCRIBE_WINDOW_MS)) {
        return respond(429, { error: 'Too many subscription attempts. Try again later.' });
      }

      // Gate on an approved join request for this device + class.
      const { resources: approved } = await joinRequestsContainer.items.query({
        query: 'SELECT c.id FROM c WHERE c.deviceId = @did AND c.classId = @cid AND c.status = "approved"',
        parameters: [
          { name: '@did', value: deviceId },
          { name: '@cid', value: classId },
        ],
      }).fetchAll();

      if (!approved.length) {
        return respond(404, { error: 'Not found' });
      }

      // Upsert: one subscription per device per class (endpoint may rotate).
      const { resources: existing } = await subscriptionsContainer.items.query({
        query: 'SELECT c.id FROM c WHERE c.deviceId = @did AND c.classId = @cid',
        parameters: [
          { name: '@did', value: deviceId },
          { name: '@cid', value: classId },
        ],
      }).fetchAll();

      const doc = {
        id: existing[0]?.id || crypto.randomUUID(),
        classId,
        deviceId,
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        createdAt: existing[0] ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!doc.createdAt) delete doc.createdAt; // preserve original on upsert

      await subscriptionsContainer.items.upsert(doc);
      context.log(`Subscription upserted: ${doc.id}`);
      return respond(201, { id: doc.id });
    } catch (err) {
      context.error('subscribe failed', err);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
