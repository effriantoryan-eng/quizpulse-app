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

## v4.2.0 — Guided Onboarding & Progressive Disclosure

Full report: `tests/reports/v4.2.0-report.html`. Unit suite run: `npm run test:unit`.

### Unit tests

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | profileSchema.test.js | `validateProfile` accepts/rejects each field (subjects enum+cap, yearLevels 7-12+cap, classCount 1-20, registrationStatus enum) | 400-worthy inputs rejected, valid partials pass through | ✅ PASS |
| 2 | profileSchema.test.js | `isProfileComplete` — a skipped step (field absent) never counts as answered | false until all 4 fields present | ✅ PASS |
| 3 | createClass.test.js | `generateJoinCode` shape | 8 chars, unambiguous alphanumeric | ✅ PASS |
| 4 | createClass.test.js | `createRealClass` creates a doc with joinCode + schoolId; throws `ClassLimitError` at the 20-class cap; rejects an empty name without writing | 201-shape doc / 429-typed error / no write on invalid name | ✅ PASS |
| 5 | introEligibility.test.js | `demo_intro` eligible for a brand-new teacher; NOT suppressed by empty class shells; suppressed once a class has an approved student | matches CEO review addendum §2/§5.7 | ✅ PASS |
| 6 | introEligibility.test.js | Every key dismissed short-circuits to `[]` without any milestone query | 0 Cosmos queries issued | ✅ PASS |
| 7 | introEligibility.test.js | `apst_intro`/`mypd_intro`/`ai_generation_intro` never eligible while their feature flags are off | absent from result while dark | ✅ PASS |
| 8 | introEligibility.test.js | `analytics_intro`/`population_intro`/`community_intro` queries exclude demo data; `misconception_intro`'s query does NOT (the one deliberate exception) | query string inspected for the `isDemo` fragment | ✅ PASS |
| 9 | introEligibility.test.js | Result order matches `CANDIDATE_KEYS` priority regardless of check order | sorted indices | ✅ PASS |
| 10 | responses.test.js | **CRITICAL regression:** `confidenceResponseCount` patch mocked to throw → submission still 201 | non-fatal counter | ✅ PASS |
| 11 | responses.test.js | Successful submission increments the counter by exactly 1 | `patch` called once with `incr`/`value:1` | ✅ PASS |
| 12 | topicPrefilter.test.js | `matchTopics` — matches subject×yearLevel combinations; zero-match fallback (e.g. Year 8 Maths) returns `[]`, not an empty "matched" render | exact tag list / empty array | ✅ PASS |

### Integration tests — `RUN_INTEGRATION=true npm run test:integration`

Added to `tests/integration/api/teacher.test.js` (⬜ requires `func start` + the isolated
`quizpulse-int-test-db` — see the Testing section of CLAUDE.md, never the production Cosmos DB).

| # | What is tested | Expected | Status |
|---|---|---|---|
| 1 | `PUT /api/me/profile` accumulates partial answers across multiple calls without losing earlier ones; `profileComplete` flips true only once all 4 fields are answered | merged profile, correct `profileComplete` | ⬜ Requires func |
| 2 | `PUT /api/me/profile` for a not-yet-onboarded teacher | 404 | ⬜ Requires func |
| 3 | `PUT /api/me/profile` rejects an invalid subject | 400 | ⬜ Requires func |
| 4 | Quitting the wizard after step 1 (no `PUT /me/profile` call) never re-gates onboarding | `GET /api/me` still `onboarded:true`, `profileComplete:false` | ⬜ Requires func |
| 5 | `GET /api/me` is safe for a legacy-shaped teacher doc (no profile/featureIntros) | `profile:{}`, `featureIntros:{}`, `eligibleIntros` includes `demo_intro` | ⬜ Requires func |
| 6 | `PUT /api/me/feature-intros` rejects an unknown key | 400 | ⬜ Requires func |
| 7 | Dismissing `demo_intro` removes it from `eligibleIntros` and records `dismissedAt` | | ⬜ Requires func |
| 8 | Dismissing two different keys back-to-back doesn't clobber either (two-tab race) | both `dismissedAt` present | ⬜ Requires func |
| 9 | `POST /api/classes/shells` creates N "My Class" shells when the teacher has zero real classes | `{ created: N }` | ⬜ Requires func |
| 10 | `POST /api/classes/shells` returns 409 once the teacher has any real class | 409 | ⬜ Requires func |
| 11 | `demo_intro` still eligible immediately after creating shells | present in `eligibleIntros` | ⬜ Requires func |
| 12 | `POST /api/classes/shells` rejects `count` outside 1-20 | 400 | ⬜ Requires func |
| 13 | `POST /api/onboarding` still rejects a `role` key in the body (regression) | 400 | ⬜ Requires func |

