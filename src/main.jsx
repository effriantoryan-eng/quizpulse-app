import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import './index.css'
import App from './App.jsx'
import { msalInstance, installAuthenticatedFetch } from './msalInstance'
import API_BASE from './api'

// Attach B2C tokens to all API calls transparently (existing pages call fetch directly).
installAuthenticatedFetch(API_BASE)

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  )

  // Register the service worker after React mounts so the initial render is never blocked.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err)
    })
  }
}

// MSAL must be initialized and any redirect response handled before React renders,
// otherwise the first paint races the auth state.
msalInstance.initialize()
  .then(() => msalInstance.handleRedirectPromise())
  .catch((err) => {
    // A failed sign-in/sign-up redirect (e.g. CIAM returns an error in the callback) must
    // NOT block rendering — without this catch the whole app stays on a blank page. Stash a
    // plain-language hint for the Login page to show, then fall through to render.
    console.error('Sign-in could not be completed:', err)
    try {
      sessionStorage.setItem(
        'qp_auth_error',
        err?.errorMessage || err?.message || 'Sign-in could not be completed. Please try again.',
      )
    } catch { /* sessionStorage may be unavailable; the console error is enough */ }
  })
  .then(renderApp)
  .catch((err) => {
    // Last-resort guard: if even initialize() fails, still attempt to show the UI.
    console.error('App startup failed:', err)
    try { renderApp() } catch { /* nothing more we can do */ }
  })
