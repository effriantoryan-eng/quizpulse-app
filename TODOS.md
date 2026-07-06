
## Design debt — v4.0.0 Analytics (from /plan-design-review 2026-07-03)

- [ ] **Screen-reader ARIA for the four-cell segmented chart** — add role + aria-label so SR users
  hear the four counts (correct-confident / correct-unsure / incorrect-confident / incorrect-unsure)
  per question. D4's visible legend + counts cover sighted low-vision users; this covers SR users.
  Blocked by: v4.0.0 chart shipping. File: src/pages/teacher/Analytics.jsx.

## Ponytail debt (from /ponytail-debt 2026-07-04)

Three `ponytail:` markers found, none naming a ceiling/upgrade trigger — tighten or drop the prefix:

- [ ] `api/analytics.js:85` — a device approved in two target classes counts once (dedup via `Map`)
  rather than surfacing as a cross-class overlap case. No revisit condition named.
- [ ] `api/responses.js:149` — replaces a prior SELECT-then-create pattern that had a race window.
  Doesn't say what's still unhandled or when to revisit. (Line shifted 154→149 after the
  2026-07-06 review removed dead code above it.)
- [ ] `api/subscribe.js:49` — SSRF guard restricts push-subscription endpoints to `https://` only.
  No note on what a fuller guard (private-IP/allowlist checks) would look like or when it's needed.

## Review follow-ups — /review 2026-07-06 (advisory, not yet fixed)

The review's 7 findings were all fixed on `release/v4.0-analytics` (see CHANGELOG v4.0.0). These
three came out of the same pass but were left as follow-ups:

- [ ] `api/analyticsPopulation.js` — the population point-read's `.catch(() => ({ resource: null }))`
  swallows ALL Cosmos errors: a 503/throttle renders as "No benchmark data for {topic} yet"
  instead of an error. Distinguish 404 (genuinely unseeded) from other failures.
- [ ] `api/analytics.js` `classAnalytics` — only analytics endpoint with no `rateLimit(...)` call
  (`analytics` and `analyticsExport` both have one). Add for consistency.
- [ ] Integration tests for `GET /api/analytics/class/{classId}` — the endpoint had zero coverage,
  which is how the cross-class rate inflation shipped in Sprint 6 and survived to v4.0.0. Cover:
  single-class quiz, multi-class quiz (rate must not exceed 100%), demo class, cross-tenant 404.
