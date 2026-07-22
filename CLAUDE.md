# QuizPulse — Claude Code Context

> **Status note:** This file describes BOTH the current state and the planned PWA build.
> Sections are tagged **[CURRENT]** (exists now) or **[PLANNED — Sprint N]** (not yet built).
> Do not assume a [PLANNED] feature exists. Check the Feature status table before relying on anything.

---

## What this project is

QuizPulse is a **PWA-first** low-stakes formative assessment tool for school teachers (K–12,
any curriculum). Teachers create short multiple-choice quizzes and send them to students via
**real Web Push notifications**. Students receive a notification, tap it, complete the quiz, and
teachers view live analytics. The differentiator is push-first delivery — no link sharing
required.

**This is a real Progressive Web App built from scratch — NOT a wrapper.** It uses service
workers, the Web Push API, and a web app manifest to behave like a native app without a native
shell or App Store. Capacitor/App Store packaging is a possible future step only if a school
explicitly requires store presence — nothing in the current plan depends on it.

**[CURRENT] state of the app — v4.0.0 (Comprehensive Analytics), on top of v3.3.0 / Sprint 6 (v3.0.0 — MAJOR).**
Sprint 1 (v1.0.0) complete: teachers sign in via Microsoft Entra External ID (CIAM), complete
onboarding, manage real classes (CRUD), build quizzes, and send them. Sprint 2 adds student join
requests, teacher approval UI, name-list validation (fuse.js), class roster, and join code
management. Sprint 3 adds PWA shell (manifest + service worker), approval-gated push
subscriptions, send-notification endpoint, and iOS install guide. Sprint 4 retires simulated
responses: students now take real quizzes at `/quiz`, responses are gated by
approval/duplicate/closed checks, analytics are live (polled, real data, CSV export), failed
submissions queue offline via Background Sync, and quizzes can be scheduled for automatic send.
Sprint 5 adds a full security audit, the shared `assertScope`/`requireRole` authorization helpers
with role tiers, a 404-on-mismatch convention, an append-only `audit_log`, a step-up re-auth
guard, and the institution/school-merge/monitoring admin endpoints — backend only.
Sprint 6 (v3.0.0 — **MAJOR**) adds: SWA Standard tier with linked Function App backend
(`src/api.js` now uses `/api` in prod — **BREAKING**); community question bank (visibility
toggle, school/public browse with search + topic + year filters, upvotes, copy, report,
moderation queue); Azure API Management replacing the in-memory rate limiter; Apple ID as a
third CIAM provider (portal config + docs); analytics depth (class cross-quiz aggregation
endpoint + response timeline chart in the analytics UI). New Cosmos containers: `question_upvotes`,
`question_reports`. New env vars: `COSMOS_CONTAINER_QUESTION_UPVOTES`,
`COSMOS_CONTAINER_QUESTION_REPORTS`.

**v4.0.0 (Comprehensive Analytics) is [CURRENT] — code complete, deploy steps pending.** Class
drill-down (reuses existing `GET /api/analytics?classId=`), a four-cell confidence+correctness
chart with a promoted misconception hero card, an optional topic tag on send, and population
benchmarking (`/teacher/population`, a Results sub-tab) against a pre-aggregated seeded dataset.
Built per the amended plan — `C:\Users\Ryan\Doc\Quizpulse\QuizPulse_Sprint_Plan_v400_v410.docx` as
overridden by `C:\Users\Ryan\Doc\Quizpulse\DESIGN_REVIEW_v400_v410_addendum.md` — NOT the raw
.docx (which had a duplicate endpoint, an IDOR, and a schema that didn't match the real data
model; see the Architecture decisions entry below). **Deploy blocker:** the new
`population_benchmark` Cosmos container must be manually provisioned and seeded before this
feature works in a deployed environment — see `docs/azure/POPULATION_BENCHMARK_SETUP.md` and
Known issues below.

**v4.1.0 (APST Evidence Export) is [CURRENT] — code complete on `release/v4.1-evidence`, not yet
merged to main/deployed.** A per-quiz VIT evidence PDF (`/teacher/evidence`, a two-screen inline
export flow) and an annual aggregate MyPD log PDF, built server-side with pdfkit. Descriptor
text, VTLM 2.0 wording, and reflection templates are verbatim from AITSL/DET source
(`src/data/apstContent.js` + its server-side mirror `api/shared/apstContent.js`). Built per
`C:\Users\Ryan\Doc\Quizpulse\CC_PROMPTS_v410.md` (generated from
`QuizPulse_Sprint_Plan_v400_v410.docx`'s v4.1.0 section, corrected — see that file's "Corrections
from the raw .docx" section — and folded together with `CEO_REVIEW_v420_v430_addendum.md` §4's
amendment). `FEATURE_APST_EXPORT` flipped to `true` as part of this sprint. No breaking changes,
no deploy blockers — the API deploy just needs the new `pdfkit` dependency installed from Node
20/22 before publishing (see Deploy below).

**v4.2.0 (Guided Onboarding & Progressive Disclosure) is [CURRENT] — code complete on
`release/v4.2-onboarding`, not yet merged to main/deployed.** An optional teacher profile
(subjects, year levels, class count, registration status) collected via a 5-step onboarding
wizard, a nine-key server-eligibility "progressive disclosure" engine that surfaces one
feature-intro card at a time as a teacher hits real milestones (never more than one promotional
element per page render), and a topic-dropdown prefilter on Send. Built per
`C:\Users\Ryan\Doc\Quizpulse\CC_PROMPTS_v420_v430.md` as overridden by
`C:\Users\Ryan\Doc\Quizpulse\CEO_REVIEW_v420_v430_addendum.md` (addendum wins on conflict — same
convention as v4.0.0's design-review addendum). No breaking changes, no deploy blockers — every
new field is additive and legacy teacher docs are treated as empty.

**v4.3.0 (AI Quiz Generation, provider placeholder) is [CURRENT] — code complete on
`release/v4.3-generation`, not yet merged to main/deployed.** Document upload (PDF/docx/txt,
15MB cap) → mock-LLM draft (default provider, no API key required) → teacher review/approve →
send through the normal SendQuiz flow, plus spaced repeats for ANY quiz and misconception-
triggered follow-up practice. Built per `CC_PROMPTS_v420_v430.md` as amended by
`CEO_REVIEW_v420_v430_addendum.md` (addendum wins on conflict). No real LLM key required or used
in this build — `FEATURE_AI_GENERATION` is flipped true, but `LLM_PROVIDER` defaults to `mock`.

**v4.5.0 (Student Class Home & Post-Approval Access) is [CURRENT] — code complete, not yet
deployed.** Fixes the student dead-end after approval: a persistent `/student/class` page
(open/closed/answered quiz cards, warm empty state, Refresh button, no polling), a "Go to my
class" CTA on the approved screen, auto-subscribe to push right there (no GUID paste, never
throws — denied/unsupported are soft states), localStorage-based returning-device recognition
("Continue to my class" on `/join`), and a teacher-facing copyable `/quiz?quizId=` share link on
Send (manual escape hatch for a flaky push). New endpoint `GET /api/student/quizzes` (anonymous,
in-partition via the new shared `api/shared/getApprovedJoinRequest.js` helper — 403 uniform on
an unapproved device, metadata only, demo-excluded, capped at 50). `/student/subscribe` (the
GUID-paste page) is retired; `/student/class` is wired into both the pageView allowlist and the
`/quiz` privacy-stripping rule (same student-fingerprint-stripping posture). No new Cosmos
container, no breaking changes. Built per
`C:\Users\Ryan\Doc\Quizpulse\QuizPulse_Sprint_Plan_v450.md` (CEO/Eng/Design reviewed 2026-07-23).
Built directly on `main` in one session rather than the release-branch-per-task flow the plan
describes — same pragmatic single-session deviation v4.0–v4.4 used; not yet tagged/merged per
the branch convention.

**v4.4.0 (Traffic Monitor) is [CURRENT] — code complete on `release/v4.4-traffic`, not yet merged
to main/deployed.** Adopted from the demo repo (`github.com/effriantoryan-eng/quizpulse`); prompt
in `C:\Users\Ryan\Doc\Quizpulse\CC_PROMPTS_v440.md` (reviewed via `/review` + `/plan-eng-review`,
10 findings folded in before the build). Zero dependencies on v4.1–v4.3. Hardens the traffic WRITE
path that was already live (`src/hooks/usePageView.js` → `api/pageView.js` → a self-created
`pageviews` Cosmos container, since the baseline import) — fixed the visitor-UUID key bug, the
runtime `createIfNotExists`, and added a route allowlist, a student-privacy field-stripping rule,
and `quizId` attribution. Adds the read side: `GET /api/manage/traffic` (owner/support, 60 req/hr),
an admin-portal Traffic page, a notification→open→submit funnel (per-class in-partition roster
resolution, legacy quizzes excluded from denominators rather than coerced to 0), PWA-install
tracking from any route, real `pushSuccessCount`/`pushFailCount` on quiz docs (advisory write),
and de-stubs `usageGrowth`/`engagement` in `manage/metrics` (`systemHealth`/`security`/`spending`
stay stubbed — App Insights wiring remains out of scope). No new paid Azure services. 345/345
unit tests pass; integration tests are written (`tests/integration/api/v440-traffic.test.js`) but
not run in the build session — no live `func start` + test Cosmos available. **Deploy blocker:**
the `pageviews` container's 180-day TTL must be set manually before deploying the hardened API
(it no longer self-creates the container) — see `docs/azure/V440_CONTAINERS_SETUP.md` and Known
issues below. (That doc originally also called for a dedicated per-container RU cap; corrected
2026-07-16 — `quizpulse-app-db-av5z18` runs in Serverless capacity mode, which has no
per-container throughput setting at all, so that instruction was never achievable.)

---

## Tech stack

| Layer | Technology | Status |
|---|---|---|
| Frontend | React + Vite (SPA, React Router v6) | [CURRENT] |
| Hosting | Azure Static Web Apps (free tier → Standard in Sprint 6) | [CURRENT] |
| Backend | Azure Functions — Node.js v4, HTTP-triggered, serverless | [CURRENT] |
| Database | Azure Cosmos DB (NoSQL, serverless mode) | [CURRENT] |
| Auth | Microsoft Entra External ID — CIAM (Microsoft provider; Google in Sprint 3; Apple ID in Sprint 6) | [CURRENT] (Sprint 1 complete) |
| Secrets | Azure Key Vault — managed identity references | [CURRENT] |
| Logging | Azure Application Insights | [CURRENT] |
| Push | Web Push API + VAPID (service worker, no native SDK) | [CURRENT] — Sprint 3 complete |
| Fuzzy match | fuse.js (name-list validation, server-side) | [CURRENT] — Sprint 2 complete |
| Testing | jest + vitest (unit), supertest (integration), Playwright (E2E) | [CURRENT] — Sprint 5 suite live (102/102 unit pass) |
| Rate limiting | in-memory per-instance → Azure API Management | [CURRENT] → [PLANNED — Sprint 6] |
| CI/CD | GitHub Actions — develop → PR → main → SWA auto-deploy | [CURRENT] |

---

## Local paths

- Project root: `C:\Users\Ryan\quizpulse - PWA\`
- Changelog (breaking changes, new features, fixes — introduced Sprint 4): `CHANGELOG.md`
- Frontend source: `src/`
- Azure Functions: `api/`
- Built output: `dist/`
- Tests: `tests/` (mirrors src/ and api/ structure)
- Test reports: `tests/reports/sprintN-report.html`
- Sprint 1 report: `tests/reports/sprint1-report.html`
- Sprint 2 report: `tests/reports/sprint2-report.html`
- Sprint 3 report: `tests/reports/sprint3-report.html`
- Sprint 4 report: `tests/reports/sprint4-report.html`
- Sprint 5 report: `tests/reports/sprint5-report.html`
- Sprint 5 security audit: `docs/security/SPRINT5_AUDIT.md`
- Sprint 1 test checklist: `SPRINT_TEST_CHECKLIST.md`
- Spike reference repo: `C:\Users\Ryan\quizpulse-pwa-test\` (validated Web Push — reference only, never merged)
- v4.0.0 sprint plan: `C:\Users\Ryan\Doc\Quizpulse\QuizPulse_Sprint_Plan_v400_v410.docx`
  — amended by `C:\Users\Ryan\Doc\Quizpulse\DESIGN_REVIEW_v400_v410_addendum.md` (addendum wins on conflict)
- v4.1.0 sprint prompt: `C:\Users\Ryan\Doc\Quizpulse\CC_PROMPTS_v410.md` — generated from the
  .docx above's v4.1.0 section, corrected (see that file's "Corrections from the raw .docx"), and
  folded together with `CEO_REVIEW_v420_v430_addendum.md` §4's amendment. Build from this file,
  not the raw .docx. Its APST/VTLM source text: `C:\Users\Ryan\Downloads\QuizPulse_VIT_Export_Research_Brief.docx`.
- v4.4.0 sprint prompt: `C:\Users\Ryan\Doc\Quizpulse\CC_PROMPTS_v440.md` (no .docx — the prompt file is the source of truth)
- Graphify knowledge graph: `graphify-out/` — committed so all AI assistants share the same codebase index
  - `graphify-out/graph.json` — queryable JSON graph (697 nodes, 1091 edges)
  - `graphify-out/GRAPH_REPORT.md` — architecture report
  - `graphify-out/graph.html` — interactive visualization

**Documentation discipline:** Re-run `graphify update .` (or `graphify . --no-label`) and commit updated `graphify-out/` whenever a sprint adds new files or significant structural changes.

---

## Live URLs

- Production site: `https://nice-field-0127b5b00.7.azurestaticapps.net` (SWA in East Asia)
- Function App (direct): `https://quizpulse-app-api-av5z18.azurewebsites.net/api`
- GitHub repo: `https://github.com/effriantoryan-eng/quizpulse-app` (private)
- Spike repo: `https://github.com/effriantoryan-eng/quizpulse-pwa-test` (private)
- Resource group: `quizpulse-app-rg` (Australia East)
- Unique suffix: `av5z18` (all resource names use this suffix)

---

## Running locally

Three terminals required:

```powershell
# Terminal 1 — React dev server
cd "C:\Users\Ryan\quizpulse - PWA"
npm run dev        # -> localhost:5173

# Terminal 2 — Azure Functions
cd "C:\Users\Ryan\quizpulse - PWA\api"
func start         # -> localhost:7071

# Terminal 3 — Azurite storage emulator
azurite --silent
```

