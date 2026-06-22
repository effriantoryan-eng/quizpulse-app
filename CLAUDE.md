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

**[CURRENT] state of the app — v3.2.0 (Confidence Layer), on top of Sprint 6 (v3.0.0 — MAJOR) / v3.0.1.**
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

---

## Data model

### [CURRENT] containers

- `questions` — { id, teacherId, authorId, visibility, text, options[], correctIndex, topic, createdAt }
- `quizzes` — { id, teacherId, name, questionIds[], classIds[], status, classSize, sentAt, createdAt, isDemo? } — `isDemo` (default false, non-breaking) added v3.3.0; legacy docs without it are treated as `isDemo=false`.
- `responses` — { id, quizId, studentId, answers[]: { questionId, selectedIndex, confidence: "sure"|"pretty_sure"|"guessing", responseTimeMs? }, quizDurationMs?, completedAt, isDemo?, simulated? } — `confidence` and `responseTimeMs` added in v3.2.0 (Confidence Layer); `isDemo`/`simulated` (default false, non-breaking) added v3.3.0 for simulated demo-class responses. Legacy docs without these fields are tolerated: `confidentButIncorrect` counts 0 for answers with no confidence field.
- `teachers` — { id, teacherId, schoolId, schoolStatus, name, email, idp, role, createdAt } (pk `/id`)
- `schools` — { id, name, status, sector, suburb, state, mergedIntoId, createdAt, validatedAt } (pk `/id`)
- `classes` — { id, teacherId, schoolId, name, studentCount, joinCode, nameList[], nameListEnabled, cap, createdAt, isDemo?, demoStudents? } (pk `/teacherId`) — `isDemo` (default false, non-breaking) added v3.3.0. When `isDemo=true`: the class has no `joinCode` (never joinable) and no `nameList`, and carries `demoStudents: [{ studentId: <uuid>, name: <string> }]` (24 entries, generated server-side at create time via `api/shared/demoNames.js`, never client-provided). Max 1 demo class per teacher; demo classes do NOT count toward the 20-real-class cap. `GET /api/classes` returns `isDemo` + `demoStudentCount` (the raw `demoStudents` array is dropped from the list payload).
- `audit_log` [Sprint 5] (pk `/actorId`) — { id, actorId, actorRole, action, targetType, targetId,
  before, after, ip, createdAt }. Append-only — `api/shared/auditLog.js` exports only
  `writeAudit()`, no update/delete path. Manual provisioning:
  `docs/azure/SPRINT5_CONTAINERS_SETUP.md`.
- `invites` [Sprint 5] (pk `/schoolId`) — { id, schoolId, token, createdAt, expiresAt, used }.
  One-time teacher-invite links, 7-day expiry, max 50 pending per school. Manual provisioning:
  `docs/azure/SPRINT5_CONTAINERS_SETUP.md`.

Note: only `teachers` and `classes` carry a `schoolId` field. `questions`/`quizzes`/`responses` do
not — they're scoped by `teacherId`/`quizId`, never `schoolId`. School merge
(`POST /api/manage/schools/merge`) only re-points `teachers` and `classes` for this reason.

### [PLANNED] new/changed containers

- **`join_requests`** [Sprint 2] (pk `/classId`) — { id, classId, schoolId, teacherId,
  studentName, deviceId, status: "pending|approved|rejected|queued", matchedName, matchScore, createdAt }
- **`subscriptions`** ~~[Sprint 3]~~ **[CURRENT — Sprint 3 complete]** (pk `/classId`) — { id, classId, deviceId, endpoint, keys: { p256dh, auth }, createdAt, updatedAt }
- **`question_upvotes`** ~~[Sprint 6]~~ **[CURRENT — Sprint 6]** (pk `/questionId`) — { id, questionId, teacherId, createdAt }. Env: `COSMOS_CONTAINER_QUESTION_UPVOTES`. Provisioning: `docs/azure/SPRINT6_CONTAINERS_SETUP.md`.
- **`question_reports`** [CURRENT — Sprint 6] (pk `/questionId`) — { id, questionId, teacherId, reason, createdAt }. Env: `COSMOS_CONTAINER_QUESTION_REPORTS`. Max 20 reports/teacher/day; visible to support/platform_admin via `GET /api/questions/reports`.

