# QuizPulse Admin Portal — Claude Code Context

> This file covers the **admin portal only** (`admin/` directory). For the main teacher app,
> Function App backend, data model, and sprint history, see the root `CLAUDE.md`.

---

## What this is

A separate, minimal React + Vite SPA deployed to its own Azure SWA. Operator tooling —
not product-polish. Shares the same Function App backend as the teacher app but authenticates
via a **separate Entra External ID app registration** (own `client_id`, own audience). The
backend rejects teacher-app tokens on admin endpoints and vice versa.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (SPA, React Router v6) |
| Hosting | Azure SWA (Standard tier, linked to the same Function App) |
| Auth | Microsoft Entra External ID — admin CIAM app registration |
| Backend | Shared Function App (`quizpulse-app-api-av5z18`) — `/api/manage/*` endpoints only |

---

## Local paths

```
admin/
  index.html              SPA entry
  vite.config.js          port 5174, /api proxy to localhost:7071
  staticwebapp.config.json SWA routing + CSP
  CLAUDE.md               this file
  src/
    main.jsx              React root
    App.jsx               Router + MSAL provider + idle-timeout shell
    authConfig.js         MSAL config — reads VITE_ADMIN_CLIENT_ID
    msalInstance.js       PublicClientApplication + fetch patch
    api.js                API helpers (apiFetch, apiJson, per-endpoint wrappers)
    session.js            useIdleTimeout hook (30-min idle → logout)
    components/
      AdminNav.jsx        Top nav bar with session-expiry warning
      RequireAuth.jsx     MSAL auth gate — redirects unauthenticated users
    pages/
      Schools.jsx         School list, search, validate action
      MergeTool.jsx       Source+target pickers, side-by-side review, step-up re-auth
      Institutions.jsx    Create validated school + invite link generator
      Monitoring.jsx      Metrics dashboard + log export download
      AuditLog.jsx        Paginated filterable audit log with before/after detail
      RoleManagement.jsx  Teacher list + role assignment modal (owner-only)
```

---

## Running locally

Four terminals required:

```powershell
# Terminal 1 — teacher React app (optional for admin-only work)
cd "C:\Users\Ryan\quizpulse - PWA"
npm run dev        # -> localhost:5173

# Terminal 2 — admin React app
cd "C:\Users\Ryan\quizpulse - PWA\admin"
npm run dev        # -> localhost:5174

# Terminal 3 — Azure Functions (shared backend)
cd "C:\Users\Ryan\quizpulse - PWA\api"
func start         # -> localhost:7071

# Terminal 4 — Azurite storage emulator
azurite --silent
```

**Environment setup:**

1. Create `admin/.env.local` (not committed):
   ```
   VITE_ADMIN_CLIENT_ID=<admin portal CIAM client ID from ADMIN_CIAM_SETUP.md Part 1>
   ```

2. Add to `api/local.settings.json` under `Values`:
   ```json
   "ADMIN_AUTH_CLIENT_ID": "<same admin portal CIAM client ID>"
   ```

---

## Auth architecture

The admin portal uses a **separate CIAM app registration** from the teacher app:

- Teacher app: `AUTH_CLIENT_ID = bf3647a0-e091-42ef-b0c7-dc423d5dc5f3`
- Admin portal: `ADMIN_AUTH_CLIENT_ID = <set after creating per ADMIN_CIAM_SETUP.md>`

All `/api/manage/*` Function endpoints call `authenticateAdmin(request)` (from `api/auth.js`),
which validates the token audience against `ADMIN_AUTH_CLIENT_ID`. A teacher token sent to
an admin endpoint returns **401** (audience mismatch). The reverse is also true — admin tokens
are rejected by teacher endpoints.

The CIAM tenant and issuer are shared (same `quizpulseid.ciamlogin.com` tenant). Only the
`client_id` / audience differs.

---

## Session timeout

`admin/src/session.js` exports `useIdleTimeout`. The App shell (`App.jsx`) wires it up:
- **25 min idle** → `AdminNav` shows "Session expiring soon" warning
- **30 min idle** → `msalInstance.logoutRedirect()` fires automatically

Activity events reset the timer: `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `click`.

---

## Step-up re-auth (MergeTool)

`POST /api/manage/schools/merge` requires the caller's token to have been issued within the
last 10 minutes (`auth_time` / `iat` claim). If the token is older, the backend responds:

```json
{ "reauthRequired": true, "error": "Re-authentication required" }
```

`MergeTool.jsx` catches a `status: 401` + `body.reauthRequired` and shows a "Sign in again"
button that calls `instance.loginRedirect(adminReauthRequest)` where `adminReauthRequest` has
`prompt: 'login'`. After the redirect back, the new token has a fresh `auth_time` and the
merge succeeds.

---

## Coding conventions

Same as the main app — see root `CLAUDE.md` "Coding conventions" section. Additional rules:

- **Bare / functional UI only.** This is operator tooling. No animations, transitions, or polish.
  Plain tables, forms, inline styles. No CSS frameworks or modules.
- **No jargon rule does NOT apply here.** Admin users are operators — technical terms (UUID,
  schoolId, platform_admin, audit_log, JSONL, APIM) are fine in the admin UI.
- **All admin API calls go through `api.js` helpers.** Don't use `fetch` directly in pages.
- **Admin pages are all lazy-loaded components under a single `RequireAuth` gate.** No page
  should be reachable unauthenticated; `RequireAuth` handles the redirect.

---

## Deploy

```powershell
# Build admin app
cd "C:\Users\Ryan\quizpulse - PWA\admin"
npm run build      # output: admin/dist/

# Deploy admin dist/ to the admin SWA
# (replace <admin-swa-name> with the actual resource name)
az staticwebapp deploy --name <admin-swa-name> --resource-group quizpulse-app-rg --source ./dist
```

The admin SWA is linked to the same Function App as the teacher SWA (Standard tier backend
link). No separate API deployment is needed — changes to the Function App deploy via the
normal API deploy procedure described in the root `CLAUDE.md`.

After provisioning the admin SWA:
1. Replace `ADMIN_SWA_ORIGIN_PLACEHOLDER` in `api/host.json` with the actual SWA hostname.
2. Add the SWA hostname to the CIAM admin app registration redirect URIs.
3. Add the SWA hostname to the Function App CORS list in the Azure Portal.

---

## Portal actions still pending

- [ ] Create admin app registration (docs/azure/ADMIN_CIAM_SETUP.md Part 1)
- [ ] Provision admin SWA and link to Function App (ADMIN_CIAM_SETUP.md Part 3)
- [ ] Replace `ADMIN_SWA_ORIGIN_PLACEHOLDER` in `api/host.json` with real hostname
- [ ] Add `ADMIN_AUTH_CLIENT_ID` to Function App application settings
- [ ] Optional: configure IP allow-listing on the admin SWA (ADMIN_CIAM_SETUP.md Part 5)
