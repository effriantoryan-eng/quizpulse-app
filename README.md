# QuizPulse

Low-stakes classroom quiz app for school teachers. Teachers create questions, build quizzes, send them to a preset class, and view analytics. Student responses are simulated automatically — no real student flow exists in the current demo.

**Live demo:** https://mango-meadow-0a5aa7410.7.azurestaticapps.net

No login required — any visitor gets a stable `localStorage` UUID as their teacher identity. Data persists in the same browser across visits and is fully isolated from other visitors.

---

## Demo flow

1. **Home** (`/`) — overview of the demo and links to get started
2. **Create questions** (`/teacher/create`) — build a question bank with multiple-choice questions
3. **Question bank** (`/teacher/bank`) — browse, filter, edit, and delete saved questions
4. **Build quiz** (`/teacher/build`) — select questions, name the quiz, arrange order
5. **Send quiz** (`/teacher/send`) — choose one or more preset classes; responses are simulated instantly server-side, then redirected to Analytics
6. **Analytics** (`/teacher/analytics/:quizId`) — per-question response breakdown with bar charts
7. **Quiz history** (`/teacher/quizzes`) — all sent quizzes, click any to view analytics
8. **Preview gallery** (`/demo`) — four interactive inline mockups: student quiz experience, analytics, scheduling, and push notifications

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (SPA, React Router v6) |
| Hosting | Azure Static Web Apps (free tier, GitHub CI/CD) |
| Backend | Azure Functions — Node.js v4 runtime, HTTP-triggered, serverless |
| Database | Azure Cosmos DB (NoSQL, serverless mode) |
| Auth | None — `teacherId` is a `localStorage` UUID per browser |
| Secret management | Azure Key Vault (Cosmos DB key via managed identity) |
| Logging | Azure Application Insights (active) |

---

## Running locally

Three terminals required:

```powershell
# Terminal 1 — React dev server
npm run dev        # → localhost:5173

# Terminal 2 — Azure Functions
cd api
func start         # → localhost:7071

# Terminal 3 — Azurite storage emulator
azurite --silent
```

> **Note:** Do not use `&&` in PowerShell — run commands on separate lines.

---

## Project structure

```
src/
  pages/
    Home.jsx              — landing page
    DemoGallery.jsx       — 4 interactive inline mockup cards (no external images)
    AdminLog.jsx          — private admin usage log (hidden route, Function key secured)
    teacher/
      CreateQuestion.jsx  — create and save questions
      QuestionBank.jsx    — browse, filter, edit, delete questions
      BuildQuiz.jsx       — assemble a quiz from saved questions
      SendQuiz.jsx        — send quiz to a preset class, trigger simulation
      Analytics.jsx       — per-question response breakdown
      QuizHistory.jsx     — list all sent quizzes, link through to analytics
  components/
    DemoNav.jsx           — persistent top nav bar
  contexts/
    AuthContext.jsx       — provides { teacherId } via localStorage UUID
  session.js              — localStorage UUID helper
  api.js                  — centralised API base URL
  App.jsx                 — router and global providers
api/
  questions.js            — GET/POST/PUT/DELETE /api/questions
  quizzes.js              — GET/POST /api/quizzes, GET /api/quizzes/:id
  responses.js            — GET/POST /api/responses
  simulate.js             — POST /api/simulate (bulk response generation)
  adminLog.js             — GET /api/usageLog (private, authLevel: function)
  classes.js              — GET /api/classes (deployed but unused by frontend)
  rateLimit.js            — in-memory sliding window rate limiter
  logger.js               — structured logging to Application Insights
```

---

## Preset classes

| Class | Students |
|---|---|
| Year 9 Science | 28 |
| Year 10 Maths | 25 |
| Year 7 English | 22 |

When a quiz is sent, `POST /api/simulate` generates one response document per student server-side in a single call, avoiding the per-IP rate limit on the `/responses` endpoint.

---

## API routing note

In production the frontend calls the Function App URL directly — **not** through the SWA `/api/*` proxy. The SWA free tier proxy returns 405 for POST/PUT/DELETE. `src/api.js` handles the switch:

```js
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:7071/api'
  : 'https://quizpulse-api-b5bvbvgzdph6dyas.australiaeast-01.azurewebsites.net/api'
```

Do not revert this to `/api` in production — it will break all write operations.

---

## Deployment

**Frontend** — push to `develop`, open a PR to `master`, merge. GitHub Actions deploys automatically (~1 min).

**API** — must be deployed manually whenever `api/` files change:

```powershell
cd api
func azure functionapp publish quizpulse-api
```

**SWA staging environment quota** — the free tier allows a maximum of 3 preview environments. If CI fails with *"maximum number of staging environments"*, go to Azure portal → quizpulse-rg → quizpulse → Environments and delete stale slots from old merged PRs.

---

## Feature status

| Feature | Status |
|---|---|
| Home page | ✅ |
| Create / edit / delete questions | ✅ |
| Question bank with topic filter | ✅ |
| Build quiz | ✅ |
| Send quiz with simulated responses | ✅ |
| Analytics | ✅ |
| Quiz history | ✅ |
| Preset classes | ✅ |
| No-auth open access (localStorage UUID) | ✅ |
| App Insights logging | ✅ |
| Preview gallery (4 interactive mockups) | ✅ |
| Push notifications | Post-MVP |
| Quiz scheduling | Post-MVP |
| Student accounts | Post-MVP |
| Admin & rostering | Post-MVP |
| LMS integration | Post-MVP |
