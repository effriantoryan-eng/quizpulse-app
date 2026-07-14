const { computeRangeQuizStats } = require('../../../api/shared/rangeQuizStats');

function mockContainer(resources) {
  return { items: { query: () => ({ fetchAll: async () => ({ resources }) }) } };
}

describe('computeRangeQuizStats', () => {
  const rangeStart = new Date('2026-07-15T00:00:00.000Z');

  test('sums pushSuccessCount/pushFailCount only across quizzes that have them', async () => {
    const quizzesContainer = mockContainer([
      { id: 'q1', classIds: ['c1'], pushSuccessCount: 8, pushFailCount: 2 },
      { id: 'q2', classIds: ['c2'], pushSuccessCount: 3, pushFailCount: 0 },
    ]);
    const responsesContainer = mockContainer([5]); // SELECT VALUE COUNT(1) shape
    const result = await computeRangeQuizStats({ rangeStart, quizzesContainer, responsesContainer });

    expect(result.quizzesSent).toBe(2);
    expect(result.notificationsSent).toBe(11);
    expect(result.notificationsFailed).toBe(2);
    expect(result.responsesSubmitted).toBe(5);
  });

  test('legacy quizzes (no pushSuccessCount field) are excluded from the sums, not coerced to 0', async () => {
    const quizzesContainer = mockContainer([
      { id: 'q1', classIds: ['c1'], pushSuccessCount: 5, pushFailCount: 1 },
      { id: 'q2', classIds: ['c2'] }, // legacy — no push-count fields at all
    ]);
    const responsesContainer = mockContainer([3]);
    const result = await computeRangeQuizStats({ rangeStart, quizzesContainer, responsesContainer });

    // quizzesSent counts BOTH (it's sent-in-range, not push-count-having); notificationsSent
    // only reflects the one quiz that actually has the field.
    expect(result.quizzesSent).toBe(2);
    expect(result.notificationsSent).toBe(5);
    expect(result.notificationsFailed).toBe(1);
  });

  test('no quizzes in range → zeroed stats, no responses query issued', async () => {
    const quizzesContainer = mockContainer([]);
    let responsesQueried = false;
    const responsesContainer = {
      items: { query: () => { responsesQueried = true; return { fetchAll: async () => ({ resources: [0] }) }; } },
    };
    const result = await computeRangeQuizStats({ rangeStart, quizzesContainer, responsesContainer });

    expect(result.quizzesSent).toBe(0);
    expect(result.notificationsSent).toBe(0);
    expect(result.responsesSubmitted).toBe(0);
    expect(responsesQueried).toBe(false);
  });

  test('quizzesInRange is returned for callers that need per-quiz data (e.g. the funnel)', async () => {
    const quizzesContainer = mockContainer([{ id: 'q1', classIds: ['c1'], pushSuccessCount: 1, pushFailCount: 0 }]);
    const responsesContainer = mockContainer([0]);
    const result = await computeRangeQuizStats({ rangeStart, quizzesContainer, responsesContainer });
    expect(result.quizzesInRange).toHaveLength(1);
    expect(result.quizzesInRange[0].id).toBe('q1');
  });
});
