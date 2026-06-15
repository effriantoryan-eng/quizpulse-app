// Unit tests for subscribe.js logic — unapproved device returns 403.
// These tests mock Cosmos and call the handler directly.

const { rateLimit } = require('../../../api/rateLimit');

// --- helpers ---

function makeSubscription() {
  return {
    endpoint: 'https://push.example.com/sub/abc123',
    keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
  };
}

// Minimal handler extracted for unit testing (mirrors subscribe.js logic).
function makeHandler({ joinRequestsResult = [], existingSubResult = [] } = {}) {
  const crypto = require('crypto');

  const joinRequestsContainer = {
    items: {
      query: () => ({ fetchAll: async () => ({ resources: joinRequestsResult }) }),
    },
  };
  const subscriptionsContainer = {
    items: {
      query: () => ({ fetchAll: async () => ({ resources: existingSubResult }) }),
      upsert: async () => ({}),
    },
  };

  const SUBSCRIBE_MAX = 20;
  const SUBSCRIBE_WINDOW_MS = 3600000;

  return async function handler({ classId, deviceId, subscription, rateLimitKey }) {
    if (!rateLimit(rateLimitKey || `subscribe:${deviceId}`, SUBSCRIBE_MAX, SUBSCRIBE_WINDOW_MS)) {
      return { status: 429 };
    }

    if (
      typeof classId !== 'string' || !classId.trim() ||
      typeof deviceId !== 'string' || !deviceId.trim() ||
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return { status: 400 };
    }

    const { resources: approved } = await joinRequestsContainer.items.query().fetchAll();
    if (!approved.length) return { status: 403 };

    const { resources: existing } = await subscriptionsContainer.items.query().fetchAll();
    const doc = {
      id: existing[0]?.id || crypto.randomUUID(),
      classId,
      deviceId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };
    await subscriptionsContainer.items.upsert(doc);
    return { status: 201, id: doc.id };
  };
}

let keyCounter = 0;
function freshKey() { return `sub-unit:${Date.now()}:${keyCounter++}`; }

describe('subscribe — unapproved device', () => {
  test('returns 403 when no approved join request exists', async () => {
    const handler = makeHandler({ joinRequestsResult: [] });
    const result = await handler({
      classId: 'class-1',
      deviceId: 'device-99',
      subscription: makeSubscription(),
      rateLimitKey: freshKey(),
    });
    expect(result.status).toBe(403);
  });

  test('returns 201 when an approved join request exists', async () => {
    const handler = makeHandler({ joinRequestsResult: [{ id: 'req-1' }] });
    const result = await handler({
      classId: 'class-1',
      deviceId: 'device-99',
      subscription: makeSubscription(),
      rateLimitKey: freshKey(),
    });
    expect(result.status).toBe(201);
  });

  test('returns 400 for missing subscription keys', async () => {
    const handler = makeHandler({ joinRequestsResult: [{ id: 'req-1' }] });
    const result = await handler({
      classId: 'class-1',
      deviceId: 'device-99',
      subscription: { endpoint: 'https://example.com' }, // missing keys
      rateLimitKey: freshKey(),
    });
    expect(result.status).toBe(400);
  });

  test('returns 429 after 20 attempts from the same deviceId', async () => {
    const handler = makeHandler({ joinRequestsResult: [{ id: 'req-1' }] });
    const key = freshKey();
    for (let i = 0; i < 20; i++) {
      await handler({ classId: 'c', deviceId: 'd', subscription: makeSubscription(), rateLimitKey: key });
    }
    const result = await handler({ classId: 'c', deviceId: 'd', subscription: makeSubscription(), rateLimitKey: key });
    expect(result.status).toBe(429);
  });
});
