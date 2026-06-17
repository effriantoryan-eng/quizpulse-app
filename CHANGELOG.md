# Changelog

All notable changes to QuizPulse are documented in this file.

## [v3.0.1] — Polish release: sign-in fix, copy cleanup, encouragement, mockups

### Bug fixes

- **Sign-in broken in production (CSP).** `staticwebapp.config.json` `connect-src` listed
  `*.b2clogin.com` (old Azure AD B2C domain) instead of `*.ciamlogin.com` (Entra External ID).
  MSAL's OIDC discovery fetch was blocked, causing all sign-in buttons to silently do nothing.
  Fixed: `connect-src` now includes `https://*.ciamlogin.com`; `frame-src` added for
  `*.ciamlogin.com` and `login.microsoftonline.com` to support MSAL's silent token iframe.
  Diagnosis in `docs/fixes/SIGNIN_DIAGNOSIS.md`.
  **Portal action still required:** verify `https://nice-field-0127b5b00.7.azurestaticapps.net`
  is registered as a redirect URI in the Entra External ID app registration.

### Improvements

- **No-jargon UI copy.** Swept all user-facing rendered strings in `src/` for technical
  implementation terms (push subscription, Azure, server error codes, VAPID, etc.) and replaced
  with plain language. Affected files: `Subscribe.jsx`, `TakeQuiz.jsx`, `SendQuiz.jsx`,
  `QuestionBank.jsx`, `DemoGallery.jsx`. Code identifiers and data-model fields unchanged.
- **Generic product positioning.** Removed Victorian-secondary-specific framing from all
  user-facing strings. Renamed "demo" → "beta" in rendered UI (nav badge, home page CTA and
  callout, gallery card badge). Files: `DemoNav.jsx`, `Home.jsx`, `DemoGallery.jsx`, `CLAUDE.md`.
- **Quiz completion encouragement.** After submitting a quiz, students now see one randomly
  chosen effort/participation line from `src/data/encouragements.js` (10 entries, placeholder
  for future curation). Framing is effort-focused — no ability language, no score reference.
- **Mockup reference file.** `quizpulse_mockups_v301.html` added to project root: a
  self-contained clickable index of 5 screens (completion, lock-screen notification, participation,
  community bank, analytics). Reference artifact only — not part of the build.

### Tests

- E2E regression test added to `tests/e2e/auth.spec.js` asserting sign-in button navigates
  toward `ciamlogin.com` (catches the CSP regression without needing full credentials).
- Unit tests added in `tests/unit/encouragements.test.js` (6 assertions): array length = 10,
  all entries are plain text, no ability-focused words, selection logic correctness.
- Full unit suite: 137/137 passing (was 102 before v3.0.1; +35 from encouragements + existing
  sprint 6 tests all still green).

---

## [v3.0.0] — Sprint 6: community bank, SWA Standard, APIM, Apple ID, analytics depth

### Breaking changes

- **`src/api.js` `API_BASE` in production changes from the direct Function App URL to `/api`.**
  Any client code, scripts, or browser bookmarks pointing to
  `https://quizpulse-app-api-av5z18.azurewebsites.net/api/...` must update to the SWA hostname
  (`https://nice-field-0127b5b00.7.azurestaticapps.net/api/...`). This requires the SWA Standard
  tier upgrade and linked backend to be provisioned before deploying (see
  `docs/azure/SWA_STANDARD_UPGRADE.md`). **Do not deploy the v3.0.0 frontend before completing
  those portal steps** or all API calls will 404.

### New features

#### SWA Standard tier (`feat/s6-swa-standard-tier`)
- `src/api.js`: production `API_BASE` is now `/api` (relative, proxied by SWA linked backend).
- `staticwebapp.config.json`: explicit `/api/*` rewrite route removed; Function App origin
  removed from CSP `connect-src` (browser never calls it directly anymore).
- `docs/azure/SWA_STANDARD_UPGRADE.md`: portal steps for tier upgrade, backend linking,
  CORS cleanup, deploy order, and rollback procedure.

#### Community question bank (`feat/s6-community-bank`)
- `GET /api/questions?visibility=school|public`: paginated community browse (50/page, `?offset`).
  School mode queries teachers in the same school via a two-step DB lookup.
  Supports `?topic=`, `?year=` (7–12), `?q=` (text search) filters.
- `PUT /api/questions/{id}`: now accepts a `visibility` field (`private|school|public`).
  Enforces 500 public questions per teacher. `platform_admin` can unpublish any question
  by sending `{ "visibility": "private" }` only (moderation action).
- `POST /api/questions/{id}/copy`: creates a private clone of any school/public question.
  Increments `usageCount` on the original (best-effort).
- `POST /api/questions/{id}/upvote`: toggles upvote (1 per teacher per question). Uses the
  new `question_upvotes` Cosmos container (pk `/questionId`).
- `POST /api/questions/{id}/report`: flags a question for moderation. Rate-limited to 20
  reports/teacher/day. Uses the new `question_reports` container (pk `/questionId`).
