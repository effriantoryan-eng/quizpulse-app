# Sign-in Failure Diagnosis — v3.0.1

## Symptom

Clicking any sign-in button (Microsoft / Google / "More options") on the Login page does
nothing. No redirect to CIAM, no visible error, no browser navigation. Confirmed on **both**
desktop (production) and **mobile** (mobile still failing after the desktop CSP fix).

---

## Desktop — root cause (fixed in v3.0.1 commit `129d23e`)

### a. What happened on desktop

The button calls `instance.loginRedirect(...)` (MSAL `PublicClientApplication`). Before
initiating the redirect, MSAL fetches the OIDC discovery document:

```
GET https://quizpulseid.ciamlogin.com/19567cd0-0f52-46f7-9ac5-699538443ed1/v2.0/.well-known/openid-configuration
```

This fetch was **blocked by the Content-Security-Policy** `connect-src` directive. The browser
logs a CSP violation in the console; MSAL's internal error handling swallows the exception so
from the user's perspective the button produces total silence.

### b. Desktop root cause — stale CSP auth domains

**File:** `staticwebapp.config.json`, `globalHeaders["Content-Security-Policy"]`

The `connect-src` directive had:
```
https://login.microsoftonline.com https://*.b2clogin.com
```

These are **Azure AD B2C** domains. The project migrated to **Microsoft Entra External ID
(CIAM)** in Sprint 1 (v1.0.0), which uses `*.ciamlogin.com`. The CSP was never updated.

**Evidence trail (git):**

| Commit | File state |
|--------|-----------|
| `f68a289` (initial baseline) | CSP has `*.b2clogin.com` (copied from a B2C template) |
| `a2a68f5` (Sprint 6 SWA Standard tier) | CSP kept as-is; auth domains not revisited |
| `129d23e` (v3.0.1 fix) | `*.b2clogin.com` → `*.ciamlogin.com`; `frame-src` added |

### c. Desktop secondary gap — no `frame-src` for CIAM

`frame-src` was not set, falling back to `default-src 'self'`. MSAL uses a hidden iframe for
`acquireTokenSilent` (background token renewal). Without `frame-src https://*.ciamlogin.com`,
silent refresh fails after the session token expires. Fixed in the same commit as above.

### d. Desktop fix (applied)

```json
"connect-src": "... https://*.ciamlogin.com",
"frame-src": "https://*.ciamlogin.com https://login.microsoftonline.com"
```

---

## Mobile — root causes (investigated v3.0.1 — `fix/v301-signin-mobile`)

### Investigation order

The mobile failure persists after the desktop CSP fix. Mobile has additional failure modes
that are independent of CSP. Checked in the order specified in the investigation brief.

### a. Popup vs redirect flow — NOT the cause

`Login.jsx` calls `instance.loginRedirect()`. `AuthContext.jsx`'s `login()` helper also
calls `instance.loginRedirect()`. There is no `loginPopup()` anywhere. The redirect flow
is already in use on all platforms. ✓

### b. In-app browser WebViews — CONFIRMED GAP (no detection)

If a teacher opens the QuizPulse link from an email client, WhatsApp, or a social-media app
(Facebook, Instagram, LinkedIn), the link opens in that app's embedded in-app browser
(Meta IAB, WKWebView, etc.). These WebViews:

- Block or intercept the OAuth redirect (the IAB navigates to CIAM but can't return cleanly)
- May block third-party storage access required for MSAL's state management
- Produce total silence or a blank page after tapping sign-in

**Affected apps:** Facebook, Instagram, Messenger, WhatsApp, LinkedIn, Snapchat, Twitter/X,
TikTok, Line, and most other apps that use UIWebView/WKWebView on iOS or Android WebView.

**Code evidence:** No UA detection or fallback prompt exists in `src/pages/Login.jsx`.

**Fix:** Detect the in-app browser by user-agent, replace the sign-in buttons with a
"Please open in Safari or Chrome to sign in" message plus a copy-link button.
See detection logic in the fix below.

### c. PWA standalone mode (Add-to-Home-Screen) — CONFIRMED cause on iOS

**This is the primary mobile failure mode.**

When the app is launched from the iOS home screen (PWA standalone / `display-mode: standalone`):

1. User taps "Sign in with Microsoft" → `instance.loginRedirect()` is called
2. `window.location.href` is set to `https://quizpulseid.ciamlogin.com/...` (external origin)
3. **iOS intercepts this external-origin navigation and opens it in Safari** (standard browser)
4. The user authenticates in Safari successfully
5. CIAM issues a redirect back to `https://nice-field-0127b5b00.7.azurestaticapps.net/`
6. This redirect loads in **Safari** — not in the PWA standalone shell
7. MSAL's `handleRedirectPromise()` runs in Safari and stores the account in Safari's
   localStorage
8. **iOS 16.4+ gives PWA home-screen apps a separate data partition from Safari** — the two
   processes do not share localStorage
9. When the user switches back to the PWA home screen app, MSAL finds no account in its
   own storage partition → `getActiveAccount()` returns null → the user sees the login page
   again as if nothing happened

The effect from the user's perspective: tapping sign-in opens Safari briefly, something
seems to happen, then returning to the home-screen app shows the login page unchanged.

**Code evidence:** `authConfig.js` uses `cacheLocation: 'localStorage'` with no standalone
detection or iOS workaround.

**Fix:** Detect standalone + iOS at app startup. Show a clear guidance banner:
"You're using the app from your home screen. To sign in on iPhone, open in Safari,
sign in there, then return here." Include an "Open in Safari" link that points to the
current URL so Safari opens it at the same path.

### d. Safari ITP / interaction-state loss — CONFIRMED cause in regular mobile Safari

**File:** `src/authConfig.js`, line 28: `storeAuthStateInCookie: false`

During a `loginRedirect()` call, MSAL writes temporary auth request state (nonce, PKCE code
verifier, correlation ID, state token) to sessionStorage or localStorage BEFORE navigating to
CIAM. On return from CIAM, MSAL reads this state back to validate the response.

Safari's Intelligent Tracking Prevention (ITP) treats the navigation to `ciamlogin.com` as a
cross-site navigation and applies storage restrictions on return. This can result in:

- The stored nonce/state being wiped or partitioned
- MSAL throwing `BrowserAuthError: State not matching` internally
- The error being swallowed by MSAL's redirect handler → `handleRedirectPromise()` resolves
  to `null` → page loads unauthenticated

This affects regular mobile Safari (in-browser, not just standalone) on **any iOS version
with ITP active**, which is all recent iOS versions.

**MSAL's documented fix:** set `storeAuthStateInCookie: true`. This causes MSAL to store
the auth request state in cookies (which survive ITP and cross-origin navigations) rather
than relying on storage that ITP may restrict.

**Code evidence:**
```js
// src/authConfig.js
cache: {
  cacheLocation: 'localStorage',
  storeAuthStateInCookie: false,   // ← this must be true for Safari
},
```

**Fix:** Set `storeAuthStateInCookie: true`.

### e. Redirect URI registration — not the primary cause, action still needed

`redirectUri: window.location.origin` dynamically resolves to the SWA origin at runtime.
This is correct. The SWA hostname did not change with the Standard-tier upgrade.

**Action for Ryan (portal):** In Entra External ID → App registrations → QuizPulse →
Authentication, confirm `https://nice-field-0127b5b00.7.azurestaticapps.net` is listed as
an allowed Redirect URI. If missing, sign-in will fail with `AADSTS50011` even after all
code fixes. This is a portal verification — no code change needed.

### f. MSAL authConfig correctness — not the cause

`src/authConfig.js`:
- `authority`: `https://quizpulseid.ciamlogin.com/19567cd0-...` ✓
- `knownAuthorities`: `['quizpulseid.ciamlogin.com']` ✓
- `redirectUri`: `window.location.origin` (resolves dynamically) ✓
- `clientId`: unchanged from Sprint 1 ✓

No further MSAL config changes needed beyond `storeAuthStateInCookie`.

### g. `navigateToLoginRequestUrl: false` — by design

This is set intentionally so MSAL doesn't try to navigate back to the pre-redirect URL after
login. Correct for a SPA. ✓

---

## Mobile fixes (applied in `fix/v301-signin-mobile`)

### Fix 1 — `storeAuthStateInCookie: true` (covers Finding d)

**File:** `src/authConfig.js`

```js
cache: {
  cacheLocation: 'localStorage',
  storeAuthStateInCookie: true,
},
```

Covers regular mobile Safari. Low-risk: only affects how MSAL stores its temporary
interaction state; the account cache itself still uses localStorage.

### Fix 2 — In-app browser detection (covers Finding b)

**File:** `src/pages/Login.jsx`

Detect Meta/WebView/Line/KakaoTalk user-agent strings and display a "Please open in Safari
or Chrome" prompt with a copy-link button. Sign-in buttons are hidden in this state so the
user can't attempt a doomed OAuth flow.

Detection UA strings checked: `FBAN`, `FBAV` (Facebook), `Instagram`, `LinkedInApp`,
`Snapchat`, `Twitter`, `TikTok`, `Line/`, `KAKAOTALK`, `wv` + Android (generic Android
WebView), `GSA` (Google Search App on iOS).

### Fix 3 — iOS standalone mode guidance (covers Finding c)

**File:** `src/pages/Login.jsx`

When `window.matchMedia('(display-mode: standalone)').matches` AND the user agent suggests
iOS (iPad/iPhone), replace sign-in buttons with a clear explanation and an "Open in Safari"
link. This avoids the redirect escape → separate data partition failure.

Detection: UA check for `iPhone|iPad|iPod` combined with standalone mode detection. The
standalone detection alone is insufficient because Android PWAs can also run standalone but
DO successfully complete the redirect flow (Android Chrome doesn't have the separate data
store problem).

---

## Desktop vs mobile comparison

| Failure mode | Desktop | Mobile Safari | iOS Standalone | In-app WebView |
|---|---|---|---|---|
| CSP blocked MSAL discovery | ✓ (was the cause) | ✓ (also present) | ✓ | ✓ |
| ITP clears interaction state | ✗ | ✓ (new) | Moot (never returns to PWA) | Moot |
| Redirect opens in Safari, separate data | ✗ | ✗ | ✓ (new) | ✗ |
| In-app browser blocks redirect | ✗ | ✗ | ✗ | ✓ (new) |

The desktop CSP fix was necessary but not sufficient for mobile.