**Auth local dev:** `api/local.settings.json` must have `B2C_ALLOW_UNVERIFIED_DEV=true` for JWT
decode-only mode (no signature verification). Real tenant values (`AUTH_TENANT_SUBDOMAIN`,
`AUTH_TENANT_ID`, `AUTH_CLIENT_ID`) are already set in `local.settings.json`. See `docs/azure/B2C_SETUP.md`.

**CORS local dev:** `host.json`'s `cors` block only applies to the *deployed* Function App —
`func start` ignores it entirely, so every fetch from `localhost:5173` to `localhost:7071` fails
preflight with a CORS error unless `api/local.settings.json` also has a top-level `Host` section:
```json
"Host": { "CORS": "http://localhost:5173,http://localhost:5174", "CORSCredentials": false }
```
`local.settings.json` is gitignored (per-dev secrets), so this has to be added manually on each
machine — it's not something a repo checkout gives you for free.

**Important:** Do not use `&&` in PowerShell — run commands on separate lines.

---

## Git version control strategy

Release-branch model. Feature branches cut from the sprint's release branch, merged back via PR;
release branch merges to `develop`, then to `main` on production release.

```
main                          (production — tagged releases only)
└── develop                   (integration)
    ├── release/v1.0-sprint1  ← merged to develop after v1.0.0-rc1 tag
    │   ├── feat/s1-b2c-auth            (merged)
    │   ├── feat/s1-school-identity-model (merged)
    │   ├── feat/s1-classes-crud          (merged)
    │   ├── feat/s1-community-placeholder (merged)
    │   ├── feat/s1-azure-spending-controls (merged)
    │   └── feat/s1-tests                (merged)
    ├── release/v1.1-sprint2  ← next sprint
    ├── release/v4.0-analytics  ← [PLANNED] cut after v3.3.0 on main; see feature branches below
    ├── release/v4.1-evidence   ← [CURRENT] cut from develop after v4.0.x; see feature branches below
    ├── release/v4.2-onboarding ← [CURRENT] cut from develop after v4.0.x; see feature branches below
    ├── release/v4.3-generation ← [CURRENT] cut from develop; see feature branches below
    ├── release/v4.4-traffic    ← [PLANNED] cut from develop; NO dependencies — buildable in any gap
    └── hotfix/v1.0.1-description  ← from main when needed
```

**v4.0.0 implementation note:** built directly on `release/v4.0-analytics` as a series of commits
mirroring the `feat/v4.0-*` task boundaries below, rather than separate branches + PRs per task —
a pragmatic deviation for a single agent-paired session; the release branch itself still follows
the tag → merge develop → merge main flow. `feat/v4.0-response-schema` (topicTag + schoolId only,
per the amended field list — no `correct`/`confidenceLevel`/`yearLevel`/`isPopulationSeed`),
`feat/v4.0-topic-tag-ui`, `feat/v4.0-population-seed` (writes to `population_benchmark`, not
`responses`), `feat/v4.0-analytics-ui` (extends existing `buildQuestionBreakdown`, no new
class-analytics endpoint), `feat/v4.0-tests`.

**v4.1.0 implementation note:** built directly on `release/v4.1-evidence` as a series of commits
mirroring the task boundaries below, rather than separate branches + PRs per task — same
pragmatic single-branch deviation v4.0.0 used. Tasks covered: `apstContent.js` data module
(verbatim AITSL/DET content, reviewed separately from code review before rc1), the
`/teacher/evidence` route + two-screen export flow, `api/evidenceExport.js` +
`api/evidenceAnnualLog.js` (pdfkit), flipping `FEATURE_APST_EXPORT` and verifying
`apst_intro`/`mypd_intro` land on the route (CEO review addendum §4), and unit + integration
tests. Tag `v4.1.0-rc1` → tests pass → merge develop → merge main → tag `v4.1.0`.

**v4.2.0 feature branches** (`release/v4.2-onboarding`, cut from `develop` after v4.0.x, per one
branch per task per the prompt — not the v4.0.0 single-branch deviation):
`feat/v4.2-profile-schema`, `feat/v4.2-onboarding-wizard`, `feat/v4.2-disclosure-engine`,
`feat/v4.2-topic-prefilter`, `feat/v4.2-tests`. Tag `v4.2.0-rc1` → tests pass → merge develop →
merge main → tag `v4.2.0`.

**v4.3.0 implementation note:** built directly on `release/v4.3-generation` as five staged
commits (source upload/extraction/chunking; LLM adapter + draft schema + mock provider; draft
endpoints + approve + expand + send-transition; GenerateQuiz/ReviewDraft UI; misconception
expansion nudges), each verified end-to-end against a live local func host before the next
started — same pragmatic single-branch deviation v4.0.0/v4.1.0 used. The 15MB multipart spike
was verified locally (`request.formData()` handled a real 15MB file without truncation); the SWA
linked-backend proxy path still needs verification against a live deployment before this ships
to production — see `docs/azure/V430_CONTAINERS_SETUP.md`. Full prompt (with all CEO/eng/design
review amendments folded in) lives in `CC_PROMPTS_v420_v430.md` — built from that file, not the
raw `QuizPulse_Sprint_Plan_v420_v430.docx`, which carries a supersession notice. One scope cut
from the addendum's full spec: the Results-list-level "Create follow-up practice" nudge (lazy
evaluation across the 10 most recent closed lineage-bearing quizzes) was not built — the same
capability exists in the Analytics drill-down (built) and the misconception hero card (built);
the list-level surface is a secondary entry point to the identical action, deferred to a
follow-up rather than adding to an already-large sprint.

**v4.4.0 feature branches** (`release/v4.4-traffic`, cut from `develop` — no version-order
dependency, one branch per task, all merged): `feat/v4.4-pageview-hardening` (fixed the
inherited pageView write path), `feat/v4.4-traffic-endpoint`, `feat/v4.4-funnel-and-destub`,
`feat/v4.4-pwa-install-tracking`, `feat/v4.4-admin-traffic-ui`, `feat/v4.4-tests` — all six
merged into `release/v4.4-traffic`. Still pending: tag `v4.4.0-rc1` → merge develop → merge
main → tag `v4.4.0`. Full prompt: `CC_PROMPTS_v440.md`.

### Version numbering

| Sprint | Version | Rationale |
|---|---|---|
| 1 | v1.0.0 | Foundation — multi-provider auth + real data model |
| 2 | v1.1.0 | Student join, approval, name-list validation |
| 3 | v1.2.0 | PWA shell + push infrastructure |
| 4 | v2.0.0 | **MAJOR** — first real end-to-end loop; simulate endpoint retired (breaking) |
| 5 | v2.1.0 | Institution layer, super admin, monitoring portal |
| 6 | v3.0.0 | **MAJOR** — community bank + direct URL workaround removed (breaking) |
| 7 | v4.0.0 | Comprehensive analytics — class drill-down, confidence+correctness four-cell chart, population benchmarking |
| 8 | v4.1.0 | APST evidence export — per-quiz VIT artefact + annual MyPD aggregate log (PDF) |
| 9 | v4.2.0 | Guided onboarding & progressive disclosure — profile wizard, nine-key feature-intro engine, topic prefilter |
| 10 | v4.3.0 | AI quiz generation (mock provider) — document upload, draft review, spaced repeats, teacher-mediated expansion |
| 11 | v4.4.0 | Traffic monitor — page-view analytics + admin Traffic dashboard, quiz funnel, PWA-install + push-delivery tracking, metrics de-stub |

### Rules

- Every merge to `main` gets a git tag matching the version (e.g. `v1.0.0`).
- Every release branch gets a pre-release RC tag before merging (e.g. `v1.1.0-rc1`).
- **Updating this CLAUDE.md is a required commit on every sprint branch before it can close.**
- `CHANGELOG.md` is introduced at Sprint 4 (first breaking change), updated every sprint after.
- Hotfix: `hotfix/vX.Y.Z-description` from main → tag patch → back-merge to develop.
- Spike repo is tagged `spike/pwa-push-validated` and is reference only — never merged. Cherry-pick files (sw.js, subscribe.js, sendNotification.js) into Sprint 3 feature branches.

### Deploy

```powershell
# Frontend — push to develop, PR to main → GitHub Actions auto-deploys to SWA
# API — must be deployed separately every time api/ changes:
cd api
func azure functionapp publish quizpulse-app-api-av5z18
```

> **⚠️ Deploy the API only from Node 20 or 22 — never Node 24.** `func azure functionapp publish`
> writes the **local** Node major version into the remote `linuxFxVersion`. Deploying from Node 24
> sets an unsupported `Node|24` worker stack on the Function App (runtime `~4` supports 18/20/22),
> the worker never starts, and the **whole app + SCM/Kudu go to 503 with zero telemetry** (this
> exact outage happened on the v1.2.0 deploy, 2026-06-15). The Function App currently runs
> `NODE|22`. If a deploy ever bumps it, fix with:
> `az functionapp config set -g quizpulse-app-rg -n quizpulse-app-api-av5z18 --linux-fx-version '"NODE|22"'`
> then restart. No `nvm` is installed locally — install nvm-windows and `nvm use 22` before deploying.

---

## Sprint roadmap (summary)

Full spec lives in `QuizPulse_PWA_Development_Plan.docx`. Sprints 1–4 are a complete pilot-ready
product; 5–6 add institution machinery and can be funded from pilot revenue.

1. **v1.0.0 — Foundation.** Entra External ID auth (Microsoft), school identity model, real classes CRUD,
   community bank placeholder field, Azure $100 spending controls.
2. **v1.1.0 — Student join & approval.** Join requests, teacher approval UI (individual + batch),
   optional name-list validation with fuzzy matching.
3. **v1.2.0 — Push infrastructure.** PWA shell (manifest + service worker), approval-gated
   subscriptions, scoped send-notification, iOS install guide.
4. **v2.0.0 — Student quiz flow & analytics.** Real quiz-taking, response submission, offline
   resilience, live analytics, scheduling. Simulate endpoint retired.
5. **v2.1.0 — Institution & admin.** Security/authorization foundation, school validation + merge
   tool, institution onboarding, stubbed monitoring endpoints with log export — backend only, no
   admin frontend (Sprint 7, separate site).
6. **v3.0.0 — Community bank & hardening.** Cross-school question sharing, SWA Standard tier,
   API Management, Apple ID auth, analytics depth.
7. **v4.0.0 — Comprehensive analytics.** [CURRENT — code complete, deploy steps pending] Class
   drill-down, four-cell confidence+correctness chart, population benchmarking against a seeded
   synthetic dataset. Reviewed 2026-07-03 (design + eng), implemented same day.
8. **v4.1.0 — APST evidence export.** [CURRENT — code complete on `release/v4.1-evidence`, not
   yet deployed] Per-quiz VIT evidence PDF + annual MyPD aggregate log, editable reflection
   prompts, pre-populated APST/VTLM 2.0 fields. Reviewed 2026-07-03 (design + eng), implemented
   2026-07-15.
9. **v4.2.0 — Guided onboarding & progressive disclosure.** [CURRENT — code complete on
   `release/v4.2-onboarding`, not yet deployed] Optional teacher profile via a 5-step wizard,
   nine-key server-eligibility feature-intro engine, topic-dropdown prefilter on Send. Reviewed
   2026-07-11 (CEO + eng + design).
10. **v4.3.0 — AI quiz generation (provider placeholder).** [CURRENT — code complete on
    `release/v4.3-generation`, not yet deployed] Document upload → mock-LLM draft quiz → teacher
    review/approve, spaced-repeat scheduling for any quiz, teacher-mediated follow-up expansion
    from misconceptions. No real LLM key required — ships and tests entirely against a mock
    provider. Reviewed 2026-07-11 (CEO + eng + design), implemented 2026-07-15.
11. **v4.4.0 — Traffic monitor.** [CURRENT — code complete on `release/v4.4-traffic`, not yet
    deployed] Hardened the already-live page-view write path (`usePageView` → `POST /api/pageView`
    → `pageviews` container), added `GET /api/manage/traffic` + an admin-portal Traffic page
    (uniques, sessions, top pages, audience/device/browser splits), a notification→open→submit
    funnel, PWA-install tracking, real push-delivery counts on quiz docs, and de-stubbed the
    Cosmos-answerable `manage/metrics` groups. No dependencies on v4.1–v4.3; no new paid services.
    Reviewed 2026-07-15 (`/review` + `/plan-eng-review`); prompt in `CC_PROMPTS_v440.md`.

---

## Data model

### [CURRENT] containers

