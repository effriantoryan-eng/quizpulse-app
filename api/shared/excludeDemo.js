// Demo-class isolation — the ONE place the "exclude demo data" rule is defined (v3.3.0).
//
// Any reporting/monitoring endpoint that aggregates across teachers (metrics, logs export,
// school-wide student totals) MUST exclude demo-class data, so a teacher poking at a demo class
// can never skew platform-wide numbers. Per-teacher views (an individual teacher's Analytics for
// their own demo class) are EXEMPT — that teacher is looking at their own demo data on purpose.
//
// Import EXCLUDE_DEMO_FRAGMENT (or andExcludeDemo) here rather than re-typing the predicate, so
// the rule stays consistent and can't drift between endpoints.

// Cosmos predicate against a container whose docs may carry an `isDemo` flag (classes, quizzes,
// responses). Demo docs are `isDemo = true`; everything else — including legacy docs written
// before v3.3.0 that have no field at all — is kept.
const EXCLUDE_DEMO_FRAGMENT = '(c.isDemo = false OR NOT IS_DEFINED(c.isDemo))';

// Appends the exclusion as an AND clause to an existing WHERE body (without the WHERE keyword),
// or returns the bare predicate when there are no other conditions.
//   andExcludeDemo('')                       -> "(c.isDemo = false OR NOT IS_DEFINED(c.isDemo))"
//   andExcludeDemo('c.teacherId = @tid')     -> "c.teacherId = @tid AND (c.isDemo = false OR ...)"
function andExcludeDemo(existing) {
  return existing && existing.trim()
    ? `${existing} AND ${EXCLUDE_DEMO_FRAGMENT}`
    : EXCLUDE_DEMO_FRAGMENT;
}

// True when a class document is a demo class. Use when filtering already-fetched docs in code
// (e.g. dropping audit_log entries whose target class is a demo class).
function isDemoClass(cls) {
  return !!cls && cls.isDemo === true;
}

module.exports = { EXCLUDE_DEMO_FRAGMENT, andExcludeDemo, isDemoClass };
