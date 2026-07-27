import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../api'
import useWindowWidth from '../hooks/useWindowWidth'
import useStagedPending from '../hooks/useStagedPending'
import { FOUR_CELL, MISCONCEPTION_BG, MISCONCEPTION_BORDER } from '../data/fourCell'

// v4.6.0 Task 4 — shown once, right after onboarding (independent of profile completion — an
// early quitter of the profile wizard still gets this). Two lanes: a one-tap practice quiz
// (calls the server-orchestrated first-run chain) or starting from a real worksheet. Skip is a
// small muted text link, never a button (design D5).

const PENDING_STAGES = [
  { afterMs: 0, text: 'Setting up your practice class…' },
  { afterMs: 1800, text: 'Sending to 24 students…' },
  { afterMs: 4000, text: 'Reading their answers…' },
]

function FirstRunFinale() {
  const navigate = useNavigate()
  const width = useWindowWidth()
  const isMobile = width < 1024

  const [stage, setStage] = useState('choice') // choice | loading | result | error
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null) // { quizId, totalResponses, questions[], totalConfidentButIncorrect }
  const stageText = useStagedPending(stage === 'loading', PENDING_STAGES)

  async function runReadyMade() {
    setStage('loading')
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/onboarding/first-run`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setStage('error')
        return
      }
      const analyticsRes = await fetch(`${API_BASE}/analytics?quizId=${data.quizId}`)
      const analytics = await analyticsRes.json()
      const questions = analyticsRes.ok ? (analytics.questions || []) : []
      const totalConfidentButIncorrect = questions.reduce((s, q) => s + (q.confidentButIncorrect || 0), 0)
      setResult({
        quizId: data.quizId,
        totalResponses: analyticsRes.ok ? analytics.totalResponses : null,
        questions,
        totalConfidentButIncorrect,
      })
      setStage('result')
    } catch {
      setError('Could not connect to the server. Please try again.')
      setStage('error')
    }
  }

  if (stage === 'loading') {
    return (
      <div style={{ maxWidth: 480, margin: '120px auto', padding: '32px', textAlign: 'center' }}>
        <div role="status" aria-live="polite" style={{ padding: '14px 18px', background: 'var(--surface2)', border: 'var(--bw) solid var(--border)', borderRadius: '10px', fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>
          {stageText}
        </div>
      </div>
    )
  }

  if (stage === 'result' && result) {
    const agg = FOUR_CELL.reduce((acc, cell) => {
      acc[cell.key] = result.questions.reduce((s, q) => s + (q.fourCell?.[cell.key] || 0), 0)
      return acc
    }, {})
    const aggTotal = Object.values(agg).reduce((a, b) => a + b, 0)

    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 24px 48px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Your practice results are in</h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px' }}>
          {result.totalResponses ?? 24} practice students answered your quiz — here's what happened.
        </p>

        {result.totalConfidentButIncorrect > 0 && (
          <div
            data-testid="finale-misconception-hero"
            style={{ background: MISCONCEPTION_BG, border: `2px solid ${MISCONCEPTION_BORDER}`, borderRadius: '12px', padding: '18px 20px', marginBottom: '20px' }}
          >
            <div style={{ fontSize: '12px', color: MISCONCEPTION_BORDER, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: 700 }}>
              Misconception signal
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#5A2416' }}>
              {result.totalConfidentButIncorrect === 1
                ? '1 answer was confident but wrong.'
                : `${result.totalConfidentButIncorrect} answers were confident but wrong.`}
            </div>
            <div style={{ fontSize: '13px', color: '#7A3B28', marginTop: '4px' }}>
              This is what QuizPulse surfaces automatically — students who feel sure but got it wrong.
            </div>
          </div>
        )}

        {aggTotal > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', border: '1px solid #eee', marginBottom: '10px' }}>
              {FOUR_CELL.map((cell) => {
                const count = agg[cell.key] || 0
                const w = (count / aggTotal) * 100
                return w > 0 ? <div key={cell.key} style={{ width: `${w}%`, background: cell.border }} title={`${cell.label}: ${count}`} /> : null
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {FOUR_CELL.map((cell) => {
                const count = agg[cell.key] || 0
                const percent = aggTotal > 0 ? Math.round((count / aggTotal) * 100) : 0
                return (
                  <div key={cell.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: cell.bg, border: `1px solid ${cell.border}`, borderRadius: '6px' }}>
                    <span style={{ fontSize: '12px', color: cell.border, flex: 1 }}>{cell.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: cell.border }}>{count} ({percent}%)</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            data-testid="finale-see-full-results"
            onClick={() => navigate(`/teacher/analytics/${result.quizId}`)}
            style={{ flex: 1, minWidth: '160px', padding: '14px 18px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
          >
            See full results
          </button>
          <button
            data-testid="finale-continue"
            onClick={() => navigate('/teacher/create')}
            style={{ flex: 1, minWidth: '160px', padding: '14px 18px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--primary)', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
          >
            Continue to your account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 24px 48px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>See QuizPulse in action</h1>
      <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px' }}>
        Try it with a practice class first, or start building from your own material.
      </p>

      {error && stage === 'error' && (
        <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '16px', fontWeight: 600 }}>{error}</p>
      )}

      <button
        data-testid="finale-ready-made"
        onClick={runReadyMade}
        style={{
          width: '100%', textAlign: 'left', padding: '20px 22px', marginBottom: '14px',
          background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '14px',
          fontSize: '16px', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Use a ready-made quiz
        <div style={{ fontSize: '13px', fontWeight: 400, opacity: 0.85, marginTop: '4px' }}>
          We'll send a short practice quiz to 24 practice students and show you the results — takes a few seconds.
        </div>
      </button>

      {isMobile ? (
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 20px' }}>
          Want to build from your own worksheet instead? Do that later from a computer.
        </p>
      ) : (
        <button
          data-testid="finale-worksheet"
          onClick={() => navigate('/teacher/generate')}
          style={{
            width: '100%', textAlign: 'left', padding: '18px 20px', marginBottom: '20px',
            background: 'white', color: 'inherit', border: 'var(--bw) solid var(--border)', borderRadius: '14px',
            fontSize: '15px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Start from your worksheet
          <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--muted)', marginTop: '4px' }}>
            Upload a document and we'll draft questions from it for you to review.
          </div>
        </button>
      )}

      <button
        data-testid="finale-skip"
        onClick={() => navigate('/teacher/create')}
        style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '13px', textDecoration: 'underline', cursor: 'pointer' }}
      >
        Skip for now
      </button>
    </div>
  )
}

export default FirstRunFinale
