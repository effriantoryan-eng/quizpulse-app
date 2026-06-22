import { useState, useEffect } from 'react'

// Shows a dismissible banner when a new service worker is waiting to activate.
// The user can click "Refresh" to reload and apply the update immediately.
function SWUpdateBanner() {
  const [waitingSW, setWaitingSW] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then((reg) => {
      // Already waiting (e.g. page was reloaded before the user refreshed).
      if (reg.waiting) {
        setWaitingSW(reg.waiting)
        return
      }

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingSW(newSW)
          }
        })
      })
    })
  }, [])

  if (!waitingSW) return null

  function applyUpdate() {
    waitingSW.postMessage({ type: 'SKIP_WAITING' })
    window.location.reload()
  }

  return (
    <div style={{
      position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--primary)', color: 'white', borderRadius: '10px',
      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 9999,
      fontSize: '14px', whiteSpace: 'nowrap',
    }}>
      <span>Update available</span>
      <button
        onClick={applyUpdate}
        style={{
          background: 'white', color: 'var(--primary)', border: 'none',
          borderRadius: '6px', padding: '6px 14px', fontSize: '13px',
          fontWeight: '600', cursor: 'pointer',
        }}
      >
        Refresh
      </button>
      <button
        onClick={() => setWaitingSW(null)}
        style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
          fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 2px',
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export default SWUpdateBanner
