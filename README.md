# QuizPulse — PWA

A **PWA-first** low-stakes formative assessment tool for school teachers (K–12, any curriculum).
Teachers create short multiple-choice quizzes and send them to students via real Web Push
notifications. Students receive a notification, tap it, complete the quiz, and teachers view
live analytics. No link sharing required — delivery is push-first.

**Live app:** https://nice-field-0127b5b00.7.azurestaticapps.net

Sign in with your Microsoft or Google account. New teachers complete a one-time onboarding to
associate a school before accessing the dashboard.

**Admin portal:** https://ambitious-sand-054490e00.7.azurestaticapps.net

Operator tooling — school management, merge tool, traffic monitor, audit log, role management.
Requires a separate admin CIAM account.

**Current version:** v4.13.0 (beta)

---

## Features

| Feature | Status |
|---|---|
| Auth — Microsoft + Google via Entra External ID (CIAM) | ✅ |
| Teacher onboarding — school association | ✅ |
| Classes CRUD (create, rename, delete; unique join codes) | ✅ |
| Student join requests + teacher approval (individual + batch) | ✅ |
| Optional name-list fuzzy matching (fuse.js) | ✅ |
| Create / edit / delete questions (topic, year level) | ✅ |
| Community question bank (school/public visibility, upvotes, copy, report) | ✅ |
| Build quizzes from saved questions | ✅ |
| Send quizzes now, with a duration, or scheduled | ✅ |
| Real student quiz flow at `/quiz` (no auth required) | ✅ |
| Offline resilience — Background Sync queues failed submissions | ✅ |
| Live analytics — per-question breakdown, response timeline, CSV export | ✅ |
| Class cross-quiz aggregation + topic filter | ✅ |
| PWA shell — manifest, service worker, iOS install guide | ✅ |
| Web Push subscriptions (approval-gated, VAPID) | ✅ |
| Security foundation — `assertScope`, `requireRole`, role tiers, audit log | ✅ |
| Institution onboarding + teacher invites | ✅ |
| School validate + merge (step-up re-auth gated) | ✅ |
| Admin monitoring endpoints (metrics partially de-stubbed; security log export live) | ✅ |
| Azure $100/month spending controls + disable runbook | ✅ |
| Confidence layer — per-question confidence + misconception analytics | ✅ |
| Demo class — try the send → analytics loop with simulated students | ✅ |
| Comprehensive analytics — class drill-down, four-cell confidence+correctness chart, population benchmarking | ✅ |
| APST evidence export — per-quiz VIT PDF + annual MyPD aggregate log | ✅ |
| Guided onboarding — profile wizard + progressive feature-intro disclosure | ✅ |
| AI quiz generation (mock provider) — document upload → draft → review → send, spaced repeats | ✅ |
| Traffic monitor — page-view analytics, admin dashboard, notification funnel, PWA-install tracking | ✅ |
| Student class home — persistent post-approval page, auto-subscribe, teacher share-link | ✅ |
| First-run activation — demo chain, Getting Started checklist, starter questions, misconception-biased simulation | ✅ |
| Design overhaul (Modernist) — Archivo, one accent, Home calendar, student QR-join, confidence summary | ✅ |
| Student quiz history — own-answer review, self-practice, confidence-trend strip | ✅ |
| Admin teacher-data drill-down — overview + per-quiz analytics, fail-closed audit, PII-safe | ✅ |
| Consent & install telemetry — push grant/deny, install accept/dismiss, per-platform breakdown | ✅ |
| Class-delete cascade + remove-student cleanup — de-identify responses, delete subscriptions/join requests | ✅ |
| Send-time approval re-check — removed students never notified, stale subscriptions pruned | ✅ |
| Rejected-request retention (7-day TTL), retired usage-log dump | ✅ |
| Student leave-class + per-class notification off/on + rotated-subscription resync | ✅ |
| Teacher self-service account deletion (step-up re-auth + confirm word) | ✅ |
| Owner erasure tool — erase one device or a whole teacher account on request, audited | ✅ |
| After-hours send warning (warn, never block) | ✅ |
| Page-view data minimisation — no fingerprint fields anywhere, coarse device/browser buckets, no ID before joining | ✅ |
| Device ID out of URLs — moved to a request header | ✅ |
| Legal pages (privacy, collection notice, terms) + footer | ⚠️ content pending |
| Join-form collection notice + button-triggered notification prompt | ⚠️ notice text pending |
| Teacher terms acceptance + re-accept interstitial | ⚠️ terms text pending |
| Class school-authorisation attestation (fail-open cut-off) | ⚠️ checkbox text pending |
| Accessibility WCAG 2.1 AA — contrast, labels, keyboard focus, live regions, skip link | ✅ |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (SPA, React Router v6) |
| Hosting | Azure Static Web Apps — Standard tier (East Asia) |
| Backend | Azure Functions — Node.js v4, HTTP-triggered, serverless |
| Database | Azure Cosmos DB (NoSQL, serverless) |
| Auth | Microsoft Entra External ID (CIAM) — Microsoft, Google, Apple ID providers |
| Secrets | Azure Key Vault — managed identity references |
| Logging | Azure Application Insights |
| Push | Web Push API + VAPID (service worker, no native SDK) |
| Fuzzy match | fuse.js (name-list validation, server-side) |
| Testing | Jest + Vitest (unit), Supertest (integration), Playwright (E2E) |
| Resource group | `quizpulse-app-rg` (Australia East) |

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

