# Azure AD B2C Setup (Sprint 1 — multi-provider auth)

B2C tenant creation and identity-provider configuration are **manual Azure Portal steps** — they
cannot be safely scripted with `az`. This document is the runbook. Once complete, fill in the env
values listed at the bottom and sign-in works end to end (Microsoft + Google).

> The app is built to tolerate an unconfigured tenant: it loads, public pages work, and the
> teacher routes simply prompt to sign in. Configure the values below to enable real auth.

---

## 1. Create the B2C tenant

1. Azure Portal → **Create a resource** → search **Azure Active Directory B2C** → *Create*.
2. Choose **Create a new Azure AD B2C Tenant**.
   - Organization name: `QuizPulse`
   - Initial domain name: `quizpulseb2c` → tenant domain becomes `quizpulseb2c.onmicrosoft.com`
   - Country/Region: **Australia**
3. After creation, **link the tenant to a subscription**: B2C resource → *Subscriptions* →
   associate with `Azure subscription 1` and resource group `quizpulse-app-rg` (for billing/visibility).
4. Switch directory to the new B2C tenant (top-right account → *Switch directory*).

Record the **Tenant ID** (Overview blade) — this is `B2C_TENANT_ID`.

---

## 2. Register the SPA (frontend) application

B2C tenant → **App registrations** → *New registration*.

- Name: `QuizPulse SPA`
- Supported account types: **Accounts in any identity provider or organizational directory**
- Redirect URI: **Single-page application (SPA)** →
  - `http://localhost:5173`
  - `https://nice-field-0127b5b00.7.azurestaticapps.net`
- Grant admin consent for `openid` and `offline_access` (API permissions → *Grant admin consent*).

Record the SPA **Application (client) ID** — this is `VITE_B2C_CLIENT_ID`.

---

## 3. Register the API application + expose a scope

B2C tenant → **App registrations** → *New registration*.

- Name: `QuizPulse API`
- Redirect URI: leave blank (it is a resource, not a client).

Then on the `QuizPulse API` registration:

1. **Expose an API** → *Set* Application ID URI → accept default
   `https://quizpulseb2c.onmicrosoft.com/api` (or `api`).
2. **Add a scope**:
   - Scope name: `access_as_teacher`
   - Admin consent display name: `Access QuizPulse as a teacher`
   - State: Enabled
   - Full scope value becomes: `https://quizpulseb2c.onmicrosoft.com/api/access_as_teacher`
3. Back on **QuizPulse SPA** → *API permissions* → *Add a permission* → *My APIs* →
   `QuizPulse API` → check `access_as_teacher` → *Add*, then **Grant admin consent**.

Record the API **Application (client) ID** — this is the API audience, `B2C_CLIENT_ID` (Function App).
Record the scope value — this is `VITE_B2C_API_SCOPE`.

---

## 4. Configure identity providers

### Microsoft Account
B2C tenant → **Identity providers** → *Microsoft Account*.
- Create an app registration in the **Microsoft Entra (multi-tenant + personal)** portal at
  <https://aka.ms/MicrosoftAccountB2C>, redirect URI
  `https://quizpulseb2c.b2clogin.com/quizpulseb2c.onmicrosoft.com/oauth2/authresp`.
- Paste its **Client ID** and a **client secret** into the B2C Microsoft Account IdP.

### Google
B2C tenant → **Identity providers** → *Google*.
- In Google Cloud Console → *APIs & Services → Credentials* → create an **OAuth client ID**
  (Web application). Authorized redirect URI:
  `https://quizpulseb2c.b2clogin.com/quizpulseb2c.onmicrosoft.com/oauth2/authresp`.
- Paste the **Client ID** and **Client secret** into the B2C Google IdP.

---

## 5. Create the sign-up / sign-in user flow

B2C tenant → **User flows** → *New user flow* → **Sign up and sign in** → *Recommended*.

- Name: `signupsignin` → full policy name becomes **`B2C_1_signupsignin`** (this is `B2C_POLICY`).
- Identity providers: tick **Email signup**, **Microsoft Account**, **Google**.
- User attributes & token claims: collect and return **Display Name** and **Email Address**;
  ensure **Object ID** ( `oid` ) and **Identity Provider** ( `idp` ) are returned as claims.
- *Run user flow* to confirm Microsoft and Google buttons both appear.

---

## 6. Fill in configuration

### Frontend — `.env.production` / `.env.local` (Vite, `VITE_` prefix)

```ini
VITE_B2C_TENANT_NAME=quizpulseb2c
VITE_B2C_POLICY=B2C_1_signupsignin
VITE_B2C_CLIENT_ID=<QuizPulse SPA client id>
VITE_B2C_API_SCOPE=https://quizpulseb2c.onmicrosoft.com/api/access_as_teacher
# VITE_B2C_REDIRECT_URI defaults to window.location.origin; set only to override
```

### Backend — Function App application settings

```powershell
az functionapp config appsettings set --name quizpulse-app-api-av5z18 --resource-group quizpulse-app-rg --settings `
  B2C_TENANT_NAME=quizpulseb2c `
  B2C_TENANT_ID=<tenant id> `
  B2C_CLIENT_ID=<QuizPulse API client id> `
  B2C_POLICY=B2C_1_signupsignin
# Ensure B2C_ALLOW_UNVERIFIED_DEV is NOT set in production.
```

For local API development, the same keys live in `api/local.settings.json`. Set
`B2C_ALLOW_UNVERIFIED_DEV=true` **locally only** to skip signature verification (so tests and
local runs work without minting real B2C tokens).

---

## How the app uses these

- **Frontend** (`src/authConfig.js`, `src/msalInstance.js`): MSAL drives the redirect to the
  hosted B2C page; `teacherId` is the `oid` claim. The bearer access token is attached to every
  API call transparently by a `window.fetch` interceptor.
- **Backend** (`api/auth.js`): validates the access token against the B2C JWKS — signature,
  issuer (`https://quizpulseb2c.b2clogin.com/<tenantId>/v2.0/`), audience (`B2C_CLIENT_ID`),
  expiry — and derives `teacherId` from `oid`/`sub`. Teacher endpoints reject requests without
  a valid token (401).
