// Unit tests for api/shared/introEligibility.js — v4.2.0 progressive-disclosure milestone rules.

const { computeEligibleIntros } = require('../../../api/shared/introEligibility');

function countContainer(count) {
  return { items: { query: () => ({ fetchAll: async () => ({ resources: [count] }) }) } };
}

// Lets a single container answer differently per query text — used when a test needs classes or
// quizzes to satisfy some milestones but not others in one call.
function routedContainer(routes) {
  return {
    items: {
      query: ({ query }) => ({
        fetchAll: async () => {
          for (const [match, count] of routes) {
            if (query.includes(match)) return { resources: [count] };
          }
          return { resources: [0] };
        },
      }),
    },
  };
}

describe('computeEligibleIntros', () => {
  test('a brand-new teacher (no classes, no quizzes) is only eligible for demo_intro', async () => {
    const result = await computeEligibleIntros({
      teacherId: 't1',
      teacher: {},
      classesContainer: countContainer(0),
      quizzesContainer: countContainer(0),
    });
    expect(result).toEqual(['demo_intro']);
  });

  test('demo_intro is NOT suppressed by empty class shells (studentCount 0)', async () => {
    // classesContainer count query only counts isDemo=true OR studentCount>0 — shells (isDemo
    // false, studentCount 0) never match it, so this mirrors "shells exist but count stays 0".
    const result = await computeEligibleIntros({
      teacherId: 't1',
      teacher: {},
      classesContainer: countContainer(0),
      quizzesContainer: countContainer(0),
    });
    expect(result).toContain('demo_intro');
  });

  test('demo_intro is suppressed once a class has an approved student', async () => {
    const result = await computeEligibleIntros({
      teacherId: 't1',
      teacher: {},
      classesContainer: countContainer(1),
      quizzesContainer: countContainer(0),
    });
    expect(result).not.toContain('demo_intro');
  });

  test('every key dismissed short-circuits to an empty array without querying milestones', async () => {
    const teacher = {
      featureIntros: {
        demo_intro: { dismissedAt: '2026-01-01' },
        analytics_intro: { dismissedAt: '2026-01-01' },
        community_intro: { dismissedAt: '2026-01-01' },
        misconception_intro: { dismissedAt: '2026-01-01' },
        population_intro: { dismissedAt: '2026-01-01' },
        apst_intro: { dismissedAt: '2026-01-01' },
        mypd_intro: { dismissedAt: '2026-01-01' },
        ai_generation_intro: { dismissedAt: '2026-01-01' },
      },
    };
    let queried = false;
    const spyContainer = {
      items: { query: () => { queried = true; return { fetchAll: async () => ({ resources: [999] }) } } },
    };
    const result = await computeEligibleIntros({ teacherId: 't1', teacher, classesContainer: spyContainer, quizzesContainer: spyContainer });
    expect(result).toEqual([]);
    expect(queried).toBe(false);
  });

  test('apst_intro/mypd_intro/ai_generation_intro never appear while their flags are off', async () => {
    const result = await computeEligibleIntros({
      teacherId: 't1',
      teacher: {},
      classesContainer: countContainer(1), // suppress demo_intro to isolate the flag-dark keys
      quizzesContainer: countContainer(0),
    });
    expect(result).not.toContain('apst_intro');
    expect(result).not.toContain('mypd_intro');
    expect(result).not.toContain('ai_generation_intro');
  });

  test('analytics_intro fires once a non-demo quiz has confidenceResponseCount >= 1', async () => {
    const quizzesContainer = countContainer(1); // every quizzesContainer query in this test returns 1
    const result = await computeEligibleIntros({
      teacherId: 't1',
      teacher: {},
      classesContainer: countContainer(1),
      quizzesContainer,
    });
    expect(result).toContain('analytics_intro');
  });

  test('community_intro requires >= 2 quizzes created (server-countable)', async () => {
    const resultBelow = await computeEligibleIntros({
      teacherId: 't1',
      teacher: {},
      classesContainer: countContainer(1),
      quizzesContainer: routedContainer([["c.status = 'sent'", 0], ["confidenceResponseCount >= 1", 0], ["confidenceResponseCount >= @threshold", 0], ['SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND (c.isDemo', 1]]),
    });
    expect(resultBelow).not.toContain('community_intro');
  });

  test('demo data satisfies misconception_intro (the one deliberate exception to demo exclusion)', async () => {
    // A single count query answers every quizzesContainer check identically in this container —
    // simulate "misconception threshold met" by returning a high count everywhere and checking
    // the key is present (demo inclusion is a property of the QUERY string having no isDemo
    // filter, verified by inspecting the query passed in).
    let sawIsDemoFilterOnMisconception = false;
    const quizzesContainer = {
      items: {
        query: ({ query }) => ({
          fetchAll: async () => {
            if (query.includes('confidenceResponseCount >= @threshold')) {
              sawIsDemoFilterOnMisconception = query.includes('isDemo');
              return { resources: [1] };
            }
            return { resources: [0] };
          },
        }),
      },
    };
    const result = await computeEligibleIntros({ teacherId: 't1', teacher: {}, classesContainer: countContainer(1), quizzesContainer });
    expect(result).toContain('misconception_intro');
    expect(sawIsDemoFilterOnMisconception).toBe(false);
  });

  test('population_intro query excludes demo data', async () => {
    let sawQuery = '';
    const quizzesContainer = {
      items: {
        query: ({ query }) => ({
          fetchAll: async () => {
            if (query.includes("c.status = 'sent'")) { sawQuery = query; return { resources: [1] }; }
            return { resources: [0] };
          },
        }),
      },
    };
    const result = await computeEligibleIntros({ teacherId: 't1', teacher: {}, classesContainer: countContainer(1), quizzesContainer });
    expect(result).toContain('population_intro');
    expect(sawQuery).toMatch(/isDemo/);
  });

  test('returns keys in CANDIDATE_KEYS priority order regardless of check order', async () => {
    const quizzesContainer = countContainer(5); // satisfies analytics/misconception/population/community
    const result = await computeEligibleIntros({
      teacherId: 't1',
      teacher: {},
      classesContainer: countContainer(1),
      quizzesContainer,
    });
    const order = ['demo_intro', 'analytics_intro', 'misconception_intro', 'population_intro', 'apst_intro', 'mypd_intro', 'ai_generation_intro', 'community_intro'];
    const indices = result.map((k) => order.indexOf(k));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });
});