### Field additions to existing documents

- ~~[Sprint 1] `schoolId` + `schoolStatus` (denormalised) on teacher, class~~ — **DONE** (on teacher and class docs)
- ~~[Sprint 1] `visibility: "private|school|public"` + `authorId` on questions~~ — **DONE** (visibility='private', authorId=oid)
- ~~[Sprint 1] `role: "teacher|school_admin|super_admin"` on teacher~~ — **DONE** (role='teacher';
  display-only DB field — authorization never reads it, see Authorization model below)
- ~~[Sprint 4] `closedAt` on quizzes~~ — **DONE** (derived server-side from teacher-configured `durationMinutes` at send time; also `scheduledFor` for scheduled quizzes)
- [Sprint 6] `upvotes`, `usageCount` on questions

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
time — never trust a client-supplied `closedAt`. `POST /api/responses` re-checks `closedAt`,
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

---

## Testing [CURRENT — Sprint 1 suite live]

Three tiers, run in sequence on PR. No sprint is "done" until its test checklist passes and the
HTML report is generated.

- **Unit** (jest BE / vitest FE) — pure logic: validation, rate limiting, fuzzy match, join codes.
  Runs every push.
- **Integration** (jest + supertest) — API endpoints vs local Cosmos emulator + Azurite; status
  codes, DB writes, limit enforcement. Runs after unit pass.
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

## Admin monitoring endpoints [CURRENT — Sprint 5 backend, STUBBED metrics; admin frontend is Sprint 7]

`GET /api/manage/metrics?range=today|7d|30d` (owner/support, 60 req/hr) and `GET
/api/manage/logs/export?type=errors|security|usage&from=&to=` (owner/support). Routes use
`manage/`, not `admin/` — Azure Functions reserves the `admin/` route segment for its own host
API and refuses to register a conflicting custom route; see Authorization model above.

**Metrics is stubbed, not wired to real data.** There is no `@azure/monitor-query` SDK installed
and no App Insights App ID/API key configured — `api/metrics.js`'s `buildStubbedMetrics()` returns
the real response shape with `stubbed: true` and placeholder (`null`) values. Wiring it to real
Kusto queries against Application Insights is still open work, not yet scheduled to a sprint.

Logs export is **partially real**: `type=security` streams real JSONL straight from the
`audit_log` container (capped 50MB). `type=errors`/`type=usage` return `501 Not Implemented`
rather than fabricated data — same App Insights wiring gap as metrics.

Metric groups (real shape, stubbed values): **System health** (error rate, p95, active instances)
· **Usage/growth** (schools, teachers, students, quizzes/day, push delivery rate) · **Engagement**
(avg response rate, time-to-respond, completion rate) · **Security** (rate-limit hits, join
rejection rate, failed auth) · **Spending** (month cost vs $100 budget, per-service breakdown).

There is no admin **frontend** for any of this yet — Sprint 7, a separate site, not part of this
sprint's scope.

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

1. **SWA Standard upgrade is a portal step — not yet applied to the live site.** Until the Azure
   portal steps in `docs/azure/SWA_STANDARD_UPGRADE.md` are executed (upgrade to Standard tier,
   link the Function App backend), the production site is still on the Free tier and `/api/*` will
   break. **Do not deploy the v3.0.0 frontend before completing those portal steps.**
2. **APIM is a portal step — not yet provisioned.** Rate limiting is a no-op at the application
   layer (rateLimit() always returns true). APIM policies enforce limits once the instance is
   created per `docs/azure/APIM_SETUP.md`. Until then, the app is unthrottled in production.
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
8. **New Cosmos containers must be provisioned before deploying the Sprint 6 API.** See
   `docs/azure/SPRINT6_CONTAINERS_SETUP.md` for `question_upvotes` and `question_reports`.
9. **`question_upvotes` and `question_reports` env vars** must be set in the Function App:
   `COSMOS_CONTAINER_QUESTION_UPVOTES=question_upvotes`,
   `COSMOS_CONTAINER_QUESTION_REPORTS=question_reports`.
10. **Admin portal is live** at `https://ambitious-sand-054490e00.7.azurestaticapps.net` (SWA
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
