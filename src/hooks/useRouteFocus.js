import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Focus #main-content on route changes so keyboard/SR users land at the new page,
// not stranded at the last focused element from the previous route.
// Pure helper exported for testing — returns true when focus should move.
export function shouldMoveFocus(prev, next) {
  return prev !== next
}

export function useRouteFocus() {
  const { pathname } = useLocation()
  const prev = useRef(pathname)

  useEffect(() => {
    if (!shouldMoveFocus(prev.current, pathname)) return
    prev.current = pathname
    const main = document.getElementById('main-content')
    if (main) {
      main.focus({ preventScroll: false })
    }
  }, [pathname])
}
