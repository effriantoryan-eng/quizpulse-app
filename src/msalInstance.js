import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { msalConfig, apiRequest } from './authConfig'
import { DEV_AUTH_BYPASS, DEV_AUTH_TOKEN } from './devAuth'

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

// Acquires the ID token silently for the active account, or null if not signed in.
// The ID token is a signed RS256 JWT (oid claim = teacherId) validated by Azure Functions.
export async function getApiToken() {
  if (DEV_AUTH_BYPASS) return DEV_AUTH_TOKEN
  const account = msalInstance.getActiveAccount()
  if (!account) return null
  try {
    const result = await msalInstance.acquireTokenSilent({ ...apiRequest, account })
    return result.idToken
  } catch {
    return null
  }
}

// Transparently attaches the Entra External ID bearer token to same-API fetch calls so existing pages
// (which call fetch(`${API_BASE}/...`) directly) need no changes. Installed once at startup.
export function installAuthenticatedFetch(apiBase) {
  if (typeof window === 'undefined' || window.__quizpulseFetchPatched) return
  window.__quizpulseFetchPatched = true
  const originalFetch = window.fetch.bind(window)
  // Cold starts (Consumption plan scales to zero) and brief Cosmos throttles make the first API
  // hit after idle fail or 5xx. Retry idempotent GETs with backoff so a blip self-heals instead of
  // surfacing as "couldn't load" — pages do a single fetch with no retry of their own.
  const RETRIABLE = new Set([429, 500, 502, 503, 504])
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url
    if (!url || !url.startsWith(apiBase)) return originalFetch(input, init)

    const token = await getApiToken()
    if (token) {
      const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined))
      headers.set('Authorization', `Bearer ${token}`)
      init = { ...init, headers }
    }

    const method = (init.method || (typeof input !== 'string' ? input.method : '') || 'GET').toUpperCase()
    if (method !== 'GET') return originalFetch(input, init) // never silently replay a mutation

    let lastErr
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 400 * attempt + Math.random() * 200))
      try {
        const res = await originalFetch(input, init)
        if (attempt < 2 && RETRIABLE.has(res.status)) continue
        return res
      } catch (err) {
        lastErr = err
        if (attempt >= 2) throw err
      }
    }
    throw lastErr // unreachable: attempt 2 always returns or throws
  }
}