### Deferred to a live-Cosmos session (not exercised in this build)

- Counter concurrency under real parallel writes (`confidenceResponseCount` exact-N under N
  simultaneous submissions) — the atomic `incr` patch operation is Cosmos-server-guaranteed
  race-free by construction; unit tests confirm the call shape and the non-fatal-on-failure
  contract, but a true concurrent-load assertion needs a live Cosmos instance.
- E2E walk of the onboarding wizard + ProfileNudge + intro-card flow (Playwright, real auth).
| 4 | v3-3-demo-class.spec.ts | Demo class unreachable from /join | demo class carries no joinCode | ⬜ Requires creds |

## v4.4.0 — Traffic Monitor

Full report: `tests/reports/v4.4.0-report.html`. Unit suite run: `npm run test:unit` (345/345 pass,
35 suites — includes all prior sprints' tests, unaffected by this sprint's changes).

### Unit tests

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | pageView.test.js | `buildPageViewDoc` — validation (missing/oversized page, unrecognised eventType, default eventType) | 400s where expected, `eventType:'view'` default | ✅ PASS |
| 2 | pageView.test.js | Page-allowlist bucketing — unknown page stored as `'other'`, never rejected | 201-shape doc with `page:'other'` | ✅ PASS |
| 3 | pageView.test.js | **Student privacy posture** — a `/quiz` doc strips userAgent/screen/language/timezone/referrer even if the client sent them | all five fields `null` | ✅ PASS |
| 4 | pageView.test.js | `/quiz` keeps teacherId/sessionId/quizId; quizId length-capped; quizId never carried on non-`/quiz` pages | exact field presence/absence | ✅ PASS |
| 5 | pageViewAllowlist.test.js | `classifyPage` — known routes pass through, unknown bucket to `'other'`, no false-positive prefix matches (`/joinclass` ≠ `/join`) | exact classification per case | ✅ PASS |
| 6 | pageViewAllowlist.test.js | **Allowlist-coupling test** — every route declared in `src/App.jsx`'s `<Routes>` (walked from the real source, not a hand-copied list) is covered by the allowlist | 24/24 routes classify to something other than `'other'` | ✅ PASS |
| 7 | trafficAggregate.test.js | `getRangeStart` — `today`/`7d`/`30d` math (fixed clock), invalid range throws | exact ISO timestamps | ✅ PASS |
| 8 | trafficAggregate.test.js | `classifyAudience`/`classifyDevice`/`classifyBrowser` — prefix rules, 767/768 device boundary, Edge-before-Chrome-before-Safari UA precedence | exact bucket per case | ✅ PASS |
| 9 | trafficAggregate.test.js | **CRITICAL regression:** a pageview doc with NO `eventType` field counts as a view in every aggregate | legacy doc counted, not silently dropped | ✅ PASS |
| 10 | trafficAggregate.test.js | `pwa_install` events counted in `pwaInstalls`, excluded from view totals; daily bucketing across a UTC day boundary; topPages sorted + capped to 10; `pagesPerSession` never NaN on empty input | exact counts, no NaN | ✅ PASS |
| 11 | trafficAggregate.test.js | `computeFunnelRates` — zero-division produces `null`, not NaN; normal case rounds to 2dp | `openRate`/`completionRate` null or exact | ✅ PASS |
| 12 | rangeQuizStats.test.js | `computeRangeQuizStats` — sums push counts only across quizzes that have them (legacy quizzes excluded from the sum, not coerced to 0); skips the responses query when no quizzes are in range | exact sums, 0 extra query | ✅ PASS |
| 13 | resolveApprovedDeviceIds.test.js | Demo class reads `demoStudents` and never queries `join_requests`; real class queries `join_requests`; mixed demo+real unions correctly; a device approved in two classes counts once | exact `Set` contents | ✅ PASS |
| 14 | sendNotification.test.js | **Advisory-counter regression (mandatory):** the pushSuccessCount/pushFailCount persistence write mocked to throw → send still returns 200 (pushes already went out) | 200, `sent` correct | ✅ PASS |
| 15 | sendNotification.test.js | pushSuccessCount/pushFailCount computed from actual send outcomes; a successful persistence write still returns 200 | exact counts persisted | ✅ PASS |
| 16 | usePageView.test.js | Payload reads the visitor id under the `quizpulse_device_id` key (regression: was previously called with no key) | `getSessionId` called with the real key, never `undefined` | ✅ PASS |
| 17 | usePageView.test.js | `/quiz` payload carries only page/eventType/teacherId/sessionId/quizId; quizId parsed from `?quizId=`; non-`/quiz` pages keep full telemetry | exact key set per route | ✅ PASS |
| 18 | usePageView.test.js | `usePwaInstallTracking`'s `appinstalled` handler fires a beacon with `eventType:'pwa_install'` | beacon payload shape | ✅ PASS |
| 19 | metrics.test.js | `buildStubbedMetrics` — per-group `stubbed` flags (systemHealth/security/spending `true`; usageGrowth/engagement `false`); no top-level `stubbed` field | exact flags | ✅ PASS |

