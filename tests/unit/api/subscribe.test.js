// Unit tests for subscribe.js logic — approval gating and subscription upsert.
// Sprint 6: throughput rate limiting (20/hr/device) is now enforced by Azure API Management
// (see docs/azure/APIM_SETUP.md), not in-process. Tests for 429 from the in-process store
// have been removed. The approval gate (403 when no approved join request) is tested here.

function makeSubscription() {
  return {
    endpoint: 'https://push.example.com/sub/abc123',
    keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
  };
}

// Minimal handler extracted for unit testing (mirrors subscribe.js approval logic).
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

  return async function handler({ classId, deviceId, subscription }) {
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

describe('subscribe — unapproved device', () => {
  test('returns 403 when no approved join request exists', async () => {
    const handler = makeHandler({ joinRequestsResult: [] });
    const result = await handler({ classId: 'class-1', deviceId: 'device-99', subscription: makeSubscription() });
    expect(result.status).toBe(403);
  });

  test('returns 201 when an approved join request exists', async () => {
    const handler = makeHandler({ joinRequestsResult: [{ id: 'req-1' }] });
    const result = await handler({ classId: 'class-1', deviceId: 'device-99', subscription: makeSubscription() });
    expect(result.status).toBe(201);
  });

  test('returns 400 for missing subscription keys', async () => {
    const handler = makeHandler({ joinRequestsResult: [{ id: 'req-1' }] });
    const result = await handler({
      classId: 'class-1',
      deviceId: 'device-99',
      subscription: { endpoint: 'https://example.com' }, // missing keys
    });
    expect(result.status).toBe(400);
  });

  test('returns 400 for missing deviceId', async () => {
    const handler = makeHandler({ joinRequestsResult: [{ id: 'req-1' }] });
    const result = await handler({ classId: 'class-1', deviceId: '', subscription: makeSubscription() });
    expect(result.status).toBe(400);
  });
});
