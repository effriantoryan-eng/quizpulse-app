import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import API_BASE from '../../api'
import { queueResponse, registerResponseSync } from '../../offlineQueue'

// Decision: all questions render on one screen rather than one-at-a-time. These are short
// (≤20 question) low-stakes formative quizzes, so a single scrollable page lets students see
// progress and review answers before submitting, and it avoids extra round trips on flaky
// school wifi — the questions are fetched once up front.

function getOrCreateDeviceId() {
  const key = 'quizpulse_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

function TakeQuiz() {
  const [searchParams] = useSearchParams()
  const quizId = searchParams.get('quizId')
  const studentId = getOrCreateDeviceId()

  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({}) // questionId -> selectedIndex
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [closed, setClosed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [outcome, setOutcome] = useState(null) // null | 'submitted' | 'already' | 'offline'

  useEffect(() => {
    if (!quizId) return

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

  function selectAnswer(questionId, index) {
    setAnswers(prev => ({ ...prev, [questionId]: index }))
  }

  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id] !== undefined)

  async function handleSubmit() {
    setSubmitError(null)
    setSubmitting(true)

    const payload = {
      quizId,
      studentId,
      answers: questions.map(q => ({ questionId: q.id, selectedIndex: answers[q.id] })),
    }

    try {
      const res = await fetch(`${API_BASE}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.status === 201) {
        setOutcome('submitted')
        return
      }
      if (res.status === 409) {
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
        <div style={{ fontSize: '28px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Couldn't load this quiz</h2>
        <p style={{ color: '#555', fontSize: '14px' }}>No quiz specified.</p>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#888' }}>Loading quiz…</div>
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Couldn't load this quiz</h2>
        <p style={{ color: '#555', fontSize: '14px' }}>{loadError}</p>
      </div>
    )
  }

  if (closed) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>This quiz has closed.</h2>
        <p style={{ color: '#555', fontSize: '14px' }}>Ask your teacher if you think this is a mistake.</p>
      </div>
    )
  }

  if (outcome === 'submitted') {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Thanks for completing the quiz!</h2>
      </div>
    )
  }

  if (outcome === 'already') {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>You have already submitted this quiz.</h2>
      </div>
    )
  }

  if (outcome === 'offline') {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '16px' }}>📡</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Saved — will submit when you reconnect.</h2>
        <p style={{ color: '#555', fontSize: '14px' }}>You can close this page. Your answers are stored on this device.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>{quiz?.name}</h2>
      <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
        {questions.length} question{questions.length !== 1 ? 's' : ''}
      </p>

      {questions.map((q, qi) => (
        <div key={q.id} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
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
                  padding: '10px 12px', marginBottom: '8px', borderRadius: '8px',
                  border: `1px solid ${isSelected ? '#534AB7' : '#e0e0e0'}`,
                  background: isSelected ? '#EEEDFE33' : 'white',
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
        </div>
      ))}

      {submitError && (
        <div style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
          {submitError}
        </div>
      )}

      <button
        disabled={!allAnswered || submitting}
        onClick={handleSubmit}
        style={{
          width: '100%', padding: '12px',
          background: !allAnswered || submitting ? '#ccc' : '#534AB7',
          color: 'white', border: 'none', borderRadius: '8px',
          fontSize: '15px', fontWeight: '500',
          cursor: !allAnswered || submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit answers'}
      </button>
    </div>
  )
}

export default TakeQuiz