> **Do not use `&&` in PowerShell** — run commands on separate lines.

**Auth local dev:** `api/local.settings.json` must have `B2C_ALLOW_UNVERIFIED_DEV=true` for
JWT decode-only mode (no signature verification). Real tenant values are already set in
`local.settings.json`. See `docs/azure/B2C_SETUP.md`.

---

## Deployment

**Frontend** — push to `develop`, merge to `main`. GitHub Actions deploys automatically to SWA.

**API** — deploy manually whenever `api/` changes:

```powershell
cd api
func azure functionapp publish quizpulse-app-api-av5z18
```

> ⚠️ Deploy the API only from Node 20 or 22 — never Node 24. `func publish` writes the local
> Node major version to the remote runtime. Node 24 is unsupported on Functions runtime ~4 and
> will take the whole app to 503.

---

## Running tests

```powershell
# Unit tests (no stack required) — 593/593 passing
npx jest --config jest.config.cjs tests/unit/

# Integration tests (requires func start + Azurite + Cosmos emulator)
$env:RUN_INTEGRATION = "true"
npx jest --config jest.config.cjs tests/integration/

# E2E tests (requires running app; CIAM credentials optional)
$env:E2E_BASE_URL = "http://localhost:5173"
npx playwright test
```

---

## Sprint history

| Version | Focus | Status |
|---|---|---|
| v1.0.0 | Foundation — Entra auth, school model, classes CRUD | ✅ shipped |
| v1.1.0 | Student join + approval, name-list fuzzy matching | ✅ shipped |
| v1.2.0 | PWA shell, service worker, Web Push subscriptions | ✅ shipped |
| v2.0.0 | Real student quiz flow, live analytics, offline sync, scheduling | ✅ shipped |
| v2.1.0 | Security foundation, institution/admin/monitoring endpoints | ✅ shipped |
| v3.0.0 | Community bank, SWA Standard tier, APIM, Apple ID, analytics depth | ✅ shipped |
| v3.0.1 | Sign-in fixes (CSP + mobile), de-jargon copy, encouragement, mockups | ✅ shipped |
| v3.1.0 | Admin portal — separate site, CIAM audience separation, monitoring dashboard | ✅ shipped |
| v3.2.0 | Confidence layer — per-question confidence + misconception analytics | ✅ shipped |
| v3.2.1 | Sign-up flow (CIAM self-service create-account) | ✅ shipped |
| v3.2.2 | Roster-approval regression fix, public landing split, PWA install button | ✅ shipped |
| v3.3.0 | Demo class — simulated students for the send → analytics loop | ✅ shipped |
| v4.0.0 | Comprehensive analytics — class drill-down, four-cell chart, population benchmarking | ✅ shipped |
| v4.1.0 | APST evidence export — per-quiz VIT PDF + annual MyPD log | ✅ shipped |
| v4.2.0 | Guided onboarding — profile wizard, progressive feature-intro disclosure | ✅ shipped |
| v4.3.0 | AI quiz generation (mock provider) — upload → draft → review → send | ✅ shipped |
| v4.4.0 | Traffic monitor — page-view analytics, admin dashboard, notification funnel | ✅ shipped |
| v4.5.0 | Student class home — post-approval access, auto-subscribe, teacher share-link | ✅ shipped |
| v4.6.0 | First-run activation — demo chain, Getting Started checklist, starter questions | ✅ shipped |
| v4.7.0 | Design overhaul (Modernist) — Home calendar, student QR-join, confidence summary | ✅ shipped |
| v4.8.0 | Student quiz history — own-answer review, self-practice, confidence-trend strip | ✅ shipped |
| v4.9.0 | Admin teacher-data drill-down + consent & install telemetry | ✅ shipped |
| v4.9.1 | R1 remediation — class-delete cascade, removed-student notify fix, retired usage-log dump | ✅ shipped |
| v4.11.0 | R2 remediation — student leave/opt-out, teacher account deletion, owner erasure tool, after-hours warning | ✅ shipped |
| v4.12.0 | R3 remediation — page-view minimisation, device id out of URLs, legal pages, join notice, teacher terms, class attestation | ✅ shipped (legal wording pending) |
