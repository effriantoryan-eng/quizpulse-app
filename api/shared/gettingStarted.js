// v4.6.0 Task 3 — Getting Started checklist. Step completion is derived from LIVE Cosmos counts
// on every call (never stored tick-state, so e.g. deleting the one real class un-ticks
// 'real-class-created' automatically) — same pattern introEligibility.js already uses for the
// nine feature-intro milestones, and it reuses two of its techniques directly (teacher-partitioned
// classes.studentCount as a join-code-shared proxy, EXCLUDE_DEMO_FRAGMENT for the real-send step).
//
// The RELEASE moment is persisted, one-way, under the synthetic 'getting_started' key (see
// featureIntros.js) as a marker of when it first happened — but steps are still recomputed live
// after release, because the collapsed strip UI needs an up-to-date "N of 5" progress count (e.g.
// first-real-send often completes days after release). Only DISMISSED is a true terminal
// short-circuit (mirrors v4.2.0's "everything settled -> zero milestone queries" property) —
// once dismissed, the checklist is gone for good and there's nothing left to compute.
const { EXCLUDE_DEMO_FRAGMENT } = require('./excludeDemo');

const GETTING_STARTED_STEPS = [
  'practice-quiz-sent',
  'results-seen',
  'real-class-created',
  'join-code-shared',
  'first-real-send',
];

async function countPositive(container, query, parameters) {
  const { resources } = await container.items.query({ query, parameters }).fetchAll();
  return (resources[0] || 0) > 0;
}

async function computeGettingStartedSteps({ teacherId, classesContainer, quizzesContainer }) {
  const tidParam = [{ name: '@tid', value: teacherId }];

  const [practiceQuizSent, resultsSeen, realClassCreated, joinCodeShared, firstRealSend] = await Promise.all([
    // The first-run chain's send-and-simulate step (or any manual demo send) completed.
    countPositive(
      quizzesContainer,
      "SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND c.isDemo = true AND c.status = 'sent'",
      tidParam,
    ),
    // Any quiz — demo included, same deliberate exception misconception_intro uses, since the
    // practice quiz is this checklist's designed first touch — has at least one response counted.
    countPositive(
      quizzesContainer,
      'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND c.confidenceResponseCount >= 1',
      tidParam,
    ),
    // At least one real (non-demo) class exists.
    countPositive(
      classesContainer,
      'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND (NOT IS_DEFINED(c.isDemo) OR c.isDemo = false)',
      tidParam,
    ),
    // The one new count this task adds: a real class with an approved student implies its join
    // code actually reached someone. Teacher-partitioned (classes.studentCount), not a
    // join_requests query — join_requests' partition key is /classId, which would be
    // cross-partition here (same reasoning demo_intro's milestone already documents).
    countPositive(
      classesContainer,
      'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND (NOT IS_DEFINED(c.isDemo) OR c.isDemo = false) AND c.studentCount > 0',
      tidParam,
    ),
    // A real, non-clone quiz has actually been sent.
    countPositive(
      quizzesContainer,
      `SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND ${EXCLUDE_DEMO_FRAGMENT} AND NOT IS_DEFINED(c.parentQuizId) AND c.status = 'sent'`,
      tidParam,
    ),
  ]);

  return [
    { key: 'practice-quiz-sent', done: practiceQuizSent },
    { key: 'results-seen', done: resultsSeen },
    { key: 'real-class-created', done: realClassCreated },
    { key: 'join-code-shared', done: joinCodeShared },
    { key: 'first-real-send', done: firstRealSend },
  ];
}

// Release trigger: demo-send-complete (BOTH practice-quiz-sent AND results-seen) OR explicit
// dismiss — NOT first-real-send (eng D9: that stays a visible step, never the release trigger).
function isReleased(steps) {
  const done = (key) => steps.find((s) => s.key === key)?.done === true;
  return done('practice-quiz-sent') && done('results-seen');
}

// teacher: the caller's teacher doc (for its featureIntros.getting_started sub-object).
// Returns { released, dismissed, steps, skippedSteps } — steps is null when short-circuited.
async function computeGettingStarted({ teacherId, teacher, classesContainer, quizzesContainer }) {
  const gs = teacher?.featureIntros?.getting_started || {};

  if (gs.dismissedAt) {
    return { released: true, dismissed: true, steps: null, skippedSteps: gs.skippedSteps || [] };
  }

  const steps = await computeGettingStartedSteps({ teacherId, classesContainer, quizzesContainer });
  return { released: isReleased(steps) || !!gs.releasedAt, dismissed: false, steps, skippedSteps: gs.skippedSteps || [] };
}

module.exports = { GETTING_STARTED_STEPS, computeGettingStarted, computeGettingStartedSteps, isReleased };