- `questions` — { id, teacherId, authorId, visibility, text, options[], correctIndex, topic, createdAt }
- `quizzes` — { id, teacherId, name, questionIds[], classIds[], status, classSize, sentAt, createdAt, isDemo?, topicTag?, schoolId?, confidenceResponseCount? } — `isDemo` (default false, non-breaking) added v3.3.0; legacy docs without it are treated as `isDemo=false`. `topicTag` (string, preset enum) and `schoolId` (string, resolved server-side from the teacher's own record at send time — never client-supplied) are **[CURRENT — v4.0.0]**, optional (teacher can send without picking a topic; that quiz simply doesn't contribute to population benchmarking — see Security limits / D3 in the addendum). `confidenceResponseCount` (int) is **[CURRENT — v4.2.0]**, a denormalised counter incremented via an atomic Cosmos `incr` patch at response-submit time (both `api/responses.js` and `api/shared/runSimulation.js`) — read only by `introEligibility.js`'s `analytics_intro`/`misconception_intro` milestones; a legacy quiz with no field is treated as 0.
- `responses` — { id, quizId, studentId, answers[]: { questionId, selectedIndex, confidence: "sure"|"pretty_sure"|"guessing", responseTimeMs? }, quizDurationMs?, completedAt, isDemo?, simulated?, topicTag?, schoolId? } — `confidence` and `responseTimeMs` added in v3.2.0 (Confidence Layer); `isDemo`/`simulated` (default false, non-breaking) added v3.3.0 for simulated demo-class responses. Legacy docs without these fields are tolerated: `confidentButIncorrect` counts 0 for answers with no confidence field. `topicTag`/`schoolId` are **[CURRENT — v4.0.0]**, copied server-side from the parent quiz doc at submit time in `api/responses.js` (students submit anonymously — there is no claim to read these from). **No `correct`, `confidenceLevel`, `yearLevel`, or `isPopulationSeed` field is added** — the original .docx spec included these, but correctness/confidence already live in `answers[]` (per-answer, not per-response) and `yearLevel` is a pure function of `topicTag`; see `DESIGN_REVIEW_v400_v410_addendum.md` §E0.
- `teachers` — { id, teacherId, schoolId, schoolStatus, name, email, idp, role, createdAt, profile?, featureIntros? } (pk `/id`) — `profile` (`{subjects[], yearLevels[], classCount, registrationStatus}`, all optional/independent) and `featureIntros` (`{[key]: {shownAt?, dismissedAt?}}` for the nine keys in `api/shared/featureIntros.js`) are **[CURRENT — v4.2.0]**, additive; a legacy teacher doc with neither field is treated as `profile:{}`/`featureIntros:{}` everywhere (`GET /api/me`, `introEligibility.js`, the SendQuiz topic prefilter).
- `schools` — { id, name, status, sector, suburb, state, mergedIntoId, createdAt, validatedAt } (pk `/id`)
- `classes` — { id, teacherId, schoolId, name, studentCount, joinCode, nameList[], nameListEnabled, cap, createdAt, isDemo?, demoStudents? } (pk `/teacherId`) — `isDemo` (default false, non-breaking) added v3.3.0. When `isDemo=true`: the class has no `joinCode` (never joinable) and no `nameList`, and carries `demoStudents: [{ studentId: <uuid>, name: <string> }]` (24 entries, generated server-side at create time via `api/shared/demoNames.js`, never client-provided). Max 1 demo class per teacher; demo classes do NOT count toward the 20-real-class cap. `GET /api/classes` returns `isDemo` + `demoStudentCount` (the raw `demoStudents` array is dropped from the list payload).
- `audit_log` [Sprint 5] (pk `/actorId`) — { id, actorId, actorRole, action, targetType, targetId,
  before, after, ip, createdAt }. Append-only — `api/shared/auditLog.js` exports only
  `writeAudit()`, no update/delete path. Manual provisioning:
  `docs/azure/SPRINT5_CONTAINERS_SETUP.md`.
- `invites` [Sprint 5] (pk `/schoolId`) — { id, schoolId, token, createdAt, expiresAt, used }.
  One-time teacher-invite links, 7-day expiry, max 50 pending per school. Manual provisioning:
  `docs/azure/SPRINT5_CONTAINERS_SETUP.md`.

Note: only `teachers` and `classes` carry an **authorization-relevant** `schoolId`.
`questions`/`quizzes`/`responses` are scoped by `teacherId`/`quizId`, never `schoolId` — the
optional `schoolId` added to quizzes/responses in v4.0.0 is a denormalised benchmark tag only,
never read by any ownership check, and deliberately NOT re-pointed by school merge
(`POST /api/manage/schools/merge` still only re-points `teachers` and `classes`; stale benchmark
attribution on old responses is accepted).

### [PLANNED] new/changed containers

- **`join_requests`** [Sprint 2] (pk `/classId`) — { id, classId, schoolId, teacherId,
  studentName, deviceId, status: "pending|approved|rejected|queued", matchedName, matchScore, createdAt }
- **`subscriptions`** ~~[Sprint 3]~~ **[CURRENT — Sprint 3 complete]** (pk `/classId`) — { id, classId, deviceId, endpoint, keys: { p256dh, auth }, createdAt, updatedAt }
- **`question_upvotes`** ~~[Sprint 6]~~ **[CURRENT — Sprint 6]** (pk `/questionId`) — { id, questionId, teacherId, createdAt }. Env: `COSMOS_CONTAINER_QUESTION_UPVOTES`. Provisioning: `docs/azure/SPRINT6_CONTAINERS_SETUP.md`.
- **`question_reports`** [CURRENT — Sprint 6] (pk `/questionId`) — { id, questionId, teacherId, reason, createdAt }. Env: `COSMOS_CONTAINER_QUESTION_REPORTS`. Max 20 reports/teacher/day; visible to support/platform_admin via `GET /api/questions/reports`.
- **`population_benchmark`** ~~[PLANNED — v4.0.0]~~ **[CURRENT — v4.0.0]** (provisioned + seeded 2026-07-03) (pk `/topicTag`) — { id, topicTag, pctCorrect,
  pctConfidentIncorrect, responseCount, ... } — **~12 pre-aggregated topic-rollup docs**, one per
  preset topic tag, written once by `api/seed/populationSeed.js` (idempotent, run manually, never
  via API). Env: `COSMOS_CONTAINER_POPULATION_BENCHMARK`. **This replaces the .docx's original
  design of ~37,500 raw synthetic response docs seeded into `responses`** — that would have
  cross-partition-scanned the transactional container on every Population page load. `GET
  /api/analytics/population` does a point-read per topic against this container instead. See
  `DESIGN_REVIEW_v400_v410_addendum.md` §E1.
- **`pageviews`** **[CURRENT — formalized in v4.4.0]** (pk `/teacherId` — the field actually
  holds the anonymous visitor device UUID, the name is historical) —
  { id, page, teacherId, sessionId, eventType, quizId?, referrer, userAgent, language, timezone,
  screenWidth, screenHeight, visitedAt }. Written by `api/pageView.js` (anonymous, 60/min/IP,
  4 KB cap) on every SPA route change via `src/hooks/usePageView.js`. `page` is bucketed through
  `api/shared/pageViewAllowlist.js` server-side — an unrecognised value is stored as `'other'`,
  never rejected. `eventType` (`'view'|'pwa_install'`, default `'view'`) added v4.4.0; a legacy
  doc with no `eventType` field counts as `'view'` in every aggregate (mandatory regression,
  tested). **Student privacy posture (v4.4.0):** on `/quiz`, `referrer`/`userAgent`/`language`/
  `timezone`/`screenWidth`/`screenHeight` are always `null` — enforced server-side regardless of
  what the client sends — and `quizId` (from the `?quizId=` query param) is the one extra field
  carried, feeding the `manage/traffic` funnel's per-quiz open attribution. Came over in the
  baseline import from the demo repo; the pre-v4.4.0 code self-created this container via runtime
  `createIfNotExists` — v4.4.0 removed that (lazy init from `COSMOS_CONTAINER_PAGEVIEWS`, matching
  every other container's manual-provisioning convention) and added a 180-day TTL. (No
  per-container RU cap — the account runs in Serverless capacity mode, which doesn't support one;
  see the correction in `docs/azure/V440_CONTAINERS_SETUP.md`.) Env: `COSMOS_CONTAINER_PAGEVIEWS`.
  Provisioning: `docs/azure/V440_CONTAINERS_SETUP.md`.
- **`source_materials`** **[CURRENT — v4.3.0]** (pk `/teacherId`, 90-day TTL) — { id, teacherId,
  kind: 'pdf'|'docx'|'txt', filename, pageCount (pdf only, else null), chunks: [{ index, page?,
  text }], chunkCount, truncated, createdAt }. Written by `POST /api/generation/sources`. **The
  original uploaded binary is never persisted** — only extracted text + chunk boundaries, per the
  sprint's copyright/privacy constraint. Env: `COSMOS_CONTAINER_SOURCE_MATERIALS`. Provisioning:
  `docs/azure/V430_CONTAINERS_SETUP.md`.
- **`quiz_drafts`** **[CURRENT — v4.3.0]** (pk `/teacherId`, no TTL) — { id, teacherId, sourceId,
  sourceKind, chunkPageMap ({chunkIndex: page|null}, snapshotted at creation), unitPlanId,
  topicTag, range, provider, pagesUsed, questions: [{ text, options, correctIndex, sourceRef,
  reviewed, topicTag? }], status: 'draft'|'approved', expandedFromQuizId?, createdAt, updatedAt }.
  Written by `POST /api/generation/drafts` and `POST /api/generation/expand`. Env:
  `COSMOS_CONTAINER_QUIZ_DRAFTS`. Provisioning: `docs/azure/V430_CONTAINERS_SETUP.md`.

### Field additions to existing documents

- ~~[Sprint 1] `schoolId` + `schoolStatus` (denormalised) on teacher, class~~ — **DONE** (on teacher and class docs)
- ~~[Sprint 1] `visibility: "private|school|public"` + `authorId` on questions~~ — **DONE** (visibility='private', authorId=oid)
- ~~[Sprint 1] `role: "teacher|school_admin|super_admin"` on teacher~~ — **DONE** (role='teacher';
  display-only DB field — authorization never reads it, see Authorization model below)
- ~~[Sprint 4] `closedAt` on quizzes~~ — **DONE** (derived server-side from teacher-configured `durationMinutes` at send time; also `scheduledFor` for scheduled quizzes)
- [Sprint 6] `upvotes`, `usageCount` on questions
- ~~[v4.0.0] `topicTag` + `schoolId` on quiz and response~~ — **DONE** (optional teacher dropdown +
  server-resolved schoolId at send time; both copied from quiz onto each response at submit time).
  See Data model above and Architecture decisions below.
- ~~[v4.4.0] `pushSuccessCount` + `pushFailCount` on quizzes~~ — **DONE** (additive, set
  server-side at send time by `sendNotificationForQuiz()` — both manual send and
  `scheduledQuizSend`; the demo branch skips push and writes nothing). The write is advisory
  (try/catch, same semantics as `confidenceResponseCount`) — a persistence hiccup never fails
  the send, since the pushes already went out. A legacy quiz with neither field is excluded from
  `manage/traffic`'s funnel and `manage/metrics`' `pushDeliveryRate` denominators, never coerced
  to 0 (would inflate rates past 100% for any range spanning the v4.4.0 deploy). Feeds the real
  `pushDeliveryRate` in `manage/metrics` and the funnel in `manage/traffic`.
