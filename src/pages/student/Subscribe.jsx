import { useState } from 'react'
import API_BASE from '../../api'

// Converts a URL-safe base64 string to a Uint8Array for the VAPID public key.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0))
}

function Subscribe() {
  const [classId, setClassId] = useState('')
  const [deviceId, setDeviceId] = useState(() => {
    let id = localStorage.getItem('quizpulse_device_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('quizpulse_device_id', id)
    }
    return id
  })
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubscribe() {
    if (!classId.trim()) {
      setErrorMsg('Class ID is required.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      // Fetch the VAPID public key at runtime.
      const keyRes = await fetch(`${API_BASE}/vapid-public-key`)
      if (!keyRes.ok) throw new Error('Could not connect to the server. Please try again.')
      const { publicKey } = await keyRes.json()

      // Request push permission and subscribe.
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      // Send subscription + identifiers to the backend.
      const subRes = await fetch(`${API_BASE}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: classId.trim(),
          deviceId,
          subscription: subscription.toJSON(),
        }),
      })

      if (subRes.status === 403) {
        throw new Error('Your join request has not been approved yet. Ask your teacher to approve your request first.')
      }
      if (subRes.status === 429) {
        throw new Error('Too many subscription attempts. Try again later.')
      }
      if (!subRes.ok) {
        const data = await subRes.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }

      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px' }}>
        <h2>Subscribe to quiz notifications</h2>
        <p style={{ color: '#c0392b', fontSize: '14px' }}>
          Your browser does not support push notifications. On iOS, install QuizPulse to your Home Screen first.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ marginBottom: '8px' }}>Subscribe to quiz notifications</h2>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
        Your teacher will send quizzes as notifications. Enter your class ID and tap Subscribe.
      </p>

      {status === 'success' ? (
        <div style={{ background: '#E1F5EE', border: '1px solid #1a7a5e', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '22px', marginBottom: '8px' }}>🔔</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#085041' }}>You're subscribed!</div>
          <div style={{ fontSize: '13px', color: '#3a7a65', marginTop: '6px' }}>
            You'll receive a notification when your teacher sends a quiz.
          </div>
        </div>
      ) : (
        <>
          <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
            Class ID
          </label>
          <input
            type="text"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            placeholder="Enter your class ID"
            style={{
              width: '100%', padding: '10px 12px', fontSize: '14px',
              border: '1px solid #ccc', borderRadius: '8px', boxSizing: 'border-box',
              marginBottom: '16px',
            }}
          />

          {status === 'error' && (
            <div style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={status === 'loading'}
            style={{
              width: '100%', padding: '12px', background: status === 'loading' ? '#ccc' : 'var(--primary)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: '500',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'loading' ? 'Subscribing…' : 'Subscribe to notifications'}
          </button>
        </>
      )}
    </div>
  )
}

export default Subscribe
