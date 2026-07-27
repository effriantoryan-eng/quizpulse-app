// v4.6.0 Task 8 — pure aggregation tests for the activation funnel script. No Cosmos, no func host.
const { computeActivationFunnel } = require('../../../api/scripts/activationFunnel');

describe('computeActivationFunnel', () => {
  test('counts signups, demo sends, and real sends independently (two-bucket split)', () => {
    const teachers = [
      { id: 't1', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 't2', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 't3', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const quizzes = [
      { teacherId: 't1', status: 'sent', sentAt: '2026-01-02T00:00:00.000Z', isDemo: true },
      { teacherId: 't2', status: 'sent', sentAt: '2026-01-02T00:00:00.000Z', isDemo: false },
      // t3 never sent anything.
    ];
    const result = computeActivationFunnel({ teachers, quizzes });
    expect(result.signups).toBe(3);
    expect(result.demoSends).toBe(1);
    expect(result.realSends).toBe(1);
  });

  test('a teacher with both a demo send and a real send counts in both buckets', () => {
    const teachers = [{ id: 't1', createdAt: '2026-01-01T00:00:00.000Z' }];
    const quizzes = [
      { teacherId: 't1', status: 'sent', sentAt: '2026-01-02T00:00:00.000Z', isDemo: true },
      { teacherId: 't1', status: 'sent', sentAt: '2026-01-03T00:00:00.000Z', isDemo: false },
    ];
    const result = computeActivationFunnel({ teachers, quizzes });
    expect(result.demoSends).toBe(1);
    expect(result.realSends).toBe(1);
  });

  test('spaced-repeat clones (parentQuizId) are excluded from both buckets', () => {
    const teachers = [{ id: 't1', createdAt: '2026-01-01T00:00:00.000Z' }];
    const quizzes = [
      { teacherId: 't1', status: 'sent', sentAt: '2026-01-02T00:00:00.000Z', isDemo: false, parentQuizId: 'orig' },
    ];
    const result = computeActivationFunnel({ teachers, quizzes });
    expect(result.realSends).toBe(0);
  });

  test('draft/unsent quizzes never count', () => {
    const teachers = [{ id: 't1', createdAt: '2026-01-01T00:00:00.000Z' }];
    const quizzes = [{ teacherId: 't1', status: 'draft', isDemo: false }];
    const result = computeActivationFunnel({ teachers, quizzes });
    expect(result.realSends).toBe(0);
  });

  test('median time-to-first-real-send uses the EARLIEST real send per teacher', () => {
    const teachers = [{ id: 't1', createdAt: '2026-01-01T00:00:00.000Z' }];
    const quizzes = [
      { teacherId: 't1', status: 'sent', sentAt: '2026-01-05T00:00:00.000Z', isDemo: false }, // later
      { teacherId: 't1', status: 'sent', sentAt: '2026-01-02T00:00:00.000Z', isDemo: false }, // earlier — this one should count
    ];
    const result = computeActivationFunnel({ teachers, quizzes });
    expect(result.medianTimeToFirstSendMs).toBe(new Date('2026-01-02T00:00:00.000Z').getTime() - new Date('2026-01-01T00:00:00.000Z').getTime());
  });

  test('median is null when nobody has sent a real quiz yet', () => {
    const teachers = [{ id: 't1', createdAt: '2026-01-01T00:00:00.000Z' }];
    const result = computeActivationFunnel({ teachers, quizzes: [] });
    expect(result.medianTimeToFirstSendMs).toBeNull();
  });

  test('rates are 0 with zero signups (never divide by zero into NaN)', () => {
    const result = computeActivationFunnel({ teachers: [], quizzes: [] });
    expect(result.demoSendRate).toBe(0);
    expect(result.realSendRate).toBe(0);
  });
});