- ~~[v4.3.0] `generatedBy`, `sourceId`, `sourceRef`, `sourceRefLabel` on questions~~ — **DONE**.
  Set only on AI-materialised questions (`generatedBy: 'ai'`); `visibility` is locked `'private'`
  at materialisation and `api/questions.js`'s PUT rejects any attempt to change it. `sourceRef`
  (chunk indexes) and `sourceRefLabel` (a resolved display string, e.g. "pages 34-36" or "section
  3") are computed once at approve time from the draft's `chunkPageMap` snapshot — Analytics'
  drill-down (3s-polled) never needs a source read to show a citation.
- ~~[v4.3.0] `sourceId`, `draftId`, `parentQuizId` on quizzes~~ — **DONE**. `sourceId`/`draftId`
  link an approved AI quiz back to its source/draft (lineage — see Architecture decisions below).
  `parentQuizId` marks a spaced-repeat clone (E3) and points at the quiz it was cloned from;
  clones are excluded from population-benchmark aggregation and from `introEligibility.js`'s
  milestone counts (`NOT IS_DEFINED(c.parentQuizId)`) so a send + N repeats can't inflate them.

---

## Architecture decisions

### API routing — IMPORTANT [CURRENT — Sprint 6]

`src/api.js` now uses `/api` in production (relative URL, proxied through SWA Standard's linked
backend). The Sprint 1–5 direct Function App URL workaround is retired.

```js
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : '/api'
```

**Do not revert to the Function App URL** — SWA Standard tier proxies all `/api/*` requests to
the linked Function App. The `staticwebapp.config.json` no longer has an explicit `/api/*` rewrite
route (Standard tier manages the backend link). See `docs/azure/SWA_STANDARD_UPGRADE.md` for
the portal steps to complete the SWA → Standard upgrade and backend linking.

For local dev, `localhost:5173` (Vite) still hits `localhost:7071` (func start) directly.

### Auth [CURRENT — Sprint 1 complete; sign-up added v3.2.1]

Microsoft Entra External ID (CIAM) with MSAL (`@azure/msal-browser` + `@azure/msal-react`).
Tenant: `quizpulseid.onmicrosoft.com` (tenant ID `19567cd0-0f52-46f7-9ac5-699538443ed1`);
app registration client ID `bf3647a0-e091-42ef-b0c7-dc423d5dc5f3`. Microsoft provider live;
Google in Sprint 2 (requires Google Cloud OAuth setup); Apple ID in Sprint 6.
Authority: `https://quizpulseid.ciamlogin.com/{tenantId}` — no policy name (unlike B2C).
Bearer token is the MSAL ID token (RS256, signed by CIAM); backend validates via JWKS at
`https://quizpulseid.ciamlogin.com/{tenantId}/discovery/v2.0/keys`.
`teacherId` = `oid` claim (stable across providers). `AuthContext.jsx` exposes
`{ user, teacherId, loading, isAuthenticated, login, logout }`.
`src/msalInstance.js` patches `window.fetch` to attach bearer tokens to all API calls silently.
New teachers are gated through `/onboarding` (`GET /api/me` → `onboarded: false` → redirect).
See `docs/azure/B2C_SETUP.md` for manual tenant configuration steps.

**Sign-up flow (v3.2.1):** `src/authConfig.js` exports `signUpRequest = { scopes: ['openid',
'offline_access'], prompt: 'create' }`. `Login.jsx` has a "Create an account" button that
calls `instance.loginRedirect(signUpRequest)`. Entra External ID (CIAM) interprets
`prompt=create` as a request to show the account-creation form rather than the sign-in form
— same authority URL, same redirect URI, no extra portal config beyond enabling self-service
sign-up on the external tenant (see `docs/fixes/SIGNUP_SETUP.md` for the portal steps).
After CIAM sign-up the app receives a normal token and routes through the same onboarding
flow as a sign-in: `GET /api/me` → `{ onboarded: false }` → `/onboarding` → school name →
`POST /api/onboarding` (idempotent, role always server-set to `'teacher'`).

**Redirect URIs the app depends on:**
- `https://nice-field-0127b5b00.7.azurestaticapps.net` — production (sign-in + sign-up)
- `http://localhost:5173` — local dev (sign-in + sign-up)
Both are registered under the same app registration. No separate URI is needed for sign-up.

### Service worker [CURRENT — Sprint 4]

`public/sw.js` handles `push` (showNotification), `notificationclick` (navigates to
`/quiz?quizId=`), and `sync` (Background Sync, tag `sync-responses`). Registered in
`src/main.jsx` after React mounts via `navigator.serviceWorker.register('/sw.js')`.
`SWUpdateBanner` in App.jsx detects a waiting SW and shows a "Refresh" prompt. SW calls
`skipWaiting()` on install and `clients.claim()` on activate for immediate takeover.
Background Sync logic (IndexedDB store `pending-responses`) is duplicated between
`public/sw.js` (classic script, no ES module support) and `src/offlineQueue.js` (main-thread
queueing) — keep the store name/shape in sync if either changes.

### Quiz lifecycle & student quiz-taking [CURRENT — Sprint 4]

`closedAt` is computed server-side from a teacher-entered `durationMinutes` (min 5) at send
time — never trust a client-supplied `closedAt`. Since the 2026-07-06 pre-release review,
**`sentAt` is also server-set** on send: `POST /api/quizzes` ignores any body-supplied `sentAt`
(deriving `closedAt` from a client timestamp let a crafted `sentAt` hold a quiz open past its
duration, and a malformed one threw a 500). `POST /api/responses` re-checks `closedAt`,
duplicate submission (same `studentId` + `quizId`), and approved-join-request ownership on every
call, since the student-facing `/quiz` route has no auth. `studentId` is the same device UUID
(`quizpulse_device_id`) used for join requests and push subscriptions — there is no separate
student identity. `GET /api/quizzes/{id}/questions` is a public, anonymous endpoint that strips
`correctIndex` before returning question data to students. A timer-triggered function
(`scheduledQuizSend`, every minute) promotes `status: 'scheduled'` quizzes whose `scheduledFor`
has passed to `'sent'`, sets `closedAt`, and reuses the same `sendNotificationForQuiz()` helper
as the manual send endpoint.

### Key Vault [CURRENT]

Cosmos DB key stored as a Key Vault secret, referenced via managed identity:
`@Microsoft.KeyVault(VaultName=quizpulse-app-kv-av5z18;SecretName=COSMOS-KEY)`. The Function App
system-assigned managed identity holds Key Vault Secrets User role. VAPID keys use the same
pattern — `VAPID-PUBLIC-KEY` and `VAPID-PRIVATE-KEY` secrets in Key Vault, referenced as
`@Microsoft.KeyVault(...)` in Function App config. Generate keys once with
`npx web-push generate-vapid-keys`. `VAPID_SUBJECT` is `mailto:admin@quizpulse.app`.

### School identity & merge [CURRENT — Sprint 5]

Two adoption paths. Individual teachers create an **unvalidated** school via `POST /api/onboarding`
(free-text name); `POST /api/manage/schools/{id}/validate` (owner/platform_admin) flips it to
validated. Institutions are created already-validated via `POST /api/manage/institutions`
(owner/platform_admin), which also issues one-time 7-day teacher-invite links (`POST
/api/manage/institutions/{id}/invite`, redeemed via `POST /api/invites/{token}/redeem`).

`POST /api/manage/schools/merge` (owner only, behind step-up re-auth — see Authorization model)
re-points `teacher`/`class` docs from source `schoolId` to target, **sequentially, not
`Promise.all`**, then sets `mergedIntoId` on the source (tombstone — nothing deleted). Only
`teachers` and `classes` carry a `schoolId` field — `questions`/`quizzes`/`responses` don't, so
there's nothing to re-point on them. Rate-limited to one merge in flight at a time.

### Name-list validation [PLANNED — Sprint 2]

Optional per class. Teacher pastes names (textarea, max 50). On join request, fuse.js fuzzy-matches
(threshold 0.4) server-side; `matchedName` + `matchScore` stored on the request doc (not recomputed).
Approval UI shows a confidence badge: green ≥85%, amber 60–85%, red "not on list", no badge if no
list. **It's an assistance tool, not a gate** — the teacher decides regardless of match.

### Azure Functions v4 logging [CURRENT]

Use `context.error()` / `context.warn()` / `context.log()` — NOT `context.log.error/.warn/.info`.
The `context.log.*` sub-methods don't exist in v4 and throw, turning intended error responses into 500s.

### Authorization model [CURRENT — Sprint 5]

Every endpoint that accepts a resource ID (`classId`, `quizId`, `questionId`, a join-request id,
etc.) MUST call `assertScope` from `api/shared/authz.js` before reading or mutating that resource
— this is a hard rule for any new endpoint, not just the ones touched in Sprint 5.

- **`getCallerScope(claims)`** derives `{ teacherId, role, schoolId }` from validated JWT claims
  only — never from a request body or a database read. `role`/`schoolId` default to
  `'teacher'`/`null` until the Entra custom claims described in
  `docs/azure/ROLE_CLAIMS_SETUP.md` are configured; a missing claim never grants extra access
  (fails closed).
- **Role tiers** (`ROLES` in `api/shared/authz.js`): `teacher` (default), `school_admin`
  (school-scoped via `ownerField: 'schoolId'`), `support` (cross-tenant **read-only**),
  `platform_admin` (cross-tenant **operational** mutations — institution onboarding, school
  validation), `owner` (everything, including destructive actions like school merge and role
  changes). See `docs/azure/ROLE_CLAIMS_SETUP.md` for the Entra app-role setup.
- **`assertScope(resource, caller, { ownerField = 'teacherId', mutate = false })`** throws a
  `ScopeError` (which handlers map to **404, never 403**) when `resource[ownerField]` doesn't
  match the caller's scope. Reads bypass via `READ_ALL_ROLES` (`owner`/`support`/
  `platform_admin`); mutations bypass via the narrower `MUTATE_ALL_ROLES` (`owner`/
  `platform_admin` only) — **`support` can never mutate through this helper**, by design. Always
  pass `mutate: true` for PUT/DELETE/mutating-POST call sites.
- **`requireRole(caller, allowedRoles)`** throws the same `ScopeError` → 404 for admin endpoints
  that gate on role alone with no caller-owned resource to check (e.g. "create an institution",
  "view platform metrics") — used by every `manage/...` endpoint below.
- **404-on-mismatch is the convention, full stop.** Returning 403 confirms a resource exists but
  isn't the caller's; 404 reveals nothing. Every ownership/role check — `classes.js`,
  `questions.js`, `quizzes.js`, `joinRequests.js`, `namelist.js`, `analytics.js`,
  `sendNotification.js`, `teacherRole.js`, `adminLog.js`, `schoolAdmin.js`, `institutions.js`,
  `metrics.js`, `logsExport.js` — follows this. If you add a new one, match it.
- **List/GET endpoints scope the Cosmos query itself** (`WHERE c.teacherId = @callerId`) — never
  fetch broadly and filter in code.
- **The `role` field is never settable from a teacher-facing endpoint.** The only way to change it
  is `PUT /api/manage/teachers/{id}/role`, gated on `requireRole(caller, [ROLES.OWNER])` (see
  `api/teacherRole.js`). `teacher.js`'s onboarding handler explicitly rejects a `role` key in its
  request body rather than silently ignoring it, so a future edit can't accidentally start
  trusting it.
- **Step-up re-auth (`api/shared/stepUp.js`):** `assertStepUp(claims)` verifies the signed
  `auth_time`/`iat` claim is within a 10-minute window before allowing a destructive owner
  action through — gates `POST /api/manage/schools/merge` only. The Sprint 7 admin portal
  (`admin/src/pages/MergeTool.jsx`) handles the `{ reauthRequired: true }` response by calling
  `instance.loginRedirect` with `prompt: 'login'` so the owner can re-authenticate and retry.
- **Audit trail (`api/shared/auditLog.js`):** every admin mutation (`schoolAdmin.js`,
  `institutions.js`) calls `writeAudit()` after success, appending to the `audit_log` container.
  No update/delete path exists for it, on purpose.
- **Gotcha:** Azure Functions reserves the `admin/` route segment for its own host-level admin API
  and refuses to register a custom route under it ("The specified route conflicts with one or
  more built in routes") — this surfaced when `teacherRoleSet` was first wired up at
  `admin/teachers/{id}/role` and the function silently failed to start. Use `manage/...` (or
  similar) for any admin endpoint, not `admin/...`.
- Background: `docs/security/SPRINT5_AUDIT.md` is the full audit that motivated this model.

### Demo class isolation [CURRENT — v3.3.0]

A demo class (`isDemo: true`) lets a teacher explore the Send → Analytics loop with simulated
students, without recruiting anyone. Its data must never leak into platform-wide reporting:

**Any reporting/monitoring endpoint that aggregates across teachers must filter `isDemo` out.
Per-teacher views (`Analytics.jsx` for an individual demo class) are exempt — the teacher is
looking at their own demo data on purpose.**

- The rule is defined in ONE place: `api/shared/excludeDemo.js` exports `EXCLUDE_DEMO_FRAGMENT`
  (`(c.isDemo = false OR NOT IS_DEFINED(c.isDemo))`) plus `andExcludeDemo()`/`isDemoClass()`.
  Import it — never re-type the predicate.
- Applied in: `api/metrics.js` (real cross-teacher COUNT totals), `api/schoolsList.js` (per-school
  class counts), `api/logsExport.js` (`type=security` drops audit_log entries whose target class is
  a demo class — resolved in code, since `audit_log` has no `isDemo` of its own). Any future App
  Insights / Kusto wiring in `metrics.js`/`logsExport.js` must carry the same exclusion.
- `analytics.js` (GET /api/analytics) is per-teacher and intentionally demo-aware, not demo-excluded:
  it resolves the demo class's `demoStudents` as the approved roster and returns `isDemo: true`.

### Comprehensive analytics & population benchmarking [CURRENT — v4.0.0]

Built 2026-07-03, same day as design + eng review. Source of truth is
`DESIGN_REVIEW_v400_v410_addendum.md` (in the Doc/Quizpulse planning folder) layered over
`QuizPulse_Sprint_Plan_v400_v410.docx` — **the addendum overrides the .docx wherever they
conflict**, and what's actually built follows the addendum, not the raw .docx.

- **No new class-analytics endpoint.** `GET /api/analytics?quizId=&classId=` already did class
  filtering (`applyClassFilter`) and per-question correctness (`counts`) — `buildQuestionBreakdown`
  in `api/analytics.js` was extended in place with a `fourCell` field
  (`correctConfident`/`correctUnsure`/`incorrectConfident`/`incorrectUnsure`) rather than adding a
  new module or route.
- **"Confident" = `sure` + `pretty_sure`**, reusing the existing `CONFIDENT_VALUES` set in
  `analytics.js` — `fourCell.incorrectConfident` is always exactly `confidentButIncorrect`, by
  construction, so the four-cell chart and the misconception hero card never disagree.
- **Population data is pre-aggregated, not raw.** `api/seed/populationSeed.js` (standalone script,
  run manually, never an HTTP endpoint) writes ~12 topic-rollup docs to the new
  `population_benchmark` container (pk `/topicTag`) — see Data model above and
  `docs/azure/POPULATION_BENCHMARK_SETUP.md` for provisioning. `GET /api/analytics/population?topic=`
  (`api/analyticsPopulation.js`) does a point-read against that container plus a live aggregate of
  the caller's own topic-tagged quizzes (`aggregateSchoolTopic()`, answer-level, matching the
  seed's units). `schoolId` is resolved server-side via a point-read on the caller's own
  `teachers` doc — **never** a client-supplied query param and **never** from JWT claims (which
  default to `null` until the Entra custom claim is configured — see Authorization model above).
  The original .docx design accepted `schoolId` as an unchecked query param, which was an IDOR;
  this endpoint has no `schoolId` input at all. Only `topic` is client-supplied, validated against
  `api/shared/topicTags.js`'s preset enum.
- **Topic tag is optional on Send** (`src/pages/teacher/SendQuiz.jsx` — a plain `<select>`,
  default "No topic"), not a required field — the 12-preset taxonomy doesn't cover every Year
  7–12 subject combination. `api/quizzes.js`'s POST handler validates it when present (400 on an
  unrecognised value) and resolves `schoolId` from the teacher's own record only when a topic was
  picked. `api/responses.js` copies both fields from the quiz doc onto each response at submit
  time — students submit anonymously, so there's no claim to read them from.
- **Nav placement:** Population (`src/pages/teacher/Population.jsx`) is a sub-tab under the
  existing **Results** hub in `src/teacherNav.js` (route `/teacher/population`), not `DemoNav`
  (that component only renders for signed-out visitors).
- **Four-cell chart accessibility:** `Analytics.jsx` renders a persistent legend once above the
  question list plus always-visible per-cell counts/percentages (never hover-only) for every
  question — meaning never depends on hue or hover alone. The misconception accent is a dedicated
  terracotta (`#B5482E` / `#FBEDE8`), applied consistently to both the per-question four-cell
  "Misconception" segment and the promoted hero card above the question list — not purple
  (`#534AB7` from the original .docx would have collided with the demo-pill purple already in use).
- **Population page comparison:** `Population.jsx`'s `ComparisonBar` renders one responsive
  "you vs norm" marker track per metric (correctness, confident-but-wrong) with a plain-language
  directional verdict below it — the same layout at every viewport width, so there's no separate
  mobile breakpoint to keep in sync and no risk of two side-by-side panels burying the comparison
  on a phone.
- **Pre-release review fixes (2026-07-06, `/review` on `release/v4.0-analytics`):**
  (1) CSV export (`api/analytics.js`) neutralises spreadsheet formula injection — student-supplied
  names starting with `= + - @` get a `'` prefix (CWE-1236); any future CSV export needs the same
  guard. (2) `GET /api/analytics/class/{classId}` now counts only responses from that class's own
  roster (join-request deviceIds, or `demoStudents` for a demo class) — it previously counted ALL
  responses to a quiz against one class's approved count, inflating rates past 100% for
  multi-class quizzes. (3) `sentAt` is server-set on send (see Quiz lifecycle above). (4) The
  four-cell chart does NOT replace the per-option answer bars — `Analytics.jsx` renders both
  (four-cell grid, then option distribution), because "confidently wrong" is only teachable once
  you see WHICH option was picked. Keep both when touching that card.

### Guided onboarding & progressive disclosure [CURRENT — v4.2.0]

Built on `release/v4.2-onboarding` per `CC_PROMPTS_v420_v430.md` as amended by
`CEO_REVIEW_v420_v430_addendum.md` (addendum wins on conflict — same convention as v4.0.0's
design-review addendum).

- **Onboarding submit semantics.** `POST /api/onboarding` still fires after step 1 (school name)
  only — the teacher is onboarded from that moment, exactly as pre-v4.2.0. Steps 2-5 (the profile
  wizard) accumulate client-side and submit once via `PUT /api/me/profile` at wizard end.
  Quitting anywhere after step 1 leaves the teacher onboarded with `profileComplete:false` —
  `ProfileNudge` picks it up later; nothing ever re-gates back to `/onboarding`.
