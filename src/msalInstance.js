import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { msalConfig, apiRequest } from './authConfig'

// Single app-wide MSAL instance. Created here (not inside React) so non-React code —
// e.g. the fetch interceptor below — can acquire tokens too.
export const msalInstance = new PublicClientApplication(msalConfig)

// Keep an active account in sync so acquireTokenSilent works after a reload.
const existing = msalInstance.getActiveAccount()
if (!existing && msalInstance.getAllAccounts().length > 0) {
  msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0])
}

msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
    msalInstance.setActiveAccount(event.payload.account)
  }
})

// Acquires an API access token silently for the active account, or null if not signed in.
// Falls back to an interactive redirect only when the refresh token has expired.
export async function getApiToken() {
  const account = msalInstance.getActiveAccount()
  if (!account) return null
  try {
    const result = await msalInstance.acquireTokenSilent({ ...apiRequest, account })
    return result.accessToken
  } catch {
    // Silent acquisition failed (e.g. expired session) — let the next user action trigger
    // an interactive login rather than redirecting mid-request.
    return null
  }
}

// Transparently attaches the B2C bearer token to same-API fetch calls so existing pages
// (which call fetch(`${API_BASE}/...`) directly) need no changes. Installed once at startup.
export function installAuthenticatedFetch(apiBase) {
  if (typeof window === 'undefined' || window.__quizpulseFetchPatched) return
  window.__quizpulseFetchPatched = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url
    if (url && url.startsWith(apiBase)) {
      const token = await getApiToken()
      if (token) {
        const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined))
        headers.set('Authorization', `Bearer ${token}`)
        init = { ...init, headers }
      }
    }
    return originalFetch(input, init)
  }
}
