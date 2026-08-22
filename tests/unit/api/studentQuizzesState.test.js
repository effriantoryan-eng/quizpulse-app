// Unit test for api/studentQuizzes.js's stateOf() — the v4.7.0 T4 server-computed 'open' |
// 'closed' | 'scheduled' field. Mirror of the pure decision function (same pattern as
// tests/unit/demoNav.test.js — this repo has no easy way to import an inline function from an
// Azure Functions v4 handler module without triggering its Cosmos client construction).

function stateOf(q, now) {
  if (q.status === 'scheduled') return 'scheduled';
  if (q.closedAt && new Date(q.closedAt).getTime() < now) return 'closed';
  return 'open';
}

describe('studentQuizzes stateOf()', () => {
  const now = Date.now();

  it('scheduled status wins regardless of closedAt', () => {
    expect(stateOf({ status: 'scheduled', closedAt: null }, now)).toBe('scheduled');
  });

  it('sent + past closedAt is closed', () => {
    expect(stateOf({ status: 'sent', closedAt: new Date(now - 1000).toISOString() }, now)).toBe('closed');
  });

  it('sent + future closedAt is open', () => {
    expect(stateOf({ status: 'sent', closedAt: new Date(now + 60000).toISOString() }, now)).toBe('open');
  });

  it('sent + no closedAt is open (legacy doc tolerance)', () => {
    expect(stateOf({ status: 'sent', closedAt: null }, now)).toBe('open');
  });
});