### Integration tests — `RUN_INTEGRATION=true npm run test:integration`

Added in `tests/integration/api/v440-traffic.test.js` (⬜ requires `func start` + the isolated
`quizpulse-int-test-db` — see the Testing section of CLAUDE.md, never the production Cosmos DB).
Not run in this build session (no live Function host / test Cosmos available) — written and
syntax-verified, all 14 cases correctly gate-skip via `RUN_INTEGRATION`.

| # | What is tested | Expected | Status |
|---|---|---|---|
| 1 | `POST /api/pageView` — valid payload | 201 `{ok:true}` | ⬜ Requires func |
| 2 | `POST /api/pageView` — missing page / unrecognised eventType | 400 | ⬜ Requires func |
| 3 | `POST /api/pageView` — unrecognised page still accepted (bucketed server-side) | 201 | ⬜ Requires func |
| 4 | `GET /api/manage/traffic` — teacher-app token (wrong audience) | 401 | ⬜ Requires func |
| 5 | **REQUIRED cross-tenant negative test:** admin token with no/teacher role | 404 (never the resource, never 403) | ⬜ Requires func |
| 6 | `GET /api/manage/traffic` — owner role | 200, full response shape incl. `funnel` | ⬜ Requires func |
| 7 | `GET /api/manage/traffic` — support role (proves the READ side of the role matrix) | 200 | ⬜ Requires func |
| 8 | `GET /api/manage/traffic` — invalid range / missing range | 400 / defaults to `today` | ⬜ Requires func |
| 9 | `GET /api/manage/traffic` — 61st call within the hour | 429 | ⬜ Requires func |
| 10 | `GET /api/manage/metrics` — usageGrowth/engagement `stubbed:false`; systemHealth/security/spending `stubbed:true`; no top-level `stubbed` | exact flags | ⬜ Requires func |
| 11 | `GET /api/manage/metrics` — de-stubbed fields are finite numbers or null, never NaN | `Number.isFinite` or `null` | ⬜ Requires func |
| 12 | A demo-quiz send does not corrupt usageGrowth/engagement aggregation | finite `quizzesPerDay` after a demo send | ⬜ Requires func |

