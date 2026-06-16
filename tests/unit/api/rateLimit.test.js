// Unit tests for api/rateLimit.js.
//
// Sprint 6: rateLimit() is now a no-op — Azure API Management enforces throughput limits at
// the edge (see docs/azure/APIM_SETUP.md). The function always returns true so existing call
// sites compile and work, while APIM makes the actual throttling decision before any request
// reaches the Function App.
//
// getClientIp() is still tested because it is used by audit-log handlers (institutions.js,
// schoolAdmin.js) to record the caller's IP on sensitive admin actions.

const { rateLimit, getClientIp } = require('../../../api/rateLimit');

describe('rateLimit (APIM no-op)', () => {
  test('always returns true regardless of call count', () => {
    for (let i = 0; i < 100; i++) {
      expect(rateLimit('any-key', 1, 60000)).toBe(true);
    }
  });

  test('returns true for any key, max, and windowMs combination', () => {
    expect(rateLimit('k1', 30, 60000)).toBe(true);
    expect(rateLimit('k2', 5, 60000)).toBe(true);
    expect(rateLimit('k3', 1, 5 * 60 * 1000)).toBe(true);
  });

  test('returns true with no arguments (safe default)', () => {
    expect(rateLimit()).toBe(true);
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
