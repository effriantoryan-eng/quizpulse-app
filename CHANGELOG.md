# Changelog

All notable changes to QuizPulse are documented in this file.

## [Unreleased] — Sprint 5 security foundation

Security audit and authorization hardening that precedes the Sprint 5 admin endpoints
(institution onboarding, school merge, monitoring portal). No RC tag yet — this branch merges
into `release/v2.1-sprint5` and the admin features are built on top of it before tagging.

### Breaking changes

- **Ownership-mismatch responses changed from `403` to `404`** across `classes.js`, `questions.js`,
  `quizzes.js`, `joinRequests.js`, `analytics.js`, and `sendNotification.js`. A 403 confirmed a
  resource exists but isn't the caller's; 404 reveals nothing. Any client code asserting on `403`
  for a cross-tenant access attempt must be updated to expect `404`.

### Security fixes

- **Critical:** `GET /api/responses?quizId=` had no authentication or ownership check at all,
  leaking every student's raw quiz answers to anyone who had a `quizId`. Now requires teacher
  auth and quiz ownership (404 on mismatch), matching `GET /api/analytics`.
- **High:** `GET /api/usageLog` returned an unfiltered, platform-wide dump of every teacher's
  data gated only by a Function key. Now also requires a privileged role claim
  (`owner`/`support`); a non-privileged caller gets 404.
- `GET /api/quizzes/{id}/questions` had no rate limiting; added the standard 30 req/min/IP limit.
- `join-requests/{id}/reject` now re-verifies the loaded request belongs to the calling teacher
  (defense-in-depth, matching the `approve` path) rather than only checking class ownership.
- `subscribe.js` no longer logs `deviceId`/`classId` on a successful subscription (no operational
  need to log a per-student identifier).

### New features

- `api/shared/authz.js` — the central authorization helper (`getCallerScope`, `assertScope`).
  Every resource-scoped endpoint now goes through it instead of a hand-rolled ownership check.
  See the "Authorization model" section in `CLAUDE.md`.
- `PUT /api/manage/teachers/{id}/role` — the only way a teacher's `role` field may change,
  gated on an `owner` role claim. No caller can reach `owner` yet (claim not configured — see
  `docs/azure/ROLE_CLAIMS_SETUP.md`), so this is unreachable until that configuration lands,
  by design.
- `teacher.js`'s onboarding handler now explicitly rejects a `role` field in the request body
  (400) instead of silently ignoring it.
- New test category: cross-tenant access denial (`tests/integration/api/sprint5.test.js`,
  20 tests) — retrofitted across every Sprint 1–4 resource type, asserting Teacher A cannot
  reach Teacher B's class/question/quiz/analytics/join-request/responses by ID.
- `tests/unit/api/authz.test.js` — unit coverage for `assertScope`/`getCallerScope` in isolation,
  including the school_admin `schoolId` scoping branch (no endpoint uses it yet).

### Docs

- `docs/security/SPRINT5_AUDIT.md` — full audit: endpoint inventory, IDOR findings, role
  escalation check, JWT validation review, CORS check, logging/secrets/mass-assignment review.
- `docs/azure/ROLE_CLAIMS_SETUP.md` — manual Entra External ID portal steps to emit `role` (and
  later `schoolId`) as a signed token claim.

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
