// MSAL configuration for Azure AD B2C.
//
// Values come from Vite env vars (VITE_*), which are populated AFTER the B2C tenant is
// created manually in the portal — see docs/azure/B2C_SETUP.md. Until then these resolve
// to placeholders and sign-in will not succeed (the rest of the app still loads).
//
// Microsoft and Google are configured as identity providers inside the single B2C
// sign-up/sign-in user flow, so one authority drives both — the hosted B2C page shows
// a button for each provider. domain_hint (see Login.jsx) can jump straight to one.

const tenantName = import.meta.env.VITE_B2C_TENANT_NAME || 'quizpulseb2c'
const policy = import.meta.env.VITE_B2C_POLICY || 'B2C_1_signupsignin'
const clientId = import.meta.env.VITE_B2C_CLIENT_ID || '00000000-0000-0000-0000-000000000000'
const apiScope =
  import.meta.env.VITE_B2C_API_SCOPE ||
  `https://${tenantName}.onmicrosoft.com/api/access_as_teacher`
const redirectUri = import.meta.env.VITE_B2C_REDIRECT_URI || window.location.origin

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://${tenantName}.b2clogin.com/${tenantName}.onmicrosoft.com/${policy}`,
    knownAuthorities: [`${tenantName}.b2clogin.com`],
    redirectUri,
    postLogoutRedirectUri: redirectUri,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
}

// Scopes requested at login. openid/offline_access yield an ID token + refresh token;
// the API scope yields an access token whose `aud` is the API app registration — that is
// what the Azure Functions validate (see api/auth.js).
export const loginRequest = {
  scopes: ['openid', 'offline_access', apiScope],
}

// Used for silent access-token acquisition before each API call.
export const apiRequest = {
  scopes: [apiScope],
}
