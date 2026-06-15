const { app } = require('@azure/functions');
const { logRequest } = require('./logger');

// GET /api/vapid-public-key — returns the VAPID public key so the Subscribe page
// can fetch it at runtime rather than baking it into the bundle.
app.http('vapidPublicKey', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vapid-public-key',
  handler: async (_request, context) => {
    const start = Date.now();
    function respond(status, body) {
      logRequest(context, { endpoint: 'vapid-public-key', method: 'GET', status, durationMs: Date.now() - start });
      return { status, jsonBody: body };
    }

    try {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) {
        context.error('VAPID_PUBLIC_KEY not configured');
        return respond(503, { error: 'Push notifications not configured' });
      }
      return respond(200, { publicKey });
    } catch (err) {
      context.error('vapid-public-key failed', err);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
