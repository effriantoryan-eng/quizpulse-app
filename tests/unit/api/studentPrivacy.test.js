// v4.11.0 R2 (Erasure and opt-out) — unit test for the student leave-class rate limit.
// Captures the registered Azure Functions handler (mock app.http) and drives it directly with a fake
// request, so the per-device limit is exercised without a func host. @azure/cosmos is mocked to a
// container whose approval query returns nothing, so a call that passes the rate limit lands on the
// uniform 404 — never a 429 from anything but the limiter.
const mockHandlers = {};
jest.mock('@azure/functions', () => ({ app: { http: (name, cfg) => { mockHandlers[name] = cfg.handler; } } }));
jest.mock('@azure/cosmos', () => ({
  CosmosClient: class {
    database() {
      return {
        container: () => ({
          items: { query: () => ({ fetchAll: async () => ({ resources: [] }) }) },
          item: () => ({ read: async () => ({ resource: undefined }) }),
        }),
      };
    }
  },
}));

require('../../../api/studentPrivacy');

function makeReq(body, ip = '1.2.3.4') {
  const headers = new Map([
    ['content-length', String(JSON.stringify(body).length)],
    ['x-forwarded-for', ip],
  ]);
  return {
    url: 'http://localhost/api/student/leave-class',
    headers: { get: (k) => (headers.has(k) ? headers.get(k) : null) },
    json: async () => body,
  };
}

const ctx = { log: () => {}, warn: () => {}, error: () => {} };

describe('POST /api/student/leave-class rate limit', () => {
  test('the sixth call for one device within the hour is throttled — first five not 429, sixth 429', async () => {
    const body = { deviceId: 'DEV-leave-unit', classId: 'CLS' };
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const res = await mockHandlers.studentLeaveClass(makeReq(body), ctx);
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
