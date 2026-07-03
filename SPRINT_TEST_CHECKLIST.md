# Sprint 1 Test Checklist — v1.0.0

## How to run

```powershell
# Unit tests (no external dependencies — run these first)
npm test                        # alias for npm run test:unit

# Integration tests (requires func start + Cosmos)
# Terminal 1: cd api && func start
# Terminal 2: azurite --silent
$env:RUN_INTEGRATION = "true"
npm run test:integration

# E2E tests (requires B2C configured + npm run dev + func start)
# Copy .env.test.example to .env.test and fill in credentials
npm run test:e2e
```

Reports:
- Unit + integration HTML: `tests/reports/sprint1-report.html`
- Playwright HTML: `tests/reports/playwright/index.html`

---

## Unit tests — `npm run test:unit`

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | auth.test.js | `extractBearer` — valid Bearer header | Returns token string | ✅ PASS |
| 2 | auth.test.js | `extractBearer` — no Authorization header | Returns null | ✅ PASS |
| 3 | auth.test.js | `extractBearer` — non-Bearer scheme | Returns null | ✅ PASS |
| 4 | auth.test.js | `extractBearer` — case-insensitive scheme | Returns token | ✅ PASS |
| 5 | auth.test.js | `teacherIdFromClaims` — oid present | Returns oid | ✅ PASS |
| 6 | auth.test.js | `teacherIdFromClaims` — falls back to sub | Returns sub | ✅ PASS |
| 7 | auth.test.js | `teacherIdFromClaims` — neither oid nor sub | Returns null | ✅ PASS |
| 8 | auth.test.js | `teacherIdFromClaims` — prefers oid over sub | Returns oid | ✅ PASS |
| 9 | auth.test.js | `verifyToken` DEV_MODE — valid token | Resolves with claims | ✅ PASS |
| 10 | auth.test.js | `verifyToken` DEV_MODE — expired token | Rejects with error | ✅ PASS |
| 11 | auth.test.js | `verifyToken` DEV_MODE — malformed token | Rejects | ✅ PASS |
| 12 | auth.test.js | `verifyToken` DEV_MODE — empty string | Rejects | ✅ PASS |
| 13 | auth.test.js | `authenticateTeacher` — no Authorization header | 401 | ✅ PASS |
| 14 | auth.test.js | `authenticateTeacher` — valid token with oid | Returns teacherId | ✅ PASS |
| 15 | auth.test.js | `authenticateTeacher` — no oid/sub in claims | 401 | ✅ PASS |
| 16 | auth.test.js | `authenticateTeacher` — expired token | 401 | ✅ PASS |
| 17 | auth.test.js | `authenticateTeacher` — garbage token | 401 | ✅ PASS |
| 18 | rateLimit.test.js | 30 requests within window — all allowed | true × 30 | ✅ PASS |
| 19 | rateLimit.test.js | 31st request in window — blocked | false | ✅ PASS |
| 20 | rateLimit.test.js | Requests resume after window expires | true | ✅ PASS |
| 21 | rateLimit.test.js | Different keys have independent counters | Isolated | ✅ PASS |
| 22 | rateLimit.test.js | Limit of 1 allows exactly one request | true then false | ✅ PASS |
| 23 | rateLimit.test.js | 30-req/min API limit (35 attempts) | 30 allowed | ✅ PASS |

**Result: 23 / 23 passed**

---

## Integration tests — `npm run test:integration`

> Requires: `func start` + Azurite + `RUN_INTEGRATION=true`

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | classes.test.js | GET /api/classes — no token | 401 | ⬜ Requires running stack |
| 2 | classes.test.js | GET /api/classes — valid token | 200 + array | ⬜ |
| 3 | classes.test.js | POST /api/classes — creates class | 201 + doc | ⬜ |
| 4 | classes.test.js | POST /api/classes — missing name | 400 | ⬜ |
| 5 | classes.test.js | POST /api/classes — name > 80 chars | 400 | ⬜ |
| 6 | classes.test.js | POST /api/classes — 21st class | 429 | ⬜ |
| 7 | classes.test.js | PUT /api/classes/{id} — updates name | 200 + updated | ⬜ |
| 8 | classes.test.js | PUT /api/classes/{id} — other teacher | 403 | ⬜ |
| 9 | classes.test.js | DELETE /api/classes/{id} — other teacher | 403 | ⬜ |
| 10 | classes.test.js | DELETE /api/classes/{id} — owner | 200 | ⬜ |
| 11 | classes.test.js | DELETE /api/classes/{id} — already deleted | 404 | ⬜ |
| 12 | teacher.test.js | GET /api/me — no token | 401 | ⬜ |
| 13 | teacher.test.js | GET /api/me — new teacher | { onboarded: false } | ⬜ |
| 14 | teacher.test.js | GET /api/me — after onboarding | { onboarded: true } | ⬜ |
| 15 | teacher.test.js | POST /api/onboarding — no token | 401 | ⬜ |
| 16 | teacher.test.js | POST /api/onboarding — creates teacher + school | 201 | ⬜ |
| 17 | teacher.test.js | POST /api/onboarding — duplicate call | 200 + alreadyOnboarded | ⬜ |
| 18 | teacher.test.js | POST /api/onboarding — missing schoolName | 400 | ⬜ |
| 19 | teacher.test.js | POST /api/onboarding — schoolName > 120 chars | 400 | ⬜ |

