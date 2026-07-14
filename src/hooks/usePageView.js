import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import API_BASE from '../api'
import { getSessionId } from '../session'

const DEVICE_ID_KEY = 'quizpulse_device_id'

// Per-tab session ID — groups page views within one browser tab session
function getTabSessionId() {
  try {
    let id = sessionStorage.getItem('quizpulse_tab_session')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('quizpulse_tab_session', id)
    }
    return id
  } catch {
    return null
  }
}

function isStudentRoute(pathname) {
  return pathname === '/quiz'
}

// Shared by the route-change beacon below and the PWA-install beacon (usePwaInstall) so the
// two call sites can never drift on payload shape. Student routes (/quiz) never carry
// browser-fingerprint fields (userAgent, screen size, language, timezone, referrer) — only
// what's needed to join a quiz open to a send (quizId, from ?quizId= — pathname alone strips
// it). Also enforced server-side (api/pageView.js) since nothing client-side can be trusted.
export function buildPageViewPayload({ pathname, search = '', eventType = 'view' } = {}) {
  const base = {
    page:      pathname,
    eventType,
    teacherId: getSessionId(DEVICE_ID_KEY),
    sessionId: getTabSessionId(),
  }

  if (isStudentRoute(pathname)) {
    return { ...base, quizId: new URLSearchParams(search).get('quizId') || null }
  }

  return {
    ...base,
    referrer:     document.referrer || null,
    userAgent:    navigator.userAgent || null,
    language:     navigator.language || null,
    timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    screenWidth:  window.screen.width  || null,
    screenHeight: window.screen.height || null,
  }
}

// Fire-and-forget — never throw, never block the UI.
export function sendPageViewBeacon(payload) {
  fetch(`${API_BASE}/pageView`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).catch(() => {})
}

export function usePageView() {
  const location = useLocation()

  useEffect(() => {
    sendPageViewBeacon(buildPageViewPayload({ pathname: location.pathname, search: location.search }))
  }, [location.pathname, location.search])
}

// App-level 'appinstalled' listener — separate from usePwaInstall's own listener (which only
// tracks UI state and only mounts where InstallButton renders, e.g. Home/JoinClass). This one
// is mounted once for the whole app so an install triggered from the browser's own UI on any
// other route still gets counted. Reuses buildPageViewPayload/sendPageViewBeacon so the beacon
// shape can never drift between the route-change beacon and this one.
export function usePwaInstallTracking() {
  useEffect(() => {
    function onAppInstalled() {
      sendPageViewBeacon(buildPageViewPayload({ pathname: window.location.pathname, eventType: 'pwa_install' }))
    }
    window.addEventListener('appinstalled', onAppInstalled)
    return () => window.removeEventListener('appinstalled', onAppInstalled)
  }, [])
}
