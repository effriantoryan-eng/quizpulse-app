// v4.2.0 — the nine valid feature-intro keys (progressive disclosure engine). One place, so
// PUT /api/me/feature-intros validation and introEligibility.js milestone rules can never drift
// out of sync on what keys exist (the community_intro/profile_nudge count — the .docx enumerates
// eight; profile_nudge is the ninth, per the CEO review addendum §2).
//
// v4.6.0 adds a TENTH, synthetic key — 'getting_started' — for the first-run checklist (Task 3).
// It is NOT a FeatureIntroCard candidate (see introEligibility.js's CANDIDATE_KEYS, which
// deliberately omits it — the checklist is its own UI component, not a promo card) but it reuses
// this same key-validation list and the PUT /api/me/feature-intros dismiss/shown path so the
// checklist's release/dismiss moment persists through the identical ETag-replace mechanism.
const FEATURE_INTRO_KEYS = [
  'demo_intro',
  'analytics_intro',
  'community_intro',
  'misconception_intro',
  'population_intro',
  'apst_intro',
  'mypd_intro',
  'ai_generation_intro',
  'profile_nudge',
  'getting_started',
];

function isValidIntroKey(key) {
  return typeof key === 'string' && FEATURE_INTRO_KEYS.includes(key);
}

module.exports = { FEATURE_INTRO_KEYS, isValidIntroKey };
