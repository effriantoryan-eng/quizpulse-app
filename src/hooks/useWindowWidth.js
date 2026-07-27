import { useState, useEffect } from 'react'

// Current window inner width, re-rendering on resize. Shared so the several places that need a
// JS-side responsive breakpoint (DemoGallery, FirstRunFinale) don't each re-implement it.
export function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

export default useWindowWidth
