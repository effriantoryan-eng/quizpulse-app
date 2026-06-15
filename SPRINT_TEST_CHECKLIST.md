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
