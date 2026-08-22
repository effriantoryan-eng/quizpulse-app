import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import API_BASE from '../../api'
import { queueResponse, registerResponseSync } from '../../offlineQueue'
import ENCOURAGEMENTS from '../../data/encouragements'
import { tallyConfidence, tallySummaryText } from '../../data/confidenceTally'

// Decision: all questions render on one screen rather than one-at-a-time. These are short
// (≤20 question) low-stakes formative quizzes, so a single scrollable page lets students see
// progress and review answers before submitting, and it avoids extra round trips on flaky
// school wifi — the questions are fetched once up front.

const CONFIDENCE_KEY = 'quizpulse_confidence_explained'
const DEVICE_ID_KEY = 'quizpulse_device_id'
// Per-quiz "this device already submitted" flag. The device UUID IS the student identity,
// so a local flag matches the server's duplicate check for the same device; if storage is
// cleared the server's 409 still catches the duplicate at submit.
const submittedKey = (quizId) => `quizpulse_submitted_${quizId}`

// Confidence levels shown to students — plain language, no score implication.
const CONFIDENCE_LEVELS = [
  { value: 'sure', label: 'Sure' },
  { value: 'pretty_sure', label: 'Pretty sure' },
  { value: 'guessing', label: 'Just guessing' },
]

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

// One-time explainer shown before the student's first confidence rating.
function ConfidenceExplainer({ onDone }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: '24px',
    }}>
      <div style={{
        background: 'var(--surface)', border: 'var(--bw) solid var(--border)', padding: '28px 24px',
        maxWidth: '380px', width: '100%', textAlign: 'center',
      }}>
        <h2 style={{ margin: '0 0 10px', fontSize: '18px', color: 'var(--text)' }}>
          How sure are you?
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6' }}>
          After each answer, tap how confident you feel — not to grade you, just so your teacher
          can see which topics to spend more time on.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {CONFIDENCE_LEVELS.map(({ label }) => (
            <div key={label} style={{
              padding: '10px 14px',
              border: 'var(--bw) solid var(--border)', fontSize: '14px', color: 'var(--text)',
              background: 'var(--surface2)',
            }}>
              {label}
            </div>
          ))}
        </div>
        <button onClick={onDone} className="btn btn-primary btn-block">
          Got it
        </button>
      </div>
    </div>
  )
}

