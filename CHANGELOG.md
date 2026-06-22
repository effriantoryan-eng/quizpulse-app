# Changelog

All notable changes to QuizPulse are documented in this file.

## [v3.2.2] — Polish (PATCH)

### Bug fixes

#### Roster approval restored (`fix/v3.2.2-roster-approval-diagnosis`)
- `api/joinRequests.js`: restored the `rateLimit` import dropped by the Sprint 6 APIM migration
  (commit `f72f270`), which had removed it from the require while leaving the four `rateLimit(...)`
  call sites. Every authed join-request handler (approve, approve-batch, reject, list) was throwing
  `ReferenceError: rateLimit is not defined` → generic **500**, so teachers could not approve
  students into the roster. (Same class of bug previously fixed in `schoolAdmin.js` in v3.1.0;
  `joinRequests.js` was the last file still carrying it.)
- Full diagnosis with candidate causes ruled out: `docs/fixes/ROSTER_APPROVAL_DIAGNOSIS.md`.
- Regression guard: `tests/integration/api/v322-roster-approval.test.js` (owner approve → 200/
  `approved`; cross-tenant approve → 404).

### Information architecture

#### Two-path public landing (`feat/v3.2.2-public-landing-split`)
- `src/pages/Home.jsx` rewritten as a two-path landing: a student card (**Join a class** → `/join`)
  and a teacher card (**Sign in** / **Create account** via `loginRequest` / `signUpRequest`), with a
  **Preview gallery** link in the header. Brand accents `#534AB7` / `#EEEDFE`. Authenticated teachers
  are redirected to their dashboard and never see the landing.
- `src/components/DemoNav.jsx` (new): branches on `AuthContext.isAuthenticated` — signed-out
  visitors get a minimal rail (logo + Preview gallery link only); signed-in teachers get the existing
  `Sidebar` unchanged. `App.jsx` renders `DemoNav` in the shell.
- Sixth mockup screen **"Public landing — v3.2.2"** added to `quizpulse_mockups_v301.html`.

### Install support

#### Add-to-phone (`feat/v3.2.2-pwa-install`)
- `src/hooks/usePwaInstall.js`: `{ canInstall, install, isInstalled, platform }`. Handles
  `beforeinstallprompt` (preventDefault + stash → native), `appinstalled`, iOS detection, and
  already-installed (`display-mode: standalone` / `navigator.standalone`).
- `src/components/InstallButton.jsx`: branches on platform — `native` → **"Add to your phone"**
  button (never "Install"/"Download"); `ios` → reuses the Sprint 3 add-to-home-screen guide;
  `unsupported` or already-installed → renders nothing. Placed below the cards on Home and above
  the join-code form on JoinClass (lock-screen check-ins require the installed app on iOS).

### Tests
- New: `tests/unit/usePwaInstall.test.js`, `tests/unit/demoNav.test.js`,
  `tests/integration/api/v322-roster-approval.test.js`, `tests/e2e/v322.spec.js`.
- Report: `tests/reports/v3.2.2-report.html`. Checklist: `SPRINT_TEST_CHECKLIST.md` (v3.2.2 section).

## [v3.1.0] — Sprint 7: admin portal

Separate admin portal site (`admin/`) built on React + Vite, deployed to its own Azure SWA
and authenticated via its own Entra External ID app registration. Shares the existing
Function App backend (Sprint 5 admin endpoints) via CORS. The teacher app receives no admin
code.

### New features

#### Admin CIAM audience separation (`feat/s7-admin-ciam-app`)
- `api/auth.js`: added `authenticateAdmin()` — validates bearer tokens against
  `ADMIN_AUTH_CLIENT_ID` (a separate CIAM app registration from the teacher app's
  `AUTH_CLIENT_ID`). A teacher-app token sent to an admin endpoint now returns **401** (audience
  mismatch), and vice versa.
- `verifyTokenForAudience(token, audience)`: factored out from `verifyToken` — accepts the
  expected audience as a parameter so both `authenticateTeacher` and `authenticateAdmin` can
  share the same DEV_MODE / production code paths.
- DEV_MODE audience check: in decode-only mode the `aud` claim is checked only when both the
  token carries one AND the expected audience env var is configured — backward-compatible with
  all existing tests that mint tokens without an `aud` claim.
- All `/api/manage/*` endpoints switched from `authenticateTeacher` to `authenticateAdmin`:
  `schoolAdmin.js`, `institutions.js` (manage routes only — `inviteRedeem` stays teacher-auth),
  `metrics.js`, `logsExport.js`, `teacherRole.js`.
