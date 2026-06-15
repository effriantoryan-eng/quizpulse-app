# QuizPulse — Claude Code Context

> **Status note:** This file describes BOTH the current state and the planned PWA build.
> Sections are tagged **[CURRENT]** (exists now) or **[PLANNED — Sprint N]** (not yet built).
> Do not assume a [PLANNED] feature exists. Check the Feature status table before relying on anything.

---

## What this project is

QuizPulse is a **PWA-first** low-stakes formative assessment tool for Victorian secondary
school teachers (Years 7–12). Teachers create short multiple-choice quizzes and push them to
students via **real Web Push notifications**. Students receive a notification, tap it, complete
the quiz, and teachers view live analytics. The differentiator is push-first delivery — no link
sharing required.

**This is a real Progressive Web App built from scratch — NOT a wrapper.** It uses service
workers, the Web Push API, and a web app manifest to behave like a native app without a native
shell or App Store. Capacitor/App Store packaging is a possible future step only if a school
explicitly requires store presence — nothing in the current plan depends on it.

**[CURRENT] state of the app:** A teacher-only demo. Teachers create questions, build quizzes,
send them to a preset class, and view analytics. Student responses are *simulated* on send — no
real student flow, no push notifications yet. The PWA build (below) replaces the simulated parts
with the real thing.

---

## Tech stack

| Layer | Technology | Status |
|---|---|---|
| Frontend | React + Vite (SPA, React Router v6) | [CURRENT] |
| Hosting | Azure Static Web Apps (free tier → Standard in Sprint 6) | [CURRENT] |
| Backend | Azure Functions — Node.js v4, HTTP-triggered, serverless | [CURRENT] |
| Database | Azure Cosmos DB (NoSQL, serverless mode) | [CURRENT] |
| Auth | Azure AD B2C (multi-provider: Microsoft, Google, Apple ID) | [PLANNED — Sprint 1] (currently Easy Auth / Entra ID) |
| Secrets | Azure Key Vault — managed identity references | [CURRENT] |
| Logging | Azure Application Insights | [CURRENT] |
| Push | Web Push API + VAPID (service worker, no native SDK) | [PLANNED — Sprint 3] |
| Fuzzy match | fuse.js (name-list validation, server-side) | [PLANNED — Sprint 2] |
| Testing | jest + vitest (unit), supertest (integration), Playwright (E2E) | [PLANNED — Sprint 1 onward] |
| Rate limiting | in-memory per-instance → Azure API Management | [CURRENT] → [PLANNED — Sprint 6] |
| CI/CD | GitHub Actions — develop → PR → main → SWA auto-deploy | [CURRENT] |

---

## Local paths

- Project root: `C:\Users\Ryan\quizpulse\`
- Frontend source: `src/`
- Azure Functions: `api/`
- Built output: `dist/`
- Tests: `tests/` (mirrors src/ and api/ structure) **[PLANNED — Sprint 1]**
- Test reports: `tests/reports/sprintN-report.html` **[PLANNED — Sprint 1]**
- Spike reference repo: `C:\Users\Ryan\quizpulse-pwa-test\` (validated Web Push — reference only, never merged)

---

## Live URLs

- Production site: `https://mango-meadow-0a5aa7410.7.azurestaticapps.net`
- Function App (direct): `https://quizpulse-api-b5bvbvgzdph6dyas.australiaeast-01.azurewebsites.net/api`
- GitHub repo: `https://github.com/effriantoryan-eng/quizpulse`
- Spike repo: `https://github.com/effriantoryan-eng/quizpulse-pwa-test` (private)

---

## Running locally

Three terminals required:

```powershell
# Terminal 1 — React dev server
cd C:\Users\Ryan\quizpulse
npm run dev        # -> localhost:5173

# Terminal 2 — Azure Functions
cd C:\Users\Ryan\quizpulse\api
func start         # -> localhost:7071

# Terminal 3 — Azurite storage emulator
azurite --silent
```

**Important:** Do not use `&&` in PowerShell — run commands on separate lines.

---

## Git version control strategy

Release-branch model. Feature branches cut from the sprint's release branch, merged back via PR;
release branch merges to `develop`, then to `main` on production release.