### Deferred to a live-Cosmos session (not exercised in this build)

- All 12 integration cases above (no `func start` + test Cosmos available in this session).
- E2E walk of the admin Traffic page (Playwright, real admin CIAM credentials) — the admin
  portal has no dev-auth bypass (unlike the teacher app), so this session verified Traffic.jsx
  via a clean admin build only, not a live render.
- Manual portal verification of the `pageviews` container TTL + RU cap
  (`docs/azure/V440_CONTAINERS_SETUP.md`) — Azure Portal steps, not testable from CI.

## v4.1.0 — APST Evidence Export

Full report: `tests/reports/v4.1.0-report.html`. Unit + integration suite run together:
`RUN_INTEGRATION=true npx jest --config jest.config.cjs tests/unit/api/evidenceHelpers.test.js
tests/unit/api/pdfEvidence.test.js tests/integration/api/v4-evidence.test.js` (func started
against `quizpulse-int-test-db`, per CLAUDE.md's Testing section — never the production Cosmos).

### Unit tests

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | evidenceHelpers.test.js | `calculateHours` — PD-hours auto-calculation | 3 quizzes → 1.8hrs; 0 quizzes → 0hrs; 1 quiz → 0.6hrs | ✅ PASS |
| 2 | evidenceHelpers.test.js | `containsUnpersonalisedMarker` — unfilled reflection blocked | payload containing `[PERSONALISE:` flagged; personalised text passes | ✅ PASS |
| 3 | evidenceHelpers.test.js | `validateDateRange` — annual-log date-range validation | end-before-start → invalid; >365 days → invalid; valid range passes | ✅ PASS |
| 4 | evidenceHelpers.test.js (via `apstContent.domainCoverage`) | APST domain-balance check | `['3.3','5.1','6.2']` → all three domains present; `['3.3','3.6']` → Professional Engagement missing | ✅ PASS |
| 5 | pdfEvidence.test.js | `buildActivityPdf`/`buildAnnualLogPdf` resolve with a non-empty buffer within the test timeout | **regression test** — a footer-text call near the bottom margin previously triggered pdfkit auto-pagination mid-loop over `bufferedPageRange().count`, hanging generation forever; fixed with `lineBreak: false` + a cached page count | ✅ PASS |

### Integration tests — `RUN_INTEGRATION=true npm run test:integration`

`tests/integration/api/v4-evidence.test.js` (⬜ requires `func start` + the isolated
`quizpulse-int-test-db`, never the production Cosmos DB).

| # | What is tested | Expected | Status |
|---|---|---|---|
| 1 | `POST /api/evidence/export` unauthenticated | 401 | ✅ PASS |
| 2 | **REQUIRED cross-tenant negative test:** Teacher B requests Teacher A's quizId | 404 (never 200/403) | ✅ PASS |
| 3 | `POST /api/evidence/export` with `[PERSONALISE:` still present in a reflection field | 400 | ✅ PASS |
| 4 | Valid `POST /api/evidence/export` | 200, `Content-Type: application/pdf`, non-zero byte length | ✅ PASS |
| 5 | Exported PDF contains no student-identifying substrings (`quizpulse_device_id`) | not found in the PDF bytes | ✅ PASS |
| 6 | `GET /api/evidence/annual-log` unauthenticated | 401 | ✅ PASS |
| 7 | `GET /api/evidence/annual-log` with an end-before-start range | 400 | ✅ PASS |
| 8 | `GET /api/evidence/annual-log` with a valid range, scoped to the caller's own quizzes | 200, `Content-Type: application/pdf`, non-zero byte length | ✅ PASS |

### Manual verification (this session, dev-auth bypass — see `memory/project_local_qa_setup.md`)

- `/teacher/evidence` reachable from the sidebar (new "Evidence" hub, `teacherNav.js`); quiz
  cards render topic/date/class from `GET /api/quizzes` + `GET /api/classes`.
- Export flow: Screen 1 pre-populated (all 18 APST descriptors listed, 5 pre-ticked, VTLM
  alignment read-only) → Screen 2 shows both reflection templates with `[PERSONALISE: ...]`
  gaps visible and the Export button disabled with an inline warning while either marker
  remains → clearing both markers and exporting downloads a PDF (`POST /api/evidence/export`
  200).
- "Generate annual log" date-range picker → `GET /api/evidence/annual-log` 200, PDF downloads.
- `FEATURE_APST_EXPORT` flipped true; a teacher meeting the `apst_intro` milestone sees the
  card via `PromoSlot` on `TeacherHome`, and "Show me" navigates to the real `/teacher/evidence`
  page (not a 404).

### Deferred to a live-Cosmos / real-auth session (not exercised in this build)

- E2E walk (Playwright, real auth) — same "Requires creds" precedent as prior sprints.
- `apstContent.js` verbatim-accuracy review against the AITSL/DET source docx — separate from
  code review, required before `v4.1.0-rc1` is tagged (see CLAUDE.md).

## v4.3.0 — AI Quiz Generation (provider placeholder)

Full report: `tests/reports/v4.3.0-report.html`. Unit + integration suite run together:
`RUN_INTEGRATION=true npx jest --config jest.config.cjs tests/unit
tests/integration/api/v4.3-source-upload.test.js tests/integration/api/v4.3-drafts.test.js`
(func started against `quizpulse-int-test-db`, per CLAUDE.md's Testing section — never the
production Cosmos). 457/457 pass (425 unit, 32 integration).

### Unit tests (new files)

| # | File | What is tested | Expected | Status |
|---|---|---|---|---|
| 1 | sourceChunker.test.js | `chunkPages`/`chunkText` — one chunk per short page, an overlong page splits without spanning pages, global char cap truncates, docx/txt paragraph grouping and hard-slicing of a huge paragraph | exact chunk boundaries, `truncated:true` when capped | ✅ PASS |
| 2 | dailyQuota.test.js | `countCreatedToday`, `checkAndIncrRegenQuota` — allows/rejects at the max, tolerates a teacher doc with no counter field yet | exact counts, correct patch calls | ✅ PASS |
| 3 | sniffFileKind.test.js | PDF/docx magic-byte detection, UTF-8 txt fallback, invalid-UTF-8 binary rejected | exact `kind` or `null` | ✅ PASS |
| 4 | seededRandom.test.js | Same seed → same sequence; different seeds diverge; `seededShuffle` doesn't mutate input | deterministic output | ✅ PASS |
| 5 | draftSchema.test.js | Question count bounds (3-15), option count/length, `correctIndex` range, sourceRef hallucination guard (chunk index ≥ chunkCount rejected), topicTag enum | exact valid/invalid per case | ✅ PASS |
| 6 | llmProviderMock.test.js | Determinism (same sourceId → same draft); **hard constraint:** no generated string is an 8+ word verbatim run from real source text; every question is a complete sentence ending in "?"; distractors are unique; `InsufficientContentError` on <4 distinct terms | exact/boolean per case | ✅ PASS |
| 7 | llmAdapter.test.js | `selectChunks` — range-first, even sampling under the 60k cap, spread not just a prefix; provider resolution defaults to mock; a real provider missing its env vars throws `MissingProviderKeyError`; structured success/error log lines | exact shape per case | ✅ PASS |
| 8 | analyticsFollowUpTrigger.test.js | E1 trigger — incorrect ≥40% OR confident-incorrect ≥25%, both boundaries, zero-answer and null-fourCell no-ops | boolean per case | ✅ PASS |

### Integration tests — `RUN_INTEGRATION=true npm run test:integration`

`tests/integration/api/v4.3-source-upload.test.js` (9 cases) — real hand-built PDF/docx/txt
fixtures through a live func host: unauthenticated 401, missing-attestation 400, valid uploads
for all three formats return correct chunk/page metadata, scanned/too-short doc 400, >15MB 413,
unrecognised binary 400, 11th upload in a day 429.

`tests/integration/api/v4.3-drafts.test.js` (23 cases) — the full loop against a live func host:

| # | What is tested | Expected | Status |
|---|---|---|---|
| 1-7 | `POST /api/generation/drafts` — 401, missing sourceId, questionCount bounds, out-of-bounds range, a valid draft with unreviewed questions, unknown sourceId treated as expired, 11th generation/day → 429 | exact statuses | ✅ PASS |
| 8-10 | `GET`/`PUT /api/generation/drafts/{id}` — **cross-tenant negative test** (Teacher B → 404), invalid question shape → 400, valid edit marks reviewed | 404 / 400 / 200 | ✅ PASS |
| 11-12 | Regenerate-question resets the tick; out-of-range index → 400 | exact behaviour | ✅ PASS |
| 13-15 | Approve rejects while unreviewed; approving materialises N questions + 1 quiz then a second approve 400s; materialised questions locked to private (direct PUT to public → 400) | exact statuses | ✅ PASS |
| 16-20 | `POST /api/quizzes/{id}/send` — **cross-tenant negative test**, >5 spacedRepeats → 400, sending now with 2 repeats creates exactly 2 clones carrying `parentQuizId`, re-sending an already-sent quiz → 400, **retry-idempotency test: a resent request creates zero duplicate clones** | exact statuses, exact clone counts | ✅ PASS |
| 21-23 | `POST /api/generation/expand` — a quiz with no linked source → 400, **cross-tenant negative test**, a valid expand returns a new draft | exact statuses | ✅ PASS |

### Manual verification (this session, dev-auth bypass — see `memory/project_local_qa_setup.md`)

- Full browser walk against a live local func host: Build page CTA → GenerateQuiz (real PDF
  upload) → mock-generated 4-question draft → ReviewDraft (ticked all 4) → Approve → bridge
  navigated straight into SendQuiz with the schedule chips carried over (verified via
  `window.history.state`) → sent to the demo class with 2 spaced repeats → "Quiz sent! 3 practice
  repeats scheduled." Confirmed via func logs: the mock adapter's observability line fired, and
  `classSize` on the sent quiz was correctly computed from the real class's `studentCount` (24,
  not 0 — this was a real bug found and fixed during the session).
