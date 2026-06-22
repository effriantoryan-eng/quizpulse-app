import { useState, useEffect, useRef } from 'react'
import API_BASE from '../../api'

const STUDENT_NAME_MAX = 80

function getOrCreateDeviceId() {
  const key = 'quizpulse_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

function JoinClass() {
  const [joinCode, setJoinCode] = useState('')
  const [studentName, setStudentName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // After submission
  const [submitted, setSubmitted] = useState(false)
  const [requestId, setRequestId] = useState(null)
  const [classId, setClassId] = useState(null)
  const [className, setClassName] = useState(null)
  const [status, setStatus] = useState(null) // 'pending' | 'approved' | 'rejected' | 'queued'

  const pollRef = useRef(null)
  const deviceId = getOrCreateDeviceId()

  useEffect(() => {
    if (!submitted || !requestId || !classId) return
    if (status === 'approved' || status === 'rejected') return

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/join-request/status?deviceId=${encodeURIComponent(deviceId)}&classId=${encodeURIComponent(classId)}`)
        if (!res.ok) return
        const data = await res.json()
        setStatus(data.status)
        if (data.status === 'approved' || data.status === 'rejected') {
          clearInterval(pollRef.current)
        }
      } catch {
        // silently retry on next interval
      }
    }, 5000)

    return () => clearInterval(pollRef.current)
  }, [submitted, requestId, classId, status, deviceId])

  async function handleSubmit(e) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    const name = studentName.trim()

    if (!code) { setError('Please enter your class join code.'); return }
    if (!name) { setError('Please enter your name.'); return }
    if (name.length > STUDENT_NAME_MAX) { setError(`Name must be ${STUDENT_NAME_MAX} characters or fewer.`); return }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: code, studentName: name, deviceId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not submit join request. Please try again.')
        return
      }
      setRequestId(data.id)
      setClassId(data.classId)
      setClassName(data.className)
      setStatus(data.status)
      setSubmitted(true)
    } catch {
      setError('Could not connect to the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '16px' }}>
          {status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⏳'}
        </div>

        {status === 'approved' && (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>You're in!</h2>
            <p style={{ color: '#555', fontSize: '14px' }}>
              Your teacher has approved your request to join <strong>{className}</strong>.
              You'll receive quiz notifications here when your teacher sends one.
            </p>
          </>
        )}

        {status === 'rejected' && (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Request not approved</h2>
            <p style={{ color: '#555', fontSize: '14px' }}>
              Your teacher did not approve your join request for <strong>{className}</strong>.
              Please check with your teacher if you think this is a mistake.
            </p>
            <button
              onClick={() => { setSubmitted(false); setJoinCode(''); setStudentName(''); setError(null) }}
              style={{ marginTop: '16px', padding: '8px 20px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
            >
              Try again
            </button>
          </>
        )}

        {status === 'queued' && (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>You're on the waitlist</h2>
            <p style={{ color: '#555', fontSize: '14px' }}>
              <strong>{className}</strong> is currently full — your request is queued.
              You'll be added automatically when a spot opens up.
            </p>
            <p style={{ color: '#aaa', fontSize: '12px' }}>Checking for updates automatically…</p>
          </>
        )}

        {status === 'pending' && (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Request sent</h2>
            <p style={{ color: '#555', fontSize: '14px' }}>
              Your request to join <strong>{className}</strong> is waiting for your teacher to approve it.
              This page checks automatically every few seconds.
            </p>
            <p style={{ color: '#aaa', fontSize: '12px' }}>Checking for updates automatically…</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: '22px' }}>Join a class</h2>
      <p style={{ margin: '0 0 24px', color: '#666', fontSize: '14px' }}>
        Enter the join code your teacher shared with you.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
          Join code
        </label>
        <input
          type="text"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABCD1234"
          maxLength={8}
          autoComplete="off"
          disabled={submitting}
          style={{
            width: '100%', padding: '10px 12px', fontSize: '18px', fontFamily: 'monospace',
            letterSpacing: '2px', border: 'var(--bw) solid var(--border)', borderRadius: '8px',
            boxSizing: 'border-box', marginBottom: '16px', textTransform: 'uppercase',
          }}
        />

        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
          Your name
        </label>
        <input
          type="text"
          value={studentName}
          onChange={e => setStudentName(e.target.value)}
          placeholder="As your teacher knows you"
          maxLength={STUDENT_NAME_MAX}
          disabled={submitting}
          style={{
            width: '100%', padding: '10px 12px', fontSize: '14px',
            border: 'var(--bw) solid var(--border)', borderRadius: '8px',
            boxSizing: 'border-box', marginBottom: '16px',
          }}
        />

        {error && (
          <p style={{ color: '#c0392b', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', padding: '12px', background: 'var(--primary)', color: 'white',
            border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500',
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Sending request…' : 'Request to join'}
        </button>
      </form>
    </div>
  )
}

export default JoinClass
