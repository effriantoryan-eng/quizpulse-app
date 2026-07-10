
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

## /qa findings — 2026-07-06 (release/v4.0-analytics)

- [x] **CORS blocked every local API call from the Vite dev server** — `func start` ignores
  `host.json`'s `cors` block (deploy-only); needed a `Host.CORS` entry in
  `api/local.settings.json` (gitignored, so undocumented). Fixed: documented in CLAUDE.md's
  "Running locally" section, applied locally. Verified: preflight now returns 204 with the right
  `Access-Control-Allow-Origin` header, no more console CORS errors on any page load.
- [x] **`npm run test:integration` was completely broken** — `cross-env` was used in the script
  but never in `package.json`/`node_modules`, so the command failed immediately on Windows.
  Fixed: `npm install --save-dev cross-env`. Verified the script now runs (see below for what it
  revealed).
- [x] **CRITICAL — integration tests ran against the real production Cosmos DB, not an
  emulator.** `api/local.settings.json`'s `COSMOS_ENDPOINT` points at the live
  `quizpulse-app-db-av5z18` instance (no local emulator was configured — this matches the existing
  "Cosmos DB IP restriction skipped" known issue, and contradicted CLAUDE.md's own Testing section,
  which claimed integration tests ran "vs local Cosmos emulator" — that emulator never existed).
  The first `npm run test:integration` run (right after fixing cross-env) wrote real
  teacher/school/class/join-request/response test documents into production. **Fixed:** since
  Docker wasn't available for a local emulator, provisioned a dedicated free-tier Cosmos DB
  account (`quizpulse-int-test-db` in `quizpulse-test-rg`, same containers/partition keys as prod,
  $0/mo under the free allowance) — see `docs/azure/INFRASTRUCTURE.md`. Verified isolation: ran
  the full 118-test suite against it with `COSMOS_ENDPOINT`/`COSMOS_KEY` overridden to
  `TEST_COSMOS_ENDPOINT`/`TEST_COSMOS_KEY` (see CLAUDE.md's Testing section for the exact steps),
  confirmed via direct query that writes landed in the test DB (`classes` container had 20 new
  docs matching the run). Same 24/118 failures reproduced against this clean, empty DB — proving
  they're a pre-existing test/rate-limiter issue, not caused by dirty prod data (see next item).
- [ ] **Someone still needs to manually check production Cosmos for stray test documents** from
  the one run that happened before this was caught — `teachers`/`schools`/`classes`/
  `join_requests`/`responses` in `quizpulse-app-db-av5z18`, likely identifiable by `oid`/`teacherId`
  values matching test patterns like `integ-*`. Not done in this session (required explicit
  read-access approval for production that wasn't given).
- [ ] **MEDIUM — 24/118 integration tests fail due to the 30 req/min rate limit, not real bugs.**
  Confirmed root cause: `api/classes.js` (and others) call `rateLimit(`classes:${ip}`, 30, 60000)`
  keyed only by client IP, and Jest fires all integration tests from one process/IP with no
  throttling or delay — reproduces identically on a totally clean, empty test DB. Symptom:
  `TypeError: classes.find is not a function` (a `429` error body returned where an array was
  expected) and similar. Needs either a test-mode rate-limit bypass (e.g. skip when
  `NODE_ENV=test` or a dedicated header) or spacing out requests in the slower test files
  (`joinRequests.test.js`, `v3-3.test.js`, `sprint5.test.js`). Not fixed in this session — touching
  the shared rate limiter needs its own careful pass, not a QA-session drive-by.
- [ ] **HIGH — "Sign in with Google" button doesn't authenticate via Google at all.**
  `src/pages/Login.jsx` sends `domain_hint: 'google.com'` to CIAM, but the Google identity
  provider was never actually configured in the `quizpulseid` CIAM tenant (contradicts
  `docs/azure/B2C_SETUP.md`'s claim that "sign-in works end to end (Microsoft + Google)" — verified
  live in this session: clicking it lands on the generic unbranded CIAM email-entry form, not a
  Google consent screen, with zero error/indication anything went wrong). This is a portal/tenant
  config gap, not fixable from source — needs the Google Cloud OAuth client + CIAM IdP setup in
  `docs/azure/B2C_SETUP.md`'s "Google" section actually completed. Until then, consider hiding the
  button (same treatment as Apple ID, which is correctly not shown pending its own portal setup).