```
main                          (production — tagged releases only)
└── develop                   (integration)
    ├── release/v1.0-sprint1  ← cut from develop
    │   ├── feat/s1-b2c-auth
    │   └── feat/s1-school-identity-model
    ├── release/v1.1-sprint2
    └── hotfix/v1.0.1-description  ← from main when needed
```

### Version numbering

| Sprint | Version | Rationale |
|---|---|---|
| 1 | v1.0.0 | Foundation — multi-provider auth + real data model |
| 2 | v1.1.0 | Student join, approval, name-list validation |
| 3 | v1.2.0 | PWA shell + push infrastructure |
| 4 | v2.0.0 | **MAJOR** — first real end-to-end loop; simulate endpoint retired (breaking) |
| 5 | v2.1.0 | Institution layer, super admin, monitoring portal |
| 6 | v3.0.0 | **MAJOR** — community bank + direct URL workaround removed (breaking) |

### Rules

- Every merge to `main` gets a git tag matching the version (e.g. `v1.0.0`).
- Every release branch gets a pre-release RC tag before merging (e.g. `v1.1.0-rc1`).
- **Updating this CLAUDE.md is a required commit on every sprint branch before it can close.**
- `CHANGELOG.md` is introduced at Sprint 4 (first breaking change), updated every sprint after.
- Hotfix: `hotfix/vX.Y.Z-description` from main → tag patch → back-merge to develop.
- Spike repo is tagged `spike/pwa-push-validated` and is reference only — never merged. Cherry-pick files (sw.js, subscribe.js, sendNotification.js) into Sprint 3 feature branches.

### Deploy

```powershell
# Frontend — push to develop, PR to main → GitHub Actions auto-deploys
# API — must be deployed separately every time api/ changes:
cd api
func azure functionapp publish quizpulse-api
```

---

## Sprint roadmap (summary)

Full spec lives in `QuizPulse_PWA_Development_Plan.docx`. Sprints 1–4 are a complete pilot-ready
product; 5–6 add institution machinery and can be funded from pilot revenue.

1. **v1.0.0 — Foundation.** B2C multi-provider auth, school identity model, real classes CRUD,
   community bank placeholder field, Azure $100 spending controls.
2. **v1.1.0 — Student join & approval.** Join requests, teacher approval UI (individual + batch),
   optional name-list validation with fuzzy matching.
3. **v1.2.0 — Push infrastructure.** PWA shell (manifest + service worker), approval-gated
   subscriptions, scoped send-notification, iOS install guide.
4. **v2.0.0 — Student quiz flow & analytics.** Real quiz-taking, response submission, offline
   resilience, live analytics, scheduling. Simulate endpoint retired.
5. **v2.1.0 — Institution & admin.** Super admin panel, school validation + merge tool,
   institution onboarding, monitoring portal with log export.
6. **v3.0.0 — Community bank & hardening.** Cross-school question sharing, SWA Standard tier,
   API Management, Apple ID auth, analytics depth.

---

## Data model

### [CURRENT] containers

- `questions` — { id, teacherId, text, options[], correctIndex, topic, createdAt }
- `quizzes` — { id, teacherId, name, questionIds[], classIds[], status, classSize, sentAt, createdAt }
- `responses` — { id, quizId, questionIndex, selectedIndex, simulated, createdAt }
- `classes` — static preset list (to be replaced by real CRUD in Sprint 1)

### [PLANNED] new/changed containers

- **`schools`** [Sprint 1] (pk `/id`) — { id, name, status: "unvalidated|validated", sector,
  suburb, state, mergedIntoId, createdAt, validatedAt }
- **`classes`** [Sprint 1] (real, replaces preset) — adds schoolId, studentCount, joinCode,
  nameList[], nameListEnabled, cap (40)
- **`join_requests`** [Sprint 2] (pk `/classId`) — { id, classId, schoolId, teacherId,
  studentName, deviceId, status: "pending|approved|rejected|queued", matchedName, matchScore, createdAt }
- **`subscriptions`** [Sprint 3] (pk `/classId`) — { id, classId, schoolId, studentId, deviceId,
  endpoint, keys: { p256dh, auth }, createdAt }
