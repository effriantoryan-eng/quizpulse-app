// Unit tests for api/rateLimit.js — in-memory sliding-window implementation.
// APIM Consumption tier does not support rate-limit-by-key, so per-instance
// enforcement is used instead (adequate for pilot scale).

const { rateLimit, getClientIp } = require('../../../api/rateLimit');

describe('rateLimit (sliding window)', () => {
  test('allows calls within the limit', () => {
    const key = `allow-${Date.now()}`;
    expect(rateLimit(key, 3, 60000)).toBe(true);
    expect(rateLimit(key, 3, 60000)).toBe(true);
    expect(rateLimit(key, 3, 60000)).toBe(true);
  });

  test('blocks the call that exceeds max', () => {
    const key = `block-${Date.now()}`;
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60000);
    expect(rateLimit(key, 5, 60000)).toBe(false);
  });

  test('different keys are tracked independently', () => {
    const key1 = `ind1-${Date.now()}`;
    const key2 = `ind2-${Date.now()}`;
    for (let i = 0; i < 5; i++) rateLimit(key1, 5, 60000);
    expect(rateLimit(key1, 5, 60000)).toBe(false);
    expect(rateLimit(key2, 5, 60000)).toBe(true);
  });

  test('expired timestamps outside the window do not count', async () => {
    const key = `exp-${Date.now()}`;
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 10);
    await new Promise(r => setTimeout(r, 20));
    // Window has elapsed — should allow again
    expect(rateLimit(key, 5, 10)).toBe(true);
  });
});

describe('getClientIp', () => {
  function makeRequest(headers = {}) {
    return { headers: { get: (name) => headers[name.toLowerCase()] || null } };
  }

  test('extracts the first IP from x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  test('returns a single IP when there is no comma', () => {
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.1' });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  test('trims whitespace from the extracted IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  203.0.113.0  , 198.51.100.0' });
    expect(getClientIp(req)).toBe('203.0.113.0');
  });

  test('returns "unknown" when x-forwarded-for is absent', () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe('unknown');
  });
});
