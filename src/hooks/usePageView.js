import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import API_BASE from '../api'
import { getSessionId } from '../session'

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

export function usePageView() {
  const location = useLocation()

  useEffect(() => {
    const payload = {
      page:         location.pathname,
      teacherId:    getSessionId(),
      sessionId:    getTabSessionId(),
      referrer:     document.referrer || null,
      userAgent:    navigator.userAgent || null,
      language:     navigator.language || null,
      timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      screenWidth:  window.screen.width  || null,
      screenHeight: window.screen.height || null,
    }

    // Fire-and-forget — never throw, never block the UI
    fetch(`${API_BASE}/pageView`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    }).catch(() => {})
  }, [location.pathname])
}
