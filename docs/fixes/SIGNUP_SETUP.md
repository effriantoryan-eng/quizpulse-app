# Sign-up Flow — Diagnosis & Setup (feat/v301-signup)

## Problem statement

New teachers who have never used QuizPulse hit an error from the CIAM-hosted sign-in page
when they try to sign in ("account not found" / "email not registered"). The app never had
a sign-up entry point. This document records the diagnosis and the steps to activate one.

---

## a. How auth is currently invoked

**File:** `src/pages/Login.jsx` / `src/authConfig.js`

`Login.jsx` calls:

```js
instance.loginRedirect({
  ...loginRequest,                           // { scopes: ['openid', 'offline_access'] }
  extraQueryParameters: domainHint
    ? { domain_hint: domainHint }
    : undefined,
})
```

`authConfig.js` constructs the authority:

```js
const authority = `https://${tenantSubdomain}.ciamlogin.com/${tenantId}`
// → https://quizpulseid.ciamlogin.com/19567cd0-0f52-46f7-9ac5-699538443ed1
```

**Conclusion:** The `loginRequest` contains no `prompt` parameter. MSAL sends a standard
OpenID Connect authorization request to the Entra External ID (CIAM) authorize endpoint.
CIAM interprets this as a **sign-in request** and shows a sign-in form. There is no
sign-up path invoked anywhere in the frontend.

---

## b. Where "email not registered" originates

The error comes from the **CIAM-hosted page**, not from the app's own onboarding logic.

Flow for a new user today:

1. User clicks "Sign in with Microsoft" or "Sign in with Google"
2. Browser redirects to `https://quizpulseid.ciamlogin.com/...` (the CIAM authorize endpoint)
3. CIAM shows a **sign-in form** (email + password, or social provider chooser)
4. User enters an email that does not exist in the CIAM directory
5. **CIAM returns an error page** — "We couldn't find an account with that email address"
   or similar wording on the CIAM-hosted UI
6. The app never receives a token; MSAL's `handleRedirectPromise()` resolves to null
7. The app's own onboarding logic (`GET /api/me` → `{ onboarded: false }` → `/onboarding`)
   is never reached — it requires a valid CIAM token first

The app's `/onboarding` route and `POST /api/onboarding` endpoint do handle first-time
provisioning correctly once a token exists. The gap is entirely at the CIAM entry point.

---

## c. CIAM configuration analysis

**Entra External ID (CIAM) vs legacy Azure AD B2C:**

| Feature | Legacy B2C | Entra External ID (CIAM) |
|---|---|---|
| User flow URL | `tenant.b2clogin.com/tenant/B2C_1_susi/v2.0` | `subdomain.ciamlogin.com/tenantId` (same for all flows) |
| Sign-up trigger | Separate policy URL | `prompt=create` on the same authority URL |
| Self-service sign-up | Enabled per-policy | Enabled per external tenant configuration |

**The authority URL does NOT change for sign-up.** Entra External ID uses the same
`https://quizpulseid.ciamlogin.com/19567cd0-0f52-46f7-9ac5-699538443ed1` for both
sign-in and sign-up. There is no separate "sign-up policy" URL to configure.

**The sign-up trigger is `prompt=create`** in the OIDC authorization request. MSAL
exposes this via the `prompt` property of the login request:

```js
// Triggers the Entra External ID registration form instead of the sign-in form.
export const signUpRequest = {
  scopes: ['openid', 'offline_access'],
  prompt: 'create',
}
```

When `prompt=create` is sent:
- Entra External ID shows the account creation UI (email, name, password or social provider)
- On success, CIAM creates the user in the external tenant and issues a token
- MSAL receives the token via the same redirect URI — no new redirect URI needed
- The token contains the same `oid` claim used as `teacherId` throughout the app

---

## d. Portal steps — MANUAL ACTIONS REQUIRED (cannot be automated)

### Step 1 — Confirm the external tenant has self-service sign-up enabled

1. Sign in to `https://entra.microsoft.com`
2. Switch to the **quizpulseid** external tenant (top-right tenant picker)
3. Go to **Identity > External Identities > User flows**
4. Open the existing user flow (should be named something like "SignUpSignIn" or similar)
5. Under **Identity providers**, confirm **Email with password** is listed (needed for
   email/password sign-up in addition to Microsoft and Google social providers)
6. Under **User attributes**, confirm at minimum **Email Address** and **Display Name**
   are set to **Collect** (these are what the sign-up form asks the user to fill in)
7. Self-service sign-up is enabled by default on external tenants. If it was disabled:
   go to **User settings > Manage external collaboration settings** and verify
   "Allow users to sign up via self-service" is on

### Step 2 — Verify the redirect URI covers sign-up callbacks

Sign-up and sign-in use the **same redirect URI**. The current registered value
(`https://nice-field-0127b5b00.7.azurestaticapps.net`) covers both. No new URI needed.

For local development (`http://localhost:5173`): this should already be registered.
If not:
1. **Identity > App registrations > QuizPulse app > Authentication**
2. Under **Web > Redirect URIs**, add `http://localhost:5173`
3. Click **Save**

### Step 3 — (Optional) verify the sign-up experience end-to-end

After enabling self-service sign-up and deploying this code change:
1. Open the app in an incognito window
2. Click "Create an account"
3. Complete the CIAM sign-up form
4. On return to the app, confirm the `/onboarding` page appears (school name prompt)
5. Enter a school name and submit
6. Confirm you land on `/teacher/create` (the question creation page)

---

## e. Redirect URIs — complete list the app depends on

| URI | Environment | Purpose |
|---|---|---|
| `https://nice-field-0127b5b00.7.azurestaticapps.net` | Production | Sign-in and sign-up callbacks |
| `http://localhost:5173` | Local dev | Sign-in and sign-up callbacks |

No new URIs were added by this change. Both sign-in and sign-up use the same
`redirectUri = window.location.origin` computed at runtime.

---

## f. New-account provisioning — existing flow (no backend changes required)

After a successful CIAM sign-up, the app receives a token and the following existing
sequence handles new-account provisioning:

```
CIAM sign-up → token → MSAL sets active account
  → RequireTeacher calls GET /api/me
  → { onboarded: false }  (teacher document doesn't exist yet)
  → navigate('/onboarding')
  → user fills school name → POST /api/onboarding
  → creates school doc + teacher doc (role: 'teacher', server-set)
  → navigate('/teacher/create')
```

`POST /api/onboarding` is already idempotent: if a teacher document already exists,
it returns `{ alreadyOnboarded: true }` without overwriting the school name or role.

`role` cannot be set from the request body (`teacher.js` explicitly rejects a `role`
key with 400). Role is always server-assigned as `'teacher'` on first provisioning.

---

## g. Changes made in feat/v301-signup

| File | Change |
|---|---|
| `src/authConfig.js` | Added `signUpRequest = { scopes, prompt: 'create' }` export |
| `src/pages/Login.jsx` | Added "Create an account" section + `signUp()` function |
| `tests/unit/api/signup-provisioning.test.js` | New unit tests for onboarding idempotency + role enforcement |
| `tests/integration/api/teacher.test.js` | Added sign-up provisioning integration test assertions |
| `CLAUDE.md` | Updated auth section: sign-up flow, signUpRequest, redirect URIs |
| `CHANGELOG.md` | v3.2.1 entry |