- **`profileComplete`** = all four profile fields answered (`api/shared/profileSchema.js`'s
  `isProfileComplete`) — a skipped wizard step is absence, not a falsy answer, so it's never
  counted as "answered".
- **Class shells are a first-run convenience, not a general bulk-create tool.**
  `POST /api/classes/shells` only creates shells when the caller has zero real classes,
  server-names them "My Class 1..N", and creates sequentially (not `Promise.all`) through the
  shared `api/shared/createClass.js` helper — the same helper `POST /api/classes` uses, so
  joinCode/schoolId/cap logic can never drift between the two call sites (this codebase has
  already been bitten once by copy-pasted logic diverging — see the `rateLimit`-import regression
  in memory). The create-shells choice itself is never persisted on the profile.
- **`introEligibility.js` is the one place all nine feature-intro keys' eligibility lives.**
  `demo_intro`, `analytics_intro`, `community_intro`, `misconception_intro`, and `population_intro`
  all read teacher-partitioned Cosmos counts and (except `misconception_intro`) exclude demo data
  via `api/shared/excludeDemo.js`'s `EXCLUDE_DEMO_FRAGMENT` — `misconception_intro` is the one
  deliberate exception, since a demo quiz is its designed first touch (a teacher exploring
  misconception analytics on their practice class should still see the card). `apst_intro`,
  `mypd_intro`, and `ai_generation_intro` are gated behind `api/shared/features.js` flags (both
  `false` today) and treated as dismissed while dark, so they can never appear before v4.1.0/
  v4.3.0 flip them. Once every key is dismissed-or-dark, `GET /api/me` skips every milestone
  query — a brand-new teacher who has dismissed nothing still pays all the queries, but a teacher
  who's seen everything pays none.
- **`demo_intro`'s milestone reads `classes.studentCount > 0`** (teacher-partitioned), never a
  `join_requests` query (pk `/classId` → would be cross-partition, violating `GET /api/me`'s own
  teacher-partitioned-only rule). Empty class shells (created above) do NOT suppress this card —
  only a class that's actually been used should.
- **The `confidenceResponseCount` counter is advisory, never load-bearing for correctness.**
  `api/responses.js` and `api/shared/runSimulation.js` (the demo-quiz path, which writes
  `responses` directly and bypasses `responses.js` entirely) both increment it via an atomic
  Cosmos `incr` patch on the parent quiz doc, wrapped in try/catch — a patch failure is logged and
  swallowed, never surfaced to the student, because the response write it's counting already
  succeeded before the patch runs.
- **`PUT /api/me/feature-intros` uses an ETag-conditioned replace-with-retry, not a nested Cosmos
  patch path.** A patch on `/featureIntros/{key}/{field}` would require every ancestor object to
  already exist, which a teacher's first-ever intro interaction won't have; replacing only after
  reading the current ETag (retried up to 3× on a 412 conflict) keeps two tabs dismissing
  *different* keys from clobbering each other without that path-existence assumption.
- **One promotional element per page render** (`src/components/PromoSlot.jsx`): an eligible
  feature-intro card outranks `ProfileNudge`, which waits. `community_intro` is the one key that
  never appears in `PromoSlot` — it renders on the Build page instead (`BuildQuiz.jsx`), as its
  own self-contained slot, since that's a different job-to-be-done from the dashboard.
