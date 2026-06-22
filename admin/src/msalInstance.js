import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalConfig, adminLoginRequest } from './authConfig.js'

export const msalInstance = new PublicClientApplication(msalConfig)

await msalInstance.initialize()

// Patch fetch to silently attach the admin bearer token to /api/* calls.
const _fetch = window.fetch.bind(window)
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!url.includes('/api/')) return _fetch(input, init)

  const accounts = msalInstance.getAllAccounts()
  if (!accounts.length) return _fetch(input, init)

  try {
    const result = await msalInstance.acquireTokenSilent({ ...adminLoginRequest, account: accounts[0] })
    const headers = new Headers(init.headers || {})
    headers.set('Authorization', `Bearer ${result.idToken}`)
    return _fetch(input, { ...init, headers })
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.loginRedirect(adminLoginRequest)
    }
    return _fetch(input, init)
  }
}
