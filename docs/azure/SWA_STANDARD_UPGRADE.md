# SWA Standard Tier — Upgrade & Linked Backend Setup

This document covers the one-time Azure Portal steps to upgrade Static Web Apps from Free to
Standard tier, link the Function App as the managed backend, and update CORS. These steps must
land **atomically with the v3.0.0 frontend deploy** — if the portal upgrade happens before the
code ships (or vice versa), `/api/*` calls will break in prod.

---

## Why

The Free tier does not support linked backends. All POST/PUT/DELETE requests through the SWA
`/api/*` proxy returned 405, so Sprints 1–5 worked around this by calling the Function App URL
directly from the frontend (`https://quizpulse-app-api-av5z18.azurewebsites.net/api`). Standard
tier eliminates this workaround: SWA proxies `/api/*` to the linked Function App directly, CORS
is managed by SWA, and the frontend reverts to relative `/api` paths.

---

## Step 1 — Upgrade SWA to Standard tier

1. Azure Portal → **Static Web Apps** → `nice-field-0127b5b00` (East Asia)
2. **Settings → Hosting plan**
3. Change plan from **Free** to **Standard**
4. Confirm — this has a monthly cost (~$9 USD/app/month). Well within the $100 budget.

---

## Step 2 — Link the Function App as managed backend

> This is what actually enables SWA to proxy `/api/*` to the Function App.

1. In the same SWA resource → **Settings → APIs**
2. **Link** → select **quizpulse-app-api-av5z18** (same resource group, `quizpulse-app-rg`)
3. Confirm linking. Azure will:
   - Set the Function App as the managed backend for `/api/*`
   - Issue the SWA-to-Functions auth header automatically (no `x-functions-key` required)
   - Disable direct public HTTPS access to the Function App (optional — leave enabled for now
     so the dev `func start` flow still works locally)

After linking, `/api/*` requests to the SWA hostname are proxied to the Function App. The
explicit `routes` rewrite in `staticwebapp.config.json` has already been removed in Sprint 6.

---

## Step 3 — Update Function App CORS

Before linking, the Function App had the SWA production origin in its CORS allow-list so that
direct cross-origin calls from the browser worked. After linking, the browser never calls the
Function App directly — SWA does it server-to-server. Browser CORS rules no longer apply.

1. Azure Portal → **Function App** → `quizpulse-app-api-av5z18`
2. **API → CORS**
3. Remove `https://nice-field-0127b5b00.7.azurestaticapps.net` from the allowed origins list
4. Keep `http://localhost:5173` (local dev still calls `localhost:7071` directly)
5. Save

---

## Step 4 — Deploy

Deploy in this order to keep the production window as short as possible:

```powershell
# 1. Complete steps 1–3 in the Azure Portal first.

# 2. Push the Sprint 6 release branch — GitHub Actions auto-deploys the frontend to SWA.
git push origin release/v3.0-sprint6   # or merge to main and push

# 3. Deploy the API (from Node 20/22 only — see CLAUDE.md deploy warning).
cd api
func azure functionapp publish quizpulse-app-api-av5z18
```

After the API deploy, smoke-test:
- `GET https://nice-field-0127b5b00.7.azurestaticapps.net/api/me` — should return 401 (auth
  required), **not** 405 or 404. 401 confirms SWA is proxying to the Function App correctly.
- Sign in and verify the dashboard loads and classes/quizzes appear.

---

## Rollback

If `/api/*` breaks after linking:

1. Re-add the explicit route rewrite to `staticwebapp.config.json`:
   ```json
   { "route": "/api/*", "rewrite": "https://quizpulse-app-api-av5z18.azurewebsites.net/api/*" }
   ```
2. Revert `src/api.js` to the direct Function App URL.
3. Redeploy the frontend.
4. Unlink the Function App backend in the Portal (Settings → APIs → Unlink).

---

## Known issues after upgrade

- The in-memory rate limiter (`api/rateLimit.js`) is replaced by Azure API Management in
  Sprint 6 (`feat/s6-api-management`). Until APIM is wired, rate limiting is still per-instance.
- The SWA Standard tier costs ~$9 USD/month. Update the budget alert thresholds in
  Azure Cost Management if needed.