- Missing `rateLimit` import in `schoolAdmin.js` fixed (was `ReferenceError` at runtime).
- `docs/azure/ADMIN_CIAM_SETUP.md`: full portal walkthrough — create admin app registration,
  configure redirect URIs and token claims, provision admin SWA, link Function App backend,
  add `ADMIN_AUTH_CLIENT_ID` to Function App settings, optional IP allow-listing.

#### Admin SWA scaffold (`feat/s7-admin-swa-scaffold`)
- `admin/` — separate React + Vite project at port 5174. Operator tooling, not product polish:
  bare tables, forms, inline styles, no CSS frameworks.
- MSAL against the admin CIAM app registration (`VITE_ADMIN_CLIENT_ID`). Token acquisition and
  bearer attachment done via the same `window.fetch` patch pattern as the teacher app.
- **30-minute idle session timeout** (`admin/src/session.js`): `useIdleTimeout` hook tracks
  mouse, keyboard, touch, and scroll activity; warns at 25 min; calls `logoutRedirect` at 30 min.
- `admin/staticwebapp.config.json`: SWA routing fallback, strict CSP (`*.ciamlogin.com` in
  `connect-src` and `frame-src`), security headers (`X-Frame-Options: DENY`, etc.).
- `api/host.json` CORS: added `http://localhost:5174` (admin local dev) and
  `ADMIN_SWA_ORIGIN_PLACEHOLDER` (replace with the actual admin SWA hostname after provisioning).
- `admin/CLAUDE.md`: admin-portal-specific context, tech stack, deploy notes, local dev setup.

#### School admin tools (`feat/s7-admin-school-tools`)
- **`GET /api/manage/schools`** (new — `api/schoolsList.js`): lists all schools paginated
  (50/page), searchable by name, filterable by status. Returns per-school teacher and class
  counts computed in a single pass over all teachers/classes.
- **`GET /api/manage/teachers`** (new — `api/teachersList.js`): lists all teachers paginated,
  searchable by name/email/ID, filterable by schoolId.
- `admin/src/pages/Schools.jsx`: table of all schools with search + status filter + validate
  action. "Merge tool" button navigates to MergeTool.
- `admin/src/pages/MergeTool.jsx`: source/target school selectors (live search), side-by-side
  counts review, destructive-red confirm button. On `{ reauthRequired: true }` response (token
  >10 min old), shows a re-auth prompt that calls `instance.loginRedirect` with `prompt: 'login'`
  to force fresh auth before the caller retries the merge.
- `admin/src/pages/Institutions.jsx`: create validated school (POST /api/manage/institutions)
  and generate one-time 7-day invite links (POST /api/manage/institutions/{id}/invite) with a
  copy-to-clipboard button.

#### Monitoring dashboard (`feat/s7-admin-monitoring-ui`)
- `admin/src/pages/Monitoring.jsx`: time-range selector (Today / 7d / 30d), metric cards for
  all five groups (System health, Usage & growth, Engagement, Security, Spending) with a
  stubbed-metrics banner. Spending shows a progress bar when data is available.
- Log download: date-range pickers + per-type download buttons (Security log downloads real
  JSONL; Error/Usage show as unavailable — same constraint as the backend endpoint).

#### Audit viewer + role management (`feat/s7-admin-audit-viewer`)
- **`GET /api/manage/audit`** (new — `api/auditQuery.js`): paginated, filterable audit log
  query for the admin UI (returns JSON, not JSONL). Filters: actorId, action (CONTAINS match),
  from/to date. Requires owner/support role.
- `admin/src/pages/AuditLog.jsx`: searchable paginated table with actor, role, action, target,
  IP columns. Each row has a "Details" toggle that shows before/after JSON inline.
- `admin/src/pages/RoleManagement.jsx`: paginated teacher list with search. Owner-only "Change
  role" modal cycles through teacher / school_admin / support / platform_admin. Owner role is
  not assignable here (requires Entra app-role configuration). Non-owner callers see a read-only
  view with an explanatory notice.

### Breaking changes

- **All `/api/manage/*` endpoints now require an admin-portal token** (audience =
  `ADMIN_AUTH_CLIENT_ID`). Any existing script or test that calls these endpoints with a
  teacher-app token will receive **401** instead of the previous response. Update scripts to
  mint tokens with `aud = ADMIN_AUTH_CLIENT_ID`, or set `ADMIN_AUTH_CLIENT_ID` to the same
  value as `AUTH_CLIENT_ID` as a temporary workaround (not recommended in production).

### New env vars (Function App)

| Setting | Value |
|---|---|
| `ADMIN_AUTH_CLIENT_ID` | The admin portal CIAM app registration client ID (from ADMIN_CIAM_SETUP.md) |

### Portal steps required before deploying

