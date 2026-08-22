# Changelog

All notable changes to QuizPulse are documented in this file.

## [v4.7.0] — Design overhaul: Modernist (IN PROGRESS — not yet tagged)

A visual overhaul, not a behavior change. Remaps the app's existing 2px-border token system
(`src/index.css`) to a Modernist palette/type (Archivo, one terracotta-red accent, zero corner
radius, no drop shadows) — every one of the 600+ existing `var()` call sites restyles for free.
Plus a read-only Home calendar, a QR join path, and a student completion confidence summary. Built
per `CC_PROMPTS_v470.md` (design/eng/CEO reviewed 2026-08-17). **Zero new containers, zero new
security surface, one small endpoint extension.** No breaking changes. Ranks 6-9 from the scoping
doc (multi-class trend grid, nudge-non-submitters, device-scoped "Your activity", device linking)
are deferred to v4.8.0.

### New features
- **Design system remap** (`src/index.css`, `DESIGN.md`) — same token names, Modernist values:
  Archivo (self-hosted, `public/fonts/archivo-variable.woff2`, no more Google Fonts CDN load),
  a single terracotta accent (`--primary: #ec3013`), `--radius: 0` everywhere, shadows dropped.
  New component classes (`.btn`/`.tag`/`.field`/`.input`/`.seg`/`.table`) alongside the existing
  `.bp-*` set. `staticwebapp.config.json`'s CSP no longer needs `fonts.googleapis.com`/
  `fonts.gstatic.com`.
- **Home calendar** (`src/components/home/HomeCalendar.jsx`, `src/data/homeCalendar.js`) —
  week (default) / month toggle, read-only aggregate over `GET /api/quizzes` (no new endpoint),
  marks days with a sent or scheduled quiz.
- **"Also waiting" attention cards** (`src/data/alsoWaiting.js`) — non-submitters, a below-target
  closed quiz (response-rate proxy — no score-target concept exists in this data model), and a
  draft-in-progress quiz, derived from data the Home page already fetches. The non-submitter
  card's "Nudge" button is deferred to v4.8.0 (T3) — this ships count + "Open results" only.
- **Student "Join this class" QR** (`src/components/ClassJoinQR.jsx`, `src/components/QRCode.jsx`)
  — a self-contained, offline-capable QR (bundles `qrcode-generator`, no CDN) on the student
  class-home and the join-approved screen, encoding `/join?code=`. `JoinClass.jsx` now also
  prefills `?code=` from a scan.
- **"Coming up" scheduled quizzes** — `GET /api/student/quizzes` now also returns
  `status='scheduled'` quizzes with a server-computed `state` (`'open'|'closed'|'scheduled'`) and
  `scheduledFor`, sorted by effective date. Still demo-excluded, still 403-on-unapproved-device,
  still 50-capped, same rate limit.
- **Completion confidence self-summary** (`src/data/confidenceTally.js`) — the student's finish
  screen now shows their own confidence mix from the submission just sent ("7 sure / 4 pretty
  sure / 1 guessing") plus plain "what happens next" copy. No score, no right/wrong count — reads
  straight from the local submission payload, no new endpoint.

### Fixes / restyle
- `src/data/fourCell.js`'s misconception chart colors (hardcoded hex, not `var()`) realigned to
  the new accent.
- Hardcoded-hex sweep on the screens this sprint touches (Home, Analytics, student flow) — the
  other ~339 hardcoded hex occurrences repo-wide are out of scope, noted in `DESIGN.md`.
- Removed decorative emoji from the student flow and Home screens (house no-emoji rule).

## [v4.6.0] — First-run activation (IN PROGRESS — not yet tagged)

A new teacher used to land on Create Question (the middle of the chain) after onboarding, with
the only zero-dependency path to the product's "aha" (demo class → live analytics) hidden behind
a button nothing points to. This sprint makes first value automatic: onboarding now hands off to
a finale that can send a practice quiz to a simulated class and show real misconception analytics
in seconds, and a Getting Started checklist keeps the teacher oriented afterward. Deployed
(frontend via SWA GitHub Actions, API via `func azure functionapp publish` from Node 22, both
confirmed live 2026-07-28) but **not yet tagged `v4.6.0`** — the rc1 ship gate (integration test
run against the test Cosmos account, skip-path and injected-failure-recovery E2E legs,
starter-pack content review) is still open, and v4.6.1 (projector join screen, first-result
annotation, Home quick-start card) hasn't started. Built per `CC_PROMPTS_v460.md`. No breaking
changes, no new Cosmos container.

### New features
- **Server-orchestrated first-run chain** — `POST /api/onboarding/first-run`
  (`api/onboardingFirstRun.js`, `api/shared/firstRun.js`): creates a demo class, seeds 5 starter
  questions, creates and sends a practice quiz, and simulates 24 student responses, all in one
  call. Idempotent by construction (deterministic ids, 409-tolerant creates) — a retried call
  after a partial failure creates zero duplicates.
- **First-run finale UI** (`src/pages/FirstRunFinale.jsx`, route `/teacher/first-run`) — two
  lanes ("Use a ready-made quiz" / "Start from your worksheet"), a staged loader, and a payoff
  screen leading with the misconception hero card and an aggregated four-cell chart. Mobile
  collapses the upload lane to a one-line text prompt.
- **Getting Started checklist** (`api/shared/gettingStarted.js`,
  `src/components/GettingStartedChecklist.jsx`) — 5 steps derived from live Cosmos counts (never
  stored tick-state), owns the dashboard's promo slot until released (both the practice quiz is
  sent and its results are seen), then demotes to a collapsed "N of 5" strip.
