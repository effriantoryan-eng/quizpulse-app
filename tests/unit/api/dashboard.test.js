// Unit test for the teacher dashboard's pure logic — mirrors the active/closed split and the
// responseRate math in api/dashboard.js. (DB composition is covered by integration tests.)

function isOpen(q, now) {
  return !q.closedAt || new Date(q.closedAt).getTime() > now;
}

function responseRate(totalResponses, classSize) {
  return classSize > 0 ? Math.round((totalResponses / classSize) * 100) : null;
}

describe('dashboard — active vs closed split', () => {
  const now = Date.parse('2026-06-29T12:00:00Z');
  const quizzes = [
    { id: 'a', closedAt: '2026-06-29T13:00:00Z' }, // future -> open
    { id: 'b', closedAt: '2026-06-29T11:00:00Z' }, // past -> closed
    { id: 'c', closedAt: null },                   // no close time -> open
  ];

  test('open = no closedAt or closedAt in the future', () => {
    expect(quizzes.filter(q => isOpen(q, now)).map(q => q.id)).toEqual(['a', 'c']);
  });

  test('closed = closedAt in the past', () => {
    expect(quizzes.filter(q => !isOpen(q, now)).map(q => q.id)).toEqual(['b']);
  });
});

describe('dashboard — responseRate', () => {
  test('rounds responses / classSize to a percent', () => {
    expect(responseRate(12, 28)).toBe(43);
    expect(responseRate(28, 28)).toBe(100);
  });

  test('null when classSize is 0 (avoids divide-by-zero)', () => {
    expect(responseRate(0, 0)).toBeNull();
  });
});