- `GET /api/questions/reports`: moderation queue (support/platform_admin/owner only).
- `POST /api/quizzes`: increments `usageCount` on each referenced question (best-effort,
  fire-and-forget).
- All new questions now include `upvoteCount: 0`, `usageCount: 0`, `yearLevel: null` fields.
- `POST /api/questions`: now enforces the 2000-questions-per-teacher limit explicitly.
- Frontend: `QuestionBank.jsx` Community tab unlocked — School/Public mode toggle, search,
  topic, and year-level filters, per-card upvote toggle + "Copy to mine" + report actions.
  Visibility pill on My Questions cycles `private → school → public` on click. Edit form
  includes `yearLevel` (7–12) and `visibility` selectors.
- Frontend: `CreateQuestion.jsx` adds year level selector (Years 7–12, optional).

#### Azure API Management (`feat/s6-api-management`)
- `api/rateLimit.js`: in-memory sliding-window store removed. `rateLimit()` is now a no-op
  (always returns true) — Azure API Management enforces limits at the gateway.
- `api/schoolAdmin.js`: school-merge serialisation lock moved from `rateLimit()` to a
  module-level boolean (`mergeInProgress`) — this is a concurrency guard, not throughput limiting.
- `api/joinRequests.js`: join-code brute-force protection (10 wrong attempts/IP/hr) retained at
  the application layer with a dedicated `joinBruteForce()` sliding-window function, separate from
  `rateLimit.js`.
- `docs/azure/APIM_SETUP.md`: portal guide to create the Consumption-tier APIM instance, import
  the Function App, and configure inbound rate-limit policies for all endpoints from the security
  limits table.

#### Apple ID auth (`feat/s6-apple-id-auth`)
- `docs/azure/APPLE_ID_SETUP.md`: step-by-step guide for Apple Developer Portal (App ID,
  Services ID, private key), Azure Key Vault secret, and Entra External ID CIAM tenant
  configuration. No frontend or backend code changes required.

#### Analytics depth (`feat/s6-analytics-depth`)
- `GET /api/analytics?quizId=` now includes a `timeline` field: cumulative response counts
  in 5-minute buckets from `quiz.sentAt` — `[ { minutesElapsed, cumulativeCount } ]`.
- `GET /api/analytics/class/{classId}?topic=` (new): returns all sent quizzes targeting this
  class with per-quiz `responseCount`, `approvedStudents`, and `responseRate` (%). Optional
  `?topic=` filter restricts to quizzes containing at least one question with that topic.
  Ownership-gated via `assertScope` on the class document.
- Frontend: `Analytics.jsx` adds a `TimelineChart` SVG component above the per-question
  breakdown, showing cumulative responses over time since the quiz was sent. Updates every 3 s
  with the existing poll cycle.

### New containers (must be provisioned before deploying)
- `question_upvotes` (pk `/questionId`) — env `COSMOS_CONTAINER_QUESTION_UPVOTES`
- `question_reports` (pk `/questionId`) — env `COSMOS_CONTAINER_QUESTION_REPORTS`
- Provisioning steps: `docs/azure/SPRINT6_CONTAINERS_SETUP.md`

### Test changes
- 27 new unit tests in `tests/unit/api/communityBank.test.js`: visibility scoping,
  moderation role gating, upvote idempotency, visibility transitions, yearLevel validation.
- `rateLimit.test.js`: updated to test the no-op + `getClientIp` behaviour.
- `joinBruteForce.test.js`: tests inline sliding-window logic (no longer imports `rateLimit.js`).
- `subscribe.test.js`: in-process 429 test removed; approval-gate tests preserved.
- `sendNotification.test.js`: in-process 429 test removed; idempotency tests preserved.
  Added payload >3 KB → 413 test.
- All 130 unit tests pass.

## [v2.1.0] — Sprint 5: security foundation + admin/institution/monitoring endpoints

Security audit and authorization hardening, followed by the institution/admin/monitoring
endpoints it was the prerequisite for. Backend only — the admin frontend is Sprint 7.

### Breaking changes

- **Ownership-mismatch responses changed from `403` to `404`** across `classes.js`, `questions.js`,
  `quizzes.js`, `joinRequests.js`, `analytics.js`, and `sendNotification.js`. A 403 confirmed a
  resource exists but isn't the caller's; 404 reveals nothing. Any client code asserting on `403`
  for a cross-tenant access attempt must be updated to expect `404`.
- **`GET /api/responses?quizId=` removed entirely.** It was unauthenticated dead code (unused by
  the frontend) that leaked raw student answers — see Security fixes below. `/api/responses` is
  now `POST`-only (student submission). Teacher-facing response data is `GET /api/analytics`.

### Security fixes

- **Critical:** `GET /api/responses?quizId=` had no authentication or ownership check at all,
  leaking every student's raw quiz answers to anyone who had a `quizId`. Deleted outright rather
  than secured-and-kept, since it was dead code.
- **High:** `GET /api/usageLog` returned an unfiltered, platform-wide dump of every teacher's
  data gated only by a Function key. Now also requires a privileged role claim
  (`owner`/`support`); a non-privileged caller gets 404.