1. Create the admin app registration per `docs/azure/ADMIN_CIAM_SETUP.md`.
2. Provision the admin SWA, link it to the Function App.
3. Replace `ADMIN_SWA_ORIGIN_PLACEHOLDER` in `api/host.json` with the admin SWA hostname.
4. Add `ADMIN_AUTH_CLIENT_ID` to the Function App application settings.

### Tests

- 9 new unit tests in `tests/unit/api/adminAudience.test.js`: teacher audience accepted by
  `authenticateTeacher` / rejected by `authenticateAdmin`; admin audience accepted by
  `authenticateAdmin` / rejected by `authenticateTeacher`; no-aud tokens pass in DEV_MODE
  (backward compat); cross-portal isolation assertion.
- 11 integration tests in `tests/integration/api/sprint7.test.js`: audience gate on metrics and
  schools endpoints; CORS allow/deny assertions; role assignment owner-gate; audit log endpoint
  role gates. Run with `RUN_INTEGRATION=true`.
- 5 E2E tests in `tests/e2e/sprint7.spec.js`: auth redirect gate; teacher-identity-rejection
  at API level. Run with `RUN_E2E=true`. Full admin flow (merge step-up, log export, role change)
  documented as manual test scenarios.
- Total unit tests: 170 passing across 18 suites (was 161 / 17 suites).
- Report: `tests/reports/sprint7-report.html`.

---

## [v3.2.1] — Sign-up flow

### New features

- **"Create an account" button on the login page.** New teachers who have no CIAM account
  can now register directly from the app. The button calls `instance.loginRedirect` with
  `prompt: 'create'`, which tells Entra External ID (CIAM) to show the account-creation
  form instead of the sign-in form. Same authority, same redirect URI as sign-in — no new
  portal redirect URI registration needed.
- **New-account provisioning handshake is the existing onboarding flow.** After CIAM sign-up
  the app receives a normal `oid`-bearing token, `GET /api/me` returns `{ onboarded: false }`,
  and the user is routed to `/onboarding` to enter their school name. `POST /api/onboarding`
  creates the teacher and school documents with `role: 'teacher'` server-set. The flow is
  identical to what a returning sign-in user would see on first login — no backend changes
  required.
- **Idempotent provisioning.** A second call to `POST /api/onboarding` for the same `oid`
  returns `{ alreadyOnboarded: true }` without overwriting the existing teacher or school
  record. `role` is never settable from the request body (400 if attempted).
- **iOS standalone and in-app browser guidance updated.** Both restricted-environment prompts
  now mention sign-up alongside sign-in so users know to complete account creation in Safari
  or a real browser rather than an embedded WebView.

### Portal action required

Self-service sign-up must be enabled on the Entra External ID external tenant before the
"Create an account" button will work. Steps: `docs/fixes/SIGNUP_SETUP.md` § d.

### Diagnosis

Root cause and full analysis recorded in `docs/fixes/SIGNUP_SETUP.md`. Short version:
`loginRequest` had no `prompt` parameter → CIAM showed a sign-in-only form → new users
hit "account not found" on the CIAM-hosted page. Fix: `signUpRequest` with `prompt: 'create'`.

### Tests

- Unit (10 new): first-time teacher creation with role always `'teacher'`; role field
  rejection (400 for any role in body); idempotency (second call returns `alreadyOnboarded:
  true`, no document overwrite); input validation (missing/blank/overlong schoolName).
- Integration: existing `teacher.test.js` tests already cover the provisioning endpoint
  (`role: 'teacher'`, idempotency, 400 on missing schoolName).
- Total unit tests: 161 passing across 17 suites.
- Report: `tests/reports/signup-report.html`.

---

## [v3.2.0] — Confidence Layer (Sprint A)

Independent formative-assessment feature that adds metacognition data to the existing
quiz flow without adding stakes, friction, or requiring student accounts.

### New features

- **Confidence capture per question.** Students tap one of three coarse levels — Sure /
  Pretty sure / Just guessing — after each answer. Confidence appears once an answer is
  chosen; submission requires both an answer and a confidence rating for every question.
  One tap, no free-text, no score implication.
- **First-time-only explainer.** A one-screen modal teaches the three confidence levels
  the first time a student encounters the selector. Stored in `localStorage`
  (`quizpulse_confidence_explained`) so it shows once per device and never repeats.
- **Response-time capture (best-effort, aggregate only).** `responseTimeMs` is recorded
  per question (proxy: time from first option tap to confidence selection) and
  `quizDurationMs` is recorded for the full quiz (time from component mount to submit).
  Neither value is shown to the student. Neither gates or affects submission. Because all
  questions render on one screen the per-question timer measures engagement-to-commitment,
  not time-to-first-view — treat as a noisy aggregate signal only.
