import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../../api'
import InstallButton from '../../components/InstallButton'
import { getApprovedClasses, addApprovedClass, getPendingClasses, addPendingClass, removePendingClass, reconcileApprovals } from '../../studentClasses'
import { autoSubscribe } from '../../pushSubscribe'

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
  const navigate = useNavigate()
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
  const [subscribeState, setSubscribeState] = useState(null) // null | 'priming' | 'denied' | 'unsupported' | 'subscribed' | 'error'
  const [showJoinForm, setShowJoinForm] = useState(false)
  // Only block first paint if there's actually a pending record to reconcile — a brand-new
  // student sees the join form instantly, no loading flash.
  const [reconciling, setReconciling] = useState(() => getPendingClasses().length > 0)

  const pollRef = useRef(null)
  const deviceId = getOrCreateDeviceId()
  const knownClasses = getApprovedClasses()

  // On load, reconcile any request the teacher decided while this device's tab was closed. This is
  // the fix for the dead-end: without it, an approved student who didn't keep the original tab open
  // has no client-side path back into the class.
  useEffect(() => {
    if (getPendingClasses().length === 0) return
    let cancelled = false
    ;(async () => {
      const { newlyApproved } = await reconcileApprovals(deviceId, API_BASE)
      if (cancelled) return
      // Enrol push for anyone who just got in here — the surface where a student who missed the
      // live approval finally gets subscribed. autoSubscribe never throws.
      newlyApproved.forEach(cid => autoSubscribe(cid, deviceId).catch(() => {}))
      // Still waiting? Restore the "Request sent" screen and let the existing poll resume, so the
      // student doesn't re-submit into a duplicate request.
      const stillPending = getPendingClasses()
      if (stillPending.length > 0 && !submitted) {
        const p = stillPending[stillPending.length - 1]
        setClassId(p.classId)
        setClassName(p.className)
        setRequestId(p.requestId)
        setStatus(p.status || 'pending') // 'queued' must not be shown as "Request sent"
        setSubmitted(true)
      }
      setReconciling(false)
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Fires once the student is approved: persists the class locally (fixes the dead-end — this
  // is what lets /student/class and /join's "Continue to my class" shortcut recognise the
  // device later) and enrols push. autoSubscribe is guarded to never throw; a denied/unsupported
  // outcome is a normal, expected state here, not an error banner.
  useEffect(() => {
    if (status !== 'approved' || !classId) return
    addApprovedClass(classId, className)
    removePendingClass(classId)
    setSubscribeState('priming')
    autoSubscribe(classId, deviceId).then(setSubscribeState)
  }, [status, classId, className, deviceId])

  if (reconciling) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center', color: '#888', fontSize: '14px' }}>
        Checking for updates…
      </div>
    )
  }

  // Returning device with a known approved class — skip the join form by default.
  if (!submitted && knownClasses.length > 0 && !showJoinForm) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '16px' }}>👋</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Welcome back</h2>
        <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px' }}>
          You're already in {knownClasses.length === 1 ? knownClasses[0].className || 'your class' : `${knownClasses.length} classes`}.
        </p>
        <button
          onClick={() => navigate('/student/class')}
          style={{ width: '100%', padding: '12px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', marginBottom: '10px' }}
        >
          Continue to my class
        </button>
        <button
          onClick={() => setShowJoinForm(true)}
          style={{ width: '100%', padding: '10px', background: 'none', color: 'var(--primary)', border: 'none', fontSize: '13px', cursor: 'pointer' }}
        >
          Join a different class
        </button>
      </div>
    )
  }

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
      // Remember the attempt so a closed-tab reload can reconcile it (see the mount effect above).
      if (data.status !== 'rejected') addPendingClass(data.classId, data.className, data.id, data.status)
    } catch {
      setError('Could not connect to the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Escape hatch off the pending/queued wait screen: drop the shown request and return to the
  // form. Without this, a resumed pending screen (or a bogus/misdirected request) traps the
  // student with no way to join a different class short of clearing browser storage.
  function leaveWait() {
    if (classId) removePendingClass(classId)
    setSubmitted(false)
    setStatus(null)
    setRequestId(null)
    setClassId(null)
    setClassName(null)
    setJoinCode('')
    setStudentName('')
    setError(null)
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
            <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px' }}>
              You've joined <strong>{className}</strong>.
            </p>
            {subscribeState === 'priming' && (
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
                Turning on notifications so you don't miss a check-in — your browser may ask to confirm.
              </p>
            )}
            <button
              onClick={() => navigate('/student/class')}
              style={{ width: '100%', padding: '12px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', marginBottom: '10px' }}
            >
              Go to my class
            </button>
            <p style={{ color: '#aaa', fontSize: '12px' }}>
              We'll notify you when your teacher sends a check-in.
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
            <button
              onClick={leaveWait}
              style={{ marginTop: '16px', background: 'none', color: 'var(--primary)', border: 'none', fontSize: '13px', cursor: 'pointer' }}
            >
              Join a different class
            </button>
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
            <button
              onClick={leaveWait}
              style={{ marginTop: '16px', background: 'none', color: 'var(--primary)', border: 'none', fontSize: '13px', cursor: 'pointer' }}
            >
              Join a different class
            </button>
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

      <div style={{ marginBottom: '24px' }}>
        <InstallButton
          align="left"
          description="Add QuizPulse to your phone so your teacher's check-ins reach your lock screen."
        />
      </div>

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
