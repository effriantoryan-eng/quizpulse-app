import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import './index.css'
import App from './App.jsx'
import { msalInstance, installAuthenticatedFetch } from './msalInstance'
import API_BASE from './api'

// Attach B2C tokens to all API calls transparently (existing pages call fetch directly).
installAuthenticatedFetch(API_BASE)

// MSAL must be initialized and any redirect response handled before React renders,
// otherwise the first paint races the auth state.
msalInstance.initialize().then(() => {
  return msalInstance.handleRedirectPromise()
}).then(() => {
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
})
