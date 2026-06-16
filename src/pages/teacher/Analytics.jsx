import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import API_BASE from '../../api'

const OPTION_COLORS = ['#E6F1FB', '#EEEDFE', '#FAEEDA', '#FBEAF0']
const OPTION_BORDER = ['#185FA5', '#534AB7', '#633806', '#4B1528']
const CORRECT_BG = '#EAF3DE'
const CORRECT_BORDER = '#3B6D11'

const POLL_INTERVAL_MS = 3000

function Analytics() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const [hintVisible, dismissHint, showHint] = useHint('analytics')
  const [quizName, setQuizName] = useState('')
  const [classSize, setClassSize] = useState(null)
  const [totalResponses, setTotalResponses] = useState(0)
  const [questions, setQuestions] = useState([])
  const [nonResponders, setNonResponders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAnalytics() {
      try {
        const res = await fetch(`${API_BASE}/analytics?quizId=${quizId}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Server error ${res.status}`)
        }
        const data = await res.json()
        if (cancelled) return

        setQuizName(data.quizName)
        setClassSize(data.classSize ?? null)
        setTotalResponses(data.totalResponses)
        setQuestions(data.questions)
        setNonResponders(data.nonResponders || [])
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAnalytics()
    const intervalId = setInterval(fetchAnalytics, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [quizId])

  async function handleExportCsv() {
    setExporting(true)
    setExportError(null)
    try {
      const res = await fetch(`${API_BASE}/analytics/export?quizId=${quizId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Export failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quizId}_responses.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div style={{ padding: '24px', color: '#888' }}>Loading analytics...</div>
  if (error) return <div style={{ padding: '24px', color: '#A32D2D' }}>{error}</div>

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/teacher/quizzes')}
          style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#666' }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>{quizName || 'Quiz Analytics'}</h2>
          <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>Quiz ID: {quizId}</div>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={exporting}
          style={{ background: 'white', border: '1px solid #534AB7', color: '#534AB7', borderRadius: '8px', padding: '6px 12px', cursor: exporting ? 'not-allowed' : 'pointer', fontSize: '13px', flexShrink: 0 }}
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
        {!hintVisible && (
          <button onClick={showHint} style={{ background: 'none', border: '1px solid #C5C0F0', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: '#7B6EDE', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>?</button>
        )}
      </div>
      {hintVisible && (
        <HintBanner
          text="Each question shows how the class responded. The green bar is the correct answer. Use the question cards below to see the full breakdown. This page updates automatically every few seconds."
          onDismiss={dismissHint}
        />
      )}

      {exportError && (
        <div style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
          {exportError}
        </div>
      )}

      {/* Summary card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: '#534AB7', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: '600' }}>
            {classSize ? `${totalResponses} / ${classSize}` : totalResponses}
          </div>
          <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>Students responded</div>
        </div>
        <div style={{ background: '#EAF3DE', borderRadius: '12px', padding: '20px', color: '#3B6D11', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: '600' }}>{questions.length}</div>
          <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>Questions in quiz</div>
        </div>
      </div>

      {/* Per question breakdown */}
      {questions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px' }}>
          No questions found for this quiz.
        </div>
      )}

      {questions.map((q, qi) => {
        const counts = q.counts
        const total = counts.reduce((a, b) => a + b, 0)

        return (
          <div key={q.id} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            
            <div style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Question {qi + 1}
            </div>
            <div style={{ fontSize: '15px', fontWeight: '500', lineHeight: '1.5', marginBottom: '20px', color: '#1a1a1a' }}>
              {q.text}
            </div>

            {q.options.map((opt, i) => {
              const count = counts[i]
              const percent = total > 0 ? Math.round((count / total) * 100) : 0
              const isCorrect = i === q.correctIndex
              const barWidth = percent

              return (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{
                      width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '600',
                      background: isCorrect ? CORRECT_BG : OPTION_COLORS[i],
                      border: `1.5px solid ${isCorrect ? CORRECT_BORDER : OPTION_BORDER[i]}`,
                      color: isCorrect ? CORRECT_BORDER : OPTION_BORDER[i]
                    }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ flex: 1, fontSize: '13px', color: '#333' }}>{opt}</span>
                    {isCorrect && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: CORRECT_BG, color: CORRECT_BORDER, flexShrink: 0 }}>
                        Correct
                      </span>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#333', minWidth: '40px', textAlign: 'right' }}>
                      {percent}%
                    </span>
                  </div>
                  <div style={{ height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden', marginLeft: '34px' }}>
                    <div style={{
                      height: '100%', borderRadius: '4px',
                      width: `${barWidth}%`,
                      background: isCorrect ? CORRECT_BORDER : OPTION_BORDER[i],
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#aaa', marginLeft: '34px', marginTop: '2px' }}>
                    {count} response{count !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {totalResponses === 0 && questions.length > 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: '#aaa', fontSize: '14px', background: '#f8f8f8', borderRadius: '12px' }}>
          No responses yet. Students will appear here as soon as they submit.
        </div>
      )}

      {nonResponders.length > 0 && (
        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', marginTop: '8px' }}>
          <div style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Haven't responded yet ({nonResponders.length})
          </div>
          {nonResponders.map((s, i) => (
            <div key={i} style={{ fontSize: '13px', color: '#555', padding: '6px 0', borderBottom: i < nonResponders.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
              {s.studentName}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Analytics