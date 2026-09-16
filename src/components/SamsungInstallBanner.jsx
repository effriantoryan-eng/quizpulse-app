import { useState } from 'react'

const STORAGE_KEY = 'quizpulse_samsung_banner_dismissed'

export default function SamsungInstallBanner() {
  const [visible, setVisible] = useState(
    () => !window.matchMedia('(display-mode: standalone)').matches &&
          !localStorage.getItem(STORAGE_KEY)
  )

  if (!visible) return null

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch (_) {}
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
          Add to your phone
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
        Get quiz notifications on your lock screen by adding QuizPulse to your home screen:
      </p>
      <ol style={{ fontSize: '13px', color: '#555', margin: '8px 0 0', paddingLeft: '18px', lineHeight: '1.7' }}>
        <li>Tap the <strong>menu</strong> button (⋮) in the browser toolbar</li>
        <li>Tap <strong>Add page to</strong></li>
        <li>Tap <strong>Home screen</strong></li>
      </ol>
    </div>
  )
}
