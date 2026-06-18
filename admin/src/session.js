import { useEffect, useRef, useCallback } from 'react'

const IDLE_MS = 30 * 60 * 1000      // 30 minutes — session timeout
const WARN_MS = 25 * 60 * 1000      // 25 minutes — show warning

// Fires onTimeout after IDLE_MS of no user activity (mouse, keyboard, touch, scroll).
// Fires onWarn after WARN_MS of inactivity to let the UI show a "session expiring" notice.
// Reset whenever the user interacts.
export function useIdleTimeout({ onTimeout, onWarn, onActivity }) {
  const timeoutRef = useRef(null)
  const warnRef = useRef(null)
  const warnFired = useRef(false)

  const reset = useCallback(() => {
    clearTimeout(timeoutRef.current)
    clearTimeout(warnRef.current)
    warnFired.current = false
    if (onActivity) onActivity()

    warnRef.current = setTimeout(() => {
      warnFired.current = true
      if (onWarn) onWarn()
    }, WARN_MS)

    timeoutRef.current = setTimeout(() => {
      if (onTimeout) onTimeout()
    }, IDLE_MS)
  }, [onTimeout, onWarn, onActivity])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timeoutRef.current)
      clearTimeout(warnRef.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [reset])
}