- `GET /api/quizzes/{id}/questions` had no rate limiting; added the standard 30 req/min/IP limit.
- `join-requests/{id}/reject` now re-verifies the loaded request belongs to the calling teacher
  (defense-in-depth, matching the `approve` path) rather than only checking class ownership.
- `subscribe.js` no longer logs `deviceId`/`classId` on a successful subscription (no operational
  need to log a per-student identifier).

### New features

- `api/shared/authz.js` — the central authorization helper (`getCallerScope`, `assertScope`,
  `requireRole`). Role tiers: `support` is read-all/mutate-none (`assertScope`'s bypass only
  applies to mutations for `owner`/`platform_admin`), `platform_admin` may perform operational
  mutations, `owner` does everything including destructive actions. See "Authorization model" in
  `CLAUDE.md`.
- `PUT /api/manage/teachers/{id}/role` — the only way a teacher's `role` field may change,
  gated on an `owner` role claim. No caller can reach `owner` yet (claim not configured — see
  `docs/azure/ROLE_CLAIMS_SETUP.md`), so this is unreachable until that configuration lands,
  by design.
- `api/shared/auditLog.js` — append-only `audit_log` container (`writeAudit()`), no update/delete
  code path. Written by every admin mutation below.
- `api/shared/stepUp.js` — step-up re-auth guard (`assertStepUp`) verifying a signed
  `auth_time`/`iat` claim is within the 10-minute window; gates the destructive school-merge
  endpoint ahead of the Sprint 7 UI that will trigger re-auth.
- `POST /api/manage/schools/{id}/validate` (owner/platform_admin) and `POST
  /api/manage/schools/merge` (owner only, step-up gated) — re-points `teachers`/`classes` by
  `schoolId` sequentially, tombstones the source via `mergedIntoId`.
- `POST /api/manage/institutions`, `POST /api/manage/institutions/{id}/invite`, `POST
  /api/invites/{token}/redeem` — institution onboarding and one-time, 7-day-expiry teacher
  invites (50-pending cap per school).
- `GET /api/manage/metrics?range=` and `GET /api/manage/logs/export?type=` (owner/support) — the
  metrics endpoint is **stubbed** (no `@azure/monitor-query` SDK or App Insights credentials in
  this environment yet — real shape, placeholder values, see TODO in `api/metrics.js`); logs
  export streams real JSONL from `audit_log` for `type=security`, and returns `501` for
  `type=errors|usage` rather than fabricating data.
- `teacher.js`'s onboarding handler now explicitly rejects a `role` field in the request body
  (400) instead of silently ignoring it.
- New test category: cross-tenant access denial (`tests/integration/api/sprint5.test.js`,
  37 tests) — every Sprint 1–4 resource type plus every new Sprint 5 admin endpoint.
- `tests/unit/api/authz.test.js`, `auditLog.test.js`, `stepUp.test.js`, `metrics.test.js` — unit
  coverage for the new authorization/audit/step-up primitives.

### Docs

- `docs/security/SPRINT5_AUDIT.md` — full audit: endpoint inventory, IDOR findings, role
  escalation check, JWT validation review, CORS check, logging/secrets/mass-assignment review.
- `docs/azure/ROLE_CLAIMS_SETUP.md` — manual Entra External ID portal steps to emit `role` (and
  later `schoolId`) as a signed token claim.
- `docs/azure/SPRINT5_CONTAINERS_SETUP.md` — manual Cosmos container provisioning steps for
  `audit_log` and `invites` (no IaC in this repo).

## [v2.0.0] — Sprint 4

### Breaking changes

- **`POST /api/simulate` removed.** Simulated student responses are no longer generated when
  a teacher sends a quiz. Analytics now reflect only real student submissions. Any client code
  or scripts calling `/api/simulate` must be updated — the endpoint returns 404.

### New features

- Real student quiz-taking flow at `/quiz?quizId=` (`TakeQuiz.jsx`) — students answer all
  questions on one screen and submit without authentication.
- `POST /api/responses` now enforces: approved join-request ownership (403), duplicate
  submission per student per quiz (409), quiz closed state (410), and a 4 KB body cap (413).
- Quizzes carry a `closedAt` timestamp, set from a teacher-configured duration (minimum 5
  minutes) at send time. Closed quizzes reject new responses.
- Offline resilience: the service worker queues failed response submissions in IndexedDB and
  flushes them via Background Sync (`sync-responses`) once connectivity returns.
- Live analytics: `GET /api/analytics` joins real responses with question option text, polled
  every 3 seconds in `Analytics.jsx`. Adds an "X / Y responded" counter, a non-responder list,
  and a CSV export (rate-limited to 10 exports/teacher/hour).
- Quiz scheduling: a timer-triggered function sends scheduled quizzes automatically once their
  `scheduledFor` time has passed. `SendQuiz.jsx` exposes a functional date/time picker. Capped
  at 50 pending scheduled quizzes per teacher.

### Bug fixes

- None in this sprint.
