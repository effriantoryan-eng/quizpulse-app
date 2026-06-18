# Admin Portal — Entra External ID App Registration

The QuizPulse admin portal is a **separate SWA** that uses a **separate CIAM app registration**
from the teacher app. This gives the admin portal its own `client_id` and audience value, so the
Function App backend can cryptographically distinguish admin tokens from teacher tokens and reject
cross-portal access.

The two portals share the same Entra External ID **tenant**
(`quizpulseid.onmicrosoft.com`) but have separate app registrations with separate audiences.

---

## Part 1 — Create the admin app registration

1. Go to **Azure Portal → Entra External ID → App registrations → New registration**.
2. Set:
   - **Name:** `QuizPulse Admin Portal`
   - **Supported account types:** Accounts in this organizational directory only
   - **Redirect URIs (Single-page application):**
     - `http://localhost:5174` (local dev — note port 5174, not 5173)
     - `https://<admin-swa-hostname>` (add once the admin SWA is provisioned — see Part 3)
3. Click **Register**.
4. Note the **Application (client) ID** — this is `ADMIN_AUTH_CLIENT_ID`.

> Do NOT share this client ID with the teacher app or expose it in the teacher app's frontend.
> It is a public identifier (not a secret) but keeping them separate enables the audience gate.

---

## Part 2 — Configure the app registration

### Authentication

In the new registration → **Authentication**:
- Confirm the redirect URIs from step 1 are listed under **Single-page application**.
- Under **Implicit grant and hybrid flows**: leave both checkboxes **off** (SPA uses PKCE, not implicit).
- Under **Supported account types**: confirm organizational directory only.
- **Logout URL:** `https://<admin-swa-hostname>` (add after SWA is provisioned).

### Token configuration

In the new registration → **Token configuration → Add optional claim**:
- Token type: **ID**
- Claims to add: `email`, `given_name`, `family_name`
- This ensures the admin portal can display the signed-in user's name.

Role claims are inherited from the same Entra External ID user object — no separate role claim
configuration is needed here. The role claim setup (`docs/azure/ROLE_CLAIMS_SETUP.md`) applies
tenant-wide and is already active for the teacher app registration.

### API permissions

No additional API permissions beyond the default `openid` and `offline_access` are required.
These are already granted by default on new registrations.

---

## Part 3 — Provision the admin SWA and link it

1. In the Azure Portal, create a new **Static Web App** (call it `quizpulse-admin-av5z18` or similar)
   in the same resource group (`quizpulse-app-rg`).
2. Choose the **Standard tier** — the admin portal must link to the same Function App backend.
3. In the admin SWA **Settings → Configuration**, link the Function App `quizpulse-app-api-av5z18`
   as the backend (same backend as the teacher SWA).
4. Note the admin SWA's hostname (e.g. `happy-admin-0000a0000.7.azurestaticapps.net`).

### Update the CIAM redirect URI

Back in the admin app registration → **Authentication**, add the SWA hostname as a redirect URI:
`https://<admin-swa-hostname>`

### Update CORS in the Function App

The admin SWA origin must be added to the Function App's CORS allowed origins:
- Azure Portal → Function App → **API → CORS**
- Add `https://<admin-swa-hostname>`

In `api/host.json`, replace `ADMIN_SWA_ORIGIN_PLACEHOLDER` with the actual hostname. This
`host.json` CORS list is used during local development (`func start`); the Azure portal CORS list
governs the deployed Function App.

---

## Part 4 — Configure the Function App

Add one new application setting to the Function App (`quizpulse-app-api-av5z18`):

| Setting name | Value |
|---|---|
| `ADMIN_AUTH_CLIENT_ID` | The Application (client) ID from Part 1 |

The teacher app setting `AUTH_CLIENT_ID` (`bf3647a0-e091-42ef-b0c7-dc423d5dc5f3`) does not change.

**Verification:** after deploying, a request to `POST /api/manage/institutions` carrying a teacher
app token should return **401** (audience mismatch). A request carrying an admin portal token from
a non-privileged account should return **404** (role gate). Only a token from an account with the
`owner` or `platform_admin` role claim should succeed.

---

## Part 5 — IP allow-listing (optional, recommended for production)

Azure Static Web Apps supports IP restriction via the `allowedIpRanges` field in
`staticwebapp.config.json`. To restrict the admin portal to your office network:

```json
{
  "networking": {
    "allowedIpRanges": [
      "203.0.113.0/24"
    ]
  }
}
```

Replace `203.0.113.0/24` with your organisation's public egress IP range(s). Staff working
from home via VPN should ensure their VPN exit IP is included. Test the restriction is in
place by loading the admin SWA URL from a network outside the allow-list — it should return
**403 Forbidden**.

This is the admin SWA's `admin/staticwebapp.config.json`, not the teacher SWA's config.

---

## Local development

For local development the admin app runs on port 5174 (teacher app is on 5173):

```powershell
# Terminal 1 — teacher React app
cd "C:\Users\Ryan\quizpulse - PWA"
npm run dev        # -> localhost:5173

# Terminal 2 — admin React app
cd "C:\Users\Ryan\quizpulse - PWA\admin"
npm run dev        # -> localhost:5174

# Terminal 3 — Azure Functions (shared)
cd "C:\Users\Ryan\quizpulse - PWA\api"
func start         # -> localhost:7071

# Terminal 4 — Azurite
azurite --silent
```

In `api/local.settings.json`, add:
```json
"ADMIN_AUTH_CLIENT_ID": "<the admin client ID from Part 1>"
```

The admin app's `authConfig.js` reads `VITE_ADMIN_CLIENT_ID` — set this in
`admin/.env.local` (not committed):
```
VITE_ADMIN_CLIENT_ID=<the admin client ID from Part 1>
```
