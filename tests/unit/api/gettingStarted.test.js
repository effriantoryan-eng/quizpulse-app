// v4.6.0 Task 3 — Getting Started checklist. Pure/offline tests against injected fake containers
// (no Cosmos, no func host), mirroring introEligibility.test.js's approach.
const { computeGettingStarted, computeGettingStartedSteps, isReleased, GETTING_STARTED_STEPS } = require('../../../api/shared/gettingStarted');

function makeContainer(count) {
  return { items: { query: () => ({ fetchAll: async () => ({ resources: [count] }) }) } };
}

// A container whose query result depends on which query string was passed — lets a single test
// give different answers to the 3 different queries computeGettingStartedSteps runs against it.
function makeConditionalContainer(matchers) {
  return {
    items: {
      query: ({ query }) => ({
        fetchAll: async () => {
          const match = matchers.find((m) => m.test(query));
          return { resources: [match ? match.count : 0] };
        },
      }),
    },
  };
}

describe('computeGettingStartedSteps', () => {
  test('all steps false when every count is zero', async () => {
    const zero = makeContainer(0);
    const steps = await computeGettingStartedSteps({ teacherId: 't1', classesContainer: zero, quizzesContainer: zero });
    expect(steps).toHaveLength(GETTING_STARTED_STEPS.length);
    expect(steps.every((s) => s.done === false)).toBe(true);
  });

  test('all steps true when every count is positive', async () => {
    const one = makeContainer(1);
    const steps = await computeGettingStartedSteps({ teacherId: 't1', classesContainer: one, quizzesContainer: one });
    expect(steps.every((s) => s.done === true)).toBe(true);
    expect(steps.map((s) => s.key)).toEqual(GETTING_STARTED_STEPS);
  });

  test('real-class-created and join-code-shared can differ (a class exists but has no students yet)', async () => {
    const classesContainer = makeConditionalContainer([
      { test: (q) => q.includes('c.studentCount > 0'), count: 0 },
      { test: (q) => true, count: 1 }, // the plain real-class-exists query
    ]);
    const quizzesContainer = makeContainer(0);
    const steps = await computeGettingStartedSteps({ teacherId: 't1', classesContainer, quizzesContainer });
    expect(steps.find((s) => s.key === 'real-class-created').done).toBe(true);
    expect(steps.find((s) => s.key === 'join-code-shared').done).toBe(false);
  });
});

describe('isReleased', () => {
  test('true only when BOTH practice-quiz-sent and results-seen are done', () => {
    const base = GETTING_STARTED_STEPS.map((key) => ({ key, done: false }));
    expect(isReleased(base)).toBe(false);

    const onlySent = base.map((s) => (s.key === 'practice-quiz-sent' ? { ...s, done: true } : s));
    expect(isReleased(onlySent)).toBe(false);

    const both = base.map((s) => (['practice-quiz-sent', 'results-seen'].includes(s.key) ? { ...s, done: true } : s));
    expect(isReleased(both)).toBe(true);
  });

  test('first-real-send alone does NOT release (eng D9)', () => {
    const base = GETTING_STARTED_STEPS.map((key) => ({ key, done: key === 'first-real-send' }));
    expect(isReleased(base)).toBe(false);
  });
});

describe('computeGettingStarted short-circuit', () => {
  test('dismissed teacher never triggers a Cosmos read', async () => {
    let queried = false;
    const trackingContainer = { items: { query: () => { queried = true; return { fetchAll: async () => ({ resources: [0] }) }; } } };
    const teacher = { featureIntros: { getting_started: { dismissedAt: '2026-01-01T00:00:00.000Z' } } };
    const result = await computeGettingStarted({ teacherId: 't1', teacher, classesContainer: trackingContainer, quizzesContainer: trackingContainer });
    expect(result).toEqual({ released: true, dismissed: true, steps: null, skippedSteps: [] });
    expect(queried).toBe(false);
  });

  test('an already-released (but not dismissed) teacher still gets live steps — the collapsed strip needs an up-to-date "N of 5"', async () => {
    const zero = makeContainer(0);
    const teacher = { featureIntros: { getting_started: { releasedAt: '2026-01-01T00:00:00.000Z' } } };
    const result = await computeGettingStarted({ teacherId: 't1', teacher, classesContainer: zero, quizzesContainer: zero });
    expect(result.released).toBe(true); // stays released even though live steps read back all-false
    expect(result.dismissed).toBe(false);
    expect(result.steps).toHaveLength(5);
  });

  test('a fresh teacher (no getting_started state) computes live steps', async () => {
    const zero = makeContainer(0);
    const teacher = {};
    const result = await computeGettingStarted({ teacherId: 't1', teacher, classesContainer: zero, quizzesContainer: zero });
    expect(result.released).toBe(false);
    expect(result.dismissed).toBe(false);
    expect(result.steps).toHaveLength(5);
  });

  test('skippedSteps carries through even when not yet released/dismissed', async () => {
    const zero = makeContainer(0);
    const teacher = { featureIntros: { getting_started: { skippedSteps: ['join-code-shared'] } } };
    const result = await computeGettingStarted({ teacherId: 't1', teacher, classesContainer: zero, quizzesContainer: zero });
    expect(result.skippedSteps).toEqual(['join-code-shared']);
  });
});
