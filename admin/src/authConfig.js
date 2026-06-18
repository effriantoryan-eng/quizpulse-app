// MSAL configuration for the QuizPulse admin portal.
// Uses a SEPARATE app registration from the teacher app — different client_id, different audience.
// This lets the Function App backend reject teacher tokens on admin endpoints and vice versa.
//
// Set VITE_ADMIN_CLIENT_ID in admin/.env.local (not committed).
// See docs/azure/ADMIN_CIAM_SETUP.md for the portal registration steps.

const tenantSubdomain = import.meta.env.VITE_TENANT_SUBDOMAIN || 'quizpulseid'
const tenantId = import.meta.env.VITE_TENANT_ID || '19567cd0-0f52-46f7-9ac5-699538443ed1'
const clientId = import.meta.env.VITE_ADMIN_CLIENT_ID || ''
const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin

if (!clientId) {
  console.warn('[QuizPulse Admin] VITE_ADMIN_CLIENT_ID is not set. Auth will fail. Set it in admin/.env.local.')
}

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
    storeAuthStateInCookie: true,
  },
}

export const adminLoginRequest = {
  scopes: ['openid', 'offline_access'],
}

// Force a fresh interactive login — used by the merge step-up re-auth flow.
export const adminReauthRequest = {
  scopes: ['openid', 'offline_access'],
  prompt: 'login',
}