- **Misconception signal in teacher analytics.** `GET /api/analytics` now returns
  `confidentButIncorrect` per question: count of responses where confidence is `sure` or
  `pretty_sure` and the answer is wrong. Analytics.jsx surfaces this as an amber callout:
  "N students were confident but got this wrong — worth revisiting." This is a
  cohort/question-level signal only — individual students are never named or singled out.

### Data model changes

- `responses` container: each answer object now carries `confidence: "sure"|"pretty_sure"|"guessing"`
  (required, server-validated) and optional `responseTimeMs: number`. Top-level optional
  `quizDurationMs: number`. Legacy documents without these fields are tolerated.
- `POST /api/responses`: new validation — `confidence` is required per answer (400 if
  missing or not one of the 3 enum values); `responseTimeMs` and `quizDurationMs` are
  optional non-negative integers bounded to 30 minutes (400 if out of range).

### Tests

- Unit: confidence enum validation (valid → 201; 4th value → 400; missing → 400);
  `responseTimeMs` bounds (negative → 400; >30 min → 400); `quizDurationMs` bounds;
  `confidentButIncorrect` aggregate accuracy for known response sets; legacy responses
  (no confidence field) score 0 correctly.
- Total unit tests: 23 new assertions across `responses.test.js` and `analytics.test.js`.

---

## [v3.0.1] — Polish release: sign-in fix, copy cleanup, encouragement, mockups

### Bug fixes

- **Sign-in broken in production (CSP — desktop).** `staticwebapp.config.json` `connect-src`
  listed `*.b2clogin.com` (old Azure AD B2C domain) instead of `*.ciamlogin.com` (Entra
  External ID). MSAL's OIDC discovery fetch was blocked, causing all sign-in buttons to silently
  do nothing on desktop. Fixed: `connect-src` now includes `https://*.ciamlogin.com`; `frame-src`
  added for `*.ciamlogin.com` and `login.microsoftonline.com` to support MSAL's silent token
  iframe. Full diagnosis: `docs/fixes/SIGNIN_DIAGNOSIS.md`.
  **Portal action still required:** verify `https://nice-field-0127b5b00.7.azurestaticapps.net`
  is registered as a redirect URI in the Entra External ID app registration.

- **Sign-in broken on mobile — three additional causes.** The CSP fix was necessary but not
  sufficient on mobile. Three further fixes applied (branch `fix/v301-signin-mobile`):

  1. **Safari ITP wipes MSAL interaction state** (`src/authConfig.js`). Safari's Intelligent
     Tracking Prevention clears localStorage/sessionStorage on cross-origin navigation, removing
     the nonce/PKCE state MSAL stored before redirecting to CIAM. On return, MSAL can't validate
     the response → `handleRedirectPromise()` resolves null → page loads unauthenticated.
     Fixed: `storeAuthStateInCookie: true` — MSAL stores interaction state in cookies, which
     survive ITP. Covers regular mobile Safari on all recent iOS versions.

  2. **In-app browser WebViews** (`src/pages/Login.jsx`). If the app is opened from a link
     inside Facebook, Instagram, LinkedIn, WhatsApp, Twitter/X, TikTok, Line, Snapchat, or a
     generic Android WebView, OAuth redirects are intercepted or blocked. Sign-in buttons now
     hidden in these environments; a "Please open in Safari or Chrome" message is shown with a
     copy-link button. Detected via navigator.userAgent at render time.

  3. **iOS PWA standalone mode — separate data partition** (`src/pages/Login.jsx`). When the
     app runs from the home screen (standalone), iOS opens the CIAM URL in Safari (external
     origin). After auth, CIAM redirects back into Safari — not the PWA. iOS 16.4+ gives PWA
     home-screen apps a separate localStorage partition, so MSAL's stored account in Safari is
     invisible to the PWA. Fixed: when standalone + iPhone/iPad is detected, sign-in buttons are
     replaced with "Sign in via Safari first" guidance and an "Open in Safari" link.

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

- E2E regression tests in `tests/e2e/auth.spec.js`:
  - Desktop redirect regression (catches stale CSP — no credentials needed)
  - Mobile viewport (390×844) redirect regression
  - In-app browser detection suite: Facebook UA shows prompt, Instagram UA shows prompt,
    standard mobile Safari UA shows normal buttons
  - iOS standalone suite: iOS + standalone shows "Sign in via Safari first" guidance;
    Android + standalone shows normal sign-in buttons
- Unit tests added in `tests/unit/encouragements.test.js` (6 assertions): array length = 10,
  all entries are plain text, no ability-focused words, selection logic correctness.
- Full unit suite: 137/137 passing (was 102 before v3.0.1).

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