---

## E2E tests — `npm run test:e2e`

> Requires: B2C tenant configured (see docs/azure/B2C_SETUP.md) + credentials in `.env.test`

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | auth.spec.js | Teacher signs in via Google | Redirected to /onboarding or /teacher | ⬜ Requires B2C |
| 2 | auth.spec.js | Teacher signs in via Microsoft | Redirected to /onboarding or /teacher | ⬜ |
| 3 | classes.spec.js | Teacher creates a class | Class appears in list | ⬜ |
| 4 | classes.spec.js | Classes page renders | Heading visible | ⬜ |
| 5 | classes.spec.js | Teacher deletes a class | Class removed from list | ⬜ |

---

## Notes

- Integration and E2E tests are marked ⬜ because they require external services (Cosmos DB, B2C).
- Run integration tests locally with `func start` before merging to release branch.
- E2E tests run against deployed staging on PR merge to `develop`.
- Test report HTML: `tests/reports/sprint1-report.html` (generated by jest-html-reporter).

---

# v3.2.2 Polish Test Checklist

Report: `tests/reports/v3.2.2-report.html` · Full unit suite: **182/182 PASS**.

## Unit tests — `npm run test:unit`

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | usePwaInstall.test.js | `detectPlatform` — iOS Safari UA, not standalone | `"ios"` | ✅ PASS |
| 2 | usePwaInstall.test.js | `detectPlatform` — desktop Firefox UA | `"unsupported"` | ✅ PASS |
| 3 | usePwaInstall.test.js | `detectPlatform` — after `beforeinstallprompt` | `"native"` | ✅ PASS |
| 4 | usePwaInstall.test.js | `detectPlatform` — iOS UA but `window.MSStream` present | `"unsupported"` | ✅ PASS |
| 5 | usePwaInstall.test.js | `detectInstalled` — normal tab | `false` | ✅ PASS |
| 6 | usePwaInstall.test.js | `detectInstalled` — `display-mode: standalone` | `true` | ✅ PASS |
| 7 | usePwaInstall.test.js | `detectInstalled` — `navigator.standalone` | `true` | ✅ PASS |
| 8 | usePwaInstall.test.js | `appinstalled` transition | `isInstalled=true`, `canInstall=false` | ✅ PASS |
| 9 | demoNav.test.js | `showPublicNav` branch | `!isAuthenticated` | ✅ PASS |
| 10 | demoNav.test.js | Authenticated branch returns `<Sidebar />` | matches source | ✅ PASS |
| 11 | demoNav.test.js | Public nav has exactly one link → Preview gallery `/demo` | 1 link | ✅ PASS |
| 12 | demoNav.test.js | Public branch renders no teacher pages / sign-out | none present | ✅ PASS |

## Integration tests — `RUN_INTEGRATION=true npm run test:integration`

> Require `func start` + Cosmos/Azurite. Marked ⬜ (need external services).

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | v322-roster-approval.test.js | Owning teacher approves pending request | 200, status `approved` (regression — was 500) | ⬜ Requires func |
| 2 | v322-roster-approval.test.js | Cross-tenant: Teacher B approves Teacher A's request | 404 (never 200/403) | ⬜ Requires func |

