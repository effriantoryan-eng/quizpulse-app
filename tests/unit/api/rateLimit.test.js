// Unit tests for api/rateLimit.js — sliding window counter logic.

const { rateLimit } = require('../../../api/rateLimit');

// Use a unique key prefix per test suite run to avoid cross-test pollution.
let keyCounter = 0;
function freshKey() {
  return `test:${Date.now()}:${keyCounter++}`;
}

describe('rateLimit', () => {
  test('allows requests up to the limit within the window', () => {
    const key = freshKey();
    for (let i = 0; i < 30; i++) {
      expect(rateLimit(key, 30, 60000)).toBe(true);
    }
  });

  test('blocks the (limit + 1)th request within the same window', () => {
    const key = freshKey();
    for (let i = 0; i < 30; i++) {
      rateLimit(key, 30, 60000);
    }
    expect(rateLimit(key, 30, 60000)).toBe(false);
  });

  test('allows requests again after the window expires', async () => {
    const key = freshKey();
    const windowMs = 50; // 50 ms window for test speed

    // Fill up the limit
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, windowMs);
    }
    expect(rateLimit(key, 5, windowMs)).toBe(false);

    // Wait for window to expire
    await new Promise(r => setTimeout(r, windowMs + 10));

    expect(rateLimit(key, 5, windowMs)).toBe(true);
  });

  test('different keys have independent counters', () => {
    const key1 = freshKey();
    const key2 = freshKey();

    for (let i = 0; i < 3; i++) {
      rateLimit(key1, 3, 60000);
    }

    // key1 is exhausted; key2 should still be allowed
    expect(rateLimit(key1, 3, 60000)).toBe(false);
    expect(rateLimit(key2, 3, 60000)).toBe(true);
  });

  test('limit of 1 allows exactly one request', () => {
    const key = freshKey();
    expect(rateLimit(key, 1, 60000)).toBe(true);
    expect(rateLimit(key, 1, 60000)).toBe(false);
  });

  test('enforces the general API rate limit of 30 req/min per key', () => {
    const key = freshKey();
    let allowed = 0;
    for (let i = 0; i < 35; i++) {
      if (rateLimit(key, 30, 60000)) allowed++;
    }
    expect(allowed).toBe(30);
  });
});