// 3-button confidence selector for a single question.
function ConfidenceSelector({ questionId, value, onChange }) {
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>How sure are you?</div>
      <div className="seg" style={{ width: '100%' }}>
        {CONFIDENCE_LEVELS.map(({ value: cv, label }) => {
          const selected = value === cv
          return (
            <button
              key={cv}
              onClick={() => onChange(questionId, cv)}
              className={`seg-opt${selected ? ' active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TakeQuiz() {
  const [searchParams] = useSearchParams()
  const quizId = searchParams.get('quizId')
  const studentId = getOrCreateDeviceId()

  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})      // questionId -> selectedIndex
  const [confidence, setConfidence] = useState({}) // questionId -> confidence value
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [closed, setClosed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [outcome, setOutcome] = useState(null) // null | 'submitted' | 'already' | 'offline'
  const [showExplainer, setShowExplainer] = useState(false)
  // The just-submitted answers, kept only to render the T5 completion confidence summary — never
  // re-sent, never persisted beyond this render.
  const [submittedAnswers, setSubmittedAnswers] = useState(null)

  // Timing: quiz start time (mount) for quizDurationMs; per-question first-interaction time.
  const quizStartRef = useRef(null)
  const questionFirstInteractRef = useRef({}) // questionId -> timestamp of first option tap

  const encouragement = useMemo(
    () => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)],
    []
  )

  useEffect(() => {
    quizStartRef.current = Date.now()

    // Show explainer once per device, before the student's first confidence rating.
    if (!localStorage.getItem(CONFIDENCE_KEY)) {
      setShowExplainer(true)
    }
  }, [])

  useEffect(() => {
    if (!quizId) return

    // Already submitted from this device — go straight to the done screen instead of
    // making the student re-answer everything only to hit the duplicate check at submit.
    if (localStorage.getItem(submittedKey(quizId))) {
      setOutcome('already')
      setLoading(false)
      return
    }

    async function load() {
      try {
        const quizRes = await fetch(`${API_BASE}/quizzes/${quizId}`)
        if (quizRes.status === 404) throw new Error('Quiz not found.')
        if (!quizRes.ok) throw new Error('Something went wrong. Please try again.')
        const quizData = await quizRes.json()
        setQuiz(quizData)

        if (quizData.closedAt && new Date(quizData.closedAt).getTime() < Date.now()) {
          setClosed(true)
          setLoading(false)
          return
        }

        const questionsRes = await fetch(`${API_BASE}/quizzes/${quizId}/questions`)
        if (!questionsRes.ok) throw new Error('Something went wrong. Please try again.')
        const questionsData = await questionsRes.json()
        setQuestions(questionsData)
      } catch (err) {
        setLoadError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [quizId])

  function handleExplainerDone() {
    localStorage.setItem(CONFIDENCE_KEY, '1')
    setShowExplainer(false)
  }

  function selectAnswer(questionId, index) {
    // Record first interaction time for this question (used as responseTimeMs start).
    if (!questionFirstInteractRef.current[questionId]) {
      questionFirstInteractRef.current[questionId] = Date.now()
    }
    setAnswers(prev => ({ ...prev, [questionId]: index }))
  }

  function selectConfidence(questionId, value) {
    setConfidence(prev => ({ ...prev, [questionId]: value }))
  }

  const allAnswered = questions.length > 0 && questions.every(q =>
    answers[q.id] !== undefined && confidence[q.id] !== undefined
  )

  async function handleSubmit() {
    setSubmitError(null)
    setSubmitting(true)

    const now = Date.now()
    const quizDurationMs = quizStartRef.current ? now - quizStartRef.current : undefined

    // Build answers with confidence + responseTimeMs.
    // responseTimeMs proxy: time from first option tap to confidence selection for each question.
    // Since all questions are on one screen, this measures engagement-to-commitment per question,
    // not time-to-first-view. It is a noisy signal; aggregate patterns matter, not individual readings.
    const answersPayload = questions.map(q => {
      const firstInteract = questionFirstInteractRef.current[q.id]
      const responseTimeMs = firstInteract ? Math.max(0, now - firstInteract) : undefined
      return {
        questionId: q.id,
        selectedIndex: answers[q.id],
        confidence: confidence[q.id],
        ...(responseTimeMs !== undefined && { responseTimeMs }),
      }
    })

    const payload = {
      quizId,
      studentId,
      answers: answersPayload,
      ...(quizDurationMs !== undefined && { quizDurationMs }),
    }

    try {
      const res = await fetch(`${API_BASE}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.status === 201) {
        localStorage.setItem(submittedKey(quizId), '1')
        setSubmittedAnswers(answersPayload)
        setOutcome('submitted')
        return
      }
      if (res.status === 409) {
        localStorage.setItem(submittedKey(quizId), '1')
        setOutcome('already')
        return
      }
      if (res.status === 410) {
        setClosed(true)
        return
      }
      if (res.status === 403) {
        setSubmitError("You don't have access to this quiz. Make sure your join request was approved.")
        return
      }

      const data = await res.json().catch(() => ({}))
      setSubmitError(data.error || 'Something went wrong. Please try again.')
    } catch {
      // Network failure — queue for Background Sync and tell the student it's safe to leave.
      await queueResponse({ id: crypto.randomUUID(), ...payload, createdAt: new Date().toISOString() })
      await registerResponseSync()
      setOutcome('offline')
    } finally {
      setSubmitting(false)
    }
  }

  if (!quizId) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Couldn't load this quiz</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No quiz specified.</p>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Loading quiz…</div>
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Couldn't load this quiz</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{loadError}</p>
      </div>
    )
  }

  if (closed) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>This quiz has closed.</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Ask your teacher if you think this is a mistake.</p>
      </div>
    )
  }

  if (outcome === 'submitted') {
    // v4.7.0 T5 — the student's own confidence mix from the submission just sent, plus plain
    // "what happens next" copy. Participation-framed only: no score, no right/wrong count (house
    // rule — creature/room design non-negotiables carry over to any student-facing summary).
    const tally = tallyConfidence(submittedAnswers || [])
    const summary = tallySummaryText(tally)
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>All done — your answers have been sent to your teacher.</h2>

        {summary && (
          <div style={{ marginTop: '20px', border: 'var(--bw) solid var(--border)', padding: '16px', textAlign: 'left' }}>
            <div className="bp-label" style={{ marginBottom: '6px' }}>How you felt about it</div>
            <div style={{ fontFamily: 'var(--heading)', fontWeight: 800, fontSize: '17px', marginBottom: '10px' }}>{summary}</div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: '1.6' }}>
              Your teacher goes through the answers in class.
              {tally.guessing > 0 && ' The one you marked as a guess is a good one to ask about.'}
            </p>
          </div>
        )}

        <p
          data-testid="encouragement-line"
          style={{ fontSize: '15px', color: 'var(--primary)', fontStyle: 'italic', marginTop: '16px', lineHeight: '1.6' }}
        >
          {encouragement}
        </p>
      </div>
    )
  }

  if (outcome === 'already') {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>You have already submitted this quiz.</h2>
      </div>
    )
  }

  if (outcome === 'offline') {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Saved — will submit when you reconnect.</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>You can close this page. Your answers are stored on this device.</p>
      </div>
    )
  }

  return (
    <>
      {showExplainer && <ConfidenceExplainer onDone={handleExplainerDone} />}

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>{quiz?.name}</h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
          {questions.length} question{questions.length !== 1 ? 's' : ''}
        </p>

        {questions.map((q, qi) => (
          <div key={q.id} style={{ background: 'var(--surface)', border: 'var(--bw) solid var(--border)', padding: '18px', marginBottom: '16px' }}>
            <div className="bp-label" style={{ marginBottom: '8px' }}>
              Question {qi + 1}
            </div>
            <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '14px' }}>{q.text}</div>

            {(q.options || []).map((opt, i) => {
              const isSelected = answers[q.id] === i
              return (
                <label
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', marginBottom: '8px',
                    border: `var(--bw) solid ${isSelected ? 'var(--primary)' : 'var(--surface2)'}`,
                    background: isSelected ? 'var(--surface2)' : 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={isSelected}
                    onChange={() => selectAnswer(q.id, i)}
                  />
                  <span style={{ fontSize: '14px' }}>{opt}</span>
                </label>
              )
            })}

            {answers[q.id] !== undefined && (
              <ConfidenceSelector
                questionId={q.id}
                value={confidence[q.id]}
                onChange={selectConfidence}
              />
            )}
          </div>
        ))}

        {submitError && (
          <div style={{ padding: '10px 14px', background: 'var(--dangerBg)', border: 'var(--bw) solid var(--danger)', fontSize: '13px', color: 'var(--danger)', marginBottom: '16px' }}>
            {submitError}
          </div>
        )}

        <button
          disabled={!allAnswered || submitting}
          onClick={handleSubmit}
          className="btn btn-primary btn-block"
          style={{ justifyContent: 'center', padding: '14px' }}
        >
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
    </>
  )
}

export default TakeQuiz
