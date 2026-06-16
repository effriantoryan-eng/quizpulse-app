# Role Claims Setup (Sprint 5 — authorization foundation)

Manual Entra External ID (CIAM) portal steps to make `role` (and, later, `schoolId`) part of the
**signed ID token** instead of a value that only ever lives in the `teachers` Cosmos container.

## Why this is needed

`api/shared/authz.js`'s `getCallerScope(claims)` reads `role` and `schoolId` from validated JWT
claims only — never from the database or a request body. That is a deliberate security boundary:
the database `role` field can't be trusted for authorization decisions because nothing prevents a
future endpoint from writing to it carelessly, whereas a claim is signed by Entra and verified via
JWKS on every request (see `api/auth.js`).

Until the steps below are completed, no token carries a `role` claim, so `getCallerScope` falls back
to `role: 'teacher'` for everyone and `schoolId: null`. This is a safe default (nobody is
accidentally granted `owner`/`support`/`school_admin` scope) but it also means privileged
endpoints — `GET /api/usageLog`, `PUT /api/manage/teachers/{id}/role`, and any Sprint 5/6 admin
endpoint built on `assertScope` — are unreachable by anyone until this configuration is in place.
That is intentional: build the admin UI and configure the claim together, not before.

---

## 1. Define app roles on the API app registration

Entra admin center → **App registrations** → `QuizPulse API` (client ID
`bf3647a0-e091-42ef-b0c7-dc423d5dc5f3`, tenant `quizpulseid.onmicrosoft.com`) → **App roles** →
*Create app role* for each of:

| Display name | Value | Description |
|---|---|---|
| Teacher | `teacher` | Default — standard teacher account (also the safe fallback when no claim is present) |
| School Admin | `school_admin` | Sprint 5 — school-scoped reads/writes (`assertScope` with `ownerField: 'schoolId'`) |
| Support | `support` | Cross-tenant **read-only** access (`assertScope`'s `READ_ALL_ROLES` bypass; never `MUTATE_ALL_ROLES`) |
| Platform Admin | `platform_admin` | Cross-tenant **operational** mutations — institution onboarding, school validation (not destructive actions like school merge or role changes) |
| Owner | `owner` | Full cross-tenant access including destructive actions (school merge, behind step-up re-auth) and `PUT /api/manage/teachers/{id}/role` |

For each: allowed member types = **Users/Groups** (this is a human-assigned role, not an app
permission). Save.

## 2. Assign roles to users

**Enterprise applications** → `QuizPulse API` → **Users and groups** → *Add assignment* → pick the
user (or a group) and the app role from step 1. Every teacher who signs up through `/onboarding`
gets `role: 'teacher'` in the database automatically (`api/teacher.js`) but has **no app role
assignment** until someone manually assigns one here — assignment is the actual privilege grant.

## 3. Emit the role as a token claim

By default Entra App Roles are already included as a `roles` claim (an array) in the ID token once
assigned — no extra mapping step for the *roles* claim itself. `api/shared/authz.js` currently reads
a singular `claims.role` string. Either:

- **(Recommended)** Update `getCallerScope` to read `claims.roles?.[0]` instead of `claims.role`
  once role assignment is live, since Entra emits `roles` as an array; or
- Add a **token configuration / claims mapping policy** that copies the first `roles` array entry
  into a custom `role` claim, if a singular claim is preferred for the JS code as-is.

Whichever path is chosen, update the one-line claim read in `api/shared/authz.js`'s
`getCallerScope` to match — do not change the rest of the authorization model.

## 4. (Future — when school_admin ships) emit `schoolId` as a claim

There is no built-in Entra concept of "the school this user belongs to" — it's a QuizPulse-specific
attribute stored on the `teachers` document. To get it into the token:

1. Entra admin center → **External Identities** → **Custom user attributes** → create
   `extension_schoolId` (string).
2. **Token configuration** on the `QuizPulse API` registration → *Add optional claim* → ID → map
   `extension_schoolId` → emits as `extn.schoolId` (or similar — Entra namespaces custom attribute
   claims) in the token.
3. Populate the attribute when a school is validated (Sprint 5 admin flow) — this is application
   logic, not a portal step, and is out of scope for this document.
4. Update `getCallerScope` in `api/shared/authz.js` to read the actual claim name Entra emits.

Until this is done, `assertScope(resource, caller, { ownerField: 'schoolId' })` always fails closed
(`caller.schoolId` is `null`) — no caller can be granted school-wide scope by accident.

## 5. Verify

After assigning a role to a test account, decode the ID token (jwt.io or a debug log) and confirm
the `roles` array (or mapped `role` claim, per step 3) is present. Call `GET /api/usageLog` with
that token — it should now return data instead of `404`. Revoking the role assignment should make
the same call 404 again on the next sign-in (claims are only refreshed on token re-issuance, not
instantly on revocation — note this if testing a revoke).
