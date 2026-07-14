// Unit test for api/metrics.js's buildStubbedMetrics() — the only pure, Cosmos-free piece of
// that module (the HTTP handler itself constructs a CosmosClient-adjacent role check at module
// load via api/auth.js's env-dependent config, so it isn't required directly here — same
// constraint noted in auditLog.test.js).

const { buildStubbedMetrics } = require('../../../api/metrics');

describe('buildStubbedMetrics', () => {
  test('echoes the requested range', () => {
    const result = buildStubbedMetrics('7d');
    expect(result.range).toBe('7d');
  });

  test('includes all five documented metric groups', () => {
    const result = buildStubbedMetrics('today');
    expect(result).toHaveProperty('systemHealth');
    expect(result).toHaveProperty('usageGrowth');
    expect(result).toHaveProperty('engagement');
    expect(result).toHaveProperty('security');
    expect(result).toHaveProperty('spending');
  });

  // v4.4.0: a single top-level `stubbed` boolean can't represent a response where some groups
  // are real and some aren't — each group now carries its own flag.
  test('flags systemHealth/security/spending as stubbed, usageGrowth/engagement as not', () => {
    const result = buildStubbedMetrics('today');
    expect(result.systemHealth.stubbed).toBe(true);
    expect(result.security.stubbed).toBe(true);
    expect(result.spending.stubbed).toBe(true);
    expect(result.usageGrowth.stubbed).toBe(false);
    expect(result.engagement.stubbed).toBe(false);
  });

  test('has no top-level stubbed field', () => {
    const result = buildStubbedMetrics('today');
    expect(result).not.toHaveProperty('stubbed');
  });
});
