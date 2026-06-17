// MSAL configuration for Microsoft Entra External ID (CIAM).
// Replaces Azure AD B2C, which was retired for new tenants in May 2025.
// Tenant: quizpulseid.ciamlogin.com — external (customer-facing) type.
//
// Values come from Vite env vars (VITE_*) — public build-time constants, never secrets.
// See docs/azure/B2C_SETUP.md for portal setup steps.

const tenantSubdomain = import.meta.env.VITE_TENANT_SUBDOMAIN || 'quizpulseid'
const tenantId = import.meta.env.VITE_TENANT_ID || '19567cd0-0f52-46f7-9ac5-699538443ed1'
const clientId = import.meta.env.VITE_CLIENT_ID || 'bf3647a0-e091-42ef-b0c7-dc423d5dc5f3'
const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin

// Entra External ID uses ciamlogin.com — no policy name in the URL (unlike B2C).
const authority = `https://${tenantSubdomain}.ciamlogin.com/${tenantId}`

export const msalConfig = {
  auth: {
    clientId,
    authority,
    knownAuthorities: [`${tenantSubdomain}.ciamlogin.com`],
    redirectUri,
    postLogoutRedirectUri: redirectUri,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'localStorage',
    // Safari ITP clears sessionStorage/localStorage on cross-origin navigation, wiping the
    // MSAL nonce/state before it can be read back on return. Cookies survive ITP. Required
    // for any redirect flow on iOS Safari (both in-browser and standalone PWA).
    storeAuthStateInCookie: true,
  },
}

// openid + offline_access yield a signed ID token + refresh token.
// The ID token (RS256, contains oid claim) is used as the bearer to Azure Functions.
// TODO Sprint 3: expose an API scope in the portal and switch to an access token.
export const loginRequest = {
  scopes: ['openid', 'offline_access'],
}

export const apiRequest = {
  scopes: ['openid', 'offline_access'],
}
