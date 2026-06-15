# QuizPulse — PWA

A **PWA-first** formative assessment tool for Victorian secondary school teachers (Years 7–12).
Teachers create short multiple-choice quizzes and push them to students via Web Push notifications.
Students receive a notification, tap it, complete the quiz, and teachers view live analytics.

**Live app:** https://nice-field-0127b5b00.7.azurestaticapps.net

Sign in with your Microsoft or Google account. New teachers complete a one-time onboarding to associate a school before accessing the app.

> **Note:** This is the Sprint 1 release (v1.0.0) — real push notifications and the student quiz flow are planned for Sprints 3–4. Student responses are currently simulated.

---

## Current features (Sprint 1 — v1.0.0)

| Feature | Status |
|---|---|
| Multi-provider auth (Microsoft + Google via Azure AD B2C) | ✅ |
| Teacher onboarding — associate an unvalidated school | ✅ |
| Real classes CRUD (create, rename, delete; unique join codes) | ✅ |
| Create / edit / delete questions | ✅ |
| Question bank with My Questions / Community tabs | ✅ |
| Build and send quizzes | ✅ |
| Analytics (from simulated responses) | ✅ |
| Quiz history | ✅ |
| Community question bank placeholder | ✅ (coming Sprint 6) |
| App Insights logging | ✅ |
| Azure $100/month spending controls + runbook | ✅ |
| Web Push notifications | Sprint 3 |
| Student quiz flow (real responses) | Sprint 4 |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (SPA, React Router v6) |
| Hosting | Azure Static Web Apps — `quizpulse-app-swa` (free tier) |
| Backend | Azure Functions — Node.js v4, HTTP-triggered, serverless |
| Database | Azure Cosmos DB (NoSQL, serverless mode) |
| Auth | Azure AD B2C — Microsoft + Google providers; `teacherId` = B2C `oid` claim |
| Secrets | Azure Key Vault — managed identity references |
| Logging | Azure Application Insights |
| Resource group | `quizpulse-app-rg` (Australia East) |

---

## Running locally

Three terminals required:

```powershell
# Terminal 1 — React dev server
cd "C:\Users\Ryan\quizpulse - PWA"
npm run dev        # → localhost:5173

# Terminal 2 — Azure Functions
cd "C:\Users\Ryan\quizpulse - PWA\api"
func start         # → localhost:7071

# Terminal 3 — Azurite storage emulator
azurite --silent
```

> **Do not use `&&` in PowerShell** — run commands on separate lines.

**B2C local dev:** `api/local.settings.json` must have `B2C_ALLOW_UNVERIFIED_DEV=true` for JWT
decode-only mode (no signature verification). Replace `REPLACE_WITH_*` placeholders with real
B2C values to test against the live tenant. See `docs/azure/B2C_SETUP.md`.

---

## Project structure

```
src/
  pages/
    Home.jsx                  — landing page
    Onboarding.jsx            — first-login school association
    teacher/
      Classes.jsx             — class management (CRUD)
      CreateQuestion.jsx      — create and save questions
      QuestionBank.jsx        — browse, filter, edit, delete questions (My / Community tabs)
      BuildQuiz.jsx           — assemble a quiz from saved questions
      SendQuiz.jsx            — send quiz to a class; responses simulated server-side
      Analytics.jsx           — per-question response breakdown
      QuizHistory.jsx         — all sent quizzes, click to view analytics
  components/
    DemoNav.jsx               — persistent top navigation bar
  contexts/
    AuthContext.jsx           — { user, teacherId, loading, isAuthenticated, login, logout }
  msalInstance.js             — MSAL config + fetch interceptor for bearer tokens
  onboardingCache.js          — shared onboarding state to avoid redirect loops
  api.js                      — centralised API base URL
  App.jsx                     — router, auth guards (RequireAuth / RequireTeacher)
api/
  auth.js                     — JWT extraction + B2C verification
  teacher.js                  — GET /api/me, POST /api/onboarding
  classes.js                  — GET/POST/PUT/DELETE /api/classes
  questions.js                — GET/POST/PUT/DELETE /api/questions
  quizzes.js                  — GET/POST /api/quizzes, GET /api/quizzes/:id
  responses.js                — GET/POST /api/responses
  simulate.js                 — POST /api/simulate (bulk response generation)
  rateLimit.js                — in-memory sliding window rate limiter (30 req/min/IP)
  logger.js                   — structured logging to Application Insights
tests/
  unit/                       — jest unit tests (23/23 passing)
  integration/                — jest + supertest integration tests (requires running stack)
  e2e/                        — Playwright E2E tests (requires B2C credentials)
  reports/sprint1-report.html — Sprint 1 HTML test report
```

---

## API routing note

In production `src/api.js` calls the Function App URL directly — **not** through the SWA `/api/*`
proxy. The SWA free tier returns 405 for POST/PUT/DELETE. `src/api.js` handles the switch:

```js
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : 'https://quizpulse-app-api-av5z18.azurewebsites.net/api'
```

Do not revert this to `/api` in production — it breaks all write operations. Fixed in Sprint 6
when SWA upgrades to Standard tier with a linked backend.

---

## Deployment

**Frontend** — push to `develop`, open a PR to `main`, merge. GitHub Actions deploys automatically to SWA (~1 min).

**API** — must be deployed manually whenever `api/` files change:

```powershell
cd api
func azure functionapp publish quizpulse-app-api-av5z18
```

---

## Running tests

```powershell
# Unit tests (no stack required)
npm test

# Integration tests (requires func start + Azurite + Cosmos emulator)
$env:RUN_INTEGRATION = "true"
npm test

# E2E tests (requires B2C credentials + running app)
$env:E2E_BASE_URL = "http://localhost:5173"
$env:E2E_GOOGLE_EMAIL = "your@email.com"
npx playwright test
```

---

## Sprint roadmap

| Sprint | Version | Focus |
|---|---|---|
| 1 | v1.0.0 | Foundation — B2C auth, school identity, real classes CRUD ✅ |
| 2 | v1.1.0 | Student join + approval, name-list validation |
| 3 | v1.2.0 | PWA shell, service worker, Web Push |
| 4 | v2.0.0 | Real student quiz flow, live analytics, offline resilience |
| 5 | v2.1.0 | Institution layer, super admin, monitoring portal |
| 6 | v3.0.0 | Community question bank, SWA Standard, Apple ID |
