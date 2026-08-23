import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../../api'
import InstallButton from '../../components/InstallButton'
import ClassJoinQR from '../../components/ClassJoinQR'
import { getApprovedClasses, getPendingClasses, reconcileApprovals } from '../../studentClasses'
import { submittedKey, gatherSubmittedPayloads } from '../../data/submittedAnswers'
import { confidenceTrend } from '../../data/confidenceTally'

const DEVICE_ID_KEY = 'quizpulse_device_id'

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

// Friendly "coming up" date — plain language, no jargon, no raw ISO strings shown to students.
function friendlyDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })
}

function QuizCard({ quiz, navigate }) {
  const scheduled = quiz.state === 'scheduled'
  const closed = quiz.state === 'closed'
  const answered = !!localStorage.getItem(submittedKey(quiz.id))

  // Answered → review your own answers (any state). Open + unanswered → take it. Closed and never
  // answered has nothing saved to review, so it stays non-tappable.
  const canReview = answered && !scheduled
  const canTake = !scheduled && !closed && !answered
  const tappable = canReview || canTake
  const open = () => {
    if (canReview) navigate(`/quiz/review?quizId=${quiz.id}`, { state: { name: quiz.name } })
    else if (canTake) navigate(`/quiz?quizId=${quiz.id}`)
  }
  return (
    <div
      role={tappable ? 'button' : undefined}
      tabIndex={tappable ? 0 : undefined}
      onClick={tappable ? open : undefined}
      onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') open() } : undefined}
      style={{
        background: 'var(--surface)', border: 'var(--bw) solid var(--border)',
        padding: '18px', marginBottom: '12px', minHeight: '44px',
        cursor: tappable ? 'pointer' : 'default',
        opacity: 1, // full-contrast even when closed/scheduled — meaning never rides on hue alone
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '600' }}>{quiz.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            {scheduled ? friendlyDate(quiz.scheduledFor) : `${quiz.questionCount} question${quiz.questionCount !== 1 ? 's' : ''}`}
          </div>
        </div>
        {answered && <span className="tag tag-neutral">Answered</span>}
        {scheduled && <span className="tag tag-accent">Not open yet</span>}
        {closed && !answered && <span className="tag tag-neutral">Closed</span>}
      </div>
      {tappable && (
        <div style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '600', marginTop: '10px' }}>
          {canReview ? 'Review your answers →' : 'Tap to start →'}
        </div>
      )}
    </div>
  )
}

function ClassSection({ cls, navigate }) {
  const [quizzes, setQuizzes] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    setQuizzes(null)
    try {
      const res = await fetch(`${API_BASE}/student/quizzes?deviceId=${encodeURIComponent(getDeviceId())}&classId=${encodeURIComponent(cls.classId)}`)
      if (!res.ok) {
        // 403 = not approved / class removed. That's permanent — retrying just 403s again,
        // so show a distinct message with no Retry loop. Everything else is transient.
        setError(res.status === 403 ? 'unavailable' : 'transient')
        return
      }
      setQuizzes(await res.json())
    } catch {
      setError('transient')
    }
  }, [cls.classId])

  useEffect(() => { load() }, [load])

  const open = (quizzes || []).filter(q => q.state === 'open')
  const comingUp = (quizzes || []).filter(q => q.state === 'scheduled')
  const closedOrDone = (quizzes || []).filter(q => q.state === 'closed')

  const list = (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: 'var(--muted)' }}>You're in <strong style={{ color: 'var(--text)' }}>{cls.className || 'your class'}</strong></div>
        <button
          onClick={load}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '8px' }}
        >
          Refresh
        </button>
      </div>

      {quizzes === null && !error && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>Loading…</div>
      )}

      {error === 'transient' && (
        <div style={{ maxWidth: 480, textAlign: 'center', padding: '24px' }}>
          <p style={{ color: 'var(--text)', fontSize: '14px', marginBottom: '12px' }}>Couldn't load — try again</p>
          <button onClick={load} className="btn btn-primary">Retry</button>
        </div>
      )}

      {error === 'unavailable' && (
        <div style={{ maxWidth: 480, textAlign: 'center', padding: '24px' }}>
          <p style={{ color: 'var(--text)', fontSize: '14px' }}>
            You're no longer in this class. Ask your teacher if this seems wrong, or join a class again.
          </p>
        </div>
      )}

      {quizzes !== null && !error && quizzes.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px', background: 'var(--surface2)', border: 'var(--bw) solid var(--border)' }}>
          No check-ins right now — you're all caught up. Your teacher will send one when it's time, and you'll get a notification.
        </div>
      )}

      {open.map(q => (
        <QuizCard key={q.id} quiz={q} navigate={navigate} />
      ))}

      {comingUp.length > 0 && (
        <>
          <div className="bp-label" style={{ marginTop: open.length > 0 ? '20px' : 0 }}>Coming up</div>
          {comingUp.map(q => (
            <QuizCard key={q.id} quiz={q} navigate={navigate} />
          ))}
        </>
      )}

      {closedOrDone.length > 0 && (
        <>
          <div className="bp-label" style={{ marginTop: (open.length > 0 || comingUp.length > 0) ? '20px' : 0 }}>Answered / closed</div>
          {closedOrDone.map(q => (
            <QuizCard key={q.id} quiz={q} navigate={navigate} />
          ))}
        </>
      )}
    </div>
  )

  return (
    <div style={{ marginBottom: '32px' }}>
      {cls.joinCode ? (
        <div className="student-class-layout">
          {list}
          <ClassJoinQR joinCode={cls.joinCode} className={cls.className} />
        </div>
      ) : list}
    </div>
  )
}

function StudentClass() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState(getApprovedClasses())
  // Only reconcile-block if we have nothing to show yet but a pending attempt to check — an
  // already-approved device renders immediately, as before.
  const [reconciling, setReconciling] = useState(
    () => getApprovedClasses().length === 0 && getPendingClasses().length > 0
  )

  // Reconcile whenever there's a pending attempt — not only when nothing is shown yet — so a
  // second class approved while the student was already in one still surfaces here. The render
  // only *blocks* on the empty case (the `reconciling` flag); an already-approved list stays
  // visible and gets any new class appended when reconcile resolves.
  useEffect(() => {
    if (getPendingClasses().length === 0) return
    let cancelled = false
    ;(async () => {
      const { approved } = await reconcileApprovals(getDeviceId(), API_BASE)
      if (cancelled) return
      setClasses(approved)
      setReconciling(false)
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (reconciling) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
        Checking…
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>No class found on this device</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
          Join a class with the code your teacher gave you.
        </p>
        <button onClick={() => navigate('/join')} className="btn btn-primary">
          Join a class
        </button>
      </div>
    )
  }

  // E1 — device-wide confidence trend across every quiz this student has done. Null (nothing
  // rendered) until there are at least 2 answered quizzes with confidence data. Participation
  // signal only, never a score.
  const trend = confidenceTrend(gatherSubmittedPayloads())

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px' }}>
      {trend && (
        <div style={{ marginBottom: '24px', padding: '14px 16px', background: 'var(--surface2)', border: 'var(--bw) solid var(--border)', fontSize: '14px', color: 'var(--text)' }}>
          {trend}
        </div>
      )}
      {classes.map(cls => (
        <ClassSection key={cls.classId} cls={cls} navigate={navigate} />
      ))}
      <div style={{ marginTop: '8px' }}>
        <InstallButton description="Add QuizPulse to your phone so your teacher's check-ins reach your lock screen." />
      </div>
    </div>
  )
}

export default StudentClass
