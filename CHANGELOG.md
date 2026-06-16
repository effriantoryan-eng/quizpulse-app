# Changelog

All notable changes to QuizPulse are documented in this file.

## [v2.1.0] — Sprint 5: security foundation + admin/institution/monitoring endpoints

Security audit and authorization hardening, followed by the institution/admin/monitoring
endpoints it was the prerequisite for. Backend only — the admin frontend is Sprint 7.

### Breaking changes

- **Ownership-mismatch responses changed from `403` to `404`** across `classes.js`, `questions.js`,
  `quizzes.js`, `joinRequests.js`, `analytics.js`, and `sendNotification.js`. A 403 confirmed a
  resource exists but isn't the caller's; 404 reveals nothing. Any client code asserting on `403`
  for a cross-tenant access attempt must be updated to expect `404`.
- **`GET /api/responses?quizId=` removed entirely.** It was unauthenticated dead code (unused by
  the frontend) that leaked raw student answers — see Security fixes below. `/api/responses` is
  now `POST`-only (student submission). Teacher-facing response data is `GET /api/analytics`.

### Security fixes

- **Critical:** `GET /api/responses?quizId=` had no authentication or ownership check at all,
  leaking every student's raw quiz answers to anyone who had a `quizId`. Deleted outright rather
  than secured-and-kept, since it was dead code.
- **High:** `GET /api/usageLog` returned an unfiltered, platform-wide dump of every teacher's
  data gated only by a Function key. Now also requires a privileged role claim
  (`owner`/`support`); a non-privileged caller gets 404.
- `GET /api/quizzes/{id}/questions` had no rate limiting; added the standard 30 req/min/IP limit.
- `join-requests/{id}/reject` now re-verifies the loaded request belongs to the calling teacher
  (defense-in-depth, matching the `approve` path) rather than only checking class ownership.
- `subscribe.js` no longer logs `deviceId`/`classId` on a successful subscription (no operational
  need to log a per-student identifier).

### New features

- `api/shared/authz.js` — the central authorization helper (`getCallerScope`, `assertScope`,
  `requireRole`). Role tiers: `support` is read-all/mutate-none (`assertScope`'s bypass only
  applies to mutations for `owner`/`platform_admin`), `platform_admin` may perform operational
  mutations, `owner` does everything including destructive actions. See "Authorization model" in
  `CLAUDE.md`.
- `PUT /api/manage/teachers/{id}/role` — the only way a teacher's `role` field may change,
  gated on an `owner` role claim. No caller can reach `owner` yet (claim not configured — see
  `docs/azure/ROLE_CLAIMS_SETUP.md`), so this is unreachable until that configuration lands,
  by design.
- `api/shared/auditLog.js` — append-only `audit_log` container (`writeAudit()`), no update/delete
  code path. Written by every admin mutation below.
- `api/shared/stepUp.js` — step-up re-auth guard (`assertStepUp`) verifying a signed
  `auth_time`/`iat` claim is within the 10-minute window; gates the destructive school-merge
  endpoint ahead of the Sprint 7 UI that will trigger re-auth.
- `POST /api/manage/schools/{id}/validate` (owner/platform_admin) and `POST
  /api/manage/schools/merge` (owner only, step-up gated) — re-points `teachers`/`classes` by
  `schoolId` sequentially, tombstones the source via `mergedIntoId`.
- `POST /api/manage/institutions`, `POST /api/manage/institutions/{id}/invite`, `POST
  /api/invites/{token}/redeem` — institution onboarding and one-time, 7-day-expiry teacher
  invites (50-pending cap per school).
- `GET /api/manage/metrics?range=` and `GET /api/manage/logs/export?type=` (owner/support) — the
  metrics endpoint is **stubbed** (no `@azure/monitor-query` SDK or App Insights credentials in
  this environment yet — real shape, placeholder values, see TODO in `api/metrics.js`); logs
  export streams real JSONL from `audit_log` for `type=security`, and returns `501` for
  `type=errors|usage` rather than fabricating data.
- `teacher.js`'s onboarding handler now explicitly rejects a `role` field in the request body
  (400) instead of silently ignoring it.
- New test category: cross-tenant access denial (`tests/integration/api/sprint5.test.js`,
  37 tests) — every Sprint 1–4 resource type plus every new Sprint 5 admin endpoint.
- `tests/unit/api/authz.test.js`, `auditLog.test.js`, `stepUp.test.js`, `metrics.test.js` — unit
  coverage for the new authorization/audit/step-up primitives.

### Docs

- `docs/security/SPRINT5_AUDIT.md` — full audit: endpoint inventory, IDOR findings, role
  escalation check, JWT validation review, CORS check, logging/secrets/mass-assignment review.
- `docs/azure/ROLE_CLAIMS_SETUP.md` — manual Entra External ID portal steps to emit `role` (and
  later `schoolId`) as a signed token claim.
- `docs/azure/SPRINT5_CONTAINERS_SETUP.md` — manual Cosmos container provisioning steps for
  `audit_log` and `invites` (no IaC in this repo).

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