- **`question_upvotes`** [Sprint 6] (pk `/questionId`) — { id, questionId, teacherId, createdAt }

### Field additions to existing documents

- [Sprint 1] `schoolId` + `schoolStatus` (denormalised) on teacher, class, question, quiz, response
- [Sprint 1] `visibility: "private|school|public"` + `authorId` on questions
- [Sprint 1] `role: "teacher|school_admin|super_admin"` on teacher (set in Sprint 5)
- [Sprint 4] `closedAt` on quizzes
- [Sprint 6] `upvotes`, `usageCount` on questions

---

## Architecture decisions

### API routing — IMPORTANT [CURRENT]

In production `src/api.js` calls the Function App URL **directly**, not via the SWA `/api/*`
proxy. The SWA free-tier rewrite returns 405 for POST/PUT/DELETE. The fix: call the Function App
directly and add its origin to the CSP `connect-src` directive.

```js
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : 'https://quizpulse-api-b5bvbvgzdph6dyas.australiaeast-01.azurewebsites.net/api'
```

**Do not revert to `/api` in production** — it breaks all writes. **This is removed in Sprint 6**
when SWA upgrades to Standard tier with a proper linked backend (breaking change → v3.0.0).

### Auth [CURRENT → Sprint 1]

Currently Azure SWA Easy Auth with Entra ID. Sprint 1 replaces this with Azure AD B2C as a
multi-provider broker (Microsoft + Google in Sprint 1; Apple ID in Sprint 6). `AuthContext.jsx`
keeps the same `{ user, teacherId, loading }` interface so no downstream components change.

### Key Vault [CURRENT]

Cosmos DB key stored as a Key Vault secret, referenced via managed identity:
`@Microsoft.KeyVault(VaultName=quizpulse-kv;SecretName=COSMOS-KEY)`. The Function App
system-assigned managed identity holds Key Vault Secrets User role. VAPID keys join Key Vault in
Sprint 3 following the same pattern.

### School identity & merge [PLANNED — Sprints 1 & 5]

Two adoption paths. Individual teachers create an **unvalidated** school (free-text name).
Institutions create a **validated** school (manually verified by super admin). When a school is
validated, unvalidated records can be merged: `POST /api/admin/schools/merge` re-points all
teacher/class/question/quiz/response docs from source `schoolId` to target, sets `mergedIntoId`
on the source (tombstone — nothing deleted). Merges run sequentially, one at a time.

### Name-list validation [PLANNED — Sprint 2]

Optional per class. Teacher pastes names (textarea, max 50). On join request, fuse.js fuzzy-matches
(threshold 0.4) server-side; `matchedName` + `matchScore` stored on the request doc (not recomputed).
Approval UI shows a confidence badge: green ≥85%, amber 60–85%, red "not on list", no badge if no
list. **It's an assistance tool, not a gate** — the teacher decides regardless of match.

### Azure Functions v4 logging [CURRENT]

Use `context.error()` / `context.warn()` / `context.log()` — NOT `context.log.error/.warn/.info`.
The `context.log.*` sub-methods don't exist in v4 and throw, turning intended error responses into 500s.

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
| Public questions per teacher | 500 | 6 |
| Upvotes per teacher per question | 1 | 6 |
| Question reports per teacher/day | 20 | 6 |
| Community search results/page | 50 | 6 |

---

## Testing [PLANNED — Sprint 1 onward]

Three tiers, run in sequence on PR. No sprint is "done" until its test checklist passes and the
HTML report is generated.

- **Unit** (jest BE / vitest FE) — pure logic: validation, rate limiting, fuzzy match, join codes.
  Runs every push.
- **Integration** (jest + supertest) — API endpoints vs local Cosmos emulator + Azurite; status
  codes, DB writes, limit enforcement. Runs after unit pass.
- **E2E** (Playwright) — full user journeys vs deployed staging. Runs on PR merge to develop.

Each test record documents: what is tested, how, expected result of success, pass/fail status.
Reports → `tests/reports/sprintN-report.html`, uploaded as a GitHub Actions artifact, with a PR
summary comment. Maintain `SPRINT_TEST_CHECKLIST.md` per sprint.

---

## Azure spending controls [PLANNED — Sprint 1]

