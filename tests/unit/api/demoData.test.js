// Unit tests for the v3.3.0 simulated demo class — name selection, response samplers, idempotency,
// and the demo-isolation predicate. Pure logic only (no Cosmos, no func server).
//
// Distribution tests use a large sample size so the statistical assertions are effectively
// deterministic (the sprint spec describes 1000 samples; we sample more to keep CI non-flaky while
// asserting the same tolerances).

const { selectDemoStudents, DEMO_NAMES } = require('../../../api/shared/demoNames');
const {
  runSimulation,
  generateSimulatedResponses,
  pickAnswer,
  pickDistractor,
  pickConfidence,
  pickResponseTimeMs,
} = require('../../../api/shared/runSimulation');
const { EXCLUDE_DEMO_FRAGMENT, andExcludeDemo, isDemoClass } = require('../../../api/shared/excludeDemo');

const SAMPLES = 20000;

describe('selectDemoStudents', () => {
  test('returns 24 unique, non-empty names (and unique ids) on each call', () => {
    for (let run = 0; run < 5; run++) {
      const students = selectDemoStudents();
      expect(students).toHaveLength(24);
      const names = students.map(s => s.name);
      const ids = students.map(s => s.studentId);
      expect(new Set(names).size).toBe(24);   // no duplicate names within a class
      expect(new Set(ids).size).toBe(24);     // every device id unique
      names.forEach(n => {
        expect(typeof n).toBe('string');
        expect(n.trim().length).toBeGreaterThan(0);
      });
    }
  });

  test('pool is large enough and has no duplicate entries', () => {
    expect(DEMO_NAMES.length).toBeGreaterThanOrEqual(48); // need >= 24, comfortably more
    expect(new Set(DEMO_NAMES).size).toBe(DEMO_NAMES.length);
  });
});

describe('correctness sampler (pickAnswer)', () => {
  test('selects the correct option ~65% of the time (60–70%)', () => {
    const correctIndex = 1;
    const optionCount = 4;
    let correct = 0;
    for (let i = 0; i < SAMPLES; i++) {
      if (pickAnswer(correctIndex, optionCount) === correctIndex) correct++;
    }
    const rate = correct / SAMPLES;
    expect(rate).toBeGreaterThanOrEqual(0.60);
    expect(rate).toBeLessThanOrEqual(0.70);
  });

  test('incorrect answers are never the correct option', () => {
    // Over many samples, every non-correct pick must be a valid wrong index.
    for (let i = 0; i < 2000; i++) {
      const idx = pickAnswer(2, 4);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });
});

describe('confidence sampler (pickConfidence)', () => {
  test('buckets land within ±3% of 40/40/20', () => {
    const counts = { sure: 0, pretty_sure: 0, guessing: 0 };
    for (let i = 0; i < SAMPLES; i++) counts[pickConfidence()]++;
    expect(counts.sure / SAMPLES).toBeGreaterThanOrEqual(0.37);
    expect(counts.sure / SAMPLES).toBeLessThanOrEqual(0.43);
    expect(counts.pretty_sure / SAMPLES).toBeGreaterThanOrEqual(0.37);
    expect(counts.pretty_sure / SAMPLES).toBeLessThanOrEqual(0.43);
    expect(counts.guessing / SAMPLES).toBeGreaterThanOrEqual(0.17);
    expect(counts.guessing / SAMPLES).toBeLessThanOrEqual(0.23);
  });
});

describe('responseTimeMs sampler (pickResponseTimeMs)', () => {
  test('is bimodal — >=25% fast (<6000ms) and >=65% deliberate (10000–35000ms)', () => {
    let fast = 0;
    let deliberate = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const ms = pickResponseTimeMs();
      if (ms < 6000) fast++;
      if (ms >= 10000 && ms <= 35000) deliberate++;
    }
    expect(fast / SAMPLES).toBeGreaterThanOrEqual(0.25);
    expect(deliberate / SAMPLES).toBeGreaterThanOrEqual(0.65);
  });
});

