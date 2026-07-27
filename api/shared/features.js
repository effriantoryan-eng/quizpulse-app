// Feature flags gating work not yet built. v4.1.0 flipped FEATURE_APST_EXPORT (done);
// v4.3.0 flips FEATURE_AI_GENERATION (done) — see CEO review addendum §1 process amendments. A
// flag-dark key's intro card (apst_intro, mypd_intro, ai_generation_intro) is treated as
// dismissed by introEligibility.js so it can never appear before its sprint ships.
const FEATURE_APST_EXPORT = true;
const FEATURE_AI_GENERATION = true;
// v4.6.0 first-run activation chain (demo class + starter pack + auto-send + auto-simulate) and
// its finale/checklist UI. Off -> onboarding exits to /teacher/create exactly as before v4.6.0.
const FEATURE_FIRST_RUN = true;

module.exports = { FEATURE_APST_EXPORT, FEATURE_AI_GENERATION, FEATURE_FIRST_RUN };
