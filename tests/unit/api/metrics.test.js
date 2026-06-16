// Unit test for api/metrics.js's buildStubbedMetrics() — the only pure, Cosmos-free piece of
// that module (the HTTP handler itself constructs a CosmosClient-adjacent role check at module
// load via api/auth.js's env-dependent config, so it isn't required directly here — same
// constraint noted in auditLog.test.js).

const { buildStubbedMetrics } = require('../../../api/metrics');

describe('buildStubbedMetrics', () => {
  test('echoes the requested range and flags the response as stubbed', () => {
    const result = buildStubbedMetrics('7d');
    expect(result.range).toBe('7d');
    expect(result.stubbed).toBe(true);
  });

  test('includes all five documented metric groups', () => {
    const result = buildStubbedMetrics('today');
    expect(result).toHaveProperty('systemHealth');
    expect(result).toHaveProperty('usageGrowth');
    expect(result).toHaveProperty('engagement');
    expect(result).toHaveProperty('security');
    expect(result).toHaveProperty('spending');
  });
});
