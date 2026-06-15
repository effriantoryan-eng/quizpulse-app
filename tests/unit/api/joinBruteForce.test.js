// Unit tests for the join-code brute-force limiter.
// The limiter reuses the in-memory sliding window (rateLimit) with:
//   key: join-brute:<ip>   max: 10   window: 3600000ms (1hr)

const { rateLimit } = require('../../../api/rateLimit');

describe('join code brute-force limiter', () => {
  const MAX = 10;
  const WINDOW = 3600000;

  function uniqueKey() {
    return `join-brute:test-${Date.now()}-${Math.random()}`;
  }

  test('allows up to MAX attempts', () => {
    const key = uniqueKey();
    for (let i = 0; i < MAX; i++) {
      expect(rateLimit(key, MAX, WINDOW)).toBe(true);
    }
  });

  test('blocks the (MAX+1)th attempt within the window', () => {
    const key = uniqueKey();
    for (let i = 0; i < MAX; i++) {
      rateLimit(key, MAX, WINDOW);
    }
    expect(rateLimit(key, MAX, WINDOW)).toBe(false);
  });

  test('allows a fresh key independently', () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    for (let i = 0; i < MAX; i++) rateLimit(key1, MAX, WINDOW);
    // key2 should still be allowed
    expect(rateLimit(key2, MAX, WINDOW)).toBe(true);
  });

  test('different IPs are tracked independently', () => {
    const ip1Key = `join-brute:1.2.3.4-${Date.now()}`;
    const ip2Key = `join-brute:5.6.7.8-${Date.now()}`;
    for (let i = 0; i < MAX; i++) rateLimit(ip1Key, MAX, WINDOW);
    expect(rateLimit(ip1Key, MAX, WINDOW)).toBe(false);
    expect(rateLimit(ip2Key, MAX, WINDOW)).toBe(true);
  });
});