## E2E tests — `npm run test:e2e`

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | v322.spec.js | Unauthenticated visitor lands on Home | Two cards + Preview gallery link visible | ⬜ Requires E2E_BASE_URL |
| 2 | v322.spec.js | Click "Join a class" | `/join` renders | ⬜ |
| 3 | v322.spec.js | Authenticated teacher visits `/` | Dashboard, not the two-card landing | ⬜ Requires creds |
| 4 | v322.spec.js | Add-to-phone button on Home (Chromium) | Visible when install prompt fires | ⬜ |
| 5 | v322.spec.js | Add-to-phone hidden (desktop Firefox) | Not present | ⬜ |
| 6 | v322.spec.js | iOS Safari UA | Add-to-home-screen guide shown | ⬜ |
| 7 | joinApprove.spec.js | Roster approval happy path (teacher creates class → student joins → approve → roster) | Student appears in roster | ⬜ |

---

# v3.3.0 Test Checklist — Simulated demo class

Reports:
- Unit + integration HTML: `tests/reports/v3.3.0-report.html`
- Playwright HTML: `tests/reports/playwright/index.html`

## Unit tests — `npm run test:unit`

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | demoData.test.js | `selectDemoStudents()` returns 24 unique, non-empty names + unique ids | 24 distinct entries each call | ✅ PASS |
| 2 | demoData.test.js | Name pool large enough, no duplicate entries | `DEMO_NAMES` ≥ 48, all unique | ✅ PASS |
| 3 | demoData.test.js | Correctness sampler (`pickAnswer`) | 60–70% correct over samples | ✅ PASS |
| 4 | demoData.test.js | Incorrect answers are valid wrong indices | always in `[0,optionCount)` | ✅ PASS |
| 5 | demoData.test.js | Confidence sampler (`pickConfidence`) | each bucket within ±3% of 40/40/20 | ✅ PASS |
| 6 | demoData.test.js | Response-time sampler bimodal | ≥25% <6000ms AND ≥65% 10000–35000ms | ✅ PASS |
| 7 | demoData.test.js | `generateSimulatedResponses` shape | 24 docs, isDemo+simulated, summed duration, completedAt +20–40s | ✅ PASS |
| 8 | demoData.test.js | `runSimulation` idempotency (injected fakes) | 1st writes 24; 2nd → 409, nothing written | ✅ PASS |
| 9 | demoData.test.js | `excludeDemo` fragment + `andExcludeDemo` + `isDemoClass` | predicate keeps non-demo/legacy, drops isDemo=true | ✅ PASS |
| 10 | demoSendNotification.test.js | Demo quiz → push skipped, 24 simulated responses written | `web-push.sendNotification` NOT called; 24 docs isDemo | ✅ PASS |
| 11 | demoSendNotification.test.js | Non-demo quiz still pushes (control) | `sendNotification` called once; no simulation | ✅ PASS |

## Integration tests — `RUN_INTEGRATION=true npm run test:integration`

> Require `func start` + Cosmos/Azurite. Marked ⬜ (need external services).

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | v3-3.test.js | POST /api/classes { isDemo:true } | 201, 24 demoStudents, no joinCode | ⬜ Requires func |
| 2 | v3-3.test.js | Second demo class for same teacher | 409 "Demo class limit reached" | ⬜ Requires func |
| 3 | v3-3.test.js | 20 real + 1 demo succeed; 21st real | 429 (real cap still enforced) | ⬜ Requires func |
| 4 | v3-3.test.js | POST /api/simulate-responses on real class | 400 "Not a demo class" | ⬜ Requires func |
| 5 | v3-3.test.js | Cross-tenant: B simulates A's demo quiz | 404 (Sprint 5 convention) | ⬜ Requires func |
| 6 | v3-3.test.js | send-notification on demo quiz | sent=0, simulated=24; analytics isDemo + 24 responses | ⬜ Requires func |
| 7 | v3-3.test.js | GET /api/manage/metrics totals | exclude isDemo=true responses | ⬜ Requires func |
| 8 | v3-3.test.js | GET /api/manage/logs/export?type=security | excludes audit entries targeting demo classes | ⬜ Requires func |

## E2E tests — `npm run test:e2e`

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | v3-3-demo-class.spec.ts | No demo class → button visible → create → Demo pill, no join code | demo card with pill, "practice students", no Code: | ⬜ Requires creds |
| 2 | v3-3-demo-class.spec.ts | Teacher with 1 demo class | "Try with a demo class" button hidden | ⬜ Requires creds |
| 3 | v3-3-demo-class.spec.ts | Send quiz to demo class → analytics | Demo data pill + confident-but-incorrect callout | ⬜ Requires creds |
| 4 | v3-3-demo-class.spec.ts | Demo class unreachable from /join | demo class carries no joinCode | ⬜ Requires creds |
