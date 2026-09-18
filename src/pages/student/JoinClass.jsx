import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import API_BASE from '../../api'
import InstallButton from '../../components/InstallButton'
import ClassJoinQR from '../../components/ClassJoinQR'
import LegalFooter from '../../components/LegalFooter'
import { getApprovedClasses, addApprovedClass, getPendingClasses, addPendingClass, removePendingClass, reconcileApprovals } from '../../studentClasses'
import { autoSubscribe } from '../../pushSubscribe'
import { createDeviceId, getDeviceId } from '../../deviceId'
import { JOIN_NOTICE_SHORT, COLLECTION_NOTICE_VERSION, isLegalPending } from '../../data/legalContent'
import BrandMark from '../../components/BrandMark'

const STUDENT_NAME_MAX = 80

// R3: the collection notice on the join form. When the reviewer hasn't supplied wording yet
// (isLegalPending), we DON'T render the raw "[LEGAL TEXT PENDING]" marker and we DON'T record that
// a notice was shown — a neutral line links to the (also-pending) collection-notice page, and the
// POST omits noticeVersion (server stores null, D3.7). Joining is never blocked by a passive notice.
const NOTICE_PENDING = isLegalPending(JOIN_NOTICE_SHORT)

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
  const knownClasses = getApprovedClasses()

  // On load, reconcile any request the teacher decided while this device's tab was closed. This is
  // the fix for the dead-end: without it, an approved student who didn't keep the original tab open
  // has no client-side path back into the class.
  useEffect(() => {
    if (getPendingClasses().length === 0) return
    const deviceId = getDeviceId() // a pending record implies a prior submit → id exists
    if (!deviceId) { setReconciling(false); return }
    let cancelled = false
    ;(async () => {
      await reconcileApprovals(deviceId, API_BASE)
      if (cancelled) return
      // R3 (D3.6): notifications are NO LONGER auto-enabled on reconcile. The student turns them on
      // with an explicit button (approval screen here, or /student/class) — the tap supplies the
      // user gesture Safari requires and follows the explanation.
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
    const deviceId = getDeviceId()
    if (!deviceId) return

    pollRef.current = setInterval(async () => {
      try {
        // R3 (audit #9): the device id travels in the X-Device-Id header, never a query string
        // (request logs keep query strings). classId stays in the query — it isn't sensitive.
        const res = await fetch(`${API_BASE}/join-request/status?classId=${encodeURIComponent(classId)}`, {
          headers: { 'X-Device-Id': deviceId },
        })
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
  }, [submitted, requestId, classId, status])

  // Fires once the student is approved: persists the class locally (fixes the dead-end — this
  // is what lets /student/class and /join's "Continue to my class" shortcut recognise the device
  // later). R3 (D3.6): push is NO LONGER auto-enabled here — the student turns it on with the
  // explicit button below, after the one-line explanation, so the browser prompt follows a gesture.
  useEffect(() => {
    if (status !== 'approved' || !classId) return
    addApprovedClass(classId, className, joinCode.trim().toUpperCase() || undefined)
    removePendingClass(classId)
  }, [status, classId, className, joinCode])

  // D3.6 — explicit, button-triggered notification opt-in. The tap is the user gesture Safari
  // requires, and it follows the explanation line. autoSubscribe never throws; denied/unsupported
  // are soft states shown as copy, not error banners.
  async function turnOnNotifications() {
    const deviceId = getDeviceId()
    if (!deviceId) return
    setSubscribeState('priming')
    setSubscribeState(await autoSubscribe(classId, deviceId))
  }

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

    // R3 (audit B2): the permanent device id is minted HERE — the first time a student actually
    // submits the join form — never on a page view before any notice. createDeviceId is idempotent.
    const deviceId = createDeviceId()

    try {
      const res = await fetch(`${API_BASE}/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // noticeVersion records which collection-notice version the student was shown. Omitted
        // while wording is still pending (server stores null, D3.7) so we never claim a real
        // notice was shown when only a placeholder existed.
        body: JSON.stringify({
          joinCode: code,
          studentName: name,
          deviceId,
          ...(NOTICE_PENDING ? {} : { noticeVersion: COLLECTION_NOTICE_VERSION }),
        }),
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

            {/* D3.6 — explicit notification opt-in. Primary action: it's the product's main way of
                reaching students. One line of what-and-why before the button, and a plain
                "you can turn it off" reassurance. */}
            {subscribeState !== 'subscribed' && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '10px', lineHeight: '1.6' }}>
                  Turn on notifications so you know the moment your teacher sends a check-in. You can
                  turn them off any time on your class page.
                </p>
                <button
                  onClick={turnOnNotifications}
                  disabled={subscribeState === 'priming'}
                  className="btn btn-primary btn-block"
                  style={{ justifyContent: 'center' }}
                >
                  {subscribeState === 'priming' ? 'Turning on…' : 'Turn on notifications'}
                </button>
                {subscribeState === 'denied' && (
                  <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '8px', lineHeight: '1.6' }}>
                    Notifications are turned off in your browser. You can allow them in your browser
                    settings, or just open your class page to see new check-ins.
                  </p>
                )}
                {subscribeState === 'unsupported' && (
                  <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '8px', lineHeight: '1.6' }}>
                    This device can't show notifications here — open your class page to see new check-ins.
                  </p>
                )}
                {subscribeState === 'error' && (
                  <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '8px', lineHeight: '1.6' }}>
                    Couldn't turn notifications on just now — you can try again from your class page.
                  </p>
                )}
              </div>
            )}
            {subscribeState === 'subscribed' && (
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
                Notifications are on — we'll let you know when a check-in arrives.
              </p>
            )}

            <button
              onClick={() => navigate('/student/class')}
              className="btn btn-secondary btn-block"
              style={{ justifyContent: 'center', marginBottom: joinCode.trim() ? '24px' : 0 }}
            >
              Go to my class
            </button>
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
      <div style={{ textAlign: 'center', marginBottom: '24px' }}><BrandMark size={44} /></div>
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
          <label htmlFor="join-code">Join code</label>
          <input
            id="join-code"
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
          <label htmlFor="student-name">Your name</label>
          <input
            id="student-name"
            className="input"
            type="text"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
            placeholder="As your teacher knows you"
            maxLength={STUDENT_NAME_MAX}
            disabled={submitting}
          />
        </div>

        {/* R3 collection notice — plain, ≤2 sentences, below the fields (so the form leads with
            the action, not a legal wall). When wording is still pending we show a neutral line, not
            the raw marker. The link always points to the collection-notice page. */}
        <p style={{ color: 'var(--muted)', fontSize: '12px', margin: '0 0 12px', lineHeight: '1.6' }}>
          {NOTICE_PENDING
            ? 'How we look after your info is being finalised.'
            : JOIN_NOTICE_SHORT.text}{' '}
          <Link to="/collection-notice" style={{ color: 'var(--primary)' }}>How we look after your info</Link>
        </p>

        {error && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>
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

      <LegalFooter />
    </div>
  )
}

export default JoinClass