- **"One card per browser session"** is enforced client-side via `sessionStorage`
  (`FeatureIntroCard.jsx`'s `hasShownIntroThisSession()`) — server-side `dismissedAt` is the only
  *permanent* gate; a shown-but-not-dismissed card is allowed to reappear next session.
- **Topic prefilter is frontend-only.** `SendQuiz.jsx` segments `TOPIC_TAGS` by the teacher's
  `profile.subjects`/`profile.yearLevels` (`src/data/topicPrefilter.js`'s `matchTopics`, a pure
  function). Zero-match fallback (e.g. a Year 8 Maths teacher — no preset tag covers that
  combination) suppresses the "Your subjects" optgroup entirely rather than rendering an empty
  one; server-side enum validation in `api/shared/topicTags.js` is unchanged.

### Traffic monitor [CURRENT — v4.4.0]

Built on `release/v4.4-traffic` per `CC_PROMPTS_v440.md`, reviewed via `/review` (5 fixes) and
`/plan-eng-review` (10 findings folded in before the build — the prompt file already reflects
every amendment). Zero dependencies on v4.1–v4.3.

- **The write path was inherited, not built from scratch.** `src/hooks/usePageView.js` +
  `api/pageView.js` came over in the baseline import from the demo repo and had been silently
  writing to a self-created `pageviews` container since day one. v4.4.0's first task hardens
  that path (visitor UUID keyed under `quizpulse_device_id`, lazy Cosmos init from
  `COSMOS_CONTAINER_PAGEVIEWS`, no more runtime `createIfNotExists`) before building anything new
  on top of it. See the `pageviews` container entry in Data model above.
- **Student privacy posture (load-bearing design decision, not an afterthought).** Unifying the
  page-view visitor ID with `quizpulse_device_id` makes a student's browsing telemetry linkable
  to their quiz identity — that's what makes the funnel below possible, but it also means
  browser-fingerprint fields (userAgent, screen size, language, timezone, referrer) must never
  ride along for a route students actually visit. `api/pageView.js` drops those five fields
  whenever `page === '/quiz'`, enforced server-side regardless of what the client sends (the
  student-facing route has no auth, so nothing client-side can be trusted to have stripped them).
  The one field `/quiz` beacons DO carry beyond the general shape is `quizId` (parsed from the
  `?quizId=` query param — `location.pathname` alone strips it), which is what lets the funnel
  attribute an open to a specific send rather than "some /quiz visit sometime in the range".
- **Route allowlist (`api/shared/pageViewAllowlist.js`).** `POST /api/pageView` is
  `authLevel: 'anonymous'` by design (public beacon, no login) and its only defense against a
  flood is a spoofable per-IP rate limit (`getClientIp` trusts `x-forwarded-for`, and a caller
  hitting the Function App directly can set that header to anything). The allowlist does not stop
  a flood either — there is no per-container RU cap available to do that on this Serverless-mode
  account (see Data model / `docs/azure/V440_CONTAINERS_SETUP.md`'s correction; the in-memory rate
  limit and the $100/mo budget alert are the real backstops). The allowlist's job is narrower: it
  stops a flood from inventing arbitrary page names and exploding `topPages`/audience cardinality
  — an unrecognised page is stored bucketed as
  `'other'`, never rejected (the beacon must never break navigation). A unit test walks the real
  `<Routes>` table in `src/App.jsx` and asserts every declared route is covered, so an added
  route without a matching allowlist entry fails loudly instead of silently rotting to `'other'`.
- **`GET /api/manage/traffic?range=today|7d|30d`** (`api/traffic.js`) — owner/support, same
  404-on-mismatch/rate-limit conventions as `api/metrics.js`. Aggregation math (audience/device/
  browser classification, daily bucketing, topPages, funnel rate math) is pure and lives in
  `api/shared/trafficAggregate.js`, unit-testable without Cosmos. **A legacy pageview doc with no
  `eventType` field counts as a view in every aggregate** — mandatory regression, since all
  pre-v4.4.0 production data has no `eventType` at all and a strict `eventType === 'view'` filter
  would silently erase it from the dashboard on day one.
- **The funnel's roster lookup is per-class, in-partition — never a cross-partition scan.**
  `api/shared/resolveApprovedDeviceIds.js` mirrors `api/analytics.js`'s existing roster-resolution
  technique (demo classes read `demoStudents`; real classes query `join_requests` filtered by
  `classId IN (...)`, which Cosmos routes per-partition since `classId` is that container's
  partition key). It's a deliberate near-duplicate of `analytics.js`'s query shape rather than a
  fully shared module, since `analytics.js`'s version also returns per-class breakdown +
  studentName that the funnel doesn't need — noted as a `ponytail:` comment in the source.
- **Legacy quizzes are excluded from funnel/metrics denominators, never coerced to 0.** A quiz
  sent before v4.4.0 has no `pushSuccessCount`/`pushFailCount` at all. Coercing that to 0 would
  make `openRate`/`pushDeliveryRate` read past 100% for any range spanning the deploy — instead,
  `api/shared/rangeQuizStats.js` (shared by both `manage/traffic`'s funnel and `manage/metrics`'s
  de-stub, so "quizzes sent in range, demo-excluded, legacy-excluded" can't drift between the two
  endpoints) filters those quizzes out of the sums entirely.
- **`pushSuccessCount`/`pushFailCount` are advisory writes**, same semantics as
  `confidenceResponseCount` (v4.2.0): `api/sendNotification.js` wraps the persistence upsert in
  try/catch and `context.warn`s on failure, because by the time it runs the pushes have already
  gone out to devices — a Cosmos hiccup here must never make the teacher see a failed send when
  it actually succeeded. This also incidentally hardened the pre-existing `notificationSentAt`
  write, which previously had no such guard.
- **PWA-install tracking is app-level, not inside `usePwaInstall`.** `usePwaInstallTracking()`
  (exported from `usePageView.js`, reusing its `buildPageViewPayload`/`sendPageViewBeacon` so the
  beacon shape can't drift between the two call sites) registers its own `window.addEventListener
  ('appinstalled', ...)` once in `AppRoutes`. `usePwaInstall`'s own listener only tracks UI state
  and only mounts where `InstallButton` renders (Home, JoinClass) — an install triggered from the
  browser's own UI on any other route would otherwise go uncounted.
- **`manage/metrics` de-stub is partial, not "App Insights wiring done".** `usageGrowth`
  (schools/teachers/quizzesPerDay/pushDeliveryRate) and `engagement.completionRate` are now real
  Cosmos aggregates; `usageGrowth.students` and `engagement.avgResponseRate` stay `null`
  deliberately (both would require the same expensive-query pattern — a platform-wide distinct
  device count, or a per-quiz roster resolution across every quiz on the platform — that the
  funnel's own eng review flagged as a scale risk even scoped to one admin's view). `systemHealth`/
  `security`/`spending` are untouched, still fully stubbed. The single top-level `stubbed: true`
  is replaced with **per-group** flags, since a response can no longer be described by one boolean.
- **Cutover discontinuity, documented not hidden.** Every returning device gets a new visitor ID
  the day this ships (the pre-v4.4.0 code stored it under the broken literal key `"undefined"`,
  which never joined to anything) — for roughly the first 30 days, uniques will read artificially
  high and the funnel artificially low. The admin Traffic page's copy says so explicitly.
- **Admin Traffic dashboard** (`admin/src/pages/Traffic.jsx`) — range picker, stat tiles, funnel
  strip, top-pages/daily bar rows, audience/device/browser breakdowns. Inline styles matching
  `Monitoring.jsx`'s idiom, no chart library (admin portal convention: bare/functional UI only —
  see `admin/CLAUDE.md`).
- **Verification gap:** integration tests (`tests/integration/api/v440-traffic.test.js`, 14 cases)
  and the admin Traffic page's live render were not exercised in the build session — no
  `func start` + test Cosmos, and no admin CIAM credentials available. See Known issue #14.

### APST evidence export [CURRENT — v4.1.0]

Depends on v4.0.0's `topicTag` field (exists). New top-level route `/teacher/evidence`, added as
its own hub in `src/teacherNav.js` (not a Results sub-tab, and not `DemoNav`) — distinct
job-to-be-done from Analytics ("prove you did it" vs "act on data now"). Two artefacts: a
per-quiz VIT PDF (`POST /api/evidence/export`) and an annual MyPD aggregate log
(`GET /api/evidence/annual-log?from=&to=`), both pdfkit, both capped at 2 pages, both generated
on demand with no server-side storage.

- **Content is duplicated, not shared, across the frontend/backend boundary.** `src/data/apstContent.js`
  (ESM, used by `Evidence.jsx`) and `api/shared/apstContent.js` (CommonJS, used by both export
  endpoints) hold the same 18 APST descriptors, `APST_DEFAULTS`, VTLM 2.0 alignment text, and AERO
  citations — verbatim from AITSL/DET source
  (`C:\Users\Ryan\Downloads\QuizPulse_VIT_Export_Research_Brief.docx`, Parts I/III/IV), same
  pattern as `TOPIC_TAGS` already being duplicated client/server. Both files must be reviewed
  together for verbatim accuracy — that review happened before `v4.1.0-rc1` was tagged, separately
  from code review. `src/data/apstContent.js` is logic-free (data only); `api/shared/apstContent.js`
  additionally exports `domainCoverage()`, a pure function used by both the per-activity
  domain-coverage note and the annual log's three-domain confirmation.
- **18 of 37 APST descriptors are evidenceable** (10 Strong + 8 Moderate, per the research
  brief) — `1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.6, 3.2, 3.3, 3.4, 3.6, 4.5, 5.1, 5.2, 5.4, 6.1, 6.2,
  6.4`. `APST_DEFAULTS` pre-ticks `['3.3', '3.6', '5.1', '5.4', '6.2']` on the export screen —
  teacher can add/remove any of the 18.
- **VIT number is a plain, unpersisted text input on the export screen**, not a teacher-profile
  field — no such field exists on the `teachers` doc (the v4.2.0 `profile` object is
  `{subjects, yearLevels, classCount, registrationStatus}` only), and a single-use export detail
  didn't warrant adding one. If a future sprint needs it persisted, that's new scope, not part of
  v4.1.0.
- **Reflection personalisation gate.** Both reflection fields are pre-templated with
  `[PERSONALISE: ...]` gaps (`src/data/apstContent.js`'s `REFLECTION_TEMPLATE_1/2`). The export
  button is disabled client-side while either field still contains the literal marker, and
  `POST /api/evidence/export` re-validates the same thing server-side (400) via
  `api/shared/evidenceHelpers.js`'s `containsUnpersonalisedMarker` — this is an enforcement
  mechanism against VIT auditors flagging non-personalised reflections, not just a UX nicety, so
  the server check is never relaxed to trust the client.
- **Per-activity export reuses `api/analytics.js`'s `loadQuizAnalytics`/`buildQuestionBreakdown`**
  rather than re-deriving correctness/confidence — ownership (`quiz.teacherId === teacherId`,
  404-on-mismatch) comes for free from `loadQuizAnalytics`, and the four-cell breakdown is
  aggregated across all questions into cohort-level correctness %, confidence %, and a
  confident-but-incorrect total. No individually identifiable student data is included in any
  export — only counts.
- **The annual log doesn't persist per-quiz descriptor selections** (nothing is stored
  server-side by design, per the "no server-side storage" rule) — `api/evidenceAnnualLog.js`
  summarises using `APST_DEFAULTS` for every quiz in range rather than reconstructing a per-export
  choice that was never recorded. ponytail: upgrade to real per-export descriptor tracking if
  teachers need the aggregate to reflect actual per-activity selections.
- **Annual log scoping follows the house "list endpoints scope the query" rule** — the Cosmos
  query filters `c.teacherId = @tid AND c.status = 'sent' AND c.sentAt BETWEEN @from AND @to`
  plus `EXCLUDE_DEMO_FRAGMENT`, never a broad fetch filtered in code.
- **PDF footer bug (fixed same session it was introduced):** `renderFooter()` in
  `api/shared/pdfEvidence.js` originally placed the required footer text near the bottom margin
  with a bounding `width` and no `lineBreak: false`. If that text wrapped, pdfkit auto-paginated
  mid-render — and since both PDF builders looped `for (i = 0; i < doc.bufferedPageRange().count;
  i++)` to stamp the footer on every page, a growing page count made the loop infinite (the
  export endpoint would hang forever with no error). Fixed by adding `lineBreak: false` to the
  footer's `.text()` call and capturing `bufferedPageRange().count` once before each loop instead
  of re-evaluating it every iteration. `tests/unit/api/pdfEvidence.test.js` guards this — it fails
  on a timeout, not a hang, if the bug regresses.
- **Rate limit:** 10 req/hr/teacher on both `evidence/export` and `evidence/annual-log`,
  keyed separately — see Security limits table below (matches the CSV-export precedent).
- **`FEATURE_APST_EXPORT` flipped to `true`** in `api/shared/features.js` — `apst_intro`/
  `mypd_intro` (already fully built in v4.2.0: copy, eligibility gating, `route: '/teacher/evidence'`)
  are eligible again and verified to navigate to a real, working page.

### AI quiz generation [CURRENT — v4.3.0]

Document upload → mock-LLM draft → teacher review/approve → send through the normal SendQuiz
flow, plus spaced repeats for any quiz (E3) and misconception-triggered follow-up practice (E1).
`FEATURE_AI_GENERATION` is `true`; `LLM_PROVIDER` defaults to `mock` — **no real LLM API key is
required or used anywhere in this build.** See `docs/azure/LLM_PROVIDER_SETUP.md` before ever
switching to a real provider — it has a required activation checklist (quota semantics, a
founder-authored smoke run, Key Vault naming).

- **Copyright/privacy posture (hard constraints, not preferences).** The original uploaded
  document is NEVER persisted — `api/generationSources.js` extracts text + chunk boundaries into
  `source_materials` and discards the binary. The mock provider (`api/shared/llmProviders/mock.js`)
  builds questions entirely from single short extracted terms dropped into a fixed template — it
  never concatenates consecutive source words, so it structurally cannot reproduce an 8-word
  verbatim source run (tested: `tests/unit/api/llmProviderMock.test.js`). Real providers' system
  prompt (`api/shared/llmPrompts.js`) instructs "write in your own words" and treats the source
  text as untrusted, injection-hardened data.
- **Upload pipeline:** `POST /api/generation/sources` — multipart (`request.formData()`,
  verified locally against a real 15MB file with no truncation; the SWA linked-backend proxy path
  still needs live-deploy verification, see `docs/azure/V430_CONTAINERS_SETUP.md`), MIME-sniffed
  by magic bytes (`api/shared/sniffFileKind.js`; txt falls back to a UTF-8 validity check),
  extracted via `unpdf` (PDF, NOT `pdf-parse` — unmaintained) and `mammoth` (docx) inside a ~10s
  timeout box, with named 400 failure paths (scanned/too-short, too-many-pages, unreadable/
  encrypted). `api/shared/sourceChunker.js` splits into chunks (the universal `sourceRef`
  addressing unit for every format — PDFs additionally carry a chunk→page map; docx/txt have no
  real pages, so `sourceRef` is chunk-only there too, per the addendum's "chunk, not page" rule).
- **LLM adapter (`api/shared/llmAdapter.js`)** is the one entry point every generation/
  regeneration/expand call goes through: resolves the provider (`mock`/`azureOpenai`/`anthropic`),
  applies an identical ~60,000-char input cap across all of them (mock included, so behaviour
  never diverges at activation), does range-first-then-even-sampling chunk selection, and logs one
  structured `{sourceId, provider, chunkChars, questionCount, durationMs, outcome, rejectReason?}`
  line via `context.log`/`context.error` per call. A real provider missing its required env vars
  (`LLM_API_KEY` + `LLM_ENDPOINT` + `LLM_MODEL` for Azure OpenAI; `LLM_API_KEY` for Anthropic)
  throws `MissingProviderKeyError`, mapped to 503 by the caller.
- **`api/shared/draftSchema.js`** is the single validator for BOTH raw adapter output (invalid →
  502, never stored) and teacher edits via `PUT /api/generation/drafts/{id}` (invalid → 400) — one
  set of rules, two call sites, so validation can never drift between "what the LLM produced" and
  "what a human edited it into". Includes the hallucination guard: `sourceRef` chunk indexes must
  be `< chunkCount` for the real source.
- **Approve/send contract.** Approve materialises N question docs (`generatedBy: 'ai'`,
  `visibility` locked `'private'`, `sourceRef`/`sourceRefLabel` resolved once from the draft's
  `chunkPageMap` snapshot) + ONE draft-status quiz (carrying `draftId`/`sourceId` for lineage) —
  the teacher sends it through the **same** `POST /api/quizzes/{id}/send` transition endpoint
  every manual quiz now also uses (`SendQuiz.jsx` creates a manual quiz as `status: 'draft'` first,
  then transitions it — one send path, not two). Both materialisation and clone creation use
  deterministic ids (`api/shared/materializeAi.js`) + sequential 409-tolerant creates, with the
  parent/draft marked approved/sent LAST, so a retried request after a partial failure is
  idempotent by construction (verified: `tests/integration/api/v4.3-drafts.test.js`'s retry test
  asserts zero duplicate clones).
- **E3 — spaced repeats for any quiz.** `POST /api/quizzes/{id}/send` accepts an optional
  `spacedRepeats` array (day offsets, max 5); it computes the anchor (now's timestamp, or
  `scheduledFor`) before any writes, creates the clones first, then marks the parent sent/
  scheduled last. Each clone is its own quiz doc — the 1-response-per-student gate resets
  naturally per clone, which IS the spaced-retrieval behaviour, no special-case code needed.
  Clones carry `parentQuizId` and are excluded from population-benchmark aggregation
  (`api/analyticsPopulation.js`'s `aggregateSchoolTopic`) and from `introEligibility.js`'s
  milestone counts, so a single send with repeats can't inflate community/analytics/population
  intro eligibility or skew "you vs norm".
- **E1 — misconception-triggered expansion.** `Analytics.jsx` offers "Create follow-up practice"
  (hero card) / "Revisit {sourceRefLabel}" (per-question) when a question's incorrect rate ≥40%
  OR confident-but-incorrect rate ≥25% (two independent constants — CBI ⊆ incorrect made a single
  "incorrect OR CBI ≥40%" condition collapse to one threshold) AND the quiz has a `sourceId`.
  `POST /api/generation/expand { quizId, focusQuestionIds }` resolves lineage via the
  **materialised questions' own `sourceRef`s** — the original draft doc is never required, so
  draft cleanup can never kill the follow-up loop. Source liveness (the 90-day TTL) is checked
  only when expand is actually clicked, never gating whether the button renders — an expired
  source returns a plain "upload it again" message. **Scope cut from the full addendum spec:**
  the Results-list-level nudge (lazy evaluation across a teacher's 10 most recent closed
  lineage-bearing quizzes) was not built — the drill-down and hero card already expose the same
  action; deferred as a follow-up rather than added to an already-large sprint.
- **Quotas (`api/shared/dailyQuota.js`, one shared helper, per the "never copy-paste rate-limit
  plumbing" rule)** — uploads and generations counted from `source_materials`/`quiz_drafts`
  `createdAt` (partition-scoped); regenerations via an atomic Cosmos `incr` PATCH on a date-keyed
  teacher-doc field (`quotaRegen_{yyyymmdd}`). **Found and fixed during this build:** that PATCH
  requires an existing teacher document — a caller with no teacher doc yet (a real edge case in
  test/dev contexts) crashed the whole regenerate-question call with a 500. Fixed to tolerate a
  missing doc the same non-fatal way `confidenceResponseCount` already does elsewhere.
- **`GenerateQuiz.jsx`/`ReviewDraft.jsx`.** Two-phase upload → configure screen with staged
  pending copy ("Reading your document…" → "Writing questions…" → "Nearly there…", ~90s client
  timeout). ReviewDraft gates Approve server-side on every question reviewed-or-edited (never a
  client-claimed count) — regenerating a question resets its tick; deleting is disabled at 3
  questions remaining (the schema minimum). Approving navigates straight into `SendQuiz.jsx` in
  "quizId mode" with the chosen spaced-repeat schedule carried over via router state.
- **Bundled debt fixes** (same-file edits, per the addendum): `classAnalytics` gained a rate
  limit it was missing; `analyticsPopulation.js`'s population-container read no longer swallows
  non-404 Cosmos errors into a fake empty benchmark page (only a real 404 means "no data yet");
  `api/questions.js` rejects any attempt to change an AI-generated question's `visibility`.

---

## Security limits (enforce server-side)

| Surface | Limit | Sprint |
|---|---|---|
| Classes per teacher | 20 | 1 |
| Schools per teacher account | 1 | 1 |
| Questions per teacher | 2,000 | 1 |
| Questions per quiz | 20 | 1 |
| Quizzes per teacher | 500 | 1 |
| School name length | 120 chars | 1 |
| Class name length | 80 chars | 1 |
| API rate limit (general) | 30 req/min/IP | 1 |
| Students per class (hard cap) | 40 | 2 |
| Name list entries per class | 50 | 2 |
| Pending requests per class | 60 | 2 |
| Join requests per device/day | 5 | 2 |
| Join code brute-force | 10 attempts/hr/IP | 2 |
| Student name length | 80 chars | 2 |
| Name list saves/hr/teacher | 10 | 2 |
| Join code length | 8 chars alphanumeric | 2 |
| Subscriptions per device | 10 classes | 3 |
| Send per quiz (idempotency) | 1 | 3 |
| Subscribe attempts/device/hr | 20 | 3 |
| Notification payload | 3 KB max | 3 |
| send-notification rate/teacher | 5 req/min | 3 |
| Responses per student per quiz | 1 (409 on dup) | 4 |
| Response body size | 4 KB max | 4 |
| Analytics poll min interval | 3s client-enforced | 4 |
| CSV export rate/teacher | 10/hr | 4 |
| Scheduled quizzes pending | 50 per teacher | 4 |
| Quiz min duration (closedAt) | 5 min | 4 |
| Teachers per validated school | 200 | 5 |
| Pending teacher invites | 50 active | 5 |
| Invite link expiry | 7 days | 5 |
| School admins per school | 5 | 5 |
| Merges per session | 1 sequential | 5 |
| Metrics API calls/hr | 60 | 5 |
| Log export size | 50 MB per request | 5 |
| Owner accounts | 1 globally | 5 |
| platform_admin (support) accounts | 5 | 5 |
| Step-up re-auth window for owner-gated actions | 10 min since last sign-in | 5 |
| Public questions per teacher | 500 | 6 |
| Upvotes per teacher per question | 1 | 6 |
| Question reports per teacher/day | 20 | 6 |
| Community search results/page | 50 | 6 |
| Profile subjects | 6 | v4.2.0 |
| Profile year levels | 6 (values 7-12) | v4.2.0 |
| Class shells per onboarding batch | 20 (shares the real-class cap) | v4.2.0 |
| Evidence export rate/teacher (per-quiz + annual log, each) | 10/hr | v4.1.0 |
| pageView beacon rate | 60 req/min/IP (already enforced pre-Sprint 1) | v4.4.0 |
| pageView payload | 4 KB max (already enforced pre-Sprint 1) | v4.4.0 |
| Traffic API calls/hr/admin | 60 | v4.4.0 |
| pageviews retention (container TTL) | 180 days | v4.4.0 |
| Source upload max size | 15 MB | v4.3.0 |
| Source upload max pages (PDF) | 200 | v4.3.0 |
| Stored sources per teacher | 20 | v4.3.0 |
| Source uploads per teacher/day | 10 | v4.3.0 |
| Generations (drafts + expands) per teacher/day | 10 | v4.3.0 |
| Regenerations per teacher/day | 20 | v4.3.0 |
| Unreviewed (`status='draft'`) drafts per teacher | 50 | v4.3.0 |
| Questions per draft | 3-15 | v4.3.0 |
| Spaced-repeat entries per send action | 5 | v4.3.0 |
| source_materials retention (container TTL) | 90 days | v4.3.0 |
| student/quizzes rate | 30 req/min/IP | v4.5.0 |
| Quizzes returned per student/quizzes call | 50 | v4.5.0 |

---

## Testing [CURRENT — Sprint 1 suite live]

Three tiers, run in sequence on PR. No sprint is "done" until its test checklist passes and the
HTML report is generated.

- **Unit** (jest BE / vitest FE) — pure logic: validation, rate limiting, fuzzy match, join codes.
  Runs every push.
- **Integration** (jest + supertest) — API endpoints vs a real HTTP `func start` instance; status
  codes, DB writes, limit enforcement. Runs after unit pass.
  **⚠️ Never run `npm run test:integration` against the func host you use for normal local dev —
  `api/local.settings.json`'s `COSMOS_ENDPOINT`/`COSMOS_KEY` point at the real production Cosmos
  DB (no local emulator is configured; despite what this doc used to claim, there never was one).
  A `/qa` session on 2026-07-06 ran the suite before this was documented and wrote real test
  documents into production.** A dedicated free-tier Cosmos DB account exists for this
  (`quizpulse-int-test-db` in resource group `quizpulse-test-rg`, database `quizpulse`, same 11
  containers/partition keys as production — see `docs/azure/INFRASTRUCTURE.md`), with its
  endpoint/key already in `local.settings.json` as `TEST_COSMOS_ENDPOINT`/`TEST_COSMOS_KEY`.
  Before running integration tests, start `func start` with those values overriding the real
  ones via the shell environment (env vars beat `local.settings.json` `Values` at Functions host
  startup) — e.g. in PowerShell:
  ```powershell
  cd api
  $env:COSMOS_ENDPOINT = (Get-Content local.settings.json | ConvertFrom-Json).Values.TEST_COSMOS_ENDPOINT
  $env:COSMOS_KEY = (Get-Content local.settings.json | ConvertFrom-Json).Values.TEST_COSMOS_KEY
  func start
  ```
  Then in another terminal, `npm run test:integration` as normal. Stop that func host and start a
  plain `func start` (no overrides) afterward to go back to normal dev against production. A
  known flake exists independent of which DB is used: rapid sequential test requests from one IP
  can trip the 30 req/min rate limit on endpoints like `/api/classes`, surfacing as `classes.find
  is not a function` (a 429 error body where an array was expected) rather than a DB bug — see
  `TODOS.md`.
- **Cross-tenant access denial** [introduced Sprint 5] — for every resource type a teacher can
  act on, Teacher A authenticates and attempts to access Teacher B's resource by ID; expected
  result is always 404 (never the resource). A test that gets the resource back is a FAILED test.
  This category is required going forward for any new resource-scoped endpoint, not just the ones
  retrofitted in Sprint 5 (`tests/integration/api/sprint5.test.js`).
- **E2E** (Playwright) — full user journeys vs deployed staging. Runs on PR merge to develop.

Each test record documents: what is tested, how, expected result of success, pass/fail status.
Reports → `tests/reports/sprintN-report.html`, uploaded as a GitHub Actions artifact, with a PR
summary comment. Maintain `SPRINT_TEST_CHECKLIST.md` per sprint.

---

## Azure spending controls [CURRENT — Sprint 1 complete]

Hard limit **$100 USD/month**.

- Budget alerts at 50% / 80% / 100% (Azure Cost Management → Budgets).
- 100% threshold fires an Action Group → Automation runbook (`scripts/azure/disable-on-budget.ps1`)
  that disables the Function App and swaps the Cosmos connection string to a dummy value (API → 503).
  SWA frontend stays up. Re-enabled manually after review.
- Resource caps: Cosmos per-container RU cap; Function App daily execution quota (host.json:
  `functionTimeout=5min`, `maxConcurrentRequests=100`); App Insights daily data cap 1 GB.
- Full setup steps: `docs/azure/SPENDING_CONTROLS.md`.

---

## Admin monitoring endpoints [CURRENT — Sprint 5 backend + admin frontend; metrics partially de-stubbed v4.4.0]

`GET /api/manage/metrics?range=today|7d|30d` (owner/support, 60 req/hr), `GET
/api/manage/traffic?range=today|7d|30d` (owner/support, 60 req/hr — **[CURRENT — v4.4.0]**), and
`GET /api/manage/logs/export?type=errors|security|usage&from=&to=` (owner/support). Routes use
`manage/`, not `admin/` — Azure Functions reserves the `admin/` route segment for its own host
API and refuses to register a conflicting custom route; see Authorization model above.

**Metrics is partially de-stubbed as of v4.4.0.** `api/metrics.js`'s `buildStubbedMetrics()` now
returns **per-group** `stubbed` flags (there is no single top-level `stubbed` boolean anymore —
some groups are real, some aren't). `usageGrowth` (schools/teachers/quizzesPerDay/
pushDeliveryRate) and `engagement.completionRate` are real Cosmos aggregates
(`stubbed: false`) — `usageGrowth.students` and `engagement.avgResponseRate` stay `null`
on purpose (see the code comment in `api/metrics.js`: a platform-wide distinct-device count and
a per-quiz roster-resolution average would each require the exact expensive query pattern the
`manage/traffic` funnel's eng review flagged). `systemHealth`, `security`, and `spending` remain
`stubbed: true` — there is still no `@azure/monitor-query` SDK installed and no App Insights App
ID/API key configured. Wiring those three to real Kusto queries against Application Insights is
still open work, not yet scheduled to a sprint.

`manage/traffic` (v4.4.0) is a **separate, fully-real** endpoint — page-view analytics, a
notification→open→submit funnel, and PWA-install counts, all Cosmos-backed with no App Insights
dependency. See the v4.4.0 status blurb near the top of this file and `CC_PROMPTS_v440.md` for
the full design.

Logs export is **partially real**: `type=security` streams real JSONL straight from the
`audit_log` container (capped 50MB). `type=errors`/`type=usage` return `501 Not Implemented`
rather than fabricated data — same App Insights wiring gap as `systemHealth`/`security`/`spending`.

Metric groups (real shape, mixed real/stubbed values — see above): **System health** (error rate,
p95, active instances — stubbed) · **Usage/growth** (schools, teachers, students, quizzes/day,
push delivery rate — real except students) · **Engagement** (avg response rate, time-to-respond,
completion rate — only completionRate is real) · **Security** (rate-limit hits, join rejection
rate, failed auth — stubbed) · **Spending** (month cost vs $100 budget, per-service breakdown —
stubbed).

**Admin frontend exists** (`admin/` — see `admin/CLAUDE.md`): `admin/src/pages/Monitoring.jsx`
(metrics + log export) and `admin/src/pages/Traffic.jsx` (**[CURRENT — v4.4.0]** — page-view
dashboard, funnel strip, breakdowns). Live at
`https://ambitious-sand-054490e00.7.azurestaticapps.net` — see Known issue #12.

---

## Feature status

| Feature | Status |
|---|---|
| Home page | [CURRENT] Working |
| Create Question / Question Bank / edit / delete | [CURRENT] Working |
| Build Quiz / Send Quiz (now/duration/schedule) | [CURRENT] Working |
| Analytics (live, polled, real data, CSV export) | [CURRENT] Sprint 4 complete |
| Preset classes (3 hardcoded) | [RETIRED] — replaced by real CRUD in Sprint 1 |
| Teacher auth (Entra ID Easy Auth) | [RETIRED] — replaced by Entra External ID in Sprint 1 |
| App Insights logging | [CURRENT] Working |
| Auth (Entra External ID — Microsoft provider) | [CURRENT] Sprint 1 complete |
| School identity model (unvalidated, /api/me, /api/onboarding) | [CURRENT] Sprint 1 complete |
| Real classes CRUD (/api/classes, Classes page) | [CURRENT] Sprint 1 complete |
| Community tab placeholder (locked) | [CURRENT] Sprint 1 complete |
| Azure spending controls ($100 budget, runbook, throttling) | [CURRENT] Sprint 1 complete |
| Sprint 1 test suite (23/23 unit, integration, E2E scaffolding) | [CURRENT] Sprint 1 complete |
| Sprint 2 test suite (44/44 unit, integration, E2E scaffolding) | [CURRENT] Sprint 2 complete |
| Student join + approval + name list | [CURRENT] Sprint 2 complete |
| Sprint 3 test suite (53/53 unit, integration, E2E scaffolding) | [CURRENT] Sprint 3 complete |
| PWA shell (manifest, sw.js, SW update banner, iOS install guide) | [CURRENT] Sprint 3 complete |
| Push subscriptions (approval-gated, /api/subscribe, /api/vapid-public-key) | [CURRENT] Sprint 3 complete |
| Send-notification endpoint (/api/send-notification, idempotency, stale pruning) | [CURRENT] Sprint 3 complete |
| Sprint 4 test suite (66/66 unit, integration, E2E scaffolding) | [CURRENT] Sprint 4 complete |
| Real student quiz flow (/quiz, approval/duplicate/closed gating) | [CURRENT] Sprint 4 complete |
| Offline resilience (Background Sync, IndexedDB queue) | [CURRENT] Sprint 4 complete |
| Quiz scheduling (timer trigger, scheduledFor picker) | [CURRENT] Sprint 4 complete |
| Security audit + authorization foundation (assertScope, requireRole, role tiers, cross-tenant negative tests) | [CURRENT] Sprint 5 complete |
| Append-only audit_log + writeAudit() | [CURRENT] Sprint 5 complete |
| Step-up re-auth guard (assertStepUp) | [CURRENT] Sprint 5 complete |
| School validate + merge (/api/manage/schools/...) | [CURRENT] Sprint 5 complete |
| Institution onboarding + teacher invites (/api/manage/institutions/...) | [CURRENT] Sprint 5 complete |
| Monitoring endpoints — metrics (STUBBED, no real App Insights wiring) + logs export (security real, errors/usage 501) | [CURRENT] Sprint 5 complete |
| SWA Standard tier + linked Function App backend (API_BASE → /api, CSP cleaned) | [CURRENT] Sprint 6 complete — portal steps pending (see SWA_STANDARD_UPGRADE.md) |
| Community question bank (visibility toggle, school/public browse, upvotes, copy, report, moderation queue) | [CURRENT] Sprint 6 complete |
| Azure API Management (rateLimit.js no-op → APIM policies) | [CURRENT] Sprint 6 complete — APIM instance not yet provisioned (see APIM_SETUP.md) |
| Apple ID CIAM provider | [CURRENT] Sprint 6 complete — portal config pending (see APPLE_ID_SETUP.md) |
| Analytics depth: class cross-quiz aggregation + response timeline chart | [CURRENT] Sprint 6 complete |
| Sign-in CSP fix (*.ciamlogin.com in connect-src + frame-src) | [CURRENT] v3.0.1 complete — portal redirect URI verification pending |
| No-jargon UI copy sweep (push/Azure/server-error terms replaced) | [CURRENT] v3.0.1 complete |
| Generic product positioning (no VIC-specific copy; beta not demo) | [CURRENT] v3.0.1 complete |
| Encouragement line on quiz completion (src/data/encouragements.js) | [CURRENT] v3.0.1 complete — placeholder, expand/curate later |
| Mockup file (quizpulse_mockups_v301.html, 5 screens, reference only) | [CURRENT] v3.0.1 complete |
| Confidence layer — data model (confidence + responseTimeMs on responses) | [CURRENT] v3.2.0 complete |
| Confidence layer — student UI (3-button selector, first-time explainer, response-time capture) | [CURRENT] v3.2.0 complete |
| Confidence layer — misconception analytics (confidentButIncorrect per question, teacher callout) | [CURRENT] v3.2.0 complete |
| Sign-up flow (Create an account button, prompt: 'create', CIAM self-service sign-up) | [CURRENT] v3.2.1 complete — portal self-service sign-up must be enabled (see SIGNUP_SETUP.md) |
| Admin portal — CIAM audience separation (authenticateAdmin, separate app reg) | [CURRENT] v3.1.0 complete — portal steps in docs/azure/ADMIN_CIAM_SETUP.md |
| Admin portal — React+Vite SWA scaffold (admin/, port 5174, 30-min idle timeout) | [CURRENT] v3.1.0 complete — provision SWA + replace ADMIN_SWA_ORIGIN_PLACEHOLDER in api/host.json |
| Admin portal — school list/validate/merge/institution/invite pages | [CURRENT] v3.1.0 complete |
| Admin portal — monitoring dashboard (metrics + log export) | [CURRENT] v3.1.0 complete |
| Admin portal — audit log viewer + role management (owner-gated) | [CURRENT] v3.1.0 complete |
| GET /api/manage/schools (all schools + teacher/class counts) | [CURRENT] v3.1.0 complete |
| GET /api/manage/teachers (all teachers, paginated, searchable) | [CURRENT] v3.1.0 complete |
| GET /api/manage/audit (paginated audit log query for admin UI) | [CURRENT] v3.1.0 complete |
| Roster approval fix (restored `rateLimit` import in joinRequests.js — Sprint 6 APIM regression) | [CURRENT] v3.2.2 complete — diagnosis in docs/fixes/ROSTER_APPROVAL_DIAGNOSIS.md |
| Two-path public landing (student/teacher cards, Preview gallery link, DemoNav signed-out branch) | [CURRENT] v3.2.2 complete |
| PWA install button (usePwaInstall hook, InstallButton — native "Add to your phone" / iOS guide) | [CURRENT] v3.2.2 complete |
| Demo class data model (isDemo on classes/quizzes/responses; demoStudents; api/shared/demoNames.js) | [CURRENT] v3.3.0 complete |
| Demo class creation (POST /api/classes isDemo, 24 demoStudents, no joinCode, 1/teacher, excluded from real cap) | [CURRENT] v3.3.0 complete |
| Simulated responses (api/shared/runSimulation.js, POST /api/simulate-responses, send-notification demo branch skips push) | [CURRENT] v3.3.0 complete |
| Demo class UI (Classes "Try with a demo class" + Demo pill, SendQuiz demo note, Analytics "Demo data" pill, mockups) | [CURRENT] v3.3.0 complete |
| Demo class isolation (api/shared/excludeDemo.js; metrics/schoolsList/logsExport exclude demo from cross-teacher reporting) | [CURRENT] v3.3.0 complete |
| Comprehensive analytics — class drill-down, four-cell confidence+correctness chart, misconception hero card | [CURRENT] v4.0.0 code complete — reviewed + built 2026-07-03 |
| Population benchmarking (/teacher/population, population_benchmark container, api/analyticsPopulation.js) | [CURRENT] v4.0.0 code complete — container provisioning + seed run still pending, see Known issues |
| Topic tag on quiz (optional, 12 presets, api/shared/topicTags.js, feeds population benchmarking) | [CURRENT] v4.0.0 code complete |
| Pre-release review fixes (CSV formula-injection guard, per-class response rates, server-set sentAt, option bars kept beside four-cell) | [CURRENT] v4.0.0 — /review 2026-07-06, 215/215 tests pass |
| APST evidence export (/teacher/evidence, per-quiz PDF + annual MyPD log, pdfkit) | [CURRENT] v4.1.0 code complete on release/v4.1-evidence — not yet deployed |
| Onboarding profile wizard (5-step, PUT /api/me/profile, ProfileWizardSteps, /onboarding/profile) | [CURRENT] v4.2.0 code complete on release/v4.2-onboarding — not yet deployed |
| Class shells (POST /api/classes/shells, api/shared/createClass.js) | [CURRENT] v4.2.0 code complete |
| Progressive disclosure engine (introEligibility.js, 9 feature-intro keys, PUT /api/me/feature-intros) | [CURRENT] v4.2.0 code complete |
| Feature-intro UI (FeatureIntroCard, PromoSlot one-promo-per-page, ProfileNudge) | [CURRENT] v4.2.0 code complete |
| confidenceResponseCount counter (atomic Cosmos incr patch, api/responses.js + runSimulation.js) | [CURRENT] v4.2.0 code complete |
| SendQuiz topic dropdown prefilter (profile-matched segment + zero-match fallback) | [CURRENT] v4.2.0 code complete |
| AI quiz generation (mock provider, /teacher/generate, ReviewDraft, spaced repeats, expansion nudges) | [CURRENT] v4.3.0 code complete on release/v4.3-generation — not yet deployed |
| Page-view beacon (usePageView → POST /api/pageView → pageviews container, route allowlist, student privacy stripping) | [CURRENT] v4.4.0 code complete — hardened + formalized |
| Traffic monitor (GET /api/manage/traffic, admin Traffic page, notification funnel, PWA-install tracking, metrics de-stub) | [CURRENT] v4.4.0 code complete on release/v4.4-traffic — not yet deployed |
| Student class home (/student/class, GET /api/student/quizzes, approved-screen CTA, auto-subscribe, returning-device recognition, teacher share-link) | [CURRENT] v4.5.0 code complete — not yet deployed |
| Companion Layer Phase 2 (creature/room, monthly cadence, depth/breadth, adoption loop) | [PLANNED — post-pilot, requires student accounts] |

---

## Known issues [CURRENT]

### Resolved

~~**Roster approval returned 500 — teachers could not approve students (resolved v3.2.2).**~~
The Sprint 6 APIM migration (commit `f72f270`) removed `rateLimit` from the import in
`api/joinRequests.js` but left the four `rateLimit(...)` call sites, so every authed join-request
handler threw `ReferenceError: rateLimit is not defined` → 500. Fixed by restoring the import. Full
diagnosis (candidate causes ruled out, regression test path): `docs/fixes/ROSTER_APPROVAL_DIAGNOSIS.md`.

~~**Sign-in buttons produced total silence in production (resolved v3.0.1).**~~
The CSP `connect-src` listed `*.b2clogin.com` (old Azure AD B2C domain) instead of `*.ciamlogin.com`
(the actual Entra External ID / CIAM authority). MSAL's OIDC discovery fetch was blocked, preventing
any redirect. Fixed in `staticwebapp.config.json` — `connect-src` now has `*.ciamlogin.com`; `frame-src`
added for silent token iframe renewal. **Portal action still required:** confirm
`https://nice-field-0127b5b00.7.azurestaticapps.net` is listed as a redirect URI in the Entra External
ID app registration. Diagnosis: `docs/fixes/SIGNIN_DIAGNOSIS.md`.

~~1. **SWA Standard upgrade is a portal step — not yet applied to the live site.**~~ **Resolved.**
   Verified live 2026-07-03: `quizpulse-app-swa` is on Standard tier with the Function App linked
   as backend (`az staticwebapp backends show` confirms `backend1` → `quizpulse-app-api-av5z18`).
2. **APIM exists but is not in the traffic path, and its Consumption tier can't run rate-limit
   policies at all.** Verified 2026-07-03: an APIM instance (`quizpulse-apim-av5z18`) already
   existed in **`quizpulse-rg`** — a different resource group than the rest of the app
   (`quizpulse-app-rg`), which is why earlier checks against `quizpulse-app-rg` found nothing. The
   Function App is imported as an API and its operation list is kept in sync with all current
   routes (50 operations as of this deploy). But: (a) the SWA linked backend still points directly
   at the Function App, bypassing APIM entirely, and (b) **`docs/azure/APIM_SETUP.md`'s own
   recommendation is internally inconsistent** — it picks Consumption tier for the no-idle-cost
   reason, but `rate-limit-by-key` (which the doc's Step 3 policies all use) is rejected outright
   on Consumption tier (`ValidationError: Policy is not allowed in 'Consumption' sku`). Rate
   limiting is still a no-op in production, and applying the documented policies requires
   upgrading APIM to at least Developer tier (~$50/mo, no SLA) or Basic tier (~$150/mo, has SLA) —
   an explicit cost decision, not yet made. APIM today is a monitoring-only sidecar with zero live
   traffic and zero enforcement.
3. **Apple ID not yet active** — Entra External ID still has Microsoft only until the steps in
   `docs/azure/APPLE_ID_SETUP.md` are completed in the Apple Developer portal and the CIAM tenant.
4. **Cosmos DB IP restriction skipped** — Consumption plan lacks static outbound IPs. Deferred.
5. **Function App must be deployed separately** — GitHub Actions deploys frontend only.
6. **`func publish` bumps the remote Node runtime to the local Node major version.** Deploy only
   from Node 20/22. See the ⚠️ note under Deploy. App runs `NODE|22`.
7. **Key Vault references break if the closing `)` is dropped.** Setting a
   `@Microsoft.KeyVault(...)` value in **cmd.exe** mangles the `( ) ;` chars; a reference missing
   its `)` silently does NOT resolve — Azure passes the literal string to the app (this caused
   `/api/vapid-public-key` to return the raw reference string on 2026-06-15). Set such values from
   **PowerShell** wrapped as `'"NAME=@Microsoft.KeyVault(...)"'` (single-quoted outer, double-quoted
   inner) so `az.cmd` receives one literal token, or paste into the Azure Portal. The Function App
   managed identity holds **Key Vault Secrets User** on `quizpulse-app-kv-av5z18`.
~~8. **New Cosmos containers must be provisioned before deploying the Sprint 6 API.**~~ **Resolved.**
~~9. **`question_upvotes` and `question_reports` env vars** must be set.~~ **Resolved.** Verified
    2026-07-03: both containers exist in `quizpulse-app-db-av5z18` and both env vars are set on
    the Function App.
~~10. **`population_benchmark` container not yet provisioned or seeded (v4.0.0).**~~ **Resolved
    2026-07-03.** Container created (partition key `/topicTag`), `COSMOS_CONTAINER_POPULATION_BENCHMARK`
    set on the Function App, and `node api/seed/populationSeed.js` run once — 12 topic rollups
    seeded. The v4.0.0 API (including `analyticsPopulation`) was also redeployed the same day via
    `func azure functionapp publish` from Node 22; confirmed live (`GET /api/analytics/population`
    returns 401 unauthenticated, not 404/503 — i.e. registered and running).
11. **v4.0.0 UI was verified by build + smoke-check only, not full E2E.** `npm run build` is clean
    and `/teacher/build` + `/teacher/population` render without console errors in the preview
    browser (nav wiring confirmed — SubNav shows both "By Class" and "Population" tabs). The
    topic-dropdown-to-four-cell-chart-to-population-comparison flow with real data was NOT
    exercised end-to-end — that needs `func start` + Azurite + a seeded Cosmos emulator + a dev
    auth token, none of which were running in the session that built this. Run the E2E suite (or
    manually walk Send → Analytics → Population) before treating this as pilot-ready.
12. **Admin portal is live** at `https://ambitious-sand-054490e00.7.azurestaticapps.net` (SWA
    `quizpulse-admin-av5z18`, admin app reg `ADMIN_AUTH_CLIENT_ID=6fa86528-3a7b-4c03-bc55-c0e7073b8eb7`).
    Three production realities differ from the original Sprint 7 design — see
    `memory/reference_admin_portal_auth_gotchas.md` for the full debugging story:
    - **The admin SWA has NO linked Function App backend** (a Function App links to only one SWA,
      and it's linked to the teacher SWA). So `admin/src/api.js` calls the Function App by
      **absolute URL** in prod (`https://quizpulse-app-api-av5z18.azurewebsites.net/api`), not the
      relative `/api`. The Function App CORS and the admin CSP `connect-src` both list that host.
    - **App Service Easy Auth was disabled** on the Function App. It was a retired-since-Sprint-1
      leftover (`enabled:true`, unconfigured) that 401'd admin-audience tokens at the platform layer
      before any function code ran. All API auth now relies on app-level JWKS validation (by design).
    - **CIAM stamps token `iss` with the tenant-GUID host**, not the subdomain. `api/auth.js`'s
      `ISSUER` is now an array accepting both forms; `getCallerScope` reads the `roles[]` array claim.
      Owner role is assigned to the **self-service-signup principal** (the account you actually sign
      in as), and the admin app reg must be added to the CIAM `SignUpSignIn` user flow.
~~13. **The page-view beacon was silently live (and slightly broken) since the baseline
    import.**~~ **Resolved in v4.4.0.** All three defects fixed on `release/v4.4-traffic`
    (`feat/v4.4-pageview-hardening`): the visitor UUID now keys under `quizpulse_device_id`
    (matches join requests/responses/subscriptions, enabling the funnel), the container no
    longer self-creates at runtime (lazy init from `COSMOS_CONTAINER_PAGEVIEWS`), and TTL
    provisioning is documented in `docs/azure/V440_CONTAINERS_SETUP.md`. **Portal action still
    required before deploying:** the container's 180-day TTL must be set manually per that doc —
    the deploy-blocker note in the v4.4.0 status blurb above. (No RU cap step — corrected
    2026-07-16: `quizpulse-app-db-av5z18` is Serverless capacity mode, which has no per-container
    throughput setting to configure.)
14. **v4.4.0 integration tests are written but unrun.** `tests/integration/api/v440-traffic.test.js`
    (14 cases: pageView write contract, the full traffic-endpoint auth/role/rate-limit/validation
    matrix incl. the required cross-tenant negative test and a support-role read-access test, and
    a demo-quiz-doesn't-corrupt-aggregation check) is syntax-verified and gate-skips correctly via
    `RUN_INTEGRATION`, but was never run against a live `func start` + the `quizpulse-int-test-db`
    — none were available in the build session. Run them (and the admin Traffic page's live
    render, which also wasn't exercised — no admin dev-auth bypass exists) before treating v4.4.0
    as pilot-ready. See CLAUDE.md Testing section for the safe way to point `func start` at the
    test Cosmos account.

---

## Planned expansion — Companion Layer (Phase 2)

**What IS built (v3.2.0 — Confidence Layer / Sprint A):** per-question confidence capture
(3 coarse levels: Sure / Pretty sure / Just guessing), response-time logging as a noisy
aggregate signal, first-time-only explainer, and misconception surfacing in teacher analytics
(`confidentButIncorrect` per question — cohort/question level only, never individual).

**What is NOT yet built — gated behind (a) pilot validation and (b) durable student identity:**

The following pieces were deliberately excluded from v3.2.0 and should not be added until
the core push hypothesis is validated through a real pilot, and until named per-student accounts
exist (the current device-UUID model can't support longitudinal per-student state):

- **Persistent per-student room.** A private visual space that grows as the student participates.
  Requires a stable student identity across sessions and devices — the current device-UUID model
  doesn't provide this.
- **Monthly creature cadence.** One creature made available per active month; missed months
  cause the creature to drift to a shared city pool (opportunity, not loss). Requires month-boundary
  logic and a participation-history record per student.
- **Depth-accrues / breadth-resets engine.** Returning to a topic deepens an existing creature;
  exploring a new topic adds a new one. Requires per-student topic-response history.
- **Adoption loop + curated encouragement.** The creature naming/personalisation and curated text
  for interaction moments. Curated text only — no free-text, no AI-generated content (minors).
- **Teacher ambient room view.** Teacher sees the class's aggregate creature collection as an
  ambient engagement signal (not routed to leadership or admin). Never exposed via reporting APIs.
- **Statistical anti-farming model.** Detect and discount suspiciously fast/uniform responses
  when computing creature advancement. Confidence + responseTimeMs captured now are the forward-
  compatible data foundation for this; the detection logic is not yet built.

**Design non-negotiables to honour in Phase 2 (record here so future sessions don't drift):**

- **Participation, not correctness.** Creatures and room growth must never depend on getting
  answers right — only on participating. Wrong answers with high confidence are as valuable a
  learning signal as correct answers. Never tie creature advancement to score.
- **No rarity tiers, no leaderboards, no comparative display.** This is a personal collection,
  not a competition. Students must never see each other's rooms or creature counts.
- **Missed = opportunity, not loss.** A missed month means the creature drifts to the city pool
  (the student can still see it there); it does not disappear or decay. Framing is gentle.
- **Measure, don't enforce.** Response time is captured as data only — it must never gate,
  block, warn, or create minimum-dwell timers. Confidence is buttons only — no free-text ever.
- **Curated text only.** All creature names, room labels, and encouragement text must be
  human-curated. No AI-generated copy, no user-submitted text (content surface for minors).
- **Teacher room view is never routed to leadership.** The ambient class-room view is a teacher
  engagement signal. It must not appear in admin dashboards, reports, or monitoring endpoints.

---

## Coding conventions

- React functional components + hooks only.
- Async/await for all API calls, always wrapped in try/catch.
- API calls use `API_BASE` from `src/api.js` (relative `/api` in prod via SWA Standard proxy).
- `teacherId` from `AuthContext`.
- Plain JavaScript — no TypeScript. Inline styles — no CSS modules.
- Azure Functions v4: `context.error()` / `context.warn()` / `context.log()` only.
- All POST/PUT handlers apply, in order: rate limit → Content-Length cap → body type check →
  field validation → ownership check. 500s return a generic message to the client.
- Enforce every limit from the Security limits table **server-side**, not just in the UI.
- Student endpoints keyed by non-guessable UUIDs; teacher/admin endpoints require auth.
- **No technical jargon in user-facing strings.** JSX text, button labels, headings, placeholders,
  toast/error messages, and aria-labels must use plain language. Do NOT write "push notification",
  "service worker", "VAPID", "endpoint", "Azure", "Cosmos", "Function App", "deviceId" (as rendered
  text), "Entra", "CIAM", "MSAL", "PWA", or raw HTTP status codes in strings a teacher or student
  will see. Replace with plain equivalents ("notification", "something went wrong", etc.).
  Code identifiers, filenames, and data-model fields are NOT affected by this rule.
- **Encouragement placeholder** (`src/data/encouragements.js`): 10 effort/participation-focused
  lines shown at random on the TakeQuiz completion screen (`data-testid="encouragement-line"`).
  Expand or curate this array — do not add ability/cleverness framing, score references, or markup.
- **Mockup file** (`quizpulse_mockups_v301.html` in the project root): self-contained HTML reference
  artifact with 5 screens (completion, notification, participation, community bank, analytics).
  Not part of the build. Update alongside design changes; keep copy consistent with the no-jargon
  and generic-positioning rules above.
