// v4.2.0 progressive-disclosure milestone rules. One place all nine feature-intro keys' "should
// this teacher see this card" logic lives — GET /api/me is the only caller, so eligibility can
// never drift between endpoints.
const { EXCLUDE_DEMO_FRAGMENT } = require('./excludeDemo');
const { FEATURE_INTRO_KEYS } = require('./featureIntros');
const { FEATURE_APST_EXPORT, FEATURE_AI_GENERATION } = require('./features');

const MISCONCEPTION_RESPONSE_THRESHOLD = 5; // confidenceResponseCount on a quiz
const COMMUNITY_QUIZ_THRESHOLD = 2; // quizzes created (any status)

// Keys gated behind a feature flag that's currently off — the CEO review addendum's short-circuit
// rule treats these as dismissed so the milestone-count short-circuit below can fire correctly
// before their sprint ships, and so they're never proposed as eligible.
function flagDarkKeys() {
  const dark = new Set();
  if (!FEATURE_APST_EXPORT) {
    dark.add('apst_intro');
    dark.add('mypd_intro');
  }
  if (!FEATURE_AI_GENERATION) dark.add('ai_generation_intro');
  return dark;
}

// Returns the ordered list of feature-intro keys this teacher is currently eligible for
// (dashboard cards first in priority order, then community_intro last since it renders on the
// Build page, not the dashboard — callers filter by page). profile_nudge is intentionally
// excluded: it's a separate, lower-priority UI element (ProfileNudge), not a FeatureIntroCard
// candidate — see CEO review addendum §6.2.
const CANDIDATE_KEYS = [
  'demo_intro',
  'analytics_intro',
  'misconception_intro',
  'population_intro',
  'apst_intro',
  'mypd_intro',
  'ai_generation_intro',
  'community_intro',
];

async function computeEligibleIntros({ teacherId, teacher, classesContainer, quizzesContainer }) {
  const featureIntros = teacher?.featureIntros || {};
  const isDismissed = (key) => !!featureIntros[key]?.dismissedAt;
  const dark = flagDarkKeys();

  // Short-circuit: once every key is either dismissed or flag-dark, skip every milestone COUNT —
  // there's nothing left to become eligible for (profile_nudge isn't a candidate here, so it's
  // excluded from this check on purpose).
  const allSettled = FEATURE_INTRO_KEYS.filter((k) => k !== 'profile_nudge').every((k) => isDismissed(k) || dark.has(k));
  if (allSettled) return [];

  const eligible = [];

  const checkable = (key) => !isDismissed(key) && !dark.has(key);

  if (checkable('demo_intro')) {
    // No demo class AND no real class with any approved student. Empty class shells (studentCount
    // 0, isDemo false) must NOT suppress this — only a class that's actually been used should.
    const { resources } = await classesContainer.items
      .query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND (c.isDemo = true OR c.studentCount > 0)',
        parameters: [{ name: '@tid', value: teacherId }],
      })
      .fetchAll();
    if ((resources[0] || 0) === 0) eligible.push('demo_intro');
  }

  if (checkable('analytics_intro')) {
    const { resources } = await quizzesContainer.items
      .query({
        query: `SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND ${EXCLUDE_DEMO_FRAGMENT} AND c.confidenceResponseCount >= 1`,
        parameters: [{ name: '@tid', value: teacherId }],
      })
      .fetchAll();
    if ((resources[0] || 0) > 0) eligible.push('analytics_intro');
  }

  if (checkable('misconception_intro')) {
    // The one deliberate exception to demo exclusion — a demo quiz is this intro's designed
    // first touch, so it counts (CEO review addendum §5.2/§5.5).
    const { resources } = await quizzesContainer.items
      .query({
        query: `SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND c.confidenceResponseCount >= @threshold`,
        parameters: [
          { name: '@tid', value: teacherId },
          { name: '@threshold', value: MISCONCEPTION_RESPONSE_THRESHOLD },
        ],
      })
      .fetchAll();
    if ((resources[0] || 0) > 0) eligible.push('misconception_intro');
  }

  if (checkable('population_intro')) {
    // A NON-demo topic-tagged SEND — a demo send points at a zeros page (the b2e6664 confusion
    // class), so it must not satisfy this milestone.
    const { resources } = await quizzesContainer.items
      .query({
        query: `SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND ${EXCLUDE_DEMO_FRAGMENT} AND c.status = 'sent' AND IS_DEFINED(c.topicTag)`,
        parameters: [{ name: '@tid', value: teacherId }],
      })
      .fetchAll();
    if ((resources[0] || 0) > 0) eligible.push('population_intro');
  }

  // apst_intro / mypd_intro / ai_generation_intro: flag-gated, no milestone query needed — once
  // their flag flips on, every teacher who hasn't dismissed the key is eligible immediately
  // (ai_generation_intro is explicitly NOT gated on profile completeness).
  if (checkable('apst_intro')) eligible.push('apst_intro');
  if (checkable('mypd_intro')) eligible.push('mypd_intro');
  if (checkable('ai_generation_intro')) eligible.push('ai_generation_intro');

  if (checkable('community_intro')) {
    const { resources } = await quizzesContainer.items
      .query({
        query: `SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND ${EXCLUDE_DEMO_FRAGMENT}`,
        parameters: [{ name: '@tid', value: teacherId }],
      })
      .fetchAll();
    if ((resources[0] || 0) >= COMMUNITY_QUIZ_THRESHOLD) eligible.push('community_intro');
  }

  // Preserve CANDIDATE_KEYS priority order regardless of the order the checks above ran in.
  return CANDIDATE_KEYS.filter((k) => eligible.includes(k));
}

module.exports = { computeEligibleIntros, CANDIDATE_KEYS, MISCONCEPTION_RESPONSE_THRESHOLD, COMMUNITY_QUIZ_THRESHOLD };
