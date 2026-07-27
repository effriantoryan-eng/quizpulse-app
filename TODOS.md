
## /code coding session — v4.6.0 Tasks 1-8 complete, live-verified (2026-07-27)

Built, unit-tested, AND live-verified Tasks 1-8 of `CC_PROMPTS_v460.md` directly on `main` (no
release branch yet). 459/459 unit tests pass, clean `npm run build`. Full onboarding → finale →
ready-made lane → payoff screen → Home walked live against production Cosmos via
`dev-teacher-001` (local `func start`, no console errors). CLAUDE.md updated throughout (v4.6.0
blurb rewritten to reflect completion, feature status, Known issue #15, roadmap #13). `graphify
update .` re-run after the new frontend files landed (1286 nodes, 2084 edges).

- [x] **Task 1 — `POST /api/onboarding/first-run`** (`api/onboardingFirstRun.js`,
  `api/shared/firstRun.js`). Code-reviewed pre-live-test and fixed 3 findings: hardcoded
  `classSize` → now derived from the resolved demo class's real roster; dead-code removal of
  `nextFirstRunStep`; `FIRST_RUN_DEMO_STUDENT_COUNT` duplicate constant removed in favor of
  `api/shared/demoNames.js`'s `DEMO_STUDENT_COUNT`. **Found live (not caught by unit mocks):**
  `getOrCreateQuiz` returned `undefined` for a brand-new quiz because Cosmos's `item().read()`
  doesn't throw on a missing item in this SDK setup — fixed to check `resource` truthiness.
- [x] **Task 2 — starter pack** (`api/shared/starterPack.js`, `api/questionsStarterSeed.js`).
- [x] **Task 3 — Getting Started checklist state** (`api/shared/gettingStarted.js`), wired into
  `GET /api/me` + `PUT /api/me/feature-intros` (new `skip-step` event). Design corrected before
  live testing: `computeGettingStarted` no longer short-circuits `steps: null` on `releasedAt`
  (only on `dismissedAt`) — the collapsed strip needs a live "N of 5" count.
- [x] **Task 4 — first-run finale UI + checklist rendering** (`src/pages/FirstRunFinale.jsx`,
  `src/components/GettingStartedChecklist.jsx`), route `/teacher/first-run`. Live-verified.
- [x] **Task 5 — Tier 2 unbreakable flow**: BuildQuiz "Save & go to send" now persists a real
  draft quiz doc and hands off by `?quizId=` URL (survives refresh); PendingRequests auto-selects
  or offers an in-place picker instead of bouncing to Classes.
- [x] **Task 6 — starter-seed empty-state CTA** (`src/components/StarterSeedCta.jsx`) in
  BuildQuiz/QuestionBank empty states.
- [x] **Task 7 — demo simulation misconception bias** (`api/shared/runSimulation.js`).
  Live-confirmed: 28% misconception concentration on the payoff screen.
- [x] **Task 8 — activation funnel script** (`api/scripts/activationFunnel.js`).
- [x] **Real production bug found and fixed via live testing, unrelated to v4.6.0's own new
  code but blocking it:** `api/sendNotification.js`'s demo branch has silently clobbered
  `confidenceResponseCount` on EVERY demo-quiz send since v4.2.0 — `runSimulation()` patches that
  field directly in Cosmos, then the demo branch upserted the stale in-memory `quiz` object right
  after, wiping the patch back to undefined. Never noticed because Analytics counts responses
  directly, not via this counter — but it silently broke `analytics_intro`/`misconception_intro`
  eligibility for demo-only usage and would have broken the new `results-seen` checklist step.
  Fixed to patch `notificationSentAt` instead of upserting; regression-guarded in
  `tests/unit/api/demoSendNotification.test.js`. **Worth a closer look**: check whether any
  historical demo quizzes in production have a permanently-missing `confidenceResponseCount` as a
  result — not fixed retroactively, only prevented going forward.
- [ ] **rc1 ship gates still outstanding:** run `tests/integration/api/v460-first-run.test.js` for
  real against `quizpulse-int-test-db` (written but unrun — CLAUDE.md Known issue #15);
  starter-pack content review to the `apstContent.js` bar; the skip-path and injected
  mid-chain-failure-recovery legs of the E2E walk (only the fast/happy path was live-tested).
- [ ] **v4.6.1 (Tasks 9-11 — projector join screen, first-result annotation, Home quick-start
  card).** Entirely untouched.
- [ ] **v4.6.1 (Tasks 9-11 — projector join screen, first-result annotation, Home quick-start
  card).** Entirely untouched.

## E1 dogfood findings — v4.6.0 step zero (2026-07-27)

- [ ] **Mock provider distractor quality: plural/case-variant and stopword leakage (P3, S).**
  **What:** `api/shared/llmProviders/mock.js`'s `extractKeyTerms`/term-pool logic occasionally
  produces two options that are trivially the same term (e.g. "Plant" and "plants" as separate
  distractors on one question), and occasionally lets a generic connector word slip through as
  a distractor (e.g. "around") rather than a real topic term. **Why:** weakens a draft question
  as an "editable starting point" — a student could reasonably infer two distractors are the
  same thing, or spot the non-topic word as an obvious wrong answer, defeating the point of
  having 3 real distractors. **Context:** observed live during the step-zero E1 dogfood
  (2026-07-27) against 3 real worksheets on production — did not block the go/no-go verdict
  (E1 shipped in scope regardless; teachers review/edit every AI-drafted question before
  approving, so this is a quality nit, not a correctness bug). Fix would extend the `STOPWORDS`
  set and/or dedupe term-pool entries by a normalized (lowercased, singularized) form before
  building the option set. **Depends on:** none — isolated to `mock.js`.

## Deferred from CEO review — v4.6.0 First-Run Activation (from /plan-ceo-review 2026-07-27)

Full decision record: `~/.gstack/projects/effriantoryan-eng-quizpulse-app/ceo-plans/2026-07-27-v460-first-run-activation.md`
(assessment: `C:\Users\Ryan\Doc\Quizpulse\UX_FRICTION_ASSESSMENT_2026-07.md`). All four items
below were explicitly deferred during the review's opt-in ceremony / outside-voice pass — they
are recorded decisions, not open questions.

- [ ] **Subject-matched starter question packs (post-v4.6.0, P3, S).**
  **What:** 4 more curated 5-question packs (Science/Maths/English/Humanities) keyed off the
  profile `subjects` enum, extending the single generic pack v4.6.0 ships. **Why:** makes the
  first-run demo quiz feel personal. **Context:** trimmed in D10 — question content is cosmetic
  to the demo aha (responses are simulated), and packs aren't year-matched anyway. Build only if
  pilot teachers actually comment on the starter content. Same curation bar as apstContent.js.
- [ ] **Admin Activation panel on the Traffic page (post-pilot, P3, M).**
  **What:** move the v4.6.0 hand-run activation-funnel script (signups → demo send → first real
  send, median time-to-first-send) into `GET /api/manage/traffic` + an Activation panel in
  `admin/src/pages/Traffic.jsx`. **Why:** dashboard convenience once there are enough teachers
  that a hand-run script is annoying. **Context:** trimmed in D10 for n<10 pilot scale; the
  v4.4.0 eng review already rejected this aggregate pattern for `manage/metrics` at platform
  scope. The funnel deliberately counts demo sends — sanctioned exception now documented in
  CLAUDE.md's demo-isolation section (`api/scripts/activationFunnel.js` shipped as the hand-run
  script in this session's v4.6.0 backend work; this bullet is only about the future admin-panel
  move, which is still deferred).
- [ ] **Attributed per-teacher "analytics view" funnel stage (post-pilot, P3, M).**
  **What:** an authed server-side event write so "reached analytics" can be attributed to a
  teacher cohort. **Why:** the route-level pageview proxy is directional only — `pageviews`'
  visitor ID is the anonymous device UUID, never the teacher oid, and adding identity to the
  anonymous beacon was rejected (spoofable). **Context:** D11 restructured v4.6.0's metrics so
  nothing depends on this; build only if the pilot readout needs true cohort percentages.
- [ ] **Tier 3 job-oriented IA rework (post-pilot, P3, L).**
  **What:** nav reframed around jobs ("Send a quiz" primary action, merged Build/Send/History
  lifecycle surface, Question Bank demoted into the build flow, taxonomy unification per F6).
  **Why:** the assessment's F1 (noun-based IA) is real but is a pre-pilot bet without evidence.
  **Context:** deferred in D1; v4.6.0's E6 quick-start card is the cheap probe — pilot
  navigation data decides whether the full rework is justified.

## /plan session 2026-07-15 — v4.4.0 Traffic Monitor planned

Adopted the demo repo's (`github.com/effriantoryan-eng/quizpulse`) traffic-monitor feature as
sprint v4.4.0. Full CC-ready prompt: `C:\Users\Ryan\Doc\Quizpulse\CC_PROMPTS_v440.md`. CLAUDE.md
updated ([PLANNED] blurb, roadmap #11, version table, branch plan, data model, security limits,
feature status, Known issues #13). **No dependencies on v4.1–v4.3 — buildable in any gap. No new
paid Azure services** (Cosmos serverless RU + existing Function App only; App Insights stays out
of scope). Discovery: the write path (`usePageView` → `POST /api/pageView` → `pageviews`
container) has been live since the baseline import — the sprint hardens it and builds the read
side (admin Traffic page, funnel, PWA-install + push-delivery tracking, metrics de-stub).

- [x] **Build sprint v4.4.0** from `CC_PROMPTS_v440.md` (branch `release/v4.4-traffic`, 6 tasks).
  Done — merged to main and tagged `v4.4.0` 2026-07-15. Deploy (container TTL/RU cap + API
  publish) still pending, see `docs/azure/V440_CONTAINERS_SETUP.md`.
- [x] **LOW (pre-sprint quick fix, optional)** — `src/hooks/usePageView.js:26` calls
  `getSessionId()` with no key → visitor UUID stored under the literal localStorage key
  `"undefined"`, and doesn't match `quizpulse_device_id`, so pageviews can't join to quiz
  activity. Fixed as part of v4.4.0 Task 1 (`feat/v4.4-pageview-hardening`).
- [x] **LOW (cost hygiene, portal-only, can do anytime)** — the `pageviews` container has no TTL
  and grows unbounded; set default TTL 180 days in the portal (no code change needed).
  Documented in `docs/azure/V440_CONTAINERS_SETUP.md`; the portal step itself is still pending
  (part of the v4.4.0 deploy checklist, not yet executed against production).

## Deferred from eng review — v4.4.0 plan (from /plan-eng-review 2026-07-15)

- [ ] **Student data-collection summary for school pilots (post-v4.4.0).**
  **What:** one-page `docs/privacy/STUDENT_DATA.md` — exactly what QuizPulse stores about a
  student (device UUID, responses+confidence, join requests, minimal /quiz pageviews
  {page, id, session, time, quizId}, push subscription endpoint, 180-day traffic TTL) and
  what it deliberately does NOT (browser fingerprint on student routes, location, names
  beyond the join request). **Why:** the v4.4.0 eng review (outside voice D7) locked a
  student-privacy posture — strip UA/screen/timezone/referrer on /quiz beacons — and the
  first school that asks "what do you collect?" needs a real answer. **Context:** no privacy
  doc exists in the repo (docs/ has azure/, security/, fixes/ only); the posture is defined
  in `CC_PROMPTS_v440.md` Task 1. **Depends on:** most accurate once v4.4.0 ships.

## /qa session 2026-07-12 (v4.2.0, local, dev-auth bypass, test Cosmos DB)

Fixed this session (branch `develop`, PR #36): live-tested the v4.2.0 onboarding wizard against
`dev-teacher-001` (an account with 1 real class already) and found two bugs via network trace —

- [x] **MEDIUM — onboarding wizard progress counter read "Step 5 of 4" on the last step**
  (`src/components/onboarding/ProfileWizardSteps.jsx`) — `totalSteps` was computed as
  `startStepNumber - 2 + steps.length`, which always equals `steps.length` (4) regardless of
  `startStepNumber`, while `stepNumber` correctly ranged `startStepNumber..startStepNumber+3`
  (2..5). Fixed: `startStepNumber - 1 + steps.length`.
- [x] **MEDIUM — "Create these classes for me now" checkbox silently no-ops for any teacher who
  already has a class** (`src/components/onboarding/ProfileWizardSteps.jsx`) — confirmed via
  network trace: `POST /api/classes/shells` always 409s once the teacher has any real class, and
  the wizard swallowed the error with zero feedback. Fixed at the root: fetch `/api/classes` on
  mount and hide the checkbox (replaced with an explanatory note) once a real class already
  exists, so the wizard never offers an action guaranteed to fail.

## Deferred from design review — v4.2.0/v4.3.0 plan (from /plan-design-review 2026-07-11)

- [ ] **Formalise the design system via /design-consultation → DESIGN.md.**
  **What:** name the typography, spacing scale, and palette as a committed DESIGN.md.
  **Why:** design reviews currently calibrate against informal references
  (quizpulse_mockups_v301.html tokens + addendum notes); every review starts from
  "no DESIGN.md found".
  **Context:** de-facto house style — system-ui, purple #534AB7, reserved accents: demo purple,
  misconception terracotta (#B5482E), AI blue (#2C6BAA, added 2026-07-11 addendum §6.9),
  four-cell green/amber. **Priority:** P3, post-pilot — spend the session when a second
  contributor or a rebrand makes it pay. **Depends on:** nothing.

## Deferred from CEO review — v4.2.0/v4.3.0 plan (from /plan-ceo-review 2026-07-11)

- [ ] **E2 — Retroactive source attachment for manual quizzes.**
  **What:** let a teacher attach source material to an existing hand-built quiz so it gains
  sourceRef lineage and joins the misconception → follow-up-draft loop (v4.3.0's expand endpoint).
  **Why:** the loop is the product's moat but only works for AI-generated quizzes; the entire
  manual corpus (all quizzes that exist today) can never trigger "Create follow-up practice".
  **Cons / blocker:** attaching a source can't say WHICH pages/sections each manual question came
  from, so follow-ups would ground on the whole document — weakening the page-reference
  hallucination guard. Needs a design answer (per-question section tagging? whole-doc grounding
  with honest copy?) before building.
  **Context:** decided at the 2026-07-11 CEO review (D5.2 → Defer); full record in
  `C:\Users\Ryan\Doc\Quizpulse\CEO_REVIEW_v420_v430_addendum.md` §1 and the CEO plan doc.
  Revisit post-pilot alongside the AI-question community-sharing block review.
  **Effort:** M (human ~2 days / CC ~45 min once designed). **Priority:** P3.
  **Depends on:** v4.3.0 shipped; page-mapping design decision.

## Design debt — v4.0.0 Analytics (from /plan-design-review 2026-07-03)

- [ ] **Screen-reader ARIA for the four-cell segmented chart** — add role + aria-label so SR users
  hear the four counts (correct-confident / correct-unsure / incorrect-confident / incorrect-unsure)
  per question. D4's visible legend + counts cover sighted low-vision users; this covers SR users.
  Blocked by: v4.0.0 chart shipping. File: src/pages/teacher/Analytics.jsx.
  **→ Bundled into v4.3.0 scope** (design review 2026-07-11, CEO_REVIEW_v420_v430_addendum.md
  §6.11 — feat/v4.3-expansion edits the same file); close this entry when v4.3.0 lands.

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
  **→ Bundled into v4.3.0 scope** (eng review 2026-07-11, CEO_REVIEW_v420_v430_addendum.md §5.8);
  close this entry when v4.3.0 lands.
- [ ] `api/analytics.js` `classAnalytics` — only analytics endpoint with no `rateLimit(...)` call
  (`analytics` and `analyticsExport` both have one). Add for consistency.
  **→ Bundled into v4.3.0 scope** (eng review 2026-07-11, addendum §5.8); close when v4.3.0 lands.
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

## /qa session 2026-07-11 (local, dev-auth bypass, test Cosmos DB)

Fixed this session (branch `feat/v4.0-demo-gallery-cards-v2`): analytics rate-limit window 1hr→1min
(ISSUE-002, high — live analytics died with 429 after ~3 min of polling), "No classId provided."
dead-ends on Roster/Requests/Settings (ISSUE-001), raw class UUIDs in quiz history (ISSUE-003,
stale Sprint-0 CLASS_NAMES map), backwards analytics copy + "1 students" pluralization
(ISSUE-004/005).

All four deferred items below were fixed in a follow-up pass the same day (commits `ce6841f`,
`e9fa1c8`, `4005336`, `b2e6664` — each verified live in the browser; 215/215 unit tests pass):

- [x] **LOW — Misconception hero card says "N students answered confidently but got it wrong"
  but N sums per-question confident-wrong ANSWERS** (`src/pages/teacher/Analytics.jsx`) —
  fixed: copy now says "N answers were confident but wrong" (per-question counts in the Home
  feed are genuinely per-student and were left as-is).
- [x] **LOW — Send page shows "Picking a topic lets this quiz count toward your school's
  benchmark" even when only a demo class is selected** (`src/pages/teacher/SendQuiz.jsx`) —
  fixed: when every selected class is a demo class the note now reads "Practice quizzes sent
  to a demo class don't count toward your school's benchmark".
- [x] **LOW — Student who revisits an already-submitted quiz gets the full quiz form again**
  (`src/pages/student/TakeQuiz.jsx`) — fixed: per-quiz localStorage flag (set on 201 and 409)
  short-circuits straight to the done screen on revisit; server 409 remains the backstop if
  storage is cleared.
- [x] **LOW — Population "You haven't sent a quiz tagged X yet" message shows even when a demo
  quiz with that tag exists** (`src/pages/teacher/Population.jsx`) — fixed: empty state now
  appends "(Practice quizzes sent to a demo class don't count.)".

## /qa session 2026-07-16 (local, dev-auth bypass, test Cosmos DB, branch `main`)

Fixed this session (commits `1a499d5`, `d021b47`, `d76b6c1`, test `1d24c13` — each verified live;
428/428 unit tests pass):

- [x] **HIGH — AI-drafted questions could never be edited or visibility-toggled** — they're
  materialised with `topic: 'Other'` (`api/generationDrafts.js`) but the questions PUT validator
  only accepted the 5-topic enum, so every round-trip 400'd with a misleading topic error before
  the AI-visibility lock could even run. Server now accepts an *unchanged* out-of-enum topic
  (`api/questions.js`); Question Bank shows the true stored topic in the edit select, renders a
  static "Private" pill on AI questions instead of a toggle that can never succeed, and disables
  the edit form's visibility select for them. Regression test:
  `tests/unit/api/questions-put.regression-1.test.js`.
- [x] **MEDIUM — switching to the Requests/Settings tab from a class's Roster dropped the
  `?classId`** and dead-ended at "Pick a class first", with copy pointing at a "Requests" link
  that doesn't exist on class cards. `SubNav.jsx` now carries `classId` across the class-scoped
  tabs; empty-state copy in `PendingRequests.jsx`/`ClassSettings.jsx` describes the real path.

Deferred (low severity):

- [ ] **LOW — Question Bank failure feedback uses `alert()`** (`changeVisibility`,
  `deleteQuestion` in `src/pages/teacher/QuestionBank.jsx`) while `saveEdit` uses an inline
  error div — replace the alerts with the same inline pattern for consistency (and testability:
  automation harnesses auto-dismiss dialogs, which masked this feedback during QA).
- [ ] **LOW — "1 students" pluralization on the SendQuiz class cards**
  (`src/pages/teacher/SendQuiz.jsx` — the class-picker card subtitle). The Classes page
  pluralizes correctly; SendQuiz doesn't.

Not bugs / environment notes: `/api/vapid-public-key` 503s locally (VAPID keys aren't in
local.settings.json — push isn't locally testable, expected). Browser-pane screenshots timed out
all session and injected clicks intermittently didn't land (tooling flake on this machine —
verified app handlers fine via programmatic dispatch; page reads/console/network all worked).
