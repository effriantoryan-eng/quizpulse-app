import { useState } from 'react'

const STORAGE_KEY = 'quizpulse_ios_banner_dismissed'

function isIosSafariNotInstalled() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !window.MSStream &&
    !window.matchMedia('(display-mode: standalone)').matches
  )
}

function IosInstallBanner() {
  const [visible, setVisible] = useState(
    () => isIosSafariNotInstalled() && !localStorage.getItem(STORAGE_KEY)
  )

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'white', borderTop: '1px solid #e0e0e0',
      padding: '16px 20px', zIndex: 9998,
      boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>
          Install QuizPulse
        </div>
        <button
          onClick={dismiss}
          style={{ background: 'none', border: 'none', fontSize: '20px', color: '#aaa', cursor: 'pointer', lineHeight: 1 }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <p style={{ fontSize: '13px', color: '#555', margin: '0 0 4px' }}>
        To receive quiz notifications, add QuizPulse to your Home Screen:
      </p>
      <ol style={{ fontSize: '13px', color: '#555', margin: '8px 0 0', paddingLeft: '18px', lineHeight: '1.7' }}>
        <li>Tap the <strong>Share</strong> button (the box with an arrow) in Safari's toolbar</li>
        <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
        <li>Tap <strong>Add</strong> to confirm</li>
      </ol>
    </div>
  )
}

export default IosInstallBanner