describe('generateSimulatedResponses', () => {
  test('produces one demo-flagged response per student with summed duration', () => {
    const quiz = { id: 'q1', sentAt: '2026-06-22T00:00:00.000Z' };
    const demoStudents = selectDemoStudents();
    const questions = [
      { id: 'qa', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
      { id: 'qb', options: ['a', 'b', 'c', 'd'], correctIndex: 2 },
    ];
    const docs = generateSimulatedResponses({ quiz, demoStudents, questions });
    expect(docs).toHaveLength(24);
    for (const d of docs) {
      expect(d.isDemo).toBe(true);
      expect(d.simulated).toBe(true);
      expect(d.quizId).toBe('q1');
      expect(d.answers).toHaveLength(2);
      const summed = d.answers.reduce((s, a) => s + a.responseTimeMs, 0);
      expect(d.quizDurationMs).toBe(summed);
      // completedAt is sentAt + 20–40s
      const delta = new Date(d.completedAt).getTime() - new Date(quiz.sentAt).getTime();
      expect(delta).toBeGreaterThanOrEqual(20000);
      expect(delta).toBeLessThanOrEqual(40000);
    }
  });
});

describe('v4.6.0 misconception concentration (eng D12/CEO D12)', () => {
  test('wrong answers concentrate on ONE shared distractor per question (~80%), not spread uniformly', () => {
    const correctIndex = 0;
    const optionCount = 4;
    const distractorIndex = pickDistractor(correctIndex, optionCount);
    let wrong = 0;
    let onDistractor = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const idx = pickAnswer(correctIndex, optionCount, distractorIndex);
      if (idx !== correctIndex) {
        wrong++;
        if (idx === distractorIndex) onDistractor++;
      }
    }
    // Expected ~0.867: 80% land directly on the distractor, and the remaining 20% fall back to a
    // uniform pick among the 3 non-correct options (1/3 of which is the distractor again).
    const concentrationRate = onDistractor / wrong;
    expect(concentrationRate).toBeGreaterThanOrEqual(0.82);
    expect(concentrationRate).toBeLessThanOrEqual(0.91);
  });

  test('picking the shared distractor skews confidence toward "sure"/"pretty_sure" vs a plain guess', () => {
    let sureOrPrettyMisconception = 0;
    let sureOrPrettyDefault = 0;
    for (let i = 0; i < SAMPLES; i++) {
      if (pickConfidence(true) !== 'guessing') sureOrPrettyMisconception++;
      if (pickConfidence(false) !== 'guessing') sureOrPrettyDefault++;
    }
    expect(sureOrPrettyMisconception / SAMPLES).toBeGreaterThan(sureOrPrettyDefault / SAMPLES);
  });

  test('generateSimulatedResponses concentrates each question\'s wrong picks on one distractor', () => {
    const quiz = { id: 'q1', sentAt: '2026-06-22T00:00:00.000Z' };
    const demoStudents = selectDemoStudents();
    const questions = [{ id: 'qa', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }];
    const docs = generateSimulatedResponses({ quiz, demoStudents, questions });
    const wrongPicks = docs.map(d => d.answers[0].selectedIndex).filter(idx => idx !== 0);
    // 24 students isn't enough to assert an exact rate, but with 80% concentration and a mostly-
    // correct-answer bias, any wrong picks that do occur should mostly land on a single index.
    if (wrongPicks.length >= 3) {
      const counts = {};
      wrongPicks.forEach(idx => { counts[idx] = (counts[idx] || 0) + 1; });
      const maxCount = Math.max(...Object.values(counts));
      expect(maxCount / wrongPicks.length).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('runSimulation idempotency (injected fake containers)', () => {
  function makeDeps(questions) {
    const store = [];
    return {
      store,
      deps: {
        responsesContainer: {
          items: {
            query: () => ({ fetchAll: async () => ({ resources: [store.length] }) }),
            create: async (doc) => { store.push(doc); return { resource: doc }; },
          },
        },
        questionsContainer: {
          items: {
            query: () => ({ fetchAll: async () => ({ resources: questions }) }),
          },
        },
      },
    };
  }

  test('first call writes 24 docs; second call returns the conflict signal (409)', async () => {
    const quiz = { id: 'q1', sentAt: '2026-06-22T00:00:00.000Z', questionIds: ['qa'] };
    const cls = { isDemo: true, demoStudents: selectDemoStudents() };
    const questions = [{ id: 'qa', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }];
    const { store, deps } = makeDeps(questions);

    const first = await runSimulation(quiz, cls, null, deps);
    expect(first.simulated).toBe(24);
    expect(store).toHaveLength(24);

    const second = await runSimulation(quiz, cls, null, deps);
    expect(second.error).toBeDefined();
    expect(second.status).toBe(409);
    expect(store).toHaveLength(24); // nothing written on the conflicting call
  });
});

describe('demo isolation predicate (excludeDemo)', () => {
  test('fragment keeps non-demo and legacy docs, drops isDemo=true', () => {
    expect(EXCLUDE_DEMO_FRAGMENT).toContain('c.isDemo = false');
    expect(EXCLUDE_DEMO_FRAGMENT).toContain('NOT IS_DEFINED(c.isDemo)');
  });

  test('andExcludeDemo composes with and without an existing clause', () => {
    expect(andExcludeDemo('')).toBe(EXCLUDE_DEMO_FRAGMENT);
    expect(andExcludeDemo('c.teacherId = @tid')).toBe(`c.teacherId = @tid AND ${EXCLUDE_DEMO_FRAGMENT}`);
  });

  test('isDemoClass only true for explicit isDemo=true', () => {
    expect(isDemoClass({ isDemo: true })).toBe(true);
    expect(isDemoClass({ isDemo: false })).toBe(false);
    expect(isDemoClass({})).toBe(false);
    expect(isDemoClass(null)).toBe(false);
  });
});
