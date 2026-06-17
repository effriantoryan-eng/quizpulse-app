# Sign-in Failure Diagnosis — v3.0.1

## Symptom

Clicking any sign-in button (Microsoft / Google / "More options") on the Login page does
nothing. No redirect to CIAM, no visible error, no browser navigation.

## Investigation steps

### a. What happens when the button is clicked?

The button calls `instance.loginRedirect(...)` (MSAL `PublicClientApplication`). Before
initiating the redirect, MSAL fetches the OIDC discovery document to confirm the authority
endpoints:

```
GET https://quizpulseid.ciamlogin.com/19567cd0-0f52-46f7-9ac5-699538443ed1/v2.0/.well-known/openid-configuration
```

This fetch is **blocked by the Content-Security-Policy** `connect-src` directive. The browser
logs a CSP violation in the console and MSAL's internal error handling swallows the exception,
so from the user's perspective the button produces total silence.

### b. Root cause — stale CSP auth domains

**File:** `staticwebapp.config.json`, `globalHeaders["Content-Security-Policy"]`

The `connect-src` directive contains:
```
https://login.microsoftonline.com https://*.b2clogin.com
```

These are **Azure AD B2C** domains. The project migrated to **Microsoft Entra External ID
(CIAM)** in Sprint 1 (v1.0.0), which uses the `*.ciamlogin.com` domain family. The CSP was
never updated to reflect this change.

**Evidence trail (git):**

| Commit | File state |
|--------|-----------|
| `f68a289` (initial baseline) | CSP has `*.b2clogin.com` (copied from a B2C template) |
| `a2a68f5` (Sprint 6 SWA Standard tier) | CSP kept as-is; direct Function App URL removed but auth domains not revisited |
| `c812c0d` (fix navigationFallback) | No CSP change |

The mismatch has existed since Sprint 1 but did not cause sign-in failures on localhost
(the dev server has no CSP headers — only SWA injects them in production).

### c. Secondary gap — no frame-src for CIAM

`frame-src` is not set explicitly, so it falls back to `default-src 'self'`. MSAL uses a
hidden iframe for `acquireTokenSilent` (background token renewal after login). Without
`frame-src https://*.ciamlogin.com`, silent refresh fails after the session token expires,
forcing the user to sign in again every session. This is a latent issue that would appear
after the connect-src fix went live.

### d. MSAL config in the frontend — not the cause

`src/authConfig.js` is correct:
- `authority`: `https://quizpulseid.ciamlogin.com/19567cd0-...` ✓
- `knownAuthorities`: `['quizpulseid.ciamlogin.com']` ✓
- `redirectUri`: `window.location.origin` (resolves dynamically) ✓
- `clientId`: unchanged from Sprint 1 ✓

No MSAL config changes are needed.

### e. Redirect URI — not the primary cause, but worth flagging

`redirectUri: window.location.origin` means the URI registered in the Entra External ID
app registration must match the SWA origin. The SWA hostname did not change with the
Standard-tier upgrade — it is still `https://nice-field-0127b5b00.7.azurestaticapps.net`.

**Action for Ryan:** Confirm in the Azure portal (Entra External ID → App registrations →
QuizPulse → Authentication) that `https://nice-field-0127b5b00.7.azurestaticapps.net` is
listed as an allowed Redirect URI. If the URI isn't registered, sign-in will fail even after
the CSP fix with an `AADSTS50011` error ("The redirect URI ... does not match").
This is a portal verification step only — no code change needed.

## Fix

Update `staticwebapp.config.json` `connect-src`:
- Replace `https://*.b2clogin.com` with `https://*.ciamlogin.com`
- Keep `https://login.microsoftonline.com` (Microsoft provider OAuth endpoint)
- Add explicit `frame-src https://*.ciamlogin.com https://login.microsoftonline.com` for
  MSAL's silent iframe token renewal

## Impact

Production only. Local dev is unaffected (Vite dev server does not inject CSP headers).
Fix is a one-line config change with no code or build changes.
