# Sprint 5 Security Audit — Pre-Admin-Endpoint Foundation

Date: 2026-06-16
Scope: every HTTP-triggered Azure Function in `api/` (excluding `node_modules`), plus the
JWT validation path, CORS config, secret handling, and client-side risk surfaces that
back those endpoints. This audit precedes the Sprint 5 admin/institution endpoints — the
authorization helper built in Part B is a prerequisite for any endpoint that reads across
teachers or schools.

No code was changed while producing this document (Part A only).

---

## A1 — Endpoint inventory

| Method + route | Auth | Resource ID(s) accepted | Ownership check before read/mutate? | Line(s) |
|---|---|---|---|---|
| `GET /api/classes` | teacher (bearer) | — (lists caller's own) | Yes — query scoped `WHERE c.teacherId = @tid` | `classes.js:46-49` |
| `POST /api/classes` | teacher (bearer) | — | N/A (create) | `classes.js:71-123` |
| `PUT /api/classes/{id}` | teacher (bearer) | `classId` | Yes — `existing.teacherId !== teacherId` → 403 | `classes.js:161-171` |
| `PUT /api/classes/{id}/regenerate-code` | teacher (bearer) | `classId` | Yes — same pattern → 403 | `classes.js:217-227` |
| `DELETE /api/classes/{id}/students/{studentId}` | teacher (bearer) | `classId`, `studentId` (join_request id) | Yes — class ownership, then `joinReq.classId !== classId` check | `classes.js:263-288` |
| `DELETE /api/classes/{id}` | teacher (bearer) | `classId` | Yes — same pattern → 403 | `classes.js:337-347` |
| `PUT /api/classes/{id}/namelist` | teacher (bearer) | `classId` | Yes → 403 | `namelist.js:50-60` |
| `GET /api/questions` | teacher (bearer) | — (lists caller's own) | Yes — query scoped `WHERE c.teacherId = @teacherId` | `questions.js:34-37` |
| `POST /api/questions` | teacher (bearer) | — | N/A (create) | `questions.js:42-97` |
| `PUT /api/questions/{id}` | teacher (bearer) | `questionId` | Yes — `resources[0].teacherId !== teacherId` → 403 | `questions.js:174-175` |
| `DELETE /api/questions/{id}` | teacher (bearer) | `questionId` | Yes — same pattern → 403 | `questions.js:135-136` |
| `GET /api/quizzes` | teacher (bearer) | — | Yes — query scoped `WHERE c.teacherId = @teacherId` | `quizzes.js:129-132` |
| `POST /api/quizzes` | teacher (bearer) | — | N/A (create) | `quizzes.js:123-229` |
| `GET /api/quizzes/{id}` | optional bearer (anonymous students allowed) | `quizId` | Yes for teacher callers — `quiz.teacherId !== teacherId` → 403; students pass through by design | `quizzes.js:80-100` |
| `GET /api/quizzes/{id}/questions` | **anonymous** (intentional — student quiz-taking) | `quizId` | N/A — public by design, `correctIndex` stripped | `quizzes.js:22-60` |
| `GET /api/analytics?quizId=` | teacher (bearer) | `quizId` | Yes — `loadQuizAnalytics` throws 403 on `quiz.teacherId !== teacherId` | `analytics.js:22-29` |
| `GET /api/analytics/export?quizId=` | teacher (bearer) | `quizId` | Yes — same `loadQuizAnalytics` helper | `analytics.js:145` |
| `GET /api/responses?quizId=` | **NONE** | `quizId` | **MISSING** — no auth call at all | `responses.js:18-43` |
| `POST /api/responses` | anonymous (intentional — student submission) | `quizId`, self-asserted `studentId` (deviceId) | Yes — approved-join-request check + duplicate check + `closedAt` check | `responses.js:112-144` |
| `POST /api/join-request` | anonymous (intentional) | `joinCode` (resolved to classId) | N/A (create), brute-force + per-device + per-class limits applied | `joinRequests.js:60-152` |
| `GET /api/join-request/status` | anonymous (intentional) | `deviceId`, `classId` (query) | N/A — read-only status keyed by deviceId, no teacher data exposed | `joinRequests.js:156-193` |
| `GET /api/join-requests?classId=` | teacher (bearer) | `classId` | Yes — `cls.teacherId !== teacherId` → 403 | `joinRequests.js:221-224` |
| `POST /api/join-requests/approve-batch` | teacher (bearer) | `classId`, `ids[]` | Yes — class ownership checked, then `approveRequest` re-checks `joinReq.teacherId` per id | `joinRequests.js:274-277`, `394-406` |
| `POST /api/join-requests/{id}/approve` | teacher (bearer) | `id` (reqId), `classId` (query) | Yes — class ownership + `approveRequest` re-check | `joinRequests.js:330-333`, `406` |
| `POST /api/join-requests/{id}/reject` | teacher (bearer) | `id` (reqId), `classId` (query) | Yes — class ownership check **only**; does not re-verify `joinReq.teacherId` after read (lower risk since class ownership already gates it, but inconsistent with `approveRequest`) | `joinRequests.js:371-373` |
| `GET /api/me` | teacher (bearer) | — | N/A (caller's own record only) | `teacher.js:43-49` |
| `POST /api/onboarding` | teacher (bearer) | — | N/A (create, idempotent, one school per teacher enforced) | `teacher.js:86-150` |
| `POST /api/send-notification` | teacher (bearer) | `quizId` | Yes — `quiz.teacherId !== teacherId` → 403 | `sendNotification.js:140-147` |
| `POST /api/subscribe` | anonymous (intentional) | `classId`, `deviceId` | Yes — gated on an **approved** join request for that device+class | `subscribe.js:56-66` |
| `GET /api/vapid-public-key` | anonymous (intentional, public config) | — | N/A | `vapidPublicKey.js` |
| (timer) `scheduledQuizSend` | n/a (timer trigger, not HTTP) | — | N/A — internal, queries by `status='scheduled'` | `scheduledSend.js` |
| `GET /api/usageLog` | **function key** (`authLevel: 'function'`), not teacher bearer / no role check | — | **MISSING role check** — returns ALL teachers' questions/quizzes/responses/pageviews unfiltered, gated only by possession of the Function key | `adminLog.js:13-56` |
| `POST /api/pageView` | anonymous (intentional, analytics beacon) | `teacherId` (self-asserted, used only as a partition key for write, never read back for auth) | N/A — write-only telemetry | `pageView.js:20-79` |

---

## A2 — IDOR findings

| Endpoint | Verdict | Detail |
|---|---|---|
| `GET /api/quizzes/{id}/analytics` (`analytics.js`) | **Not vulnerable** | `loadQuizAnalytics()` (`analytics.js:22-29`) checks `quiz.teacherId !== teacherId` before assembling any response/question data, for both the live-poll and CSV-export endpoints. |
| `GET /api/classes` | **Not vulnerable** | Query is scoped server-side: `WHERE c.teacherId = @tid` (`classes.js:46-49`). Never fetches broadly then filters. |
| join_requests approve/reject | **Not vulnerable (approve), minor inconsistency (reject)** | `approveRequest()` re-checks `joinReq.teacherId !== teacherId` after the read (`joinRequests.js:406`), so Teacher A cannot approve Teacher B's request even if they guessed a `classId` they don't own (they'd be blocked earlier anyway by the class-ownership check at line 274/330). Reject path (`joinRequests.js:371-388`) checks class ownership before reading the request but does **not** re-check `joinReq.teacherId` on the loaded document — purely defense-in-depth gap, not currently exploitable since `classId` ownership is already required to reach that code path. |
| class roster + `PUT namelist` | **Not vulnerable** | `classesNameList` reads via `classesContainer.item(classId, teacherId)` — the partition key itself is `teacherId`, so a mismatched teacherId 404s at the Cosmos layer before the explicit ownership check even runs (`namelist.js:50-60`). |
| question edit/delete | **Not vulnerable** | Both `PUT` and `DELETE` check `resources[0].teacherId !== teacherId` before mutating (`questions.js:135-136`, `174-175`). |
| `send-notification` | **Not vulnerable** | Checks `quiz.teacherId !== teacherId` before calling `sendNotificationForQuiz` (`sendNotification.js:147`). |
| **`GET /api/responses?quizId=`** | **CRITICAL — confirmed IDOR / unauthenticated data leak** | `responses.js:18-43`. The handler never calls `authenticateTeacher`. Anyone who has (or guesses/finds) a `quizId` can retrieve every student's raw answers (`selectedIndex` per `questionId`) for that quiz with a single unauthenticated `GET`. This route is **not called anywhere in `src/`** (confirmed via grep) — it appears to be dead code left over from before `analytics.js` was built in Sprint 4, but it is still deployed and live. |
| **`GET /api/usageLog`** | **HIGH — broad cross-tenant read, no role granularity** | `adminLog.js:13-56`. Gated by Azure Function key (`authLevel: 'function'`), not by the teacher-claims authorization model at all. Anyone holding that key gets an unfiltered dump of every teacher's questions, quizzes, and responses platform-wide. There is no `role` check — possession of the key is the only gate. This endpoint needs to move onto the new `assertScope`/role-claim model before Sprint 5 builds real admin endpoints next to it, otherwise it sets the wrong precedent. |

---

## A3 — Role escalation vector

Only one code path writes to the `teachers` container: `POST /api/onboarding` (`teacher.js:139-150`).

- It reads `schoolName` from the request body — that's the only client-controlled field.
- The `teacher` document is built field-by-field from a literal object: `id`, `teacherId`,
  `schoolId` (server-derived from the school it just created), `schoolStatus`, `name`/`email`/`idp`
  (from validated token claims, not the body), and `role: 'teacher'` **hardcoded as a string
  literal** (`teacher.js:147`).
- There is no `...body` spread anywhere in this handler, so there is no mass-assignment path. A
  crafted `{ "schoolName": "x", "role": "super_admin" }` body cannot set `role` — the field is
  simply never read from `body`.
- `onboarding` is also idempotent (re-submission returns the existing record at `teacher.js:115-123`)
  and does not re-run the creation logic, so there's no "re-onboard to overwrite role" path either.

**Verdict: no existing role-escalation vulnerability.** This is correctly locked down today.
However, `role` currently lives only as a DB field with no enforcement mechanism anywhere (nothing
in the codebase reads `teacher.role` for authorization yet — Sprint 5 is the first sprint that will).
Part B4 addresses this by moving role into a signed token claim before any admin endpoint trusts it,
so a future endpoint can't be written carelessly against the DB copy.

---

## A4 — Anonymous endpoint checks

**ID generation.** Confirmed via grep across `api/*.js`: every document ID (`questions`, `quizzes`,
`classes`, `join_requests`, `schools`, `responses`) is generated with `crypto.randomUUID()`
(e.g. `questions.js:85`, `quizzes.js:214`, `joinRequests.js:134`, `teacher.js:127`). The one
exception is `joinCode`, which is intentionally short (8 chars) per the Security limits table and
is rate-limited against brute force (`joinRequests.js:97-106`, `classes.js:20-24` for generation).
IDs are not sequential or otherwise guessable.

**`POST /api/responses` gating, traced (`responses.js:101-144`):**
1. Quiz lookup by `quizId` → 404 if missing.
2. `closedAt` check — rejects with 410 if the quiz has closed (`responses.js:112-114`).
3. Approval check — queries `join_requests` for `deviceId = studentId` AND `status = "approved"` AND
   `classId IN (quiz.classIds)` (`responses.js:116-131`). Returns 403 if no approved request.
4. Duplicate check — queries existing responses by `(quizId, studentId)`, returns 409 if found
   (`responses.js:134-144`).

`studentId` **is** self-asserted directly from the request body (`responses.js:72`, `99`) with no
signature or session binding — confirmed. The mitigating factor is that `deviceId` (what gets
passed as `studentId`) is a `crypto.randomUUID()` minted client-side and stored in `localStorage`
(`src/pages/student/JoinClass.jsx:6-14`), so it isn't guessable by brute force. The forgery risk is:
if a `deviceId` ever leaks to a third party (e.g., visible to a teacher via `join-requests` list, or
via the `GET /api/responses` leak above), that party could submit/forge a response or re-subscribe
to push as that student. This is a **second-order** risk that compounds with the Critical finding
above — once `GET /api/responses` is fixed, this exposure shrinks back to "only the owning teacher
can see a class's deviceIds," which is already an accepted trust boundary per `CLAUDE.md`.

**Rate limiting — confirmed in code:**
- `POST /api/responses`: rate-limited 5 req/min/IP (`responses.js:46-48`). ✅ Applies.
- `GET /api/quizzes/{id}/questions`: **no `rateLimit()` call anywhere in the handler**
  (`quizzes.js:22-60`). The general per-IP limiter does **not** apply here. Low/Medium — this is a
  read of non-sensitive data (question text/options, no answer key) gated only by needing a valid
  `quizId`, but it has zero throttling, enabling unmetered scraping/probing of quiz IDs found
  elsewhere.

---

## A5 — JWT validation

`api/auth.js:53-77` (`verifyToken`). In production (`DEV_MODE` false), `jwt.verify()` is called
with:
- `algorithms: ['RS256']` — restricts to the expected asymmetric algorithm (no `alg: none` /
  HS256-confusion risk).
- `audience: AUDIENCE` (`AUTH_CLIENT_ID`) — **checked**.
- `issuer: ISSUER` (CIAM tenant issuer URL) — **checked**.
- Signature — **checked**, via `getSigningKey` resolving the key from the tenant's JWKS endpoint
  (`auth.js:35-40`).
- Expiry (`exp`) — **checked**; `jsonwebtoken`'s `verify()` enforces `exp` by default whenever
  `ignoreExpiration` is not set to `true`, and it isn't set here.

All four (signature, issuer, audience, expiry) are verified in production. ✅

`B2C_ALLOW_UNVERIFIED_DEV` (`auth.js:17`) is read once from `process.env` at module load. Confirmed:
- It only appears in `api/local.settings.json`, which is git-ignored (`.gitignore` contains
  `local.settings.json`) and was never committed (`git log --all -- "*local.settings.json"` and
  `git ls-files | grep local.settings` both return empty).
- No deployment script, GitHub Actions workflow, or `host.json`/App Settings reference in this repo
  sets `B2C_ALLOW_UNVERIFIED_DEV` for the deployed Function App. It can only be true if someone
  manually sets it in the Azure Portal App Settings — there is no code path that defaults it on.

No finding here beyond documenting the verification (done in Part B's CLAUDE.md update, not a fix).

---

## A6 — CORS

`api/host.json`:
```json
"cors": {
  "allowedOrigins": [
    "http://localhost:5173",
    "https://nice-field-0127b5b00.7.azurestaticapps.net"
  ],
  "supportCredentials": false
}
```
**Not a wildcard.** Restricted to the local dev origin and the production SWA origin only. No
finding — no fix needed for A6/B5.

---

## A7 — Quick checks

- **Logging of sensitive data:** Reviewed every `context.log()` / `context.warn()` / `context.error()`
  call across `api/*.js`. None log a full request body or a student's name. One borderline case:
  `subscribe.js:89` logs `device=${deviceId}, class=${classId}` — `deviceId` is a random UUID (not
  directly identifying), but it is a stable per-student identifier; logging it is unnecessary for
  the message's purpose. **Low** — trim it.
- **Secrets in git:** `local.settings.json` is gitignored and was never committed (confirmed above).
  No secret material found in `git log --all`.
- **`dangerouslySetInnerHTML`:** zero matches in `src/` (confirmed via grep). Push notification
  payloads built in `sendNotification.js:43-47` are `JSON.stringify`'d plain strings (`title`,
  `body`, `url`) — the service worker passes them to `showNotification`, never to innerHTML. No XSS
  vector via push payloads.
- **Input validation / mass assignment:** Every POST/PUT handler destructures only named fields from
  the body and either validates types/ranges explicitly (`correctIndex` and `selectedIndex` are both
  checked as `Number.isInteger` within `0–3`; `topic`/`status` checked against allow-lists) or
  rejects non-conforming shapes outright. No handler ever spreads an unvalidated request body
  directly into a persisted document — confirmed by reading every `container.items.create/upsert`
  and `.replace()` call site. No mass-assignment vector found anywhere in the current endpoint set.

---

## Findings summary (ranked)

| # | Severity | Finding | File:Line |
|---|---|---|---|
| 1 | **Critical** | `GET /api/responses?quizId=` has no authentication and no ownership check — leaks raw student answers for any quiz to anyone who has the quizId. Dead code (unused by the frontend) but live in production. | `responses.js:18-43` |
| 2 | **High** | `GET /api/usageLog` returns an unfiltered, platform-wide dump of questions/quizzes/responses/pageviews, gated only by a Function key with no role/scope check. Sets the wrong precedent right before Sprint 5 admin endpoints are built next to it. | `adminLog.js:13-56` |
| 3 | **Medium** | Ownership-check pattern is duplicated ad hoc in 10+ handlers and inconsistently returns `403` (confirms a resource exists but isn't yours) instead of `404`. Needs the shared `assertScope` helper and a 404-on-mismatch convention. | `classes.js`, `questions.js`, `quizzes.js`, `joinRequests.js`, `analytics.js`, `sendNotification.js` (all ownership-check sites) |
| 4 | **Medium** | `GET /api/quizzes/{id}/questions` has no rate limiting at all, allowing unmetered scraping/probing once a `quizId` is known. | `quizzes.js:22-60` |
| 5 | **Low** | `join-requests/{id}/reject` checks class ownership but doesn't re-verify `joinReq.teacherId` on the loaded document (inconsistent with the `approve` path's defense-in-depth check); not currently exploitable on its own. | `joinRequests.js:371-388` |
| 6 | **Low** | `subscribe.js` logs `deviceId` and `classId` in a success-path `context.log` with no operational need. | `subscribe.js:89` |
| 7 | **Informational** | `role` field has no enforcement today (no escalation vector exists, confirmed in A3), but nothing reads it for authorization either — Sprint 5 must move it to a signed token claim before any admin endpoint trusts it. | `teacher.js:147` |

Findings 1–4 are addressed in Part B below. Findings 5–6 are small, included in Part B as
low-effort fixes alongside the related files they touch. Finding 7 is addressed by B4 (role-claim
migration), required before Sprint 5 builds on top of this branch.
