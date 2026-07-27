import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../../api'
import InstallButton from '../../components/InstallButton'
import { getApprovedClasses, getPendingClasses, reconcileApprovals } from '../../studentClasses'

const DEVICE_ID_KEY = 'quizpulse_device_id'
const submittedKey = (quizId) => `quizpulse_submitted_${quizId}`

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function QuizCard({ quiz, onOpen }) {
  const closed = quiz.closedAt && new Date(quiz.closedAt).getTime() < Date.now()
  const answered = !!localStorage.getItem(submittedKey(quiz.id))

  const tappable = !closed && !answered
  return (
    <div
      role={tappable ? 'button' : undefined}
      tabIndex={tappable ? 0 : undefined}
      onClick={tappable ? () => onOpen(quiz.id) : undefined}
      onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(quiz.id) } : undefined}
      style={{
        background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '12px',
        padding: '18px', marginBottom: '12px', minHeight: '44px',
        cursor: tappable ? 'pointer' : 'default',
        opacity: 1, // full-contrast even when closed — meaning never rides on hue alone
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '600' }}>{quiz.name}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            {quiz.questionCount} question{quiz.questionCount !== 1 ? 's' : ''}
          </div>
        </div>
        {answered && (
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#085041', background: '#E1F5EE', padding: '4px 10px', borderRadius: '999px' }}>
            ✅ Answered
          </span>
        )}
        {closed && !answered && (
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#555', background: '#eee', padding: '4px 10px', borderRadius: '999px' }}>
            Closed
          </span>
        )}
      </div>
      {tappable && (
        <div style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '500', marginTop: '10px' }}>
          Tap to start →
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

  const open = (quizzes || []).filter(q => !q.closedAt || new Date(q.closedAt).getTime() >= Date.now())
  const closedOrDone = (quizzes || []).filter(q => q.closedAt && new Date(q.closedAt).getTime() < Date.now())

  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>You're in <strong>{cls.className || 'your class'}</strong></div>
        <button
          onClick={load}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', padding: '8px' }}
        >
          Refresh
        </button>
      </div>

      {quizzes === null && !error && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Loading…</div>
      )}

      {error === 'transient' && (
        <div style={{ maxWidth: 480, textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
          <p style={{ color: '#555', fontSize: '14px', marginBottom: '12px' }}>Couldn't load — try again</p>
          <button onClick={load} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {error === 'unavailable' && (
        <div style={{ maxWidth: 480, textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔒</div>
          <p style={{ color: '#555', fontSize: '14px' }}>
            You're no longer in this class. Ask your teacher if this seems wrong, or join a class again.
          </p>
        </div>
      )}

      {quizzes !== null && !error && quizzes.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '14px', background: '#fafafa', border: 'var(--bw) solid var(--border)', borderRadius: '12px' }}>
          No check-ins right now — you're all caught up. Your teacher will send one when it's time, and you'll get a notification.
        </div>
      )}

      {open.map(q => (
        <QuizCard key={q.id} quiz={q} onOpen={(id) => navigate(`/quiz?quizId=${id}`)} />
      ))}
      {closedOrDone.map(q => (
        <QuizCard key={q.id} quiz={q} onOpen={(id) => navigate(`/quiz?quizId=${id}`)} />
      ))}
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
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center', color: '#888', fontSize: '14px' }}>
        Checking…
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '16px' }}>🔍</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>No class found on this device</h2>
        <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px' }}>
          Join a class with the code your teacher gave you.
        </p>
        <button
          onClick={() => navigate('/join')}
          style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
        >
          Join a class
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px' }}>
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
