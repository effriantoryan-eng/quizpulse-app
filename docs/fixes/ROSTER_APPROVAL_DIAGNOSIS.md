# Roster Approval Failure — Diagnosis (v3.2.2)

**Date:** 2026-06-22
**Branch:** `fix/v3.2.2-roster-approval-diagnosis`
**Symptom:** A teacher with an existing class clicks **Approve** (single or batch) on a
pending student join request and the action fails. The UI surfaces
"Failed to approve requests." The student never moves into the roster.

---

## Reproduction

The teacher UI (`src/pages/teacher/PendingRequests.jsx`) approves via
`POST /api/join-requests/approve-batch` (both the per-row "Approve" and "Approve all"
buttons route through `approveSelected()` / `approveAll()`), with body
`{ classId, ids: [...] }`. The single-request route
`POST /api/join-requests/{id}/approve?classId=...` is exercised by the integration
suite and shares the same failure.

### a. Network response

```
POST /api/join-requests/approve-batch   (also /api/join-requests/{id}/approve)
→ 500 Internal Server Error
  { "error": "An unexpected error occurred" }
```

The 500 is the generic catch-all body returned by every handler's outer `try/catch`.
It is **not** a 404 (ownership), **not** a 409 (cap/duplicate), **not** a 400 (bad body).
That alone narrows the cause to an exception thrown *inside* the handler before any
business logic runs.

### b. App Insights `operation_Id`

This environment has no live App Insights access, so a production `operation_Id` could
not be captured. The corresponding server-side signal, however, is deterministic: the
Function App emits an `exceptions` row with
`context.error('joinRequestApproveBatch error:', err.message)` where
`err.message === "rateLimit is not defined"` (a `ReferenceError`). Any
`exceptions | where outerMessage has "rateLimit is not defined"` Kusto query against
the live instance for the affected window will return the trace. The same message
appears for `joinRequestApprove`, `joinRequestsList`, and `joinRequestReject`.

### c. `join_request` document (Cosmos)

The stored document is **well-formed and not implicated**. A representative pending
request created by `joinRequestCreate` (which works — it has no `rateLimit` call):

```json
{
  "id": "<uuid>",
  "classId": "<class uuid>",
  "schoolId": null,
  "teacherId": "<owning teacher oid>",
  "studentName": "Sample Student",
  "deviceId": "<device uuid>",
  "status": "pending",
  "matchedName": null,
  "matchScore": 0,
  "createdAt": "2026-06-22T..."
}
```

The doc carries `teacherId` (matching the class owner) and `classId` (the partition
key). Ownership and partition-key lookups would both succeed — the failure happens
before they are reached.

### d. Caller JWT claims

`getCallerScope`/`authenticateTeacher` resolve normally for the owning teacher:
`oid` = the teacher's stable id (= `teacherId` on the class and the join request),
`role` absent → defaults to `'teacher'`, `schoolId` absent → `null`. None of these
values are read on the approval path before the exception, so they are not the cause.

---

## Candidate causes — confirmed / ruled out

| # | Candidate | Verdict | Evidence |
|---|---|---|---|
| a | `assertScope` `ownerField` mismatch (scoping on `schoolId` vs `teacherId`) | **Ruled out** | All four handlers call `assertScope(cls, { teacherId })` with the default `ownerField: 'teacherId'`; the class doc carries `teacherId`. Correct. |
| b | Role claim missing → `schoolId=null` and a helper requires it | **Ruled out** | The approval path never requires `schoolId`. `assertScope` with default `ownerField` compares `teacherId` only. |
| c | `studentCount` drift → cap re-check throws 409 | **Ruled out** | The observed status is 500, not 409. The cap check in `approveRequest` is reached *after* the throwing line and returns 409 (not 500) when it trips. |
| d | Frontend posts wrong id (`classId` vs `join_request.id`) | **Ruled out** | `PendingRequests.jsx` sends `{ classId, ids: [request.id] }` to approve-batch and `?classId=` + the request id in the path to the single route. Both correct. |

## Resolved cause

**A missing import.** The Sprint 6 commit `f72f270`
("replace in-memory rate limiting with Azure API Management") changed line 3 of
`api/joinRequests.js` from:

```js
const { rateLimit, getClientIp } = require('./rateLimit');
```

to:

```js
const { getClientIp } = require('./rateLimit');
```

…but left the four `rateLimit(...)` **call sites** intact (in `joinRequestsList`,
`joinRequestApproveBatch`, `joinRequestApprove`, `joinRequestReject`). With `rateLimit`
no longer in scope, the first thing each authed handler does after auth is evaluate
`if (!rateLimit(...))`, which throws `ReferenceError: rateLimit is not defined`. The
outer `try/catch` converts it to the generic 500.

`joinRequests.js` is the **only** API file that lost the import: every other handler
(`classes.js`, `questions.js`, `responses.js`, …) still imports `rateLimit` and works.
The migration intent was to keep `rateLimit` as a (still-functional in-memory) no-op
fallback — `rateLimit.js` was never removed and still exports the function — so the
correct fix is to restore the import, not to delete the call sites.

This is why approval (and, less visibly, the join-requests *list* — which 500s the same
way, so the pending list can fail to load too) has been broken since v3.0.0.

## Fix

Restore `rateLimit` to the import in `api/joinRequests.js:3`:

```js
const { rateLimit, getClientIp } = require('./rateLimit');
```

## Regression guard

`tests/integration/api/v322-roster-approval.test.js`:
- Owning teacher approves a pending request → **200**, request `status` becomes
  `"approved"` (this reproduces the exact failure mode — it threw a 500 before the fix).
- Cross-tenant: Teacher B attempts to approve Teacher A's request → **404** (never 200,
  never 403).