- E1 expansion nudge: sent a second AI-generated quiz to the demo class, confirmed the
  misconception hero card and 3 of 4 per-question cards crossed the real trigger thresholds from
  actual simulated response data, clicked "Create follow-up practice", landed on a fresh
  5-question draft. Zero browser console errors across the whole session.
- 15MB multipart upload spike: verified locally that `request.formData()` receives a real 15MB
  file intact with no truncation (Functions v4's documented large-field-truncation issue,
  `azure-functions-nodejs-library` #206, was not observed locally). **Not verified against the
  deployed SWA linked-backend proxy** — that requires a live deployment; see
  `docs/azure/V430_CONTAINERS_SETUP.md` for the required pre-production check.

### Deferred / scope cuts (not exercised in this build)

- Results-list-level "Create follow-up practice" nudge (lazy evaluation across a teacher's 10
  most recent closed lineage-bearing quizzes) — scope cut, see CLAUDE.md's AI quiz generation
  section. The same action ships via the Analytics drill-down and misconception hero card.
- Real-provider (`azureOpenai`/`anthropic`) end-to-end generation — no API key configured in this
  session; both providers are structurally complete and unit-tested for the missing-key → 503
  path only. `docs/azure/LLM_PROVIDER_SETUP.md`'s founder-authored smoke run is required before
  any pilot activation.
- E2E walk (Playwright, real auth) — same "Requires creds" precedent as prior sprints.
- SWA linked-backend proxy verification for the 15MB upload endpoint (see above).
