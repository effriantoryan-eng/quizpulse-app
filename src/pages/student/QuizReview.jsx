import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import API_BASE from '../../api'
import ENCOURAGEMENTS from '../../data/encouragements'
import { readSubmitted } from '../../data/submittedAnswers'
import { CONFIDENCE_LABELS } from '../../data/confidenceTally'

// Two student-facing modes over the same question display, deliberately kept OUT of TakeQuiz so
// none of its submit / offline-queue / duplicate-gate machinery is touched:
//   mode="review"   — read-only recap of the student's OWN saved choices + confidence. Never the
//                     correct answer, never a score (house rule). Reads device-local storage only.
//   mode="practice" — re-answer a closed quiz just for yourself. Nothing is submitted, nothing is
//                     stored, the teacher never sees it. Pure retrieval practice.
// Questions come from the existing GET /api/quizzes/{id}/questions, which already strips
// correctIndex — so a correct answer can't leak even by accident.

const box = { maxWidth: 600, margin: '0 auto', padding: '24px' }
const centered = { maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }

function pickEncouragement() {
  return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
}

function OptionRow({ opt, marked, markLabel, interactive, selected, onSelect }) {
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } } : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        padding: '10px 12px', marginBottom: '8px',
        border: `var(--bw) solid ${(marked || selected) ? 'var(--primary)' : 'var(--surface2)'}`,
        background: (marked || selected) ? 'var(--surface2)' : 'var(--surface)',
        cursor: interactive ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: '14px' }}>{opt}</span>
      {marked && <span className="tag tag-accent" style={{ flexShrink: 0 }}>{markLabel}</span>}
    </div>
  )
}

export default function QuizReview({ mode }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const quizId = params.get('quizId')
  const isPractice = mode === 'practice'
  const quizName = location.state?.name || null

  const [questions, setQuestions] = useState(null)
  const [error, setError] = useState(null) // 'transient' | 'gone'
  const [reloadKey, setReloadKey] = useState(0)

  // Review reads the student's own saved payload; practice never does.
  const saved = !isPractice && quizId ? readSubmitted(quizId) : null

  // Practice-only local state.
  const [picks, setPicks] = useState({})
  const [done, setDone] = useState(false)
  const [encouragement] = useState(pickEncouragement)

  useEffect(() => {
    if (!quizId) return
    let cancelled = false
    setError(null)
    setQuestions(null)
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/quizzes/${quizId}/questions`)
        if (res.status === 404) { if (!cancelled) setError('gone'); return }
        if (!res.ok) { if (!cancelled) setError('transient'); return }
        const data = await res.json()
        if (!cancelled) setQuestions(data)
      } catch {
        if (!cancelled) setError('transient')
      }
    })()
    return () => { cancelled = true }
  }, [quizId, reloadKey])

  if (!quizId) {
    return (
      <div style={centered}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Nothing to show</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No quiz was specified.</p>
      </div>
    )
  }

  if (error === 'gone') {
    return (
      <div style={centered}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>This quiz isn't available anymore</h2>
        <button onClick={() => navigate('/student/class')} className="btn btn-primary">Back to my class</button>
      </div>
    )
  }

  if (error === 'transient') {
    return (
      <div style={centered}>
        <p style={{ color: 'var(--text)', fontSize: '14px', marginBottom: '12px' }}>Couldn't load — try again</p>
        <button onClick={() => setReloadKey(k => k + 1)} className="btn btn-primary">Retry</button>
      </div>
    )
  }

  if (questions === null) {
    return <div style={{ ...centered, color: 'var(--muted)', fontSize: '14px' }}>Loading…</div>
  }

  // Review mode with no saved detail (legacy '1' flag, or storage cleared): be honest, and offer
  // the practice path as a recovery so the student isn't fully dead-ended.
  if (!isPractice && !saved) {
    return (
      <div style={centered}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>This one's done</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
          The details weren't saved on this device, so there's nothing to look back on here.
        </p>
        {questions.length > 0 && (
          <button
            onClick={() => navigate(`/quiz/practice?quizId=${quizId}`, { state: { name: quizName } })}
            className="btn btn-primary"
          >
            Try it yourself instead
          </button>
        )}
      </div>
    )
  }

  if (isPractice && questions.length === 0) {
    return (
      <div style={centered}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Nothing to practice here anymore</h2>
        <button onClick={() => navigate('/student/class')} className="btn btn-primary">Back to my class</button>
      </div>
    )
  }

  // Practice completion — retrieval practice only, so no score and no right/wrong, same house rule.
  if (isPractice && done) {
    return (
      <div style={centered}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Nice — you ran through it again.</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
          Going over it a second time helps it stick, even without a mark.
        </p>
        <p data-testid="encouragement-line" style={{ fontSize: '15px', color: 'var(--primary)', fontStyle: 'italic', marginTop: '16px' }}>
          {encouragement}
        </p>
        <div style={{ marginTop: '20px' }}>
          <button onClick={() => navigate('/student/class')} className="btn btn-secondary">Back to my class</button>
        </div>
      </div>
    )
  }

  const savedByQ = {}
  if (saved) for (const a of saved.answers) savedByQ[a.questionId] = a

  return (
    <div style={box}>
      <button
        onClick={() => navigate('/student/class')}
        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '8px 0', marginBottom: '8px' }}
      >
        ← My class
      </button>

      <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>
        {isPractice ? (quizName || 'Practice') : 'What you thought'}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
        {isPractice
          ? 'Just for you — nothing gets sent to your teacher.'
          : `${quizName ? quizName + ' — ' : ''}your own answers. No score here, just what you picked.`}
      </p>

      {questions.map((q, qi) => {
        const savedA = savedByQ[q.id]
        return (
          <div key={q.id} style={{ background: 'var(--surface)', border: 'var(--bw) solid var(--border)', padding: '18px', marginBottom: '16px' }}>
            <div className="bp-label" style={{ marginBottom: '8px' }}>Question {qi + 1}</div>
            <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '14px' }}>{q.text}</div>

            {(q.options || []).map((opt, i) => (
              <OptionRow
                key={i}
                opt={opt}
                interactive={isPractice}
                selected={isPractice && picks[q.id] === i}
                marked={!isPractice && savedA && savedA.selectedIndex === i}
                markLabel="You chose"
                onSelect={() => setPicks(p => ({ ...p, [q.id]: i }))}
              />
            ))}

            {!isPractice && savedA && savedA.confidence && (
              <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--muted)' }}>
                You were: <span className="tag tag-neutral">{CONFIDENCE_LABELS[savedA.confidence] || savedA.confidence}</span>
              </div>
            )}
          </div>
        )
      })}

      {!isPractice && (
        <button
          onClick={() => navigate(`/quiz/practice?quizId=${quizId}`, { state: { name: quizName } })}
          className="btn btn-secondary btn-block"
          style={{ justifyContent: 'center', padding: '14px' }}
        >
          Try it again yourself
        </button>
      )}

      {isPractice && (
        <button
          onClick={() => setDone(true)}
          className="btn btn-primary btn-block"
          style={{ justifyContent: 'center', padding: '14px' }}
        >
          Done
        </button>
      )}
    </div>
  )
}
