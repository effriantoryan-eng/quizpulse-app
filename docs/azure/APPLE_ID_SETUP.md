# Apple ID — Entra External ID CIAM Provider Setup

This document covers the steps to add Apple as a third sign-in provider in the QuizPulse
Entra External ID tenant. The frontend MSAL flow and backend JWT validation already handle
multiple providers — no code changes are needed when a new provider is added correctly.

**Prerequisites:** an Apple Developer account (Team ID, App ID, and a Services ID).

---

## Part 1 — Apple Developer Portal

### Step 1 — Register an App ID

1. Sign in to [developer.apple.com](https://developer.apple.com) → **Certificates, IDs & Profiles**
2. **Identifiers** → **+** → **App IDs** → **App** → Continue
3. Description: `QuizPulse`
4. Bundle ID (explicit): `app.quizpulse.pwa`
5. Under **Capabilities**, enable **Sign In with Apple**
6. Continue → Register

Note the **Team ID** (top-right of the developer portal, e.g. `ABCDE12345`).

### Step 2 — Create a Services ID

This is what Entra External ID registers as the OAuth client.

1. **Identifiers** → **+** → **Services IDs** → Continue
2. Description: `QuizPulse Web`
3. Identifier: `app.quizpulse.web` (reverse-domain, must be unique)
4. Continue → Register
5. Click the newly created Services ID → enable **Sign In with Apple** → **Configure**
6. Primary App ID: select `app.quizpulse.pwa` (from Step 1)
7. Domains and Subdomains: `quizpulseid.ciamlogin.com`
8. Return URLs:
   ```
   https://quizpulseid.ciamlogin.com/quizpulseid.onmicrosoft.com/federation/oidc/apple
   ```
9. Save → Continue → Register

### Step 3 — Create a private key

Entra External ID uses a signed JWT (client_secret_jwt) to authenticate with Apple.

1. **Keys** → **+**
2. Name: `QuizPulse Apple Sign In`
3. Enable **Sign In with Apple** → Configure → select the `app.quizpulse.pwa` App ID
4. Continue → Register → **Download** (download once — Apple doesn't store it)
5. Note the **Key ID** (e.g. `FGHIJ67890`)
6. Store the downloaded `.p8` file securely (see Key Vault step below)

---

## Part 2 — Azure Key Vault

Store the Apple private key as a Key Vault secret so the Entra External ID configuration
can reference it without putting the key in plaintext config.

1. Azure Portal → **Key Vault** → `quizpulse-app-kv-av5z18` → **Secrets** → **+ Generate/Import**
2. Upload method: **Manual**
3. Name: `APPLE-PRIVATE-KEY`
4. Value: paste the full contents of the `.p8` file including `-----BEGIN PRIVATE KEY-----` lines
5. Create

> The `.p8` file is the raw private key material. Treat it like a password. Do not commit
> it to git. Rotate it by generating a new key in the Apple portal and updating the secret.

---

## Part 3 — Entra External ID CIAM Tenant

1. Azure Portal → **Microsoft Entra External ID** → `quizpulseid` tenant
2. **External Identities** → **All identity providers**
3. Click **Apple** → **Configure**
4. Fill in:
   - **Services ID**: `app.quizpulse.web`
   - **Apple Team ID**: from Step 1 (e.g. `ABCDE12345`)
   - **Key ID**: from Step 3 (e.g. `FGHIJ67890`)
   - **Private key**: paste the `.p8` content (or reference the Key Vault secret)
5. Save

6. Still in the `quizpulseid` tenant → **User flows** → `SignUpSignIn` (or your flow name)
7. **Identity providers** → ensure **Apple** is checked
8. Save

### Verify the OIDC discovery endpoint

After saving, visit:
```
https://quizpulseid.ciamlogin.com/quizpulseid.onmicrosoft.com/v2.0/.well-known/openid-configuration
```
Confirm `apple` appears in `claims_providers_supported` (or similar field depending on tenant version).

---

## Part 4 — Frontend MSAL config

MSAL automatically discovers the Apple login option from the Entra External ID OIDC metadata —
no frontend code changes are required. The **Sign in** button on the Login page will show Apple
as a provider option once the tenant is configured.

If you need to force the Apple identity hint (e.g. a dedicated "Sign in with Apple" button):

```js
// src/msalInstance.js — optional, only if adding a dedicated Apple button
import { msalInstance } from './msalInstance'

async function signInWithApple() {
  await msalInstance.loginRedirect({
    scopes: ['openid', 'profile', 'email'],
    extraQueryParameters: { domain_hint: 'apple.com' }
  })
}
```

Do not add this unless a dedicated Apple button is explicitly requested. The generic sign-in
flow already surfaces Apple as an option through the CIAM-hosted login page.

---

## Part 5 — Backend JWT validation

No changes required. The backend (`api/auth.js`) validates tokens via JWKS at:
```
https://quizpulseid.ciamlogin.com/{tenantId}/discovery/v2.0/keys
```
This is the same endpoint for all providers (Microsoft, Google, Apple). The `oid` claim is
set by Entra External ID as a stable opaque ID regardless of which provider the user used
— so `teacherId` from the `oid` claim works identically.

---

## Notes

- **Apple's email relay**: Apple may return a relayed email address
  (`abc123@privaterelay.appleid.com`). The onboarding flow uses `oid` as the primary
  identifier, not email, so this is handled correctly.
- **Name disclosure**: Apple only sends the user's name on the very first sign-in. Subsequent
  logins omit it. The onboarding form already allows teachers to enter their name manually,
  so this is not a blocker.
- **Key rotation**: Apple private keys cannot be updated once created (only revoked and
  replaced). Create a new key, update the Key Vault secret and the Entra provider config,
  then revoke the old key. Allow a few minutes for propagation before revoking.
- **Testing**: use a real Apple ID in a sandbox environment (Apple does not provide a test
  Apple ID without a Developer account). E2E Playwright tests for Apple sign-in require
  a real Apple ID credential stored securely in CI secrets.
