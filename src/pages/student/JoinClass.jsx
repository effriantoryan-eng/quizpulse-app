import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import API_BASE from '../../api'
import InstallButton from '../../components/InstallButton'
import ClassJoinQR from '../../components/ClassJoinQR'
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
  const [searchParams] = useSearchParams()
  // Prefill from a scanned "Join this class" QR (v4.7.0 T4) — ?code=XXXX. Never auto-submits;
  // the student still confirms their name.
  const [joinCode, setJoinCode] = useState(() => (searchParams.get('code') || '').toUpperCase())
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
    addApprovedClass(classId, className, joinCode.trim().toUpperCase() || undefined)
    removePendingClass(classId)
    setSubscribeState('priming')
    autoSubscribe(classId, deviceId).then(setSubscribeState)
  }, [status, classId, className, deviceId, joinCode])

  if (reconciling) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
        Checking for updates…
      </div>
    )
  }

  // Returning device with a known approved class — skip the join form by default.
  if (!submitted && knownClasses.length > 0 && !showJoinForm) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Welcome back</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
          You're already in {knownClasses.length === 1 ? knownClasses[0].className || 'your class' : `${knownClasses.length} classes`}.
        </p>
        <button
          onClick={() => navigate('/student/class')}
          className="btn btn-primary btn-block"
          style={{ justifyContent: 'center', marginBottom: '10px' }}
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
        <span className="tag tag-neutral" style={{ marginBottom: '16px' }}>
          {status === 'approved' ? 'Approved' : status === 'rejected' ? 'Not approved' : status === 'queued' ? 'Waitlisted' : 'Pending'}
        </span>

        {status === 'approved' && (
          <>
            <h2 style={{ margin: '16px 0 8px', fontSize: '20px' }}>You're in!</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
              You've joined <strong style={{ color: 'var(--text)' }}>{className}</strong>.
            </p>
            {subscribeState === 'priming' && (
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '12px' }}>
                Turning on notifications so you don't miss a check-in — your browser may ask to confirm.
              </p>
            )}
            <button
              onClick={() => navigate('/student/class')}
              className="btn btn-primary btn-block"
              style={{ marginBottom: '10px' }}
            >
              Go to my class
            </button>
            <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: joinCode.trim() ? '24px' : 0 }}>
              We'll notify you when your teacher sends a check-in.
            </p>
            {joinCode.trim() && (
              <ClassJoinQR joinCode={joinCode.trim().toUpperCase()} className={className} />
            )}
          </>
        )}

        {status === 'rejected' && (
          <>
            <h2 style={{ margin: '16px 0 8px', fontSize: '20px' }}>Request not approved</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              Your teacher did not approve your join request for <strong style={{ color: 'var(--text)' }}>{className}</strong>.
              Please check with your teacher if you think this is a mistake.
            </p>
            <button
              onClick={() => { setSubmitted(false); setJoinCode(''); setStudentName(''); setError(null) }}
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
            >
              Try again
            </button>
          </>
        )}

        {status === 'queued' && (
          <>
            <h2 style={{ margin: '16px 0 8px', fontSize: '20px' }}>You're on the waitlist</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              <strong style={{ color: 'var(--text)' }}>{className}</strong> is currently full — your request is queued.
              You'll be added automatically when a spot opens up.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '12px' }}>Checking for updates automatically…</p>
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
            <h2 style={{ margin: '16px 0 8px', fontSize: '20px' }}>Request sent</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              Your request to join <strong style={{ color: 'var(--text)' }}>{className}</strong> is waiting for your teacher to approve it.
              This page checks automatically every few seconds.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '12px' }}>Checking for updates automatically…</p>
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
      <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: '14px' }}>
        Enter the join code your teacher shared with you.
      </p>

      <div style={{ marginBottom: '24px' }}>
        <InstallButton
          align="left"
          description="Add QuizPulse to your phone so your teacher's check-ins reach your lock screen."
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field" style={{ marginBottom: '16px' }}>
          <label>Join code</label>
          <input
            className="input"
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABCD1234"
            maxLength={8}
            autoComplete="off"
            disabled={submitting}
            style={{ fontSize: '18px', fontFamily: 'var(--mono)', letterSpacing: '2px', textTransform: 'uppercase' }}
          />
        </div>

        <div className="field" style={{ marginBottom: '16px' }}>
          <label>Your name</label>
          <input
            className="input"
            type="text"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
            placeholder="As your teacher knows you"
            maxLength={STUDENT_NAME_MAX}
            disabled={submitting}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary btn-block"
          style={{ justifyContent: 'center', padding: '14px' }}
        >
          {submitting ? 'Sending request…' : 'Request to join'}
        </button>
      </form>
    </div>
  )
}

export default JoinClass
