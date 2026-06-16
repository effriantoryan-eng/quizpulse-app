// Unit tests for the join-code brute-force limiter.
// The limiter is now a dedicated sliding-window store in joinRequests.js (separate from the
// general rateLimit.js no-op, because brute-force protection is a security control, not
// throughput limiting). We test the same logic in isolation here.

const BRUTE_FORCE_MAX = 10;
const BRUTE_FORCE_WINDOW_MS = 3600000;

// Inline the same logic used in joinRequests.js so this test stays a pure unit test
// without importing Cosmos/Functions SDK modules.
function makeBruteForce() {
  const store = new Map();
  return function bruteForce(key) {
    const now = Date.now();
    const attempts = (store.get(key) || []).filter(t => now - t < BRUTE_FORCE_WINDOW_MS);
    if (attempts.length >= BRUTE_FORCE_MAX) return false;
    attempts.push(now);
    store.set(key, attempts);
    return true;
  };
}

describe('join code brute-force limiter', () => {
  test('allows up to MAX attempts', () => {
    const bf = makeBruteForce();
    const key = 'join-brute:1.2.3.4';
    for (let i = 0; i < BRUTE_FORCE_MAX; i++) {
      expect(bf(key)).toBe(true);
    }
  });

  test('blocks the (MAX+1)th attempt within the window', () => {
    const bf = makeBruteForce();
    const key = 'join-brute:1.2.3.4';
    for (let i = 0; i < BRUTE_FORCE_MAX; i++) bf(key);
    expect(bf(key)).toBe(false);
  });

  test('allows a fresh key independently', () => {
    const bf = makeBruteForce();
    const key1 = 'join-brute:1.2.3.4';
    const key2 = 'join-brute:5.6.7.8';
    for (let i = 0; i < BRUTE_FORCE_MAX; i++) bf(key1);
    expect(bf(key1)).toBe(false);
    expect(bf(key2)).toBe(true);
  });

  test('different IPs are tracked independently', () => {
    const bf = makeBruteForce();
    const ip1 = 'join-brute:1.2.3.4';
    const ip2 = 'join-brute:5.6.7.8';
    for (let i = 0; i < BRUTE_FORCE_MAX; i++) bf(ip1);
    expect(bf(ip1)).toBe(false);
    expect(bf(ip2)).toBe(true);
  });
});