- **Generic starter question pack** (`api/shared/starterPack.js`,
  `POST /api/questions/starter-seed`) — 5 study-skills questions, `origin: 'starter'` on the
  question doc. Also surfaced as an "Add 5 starter questions" CTA in the BuildQuiz/QuestionBank
  empty states (`src/components/StarterSeedCta.jsx`).
- **Misconception-biased demo simulation** (`api/shared/runSimulation.js`) — wrong answers now
  concentrate ~87% on one shared distractor per question (chosen once per question, not per
  student) with confidence correlated to it, so the four-cell chart, hero card, and per-option
  bars tell one coherent story instead of a uniform spread.
- **Activation funnel script** (`api/scripts/activationFunnel.js`) — standalone, founder-run
  only. Signups, demo sends, first real sends, median signup→real-send time, explicit two-bucket
  `isDemo` split.
- **BuildQuiz draft persistence** — "Save & go to send" now creates a real `status:'draft'` quiz
  doc and hands off by `?quizId=` URL instead of router state, so a refresh no longer loses the
  quiz.
- **PendingRequests classId resolution** — with no `?classId=`, auto-selects when exactly one
  class has pending requests, or offers an in-place picker among the classes that do, instead of
  bouncing to Classes.

### Bug fixes
- `api/sendNotification.js`'s demo branch had silently clobbered `confidenceResponseCount` on
  every demo-quiz send since v4.2.0 — a full upsert of a stale in-memory `quiz` object overwrote
  a patch `runSimulation()` had just written directly to Cosmos. Fixed to patch
  `notificationSentAt` instead of upserting. Verified against production: one affected record (a
  test artifact from this sprint's own live QA), no real teacher data involved.
- `getOrCreateQuiz` returned `undefined` for a brand-new quiz — Cosmos's `item().read()` doesn't
  throw on a missing item in this SDK setup, only `getTeacher()`'s established
  `resource || null` pattern accounted for that; the new code now checks resource truthiness too.
- `PendingRequests`' new classId-picker no longer treats a failed/rate-limited per-class count as
  zero — a class whose count couldn't be loaded still appears in the picker instead of vanishing.

### Fixes (post-deploy, 2026-08-17 — commit `04c8809`)
- **Generation daily quota is now attempt-based** (`api/shared/dailyQuota.js` `checkAndIncrQuota`,
  wired into `api/generationDrafts.js`). Previously counted persisted drafts, so a failing/retried
  provider call (502/503) was invisible to the cap and a retry loop could burn unlimited paid spend.
  Now increments an atomic date-keyed counter before the provider call. `checkAndIncrRegenQuota`
  is a thin wrapper over the generalized helper.
- **Starter-pack correct-answer indices spread across the pack** (`api/shared/starterPack.js`) —
  4 of 5 answers previously sat at index 1, pattern-matchable in one send; now varied (2,0,3,1,2).
- **`api/rateLimit.js` bypasses the in-memory limiter under `RUN_INTEGRATION=true`** — fixes the
  documented flake where rapid sequential integration-test requests from one IP trip the 30 req/min
  cap (surfacing as `classes.find is not a function`). Gated on the same env var that already gates
  the integration suite, so it can never flip on in production.
- **Hid the "Sign in with Google" button** (`src/pages/Login.jsx`) — the Google IdP was never
  configured in the CIAM tenant, so the button led to a silent dead end (same treatment as Apple ID).
- Added `api/scripts/findStrayTestDocs.js` (founder-run audit for test-pollution docs in Cosmos).

### Other
- Wizard step 4 (the "create these classes for me" checkbox) removed from
  `ProfileWizardSteps.jsx` per the sprint's design — `POST /api/classes/shells` stays live for
  any other caller, just unused by onboarding now.
- Extracted three modules that were duplicated between the new finale screen and existing pages:
  `src/data/fourCell.js` (four-cell chart palette, shared with `Analytics.jsx`),
  `src/hooks/useStagedPending.js` (shared with `GenerateQuiz.jsx`), and
  `src/hooks/useWindowWidth.js` (shared with `DemoGallery.jsx`).
- `PromoSlot` now accepts an optional preloaded `eligibleIntros` prop so `TeacherHome` doesn't
  double-fetch `/api/me` on every load.
- `/teacher/first-run` added to `FULL_WIDTH_ROUTES` and `api/shared/pageViewAllowlist.js`.
- `featureIntros.getting_started` is a tenth, synthetic key (alongside the nine v4.2.0
  feature-intro keys) reusing the same `PUT /api/me/feature-intros` ETag-replace mechanism, with
  a new `skip-step` event for the checklist's per-step skipped marker.

## [v4.5.0] — Student class home & post-approval access

Fixes the student dead-end after approval — the only path into a quiz used to be a live push
notification, which fails silently on any device without push configured. Deployed (frontend via
SWA GitHub Actions, API via `func azure functionapp publish` from Node 22). Built per
`QuizPulse_Sprint_Plan_v450.md` (CEO/Eng/Design reviewed 2026-07-23). No breaking changes, no new
Cosmos container.

### New features
- Persistent `/student/class` page — open/closed/answered quiz cards, warm empty state, a manual
  Refresh button (no polling), one section per known class.
- New `GET /api/student/quizzes?deviceId=&classId=` — anonymous, in-partition via the new shared
  `api/shared/getApprovedJoinRequest.js` helper (403 uniform when not approved, metadata only,
  demo-excluded, capped at 50, 30 req/min/IP).
- Approved-screen CTA ("Go to my class") on `JoinClass.jsx`, replacing dead "You're in!" text.
- Auto-subscribe to push right on the approved screen — no GUID paste, guarded to never throw
  (`src/pushSubscribe.js`); denied permission / no `PushManager` (iOS uninstalled) are soft states.
- Returning-device recognition: `/join` offers "Continue to my class" via localStorage
  (`src/studentClasses.js`) instead of forcing the join form again.
- Teacher-facing copyable `/quiz?quizId=` share link on `SendQuiz.jsx` — manual escape hatch for a
  flaky push.

### Retired
- `/student/subscribe` (the GUID-paste push page) — replaced by the auto-subscribe flow above.

### Other
- `/student/class` added to `api/shared/pageViewAllowlist.js` and to the `/quiz`
  student-fingerprint-stripping rule in `api/pageView.js`.

## [v4.3.0] — AI quiz generation, provider placeholder (on `release/v4.3-generation`)

Document upload (PDF/docx/txt, 15MB) → mock-LLM draft → teacher review/approve → send through the
normal SendQuiz flow, plus spaced repeats for any quiz and misconception-triggered follow-up
practice. Built per `CC_PROMPTS_v420_v430.md` as amended by `CEO_REVIEW_v420_v430_addendum.md`.
No breaking changes. **No real LLM API key required or used** — `FEATURE_AI_GENERATION` is on,
but `LLM_PROVIDER` defaults to `mock`; see `docs/azure/LLM_PROVIDER_SETUP.md` before ever
activating a real provider.

### New features

#### Source upload + extraction + chunking (`api/generationSources.js`)
- `POST /api/generation/sources` — multipart upload, MIME-sniffed by magic bytes
  (`api/shared/sniffFileKind.js`), extracted via `unpdf` (PDF) / `mammoth` (docx) inside a ~10s
  timeout box with named 400 failure paths (scanned/too-short, too-many-pages, unreadable/
  encrypted). The original binary is never persisted — only extracted text + chunk boundaries.
- `api/shared/sourceChunker.js` — chunk index is the universal `sourceRef` addressing unit;
  PDFs additionally carry a chunk→page map.
- Verified locally: a real 15MB file survives `request.formData()` without truncation. The SWA
  linked-backend proxy path still needs live-deploy verification before production use.

#### LLM adapter + mock provider (`api/shared/llmAdapter.js`, `api/shared/llmProviders/*`)
- Provider resolution (`LLM_PROVIDER`, default `mock`), a shared ~60k-char input cap identical
  across all providers, range-first-then-even-sampling chunk selection, and one structured
  observability log line per generation/regeneration/expand call.
- Mock provider is deterministic (seeded from sourceId) and structurally cannot reproduce a
  verbatim 8-word source run — it builds questions from single short extracted terms in a fixed
  template, never from concatenated source text.
- `api/shared/draftSchema.js` — single validator for both raw adapter output (→502) and teacher
  edits (→400), including a hallucination guard on `sourceRef` chunk indexes.

#### Draft endpoints, approve, expand, send-transition
- `POST/GET/PUT /api/generation/drafts[/{id}]`, `POST .../regenerate-question` (resets its tick),
  `POST .../approve` (server-enforces every question reviewed-or-edited, pre-checks caps before
  writing, deterministic idempotent materialisation).
- `POST /api/generation/expand` — misconception-triggered follow-up, resolves lineage via the
  materialised questions' own `sourceRef`s (draft doc not required); checks source liveness only
  on click.
- New `POST /api/quizzes/{id}/send` — the one send-transition path for both AI-generated and
  manual quizzes (manual quizzes now create as `status:'draft'` then transition through the same
  endpoint). Computes spaced-repeat clones (E3, max 5, deterministic ids, 409-tolerant) before
  marking the parent sent/scheduled.

#### Review UI (`GenerateQuiz.jsx`, `ReviewDraft.jsx`, `AiBadge.jsx`)
- Two-phase GenerateQuiz screen with staged pending copy and a ~90s client timeout.
- ReviewDraft: AI banner, per-question tick/edit/regenerate/delete, a schedule editor for spaced
  repeats, sticky footer gating Approve. Approve → send bridge lands straight in SendQuiz with the
  schedule carried over.
- Persistent generation CTA on the Build page; AiBadge on AI-generated questions in the bank.

#### Misconception-triggered expansion (Analytics.jsx)
- "Create follow-up practice" (hero card) / "Revisit {sourceRefLabel}" (per-question) when a
  question's incorrect rate ≥40% OR confident-but-incorrect rate ≥25%, only for quizzes with live
  source lineage.

### New endpoints
- `POST /api/generation/sources`, `POST/GET/PUT /api/generation/drafts[/{id}]`,
  `POST /api/generation/drafts/{id}/regenerate-question`, `POST /api/generation/drafts/{id}/approve`,
  `POST /api/generation/expand`, `POST /api/quizzes/{id}/send`.

### Data model additions
- New containers: `source_materials` (pk `/teacherId`, 90-day TTL), `quiz_drafts` (pk `/teacherId`).
- Questions: `generatedBy`, `sourceId`, `sourceRef`, `sourceRefLabel` (AI-materialised only).
- Quizzes: `sourceId`, `draftId` (lineage), `parentQuizId` (marks a spaced-repeat clone; excluded
  from population benchmarking and progressive-disclosure milestone counts).

### Fixed during this sprint
- `api/shared/dailyQuota.js`'s regeneration counter crashed with a 500 when the caller's teacher
  doc didn't exist yet (its Cosmos PATCH requires an existing document) — now tolerates a missing
  doc non-fatally, matching `confidenceResponseCount`'s existing convention.
- The send-transition endpoint didn't compute `classSize` from the selected classes' real
  `studentCount` — fixed to derive it server-side rather than trusting a client-supplied value.
- Bundled debt: `classAnalytics` gained a missing rate limit; `analyticsPopulation.js` no longer
  swallows non-404 Cosmos errors into a fake empty benchmark page; AI-generated questions can't
  have their `visibility` changed via a direct PUT.

### Scope cut
- The Results-list-level "Create follow-up practice" nudge (lazy evaluation across a teacher's 10
  most recent closed lineage-bearing quizzes) was not built — the same action already exists in
  the Analytics drill-down and the misconception hero card, both shipped. Deferred as a follow-up.

### Tests
- Unit: `sourceChunker`, `dailyQuota`, `sniffFileKind`, `seededRandom`, `draftSchema`,
  `llmProviderMock` (incl. the hard no-verbatim-8-words check), `llmAdapter`,
  `analyticsFollowUpTrigger`. Integration: `v4.3-source-upload.test.js` (9 cases),
  `v4.3-drafts.test.js` (23 cases covering the full upload→generate→review→approve→send loop,
  cross-tenant negative tests on every new endpoint, and a retry-idempotency test).
- Verified live end-to-end against a real local func host, including a real AI-generated quiz
  sent to the demo class and the resulting misconception nudge triggering a real follow-up draft.

## [v4.4.0] — Traffic monitor (unreleased — on `release/v4.4-traffic`)

Adopted from the demo repo's traffic-monitor feature and hardened. `GET /api/manage/traffic` +
an admin Traffic dashboard (page views, uniques, top pages, audience/device/browser breakdowns,
a notification→open→submit funnel), PWA-install tracking from any route, and a partial de-stub
of `manage/metrics`. Built per `CC_PROMPTS_v440.md`, reviewed via `/review` and `/plan-eng-review`
(10 findings folded in before the build). No breaking changes — every new field is additive, no
new paid Azure services, and `POST /api/pageView` still accepts the old payload shape. Zero
dependencies on v4.1.0/v4.2.0/v4.3.0.

### New features

#### Hardened page-view write path (`feat/v4.4-pageview-hardening`)
- `src/hooks/usePageView.js` now keys the visitor UUID under `quizpulse_device_id` (matches the
  UUID join requests/responses/subscriptions already use — was previously stored under the
  literal localStorage key `"undefined"`).
- `api/pageView.js` no longer self-creates the `pageviews` Cosmos container at runtime; it's now
  lazily initialised from `COSMOS_CONTAINER_PAGEVIEWS`, same convention as every other container.
- New route allowlist (`api/shared/pageViewAllowlist.js`): an unrecognised `page` value is stored
  bucketed as `'other'`, never rejected — closes off junk-cardinality inflation from the
  anonymous, spoofable-rate-limited beacon endpoint.
- New student privacy posture: on `/quiz`, the beacon carries no userAgent/screen size/language/
  timezone/referrer — enforced server-side regardless of what the client sends. An optional
  `quizId` (parsed from `?quizId=`) is the one extra field `/quiz` beacons carry, enabling
  per-quiz funnel attribution.
- `docs/azure/V440_CONTAINERS_SETUP.md`: formalises the (already-existing, previously unmanaged)
  `pageviews` container — 180-day TTL, a dedicated RU cap (blast-radius guard against the
  anonymous endpoint's spoofable rate limit burning the $100/mo budget), `COSMOS_CONTAINER_PAGEVIEWS`.

#### Traffic endpoint + funnel (`feat/v4.4-traffic-endpoint`, `feat/v4.4-funnel-and-destub`)
- `GET /api/manage/traffic?range=today|7d|30d` — owner/support, same auth/rate-limit conventions
  as `manage/metrics`. Aggregation logic in `api/shared/trafficAggregate.js` (pure, unit-tested).
  A legacy pageview doc with no `eventType` field counts as a view in every aggregate (mandatory
  regression — all pre-v4.4.0 production data has no `eventType`).
- Funnel block: quizzes sent → notifications delivered → rostered opens → responses submitted,
  with `openRate`/`completionRate`. Roster resolution is per-class, in-partition
  (`api/shared/resolveApprovedDeviceIds.js`) — never a cross-partition scan. Legacy quizzes (sent
  before v4.4.0, no push-count fields) are excluded from denominators, never coerced to 0.
- `api/sendNotification.js` now persists `pushSuccessCount`/`pushFailCount` on the quiz doc at
  send time (both the manual and scheduled-send paths). The write is advisory — same semantics
  as `confidenceResponseCount` — since the pushes have already gone out by the time it runs.
- `api/metrics.js`: `usageGrowth`/`engagement.completionRate` are now real Cosmos aggregates
  (shared query helper `api/shared/rangeQuizStats.js`, reused by the traffic funnel so the two
  endpoints can't drift on what "demo-excluded, legacy-excluded" means). The single top-level
  `stubbed: true` is replaced with per-group flags; `systemHealth`/`security`/`spending` remain
  fully stubbed (App Insights wiring stays out of scope).

#### PWA-install tracking (`feat/v4.4-pwa-install-tracking`)
- `usePwaInstallTracking()` registers one app-level `window.addEventListener('appinstalled', …)`
  (separate from `usePwaInstall`'s own UI-state listener, which only mounts where `InstallButton`
  renders) so an install triggered from the browser's own UI on any route gets counted.

#### Admin Traffic dashboard (`feat/v4.4-admin-traffic-ui`)
- `admin/src/pages/Traffic.jsx` — range picker, stat tiles, funnel strip, top-pages/daily bar
  rows, audience/device/browser breakdowns. No chart library, matches `Monitoring.jsx`'s idiom.

### New endpoints
- `GET /api/manage/traffic?range=today|7d|30d` — traffic analytics + funnel (owner/support).

### Data model additions
- `pageviews`: formalised (was an unmanaged, self-created container) — added `eventType`
  (`'view'|'pwa_install'`) and optional `quizId`. `page` now server-bucketed through the
  allowlist; student-route (`/quiz`) docs never carry browser-fingerprint fields.
- `quizzes`: optional `pushSuccessCount`/`pushFailCount` (int) — additive, advisory, set at send
  time.

### Testing
- 345/345 unit tests pass (35 suites). New: `pageView.test.js`, `pageViewAllowlist.test.js`
  (incl. the mandatory allowlist-coupling test against `src/App.jsx`'s real route table),
  `trafficAggregate.test.js`, `rangeQuizStats.test.js`, `resolveApprovedDeviceIds.test.js`,
  `usePageView.test.js`; extended `sendNotification.test.js` (advisory-counter regression) and
  `metrics.test.js` (per-group stubbed flags).
- Integration tests written (`tests/integration/api/v440-traffic.test.js`, 14 cases incl. the
  required cross-tenant negative test and a support-role read-access test) but not run in the
  build session — no live `func start` + test Cosmos available. See CLAUDE.md Known issues.

## [v4.1.0] — APST evidence export (on `release/v4.1-evidence`)

A per-quiz VIT evidence PDF and an annual aggregate MyPD log PDF, turning existing quiz data
(confidence + correctness) into professional-learning evidence against 18 of 37 APST descriptors.
Built per `CC_PROMPTS_v410.md` as amended by `CEO_REVIEW_v420_v430_addendum.md` §4 (addendum wins
on conflict). No breaking changes — the new "Evidence" nav hub is additive and doesn't change any
existing route.

### New features

#### APST content module
- `src/data/apstContent.js` (ESM) + `api/shared/apstContent.js` (CommonJS mirror): 18
  evidenceable APST descriptors, `APST_DEFAULTS`, verbatim VTLM 2.0 alignment text, the two MyPD
  reflection templates with `[PERSONALISE: ...]` gaps, and AERO citations — verbatim from AITSL/DET
  source (`QuizPulse_VIT_Export_Research_Brief.docx`), reviewed for accuracy before this tag.

#### Evidence route (`src/pages/teacher/Evidence.jsx`)
- New top-level "Evidence" hub in `src/teacherNav.js`, route `/teacher/evidence`. Lists sent
  quizzes with an inline two-screen export flow: Screen 1 (activity details, pre-populated,
  editable APST descriptor checkboxes), Screen 2 (reflection templates, export blocked with an
  inline warning while `[PERSONALISE:` remains in either field).
- "Generate annual log" — an inline date-range picker with client-side domain-coverage preview,
  downloads the aggregate PDF.

#### PDF generation (`api/evidenceExport.js`, `api/evidenceAnnualLog.js`, `api/shared/pdfEvidence.js`)
- `POST /api/evidence/export` — per-quiz PDF, 2 pages, reuses `api/analytics.js`'s
  `loadQuizAnalytics`/`buildQuestionBreakdown` for ownership (404-on-mismatch) and cohort-level
  correctness/confidence data. Server-side re-validates the personalisation gate (400 if
  `[PERSONALISE:` remains).
- `GET /api/evidence/annual-log?from=&to=` — aggregate PDF across the caller's own sent quizzes
  in range (query-scoped, demo-excluded), server-validates the date range (end > start, ≤365 days).
- Both endpoints rate-limited 10 req/hr/teacher (new Security limits row).
- **Fixed during this sprint:** the shared footer renderer could trigger pdfkit auto-pagination
  (text near the bottom margin wrapping past `page.height`) while a loop was iterating
  `bufferedPageRange().count` — an infinite loop that hung the export endpoint forever with no
  error. Fixed with `lineBreak: false` and a cached page count; regression-guarded by
  `tests/unit/api/pdfEvidence.test.js`.

#### Feature flag
- `FEATURE_APST_EXPORT` flipped to `true` in `api/shared/features.js` — `apst_intro`/`mypd_intro`
  (built in v4.2.0) are now eligible and verified to navigate to a working `/teacher/evidence`.

### New endpoints
- `POST /api/evidence/export` — per-quiz APST/VIT evidence PDF.
- `GET /api/evidence/annual-log` — annual aggregate MyPD log PDF.

### Tests
- `tests/unit/api/evidenceHelpers.test.js`, `tests/unit/api/pdfEvidence.test.js`,
  `tests/integration/api/v4-evidence.test.js` — see `SPRINT_TEST_CHECKLIST.md`'s v4.1.0 section
  and `tests/reports/v4.1.0-report.html`.

## [v4.2.0] — Guided onboarding & progressive disclosure (on `release/v4.2-onboarding`)

An optional profile (subjects, year levels, class count, registration status) collected via a
5-step onboarding wizard, a nine-key server-eligibility "progressive disclosure" engine that
surfaces one feature-intro card at a time as a teacher hits real milestones, and a topic-dropdown
prefilter on Send. Built per `CC_PROMPTS_v420_v430.md` as amended by
`CEO_REVIEW_v420_v430_addendum.md` (addendum wins on conflict). No breaking changes — every new
field is additive and legacy teacher docs are treated as empty.

### New features

#### Teacher profile + onboarding wizard (`feat/v4.2-profile-schema`, `feat/v4.2-onboarding-wizard`)
- Optional `profile{subjects,yearLevels,classCount,registrationStatus}` on the teacher doc
  (`api/shared/profileSchema.js`). `POST /api/onboarding` still fires after step 1 (school name)
  only — the teacher is onboarded from that moment, exactly as before. New
  `PUT /api/me/profile` accumulates steps 2-5 client-side and submits once at wizard end (or from
  `/onboarding/profile` later); quitting mid-wizard never re-gates onboarding.
- `src/components/onboarding/ProfileWizardSteps.jsx`: 4 skippable steps (subjects, year levels,
  class count + shell checkbox, registration status) with progress dots. "Next" on an empty
  selection behaves exactly like "Skip" — the primary button is never disabled.
- `api/shared/createClass.js`: joinCode/schoolId/cap logic extracted into one place, adopted by
  both `POST /api/classes` and the new `POST /api/classes/shells` (server-generates
  "My Class 1..N", only when the caller has zero real classes, sequential + cap-respecting).
- `src/components/ProfileNudge.jsx`: dashboard banner for a teacher who skipped the profile
  steps, permanently dismissible via the `profile_nudge` feature-intro key.

#### Progressive disclosure engine (`feat/v4.2-disclosure-engine`)
- `api/shared/introEligibility.js` computes `eligibleIntros[]` server-side for nine keys
  (`demo_intro`, `analytics_intro`, `community_intro`, `misconception_intro`, `population_intro`,
  `apst_intro`, `mypd_intro`, `ai_generation_intro`, `profile_nudge`). Milestone counts are
  teacher-partitioned and demo-excluded (`api/shared/excludeDemo.js`), with one deliberate
  exception: `misconception_intro` includes demo data (its designed first touch).
  `apst_intro`/`mypd_intro`/`ai_generation_intro` are gated behind `api/shared/features.js` flags
  (`FEATURE_APST_EXPORT`, `FEATURE_AI_GENERATION` — both `false` until v4.1.0/v4.3.0) and treated
  as dismissed until their flag flips. Once every key is dismissed or flag-dark, `GET /api/me`
  skips all milestone queries.
- `api/responses.js` and `api/shared/runSimulation.js` both increment a denormalised
  `confidenceResponseCount` on the parent quiz doc via an atomic Cosmos `incr` patch — advisory
  only, a patch failure never fails the student's submission.
- `PUT /api/me/feature-intros` records a card was shown/dismissed via an ETag-conditioned
  replace-with-retry (not a read-modify-write of the whole object), so two tabs dismissing
  different keys can't clobber each other.
- `src/components/FeatureIntroCard.jsx` + `src/data/featureIntros.js`: one card per browser
  session, "Show me" navigates / "✕" dismisses forever. `src/components/PromoSlot.jsx` is the
  dashboard's single promo slot — an eligible intro card outranks `ProfileNudge`, which waits.
  `community_intro` renders on the Build page instead, as its own slot.

#### Topic dropdown prefilter (`feat/v4.2-topic-prefilter`)
- `SendQuiz.jsx`'s topic dropdown segments the teacher's profile-matched subjects/year levels
  first (an optgroup), with a "Show all topics" expander for the rest. Zero-match fallback (e.g.
  Year 8 Maths — no preset tag covers it) suppresses the matched segment entirely rather than
  showing an empty one. Frontend-only; server-side enum validation unchanged.

### New endpoints
- `PUT /api/me/profile` — accumulate onboarding-wizard profile answers.
- `PUT /api/me/feature-intros` — record a feature-intro card shown/dismissed.
- `POST /api/classes/shells` — create N empty class shells for a first-run teacher.

### Data model additions
- `teachers`: optional `profile{subjects[],yearLevels[],classCount,registrationStatus}` and
  `featureIntros{[key]:{shownAt,dismissedAt}}` — additive, legacy docs treated as empty.
- `quizzes`: optional `confidenceResponseCount` (int) — denormalised counter incremented at
  response-submit time, read by `misconception_intro`'s milestone check.

## [v4.0.0] — Comprehensive analytics (unreleased — on `release/v4.0-analytics`)

Class drill-down, a four-cell confidence+correctness chart with a promoted misconception hero
card, an optional topic tag on send, and population benchmarking against a pre-aggregated seeded
dataset. Built 2026-07-03 per the amended sprint plan — `DESIGN_REVIEW_v400_v410_addendum.md`
overrides the raw `.docx` wherever they conflict (see CLAUDE.md, Architecture decisions).
No breaking changes; deploy requires the `population_benchmark` container +
`COSMOS_CONTAINER_POPULATION_BENCHMARK` env var (provisioned + seeded 2026-07-03).

### New features

#### Four-cell confidence+correctness chart (`feat/v4.0-analytics-ui`)
- `buildQuestionBreakdown` (`api/analytics.js`) extended in place with `fourCell`
  (`correctConfident`/`correctUnsure`/`incorrectConfident`/`incorrectUnsure`). "Confident" =
  `sure` + `pretty_sure` (reuses `CONFIDENT_VALUES`), so `fourCell.incorrectConfident` always
  equals `confidentButIncorrect` by construction. No new endpoint — class drill-down reuses
  `GET /api/analytics?quizId=&classId=` (`applyClassFilter`).
- `Analytics.jsx`: persistent four-cell legend above the question list, always-visible per-cell
  counts + percentages (never hover-only), misconception hero card promoted above the question
  list. Misconception accent is a dedicated terracotta (`#B5482E`/`#FBEDE8`) on both the segment
  and the hero card.

#### Topic tag on send (`feat/v4.0-topic-tag-ui`, `feat/v4.0-response-schema`)
- Optional 12-preset `topicTag` on quiz send (`api/shared/topicTags.js`, mirrored in
  `src/data/topicTags.js` — keep in sync). Validated server-side (400 on unrecognised value);
  never blocks send. `schoolId` resolved server-side from the caller's own teacher doc — never
  client-supplied.
- `api/responses.js` copies `topicTag`/`schoolId` from the quiz doc onto each response at submit
  time (students submit anonymously — there is no claim to read them from). No `correct`/
  `confidenceLevel`/`yearLevel`/`isPopulationSeed` fields (addendum §E0 dropped them from the
  .docx spec).

#### Population benchmarking (`feat/v4.0-population-seed`)
- New `population_benchmark` container (pk `/topicTag`): ~12 pre-aggregated topic rollups written
  once by `api/seed/populationSeed.js` (standalone, idempotent, manual — never an HTTP endpoint).
  Replaces the .docx design of ~37,500 raw synthetic response docs in `responses` (addendum §E1).
- `GET /api/analytics/population?topic=` (`api/analyticsPopulation.js`): point-read of the topic
  rollup + live aggregate of the caller's own topic-tagged quizzes. **No `schoolId` input at
  all** — the .docx's unchecked query param was an IDOR (addendum §E2). Demo data excluded from
  the live aggregate.
- `Population.jsx` — Results sub-tab (`/teacher/population`): one responsive "you vs norm" marker
  track per metric with a plain-language verdict.

### Security / bug fixes (pre-release review, /review 2026-07-06)

- **CSV formula injection (`api/analytics.js` export):** student-supplied names reaching the
  teacher's CSV are now neutralised — cells starting with `= + - @` (or tab/CR) get a `'` prefix
  so Excel doesn't execute them (CWE-1236).
- **Per-class response rates fixed (`GET /api/analytics/class/{classId}`):** the endpoint counted
  ALL responses to a quiz against ONE class's approved count, so multi-class quizzes showed rates
  past 100% in the Results "By Class" view. Responses are now counted against the class's own
  roster (join-request deviceIds; `demoStudents` for a demo class). Roster query also moved out
  of the per-quiz loop.
- **`sentAt` server-set (`POST /api/quizzes`):** `closedAt` was derived from a client-supplied
  `sentAt` — a crafted timestamp could hold a quiz open past its duration, and a malformed one
  threw a 500 (`toISOString` RangeError). Both `sentAt` and `closedAt` are now server-derived;
  any body-supplied `sentAt` is ignored.
- **Per-option answer bars restored (`Analytics.jsx`):** the four-cell chart had silently replaced
  the option-level distribution, hiding WHICH wrong option students picked. Both now render.
- Stale analytics hint copy rewritten for the four-cell layout; `Population.jsx` verdict grammar
  fixed; dead code removed from `api/responses.js`.

### Tests
- `feat/v4.0-tests` — unit suite green (215 passing), including `populationSeed.test.js` and
  four-cell breakdown tests (sum-to-total, legacy no-confidence answers, hero-card agreement).
  Known gap: `GET /api/analytics/class/{classId}` still has no integration coverage (see TODOS.md).

## [v3.3.0] — Simulated demo class (MINOR)

Lets a teacher explore the full Send → Analytics loop with simulated students, without recruiting
anyone. Non-breaking: every new field defaults off and legacy documents are treated as non-demo.

### New features

#### Demo class data model (`feat/v3.3-demo-class-data-model`)
- `isDemo` (default `false`) added to the `classes`, `quizzes`, and `responses` containers. Docs
  written before v3.3.0 (no field) are treated as `isDemo=false` everywhere.
- Demo classes additionally carry `demoStudents: [{ studentId, name }]` — 24 distinct curated
  names generated server-side at create time (`api/shared/demoNames.js`, ~80-name pool, shuffle-24),
  never client-provided.
- `POST /api/classes` accepts `isDemo: true` → generates 24 `demoStudents`, sets `studentCount=24`,
  omits `joinCode` (never joinable) and `nameList`. Max **1 demo class per teacher** (409 "Demo
  class limit reached"); demo classes do **not** count toward the 20-real-class cap.
- `GET /api/classes` returns `isDemo` + `demoStudentCount` (the raw `demoStudents` array is dropped
  from the list payload).

#### Simulated responses (`feat/v3.3-simulate-responses-endpoint`)
- `api/shared/runSimulation.js`: one simulated response per demo student — correct option with
  probability 0.65; confidence weighted sure/pretty_sure/guessing 0.40/0.40/0.20; bimodal
  per-question response time (30% 2–5s, 70% 10–35s); `quizDurationMs` = sum; `completedAt` =
  `sentAt` + 20–40s; `isDemo`/`simulated` flags. Idempotent (409 if already simulated).
- `POST /api/simulate-responses { quizId }`: rate-limited (5/min/teacher), ownership-checked
  (404 cross-tenant), demo-class-gated (400 "Not a demo class").
- `api/sendNotification.js`: when the quiz's class is a demo class, push is skipped entirely and
  `runSimulation()` runs instead. From the teacher's UI, Send → Analytics is unchanged.
- `api/quizzes.js` stamps `isDemo` on a quiz at creation when it targets a demo class;
  `api/analytics.js` is demo-aware (resolves `demoStudents` as the approved roster, returns `isDemo`).

#### Demo class UI (`feat/v3.3-demo-class-ui`)
- `Classes.jsx`: "Try with a demo class" button (shown only when the teacher has no demo class) +
  purple "Demo" pill (`#EEEDFE`/`#3C3489`); demo cards hide the join code and Roster link; the
  20-class cap counts real classes only.
- `SendQuiz.jsx`: inline note "This is a demo class. Responses are generated automatically — no one
  is notified." and demo-aware success messaging.
- `Analytics.jsx`: "Demo data" pill beside the quiz title; all analytics features render unchanged.
- `quizpulse_mockups_v301.html`: three demo-class reference screens added.

### Security / data integrity

#### Demo class isolation (`feat/v3.3-monitoring-isolation`)
- `api/shared/excludeDemo.js` defines the rule in one place (`EXCLUDE_DEMO_FRAGMENT`). Any
  reporting/monitoring endpoint that aggregates across teachers excludes demo data: `metrics.js`
  (real cross-teacher COUNT totals), `schoolsList.js` (per-school class counts), `logsExport.js`
  (`type=security` drops audit entries whose target class is a demo class). Per-teacher Analytics
  is exempt — the teacher is viewing their own demo data on purpose.

### Tests
- Unit (`demoData.test.js`, `demoSendNotification.test.js`), integration (`v3-3.test.js`, gated),
  E2E (`v3-3-demo-class.spec.ts`). Report: `tests/reports/v3.3.0-report.html`. Unit suite green
  (195 passing). `jest.config.cjs` now resolves `api/node_modules` so unit tests can require real
  handler modules with mocks; `metrics.js` switched to lazy Cosmos init.

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