Hard limit **$100 USD/month**.

- Budget alerts at 50% / 80% / 100% (Azure Cost Management → Budgets).
- 100% threshold fires an Action Group → Automation runbook (`scripts/azure/disable-on-budget.ps1`)
  that disables the Function App and swaps the Cosmos connection string to a dummy value (API → 503).
  SWA frontend stays up. Re-enabled manually after review.
- Resource caps: Cosmos per-container RU cap; Function App daily execution quota (host.json);
  App Insights daily data cap 1 GB.

---

## Admin monitoring portal [PLANNED — Sprint 5, depth in Sprint 6]

Super admin route, gated by `role: super_admin`. Metrics via `GET /api/admin/metrics?range=`
proxying App Insights Kusto queries. Log download via `GET /api/admin/logs/export` streaming JSONL.

Metric groups: **System health** (error rate, p95, active instances) · **Usage/growth** (schools,
teachers, students, quizzes/day, push delivery rate) · **Engagement** (avg response rate, time-to-respond,
completion rate) · **Security** (rate-limit hits, join rejection rate, failed auth) · **Spending**
(month cost vs $100 budget, per-service breakdown).

---

## Feature status

| Feature | Status |
|---|---|
| Home page | [CURRENT] Working |
| Create Question / Question Bank / edit / delete | [CURRENT] Working |
| Build Quiz / Send Quiz | [CURRENT] Working |
| Simulated responses (`/api/simulate`) | [CURRENT] Working — **retired in Sprint 4** |
| Analytics (from simulated data) | [CURRENT] Working — real data in Sprint 4 |
| Preset classes (3 hardcoded) | [CURRENT] — **replaced by real CRUD in Sprint 1** |
| Teacher auth (Entra ID Easy Auth) | [CURRENT] — **replaced by B2C in Sprint 1** |
| App Insights logging | [CURRENT] Working |
| Multi-provider auth (B2C) | [PLANNED — Sprint 1] |
| School identity model | [PLANNED — Sprint 1] |
| Real classes CRUD | [PLANNED — Sprint 1] |
| Azure spending controls | [PLANNED — Sprint 1] |
| Student join + approval + name list | [PLANNED — Sprint 2] |
| PWA shell + service worker | [PLANNED — Sprint 3] |
| Web Push notifications | [PLANNED — Sprint 3] |
| Real student quiz flow | [PLANNED — Sprint 4] |
| Offline resilience (Background Sync) | [PLANNED — Sprint 4] |
| Quiz scheduling | [PLANNED — Sprint 4] |
| Super admin + school merge | [PLANNED — Sprint 5] |
| Institution onboarding | [PLANNED — Sprint 5] |
| Monitoring portal | [PLANNED — Sprint 5/6] |
| Community question bank | [PLANNED — Sprint 6] |
| SWA Standard / API Management / Apple ID | [PLANNED — Sprint 6] |

---

## Known issues [CURRENT]

1. **SWA free tier does not proxy POST/PUT/DELETE** — frontend calls Function App directly (see
   API routing). Fixed in Sprint 6 via SWA Standard linked backend.
2. **Rate limiter is per-instance** (in-memory Map, not shared across replicas). Fine for now;
   replaced by Azure API Management in Sprint 6.
3. **Cosmos DB IP restriction skipped** — Consumption plan lacks static outbound IPs. Deferred.
4. **Function App must be deployed separately** — GitHub Actions deploys frontend only.

---

## Coding conventions

- React functional components + hooks only.
- Async/await for all API calls, always wrapped in try/catch.
- API calls use `API_BASE` from `src/api.js` (direct Function App URL in prod until Sprint 6).
- `teacherId` from `AuthContext`.
- Plain JavaScript — no TypeScript. Inline styles — no CSS modules.
- Azure Functions v4: `context.error()` / `context.warn()` / `context.log()` only.
- All POST/PUT handlers apply, in order: rate limit → Content-Length cap → body type check →
  field validation → ownership check. 500s return a generic message to the client.
- Enforce every limit from the Security limits table **server-side**, not just in the UI.
- Student endpoints keyed by non-guessable UUIDs; teacher/admin endpoints require auth.
