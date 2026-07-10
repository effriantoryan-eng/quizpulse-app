import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import API_BASE from '../../api'

const OPTION_COLORS = ['#E6F1FB', 'var(--surface2)', '#FAEEDA', '#FBEAF0']
const OPTION_BORDER = ['#185FA5', 'var(--primary)', '#633806', '#4B1528']
const CORRECT_BG = '#EAF3DE'
const CORRECT_BORDER = '#3B6D11'

// Misconception accent — one color for the signal everywhere it appears (per-question four-cell
// "incorrect, confident" segment and the promoted hero card). Deliberately NOT purple (would
// collide with the demo-pill purple below) and NOT the same amber used elsewhere — a dedicated,
// distinct accent per DESIGN_REVIEW_v400_v410_addendum.md §D5.
const MISCONCEPTION_BG = '#FBEDE8'
const MISCONCEPTION_BORDER = '#B5482E'

// Four-cell chart (v4.0.0) — correctness x confidence, always shown with visible counts/labels
// (never color- or hover-only, per §D4). incorrectConfident reuses the misconception accent.
const FOUR_CELL = [
  { key: 'correctConfident', label: 'Correct, confident', bg: '#DCEFC8', border: '#3B6D11' },
  { key: 'correctUnsure', label: 'Correct, unsure', bg: '#EEF6E4', border: '#6B9A44' },
  { key: 'incorrectConfident', label: 'Misconception', bg: MISCONCEPTION_BG, border: MISCONCEPTION_BORDER },
  { key: 'incorrectUnsure', label: 'Incorrect, unsure', bg: '#FDF3E3', border: '#B8860B' },
]

const POLL_INTERVAL_MS = 3000

// SVG line chart showing cumulative responses over time since quiz was sent.
function TimelineChart({ timeline, classSize }) {
  if (timeline.length < 2) return null

  const W = 580, H = 100, PAD_L = 36, PAD_B = 24, PAD_T = 8, PAD_R = 12
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_B - PAD_T

  const maxMinutes = timeline[timeline.length - 1].minutesElapsed || 1
  const maxCount = Math.max(classSize || 1, timeline[timeline.length - 1].cumulativeCount || 1)

  function tx(minutes) { return PAD_L + (minutes / maxMinutes) * chartW }
  function ty(count) { return PAD_T + chartH - (count / maxCount) * chartH }

  const points = timeline.map(p => `${tx(p.minutesElapsed)},${ty(p.cumulativeCount)}`).join(' ')
  const areaPoints = [
    `${tx(0)},${ty(0)}`,
    ...timeline.map(p => `${tx(p.minutesElapsed)},${ty(p.cumulativeCount)}`),
    `${tx(maxMinutes)},${ty(0)}`
  ].join(' ')

  // X-axis tick labels (every ~30 minutes, max 6 labels)
  const tickInterval = Math.ceil(maxMinutes / 6 / 30) * 30 || 5
  const xTicks = []
  for (let m = 0; m <= maxMinutes; m += tickInterval) xTicks.push(m)

  return (
    <div style={{ background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
        Response timeline
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Y gridlines */}
        {[0, 0.5, 1].map(frac => (
          <line key={frac} x1={PAD_L} y1={ty(maxCount * frac)} x2={W - PAD_R} y2={ty(maxCount * frac)}
            stroke="#f0f0f0" strokeWidth="1" />
        ))}
        {/* Y-axis labels */}
        <text x={PAD_L - 4} y={ty(maxCount) + 4} fontSize="9" fill="#bbb" textAnchor="end">{maxCount}</text>
        <text x={PAD_L - 4} y={ty(maxCount * 0.5) + 4} fontSize="9" fill="#bbb" textAnchor="end">{Math.round(maxCount * 0.5)}</text>
        <text x={PAD_L - 4} y={ty(0) + 1} fontSize="9" fill="#bbb" textAnchor="end">0</text>
        {/* Area fill */}
        <polygon points={areaPoints} fill="var(--primary)" opacity="0.08" />
        {/* Line */}
        <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinejoin="round" />
        {/* X-axis ticks */}
        {xTicks.map(m => (
          <g key={m}>
            <line x1={tx(m)} y1={PAD_T + chartH} x2={tx(m)} y2={PAD_T + chartH + 4} stroke="#ddd" strokeWidth="1" />
            <text x={tx(m)} y={H - 4} fontSize="9" fill="#bbb" textAnchor="middle">{m}m</text>
          </g>
        ))}
        {/* Axis lines */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + chartH} stroke="#e0e0e0" strokeWidth="1" />
        <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="#e0e0e0" strokeWidth="1" />
      </svg>
    </div>
  )
}

function Analytics() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const classId = searchParams.get('classId') || ''
  const [hintVisible, dismissHint, showHint] = useHint('analytics')
  const [quizName, setQuizName] = useState('')
  const [isDemo, setIsDemo] = useState(false)
  const [classSize, setClassSize] = useState(null)
  const [totalResponses, setTotalResponses] = useState(0)
  const [questions, setQuestions] = useState([])
  const [classes, setClasses] = useState([])
  const [nonResponders, setNonResponders] = useState([])
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  const classQuery = classId ? `&classId=${classId}` : ''

  useEffect(() => {
    let cancelled = false

    async function fetchAnalytics() {
      try {
        const res = await fetch(`${API_BASE}/analytics?quizId=${quizId}${classQuery}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Server error ${res.status}`)
        }
        const data = await res.json()
        if (cancelled) return

        setQuizName(data.quizName)
        setIsDemo(data.isDemo === true)
        setClassSize(data.classSize ?? null)
        setTotalResponses(data.totalResponses)
        setQuestions(data.questions)
        setClasses(data.classes || [])
        setNonResponders(data.nonResponders || [])
        setTimeline(data.timeline || [])
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
  }, [quizId, classId])

  function handleClassChange(e) {
    const next = e.target.value
    const params = {}
    if (next) params.classId = next
    setSearchParams(params, { replace: true })
  }

  async function handleExportCsv() {
    setExporting(true)
    setExportError(null)
    try {
      const res = await fetch(`${API_BASE}/analytics/export?quizId=${quizId}${classQuery}`)
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
          onClick={() => navigate(classId ? '/teacher/results' : '/teacher/quizzes')}
          style={{ background: 'none', border: 'var(--bw) solid var(--border)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#666' }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '20px' }}>{quizName || 'Quiz Analytics'}</h2>
            {isDemo && (
              <span
                data-testid="analytics-demo-pill"
                style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: '#EEEDFE', color: '#3C3489', flexShrink: 0 }}
              >
                Demo data
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>Quiz ID: {quizId}</div>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={exporting}
          style={{ background: 'white', border: 'var(--bw) solid var(--primary)', color: 'var(--primary)', borderRadius: '8px', padding: '6px 12px', cursor: exporting ? 'not-allowed' : 'pointer', fontSize: '13px', flexShrink: 0 }}
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
        {!hintVisible && (
          <button onClick={showHint} style={{ background: 'none', border: 'var(--bw) solid var(--border)', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: 'var(--primary)', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>?</button>
        )}
      </div>
      {hintVisible && (
        <HintBanner
          text="Each question shows how the class responded, split by correct/incorrect and how confident students felt. The terracotta segment marks confident-but-wrong answers — the strongest reteach signal. This page updates automatically every few seconds."
          onDismiss={dismissHint}
        />
      )}

      {exportError && (
        <div style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
          {exportError}
        </div>
      )}

      {/* Class filter — only when the quiz reached more than one class */}
      {classes.length > 1 && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Showing
          </label>
          <select
            value={classId}
            onChange={handleClassChange}
            style={{ width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px', border: 'var(--bw) solid var(--border)', background: 'white' }}
          >
            <option value="">All classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Summary card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: 'var(--primary)', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
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

      {/* Response timeline chart */}
      {timeline.length > 1 && (
        <TimelineChart timeline={timeline} classSize={classSize} />
      )}

      {/* Misconception hero card — promoted above the question list (v4.0.0), not buried below.
          Cohort/question level only, never individual (see CLAUDE.md — Companion Layer non-negotiables). */}
      {(() => {
        const totalConfidentButIncorrect = questions.reduce((sum, q) => sum + (q.confidentButIncorrect || 0), 0)
        if (totalConfidentButIncorrect === 0) return null
        const worst = questions.reduce((a, b) => (b.confidentButIncorrect || 0) > (a.confidentButIncorrect || 0) ? b : a, questions[0])
        const worstIndex = questions.indexOf(worst)
        return (
          <div
            data-testid="misconception-hero"
            style={{ background: MISCONCEPTION_BG, border: `2px solid ${MISCONCEPTION_BORDER}`, borderRadius: '12px', padding: '18px 20px', marginBottom: '20px' }}
          >
            <div style={{ fontSize: '12px', color: MISCONCEPTION_BORDER, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: '700' }}>
              Misconception signal
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#5A2416', marginBottom: '4px' }}>
              {totalConfidentButIncorrect === 1
                ? '1 answer was confident but wrong.'
                : `${totalConfidentButIncorrect} answers were confident but wrong.`}
            </div>
            <div style={{ fontSize: '13px', color: '#7A3B28' }}>
              Worst question: <strong>Question {worstIndex + 1}</strong> ({worst.confidentButIncorrect} confident-but-wrong)
            </div>
          </div>
        )
      })()}

      {/* Four-cell legend — shown once, above the first question card, not per-question or hover-only. */}
      {questions.length > 0 && questions.some(q => q.fourCell) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', padding: '10px 14px', background: '#fafafa', borderRadius: '8px', border: '1px solid #eee' }}>
          {FOUR_CELL.map(cell => (
            <div key={cell.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#555' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: cell.bg, border: `1.5px solid ${cell.border}`, flexShrink: 0 }} />
              {cell.label}
            </div>
          ))}
        </div>
      )}

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
          <div key={q.id} style={{ background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            
            <div style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Question {qi + 1}
            </div>
            <div style={{ fontSize: '15px', fontWeight: '500', lineHeight: '1.5', marginBottom: '20px', color: '#1a1a1a' }}>
              {q.text}
            </div>

            {q.fourCell && (
              (() => {
                const fcTotal = Object.values(q.fourCell).reduce((a, b) => a + b, 0)
                return (
                  <div style={{ marginBottom: '18px' }}>
                    {/* Segmented bar — proportional widths, but meaning never depends on this alone. */}
                    <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', border: '1px solid #eee', marginBottom: '10px' }}>
                      {FOUR_CELL.map(cell => {
                        const count = q.fourCell[cell.key] || 0
                        const width = fcTotal > 0 ? (count / fcTotal) * 100 : 0
                        return width > 0 ? (
                          <div key={cell.key} style={{ width: `${width}%`, background: cell.border }} title={`${cell.label}: ${count}`} />
                        ) : null
                      })}
                    </div>
                    {/* Always-visible counts + percentages per cell — never hover-only (touch users get nothing on hover). */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {FOUR_CELL.map(cell => {
                        const count = q.fourCell[cell.key] || 0
                        const percent = fcTotal > 0 ? Math.round((count / fcTotal) * 100) : 0
                        return (
                          <div key={cell.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: cell.bg, border: `1px solid ${cell.border}`, borderRadius: '6px' }}>
                            <span style={{ fontSize: '12px', color: cell.border, flex: 1 }}>{cell.label}</span>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: cell.border }}>{count} ({percent}%)</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()
            )}

            {/* Per-option distribution — always shown alongside the four-cell chart: "confidently
                wrong" only becomes teachable once you can see WHICH option they picked. */}
            {q.options.map((opt, i) => {
                const count = counts[i]
                const percent = total > 0 ? Math.round((count / total) * 100) : 0
                const isCorrect = i === q.correctIndex
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
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#333', minWidth: '40px', textAlign: 'right' }}>{percent}%</span>
                    </div>
                    <div style={{ height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden', marginLeft: '34px' }}>
                      <div style={{ height: '100%', borderRadius: '4px', width: `${percent}%`, background: isCorrect ? CORRECT_BORDER : OPTION_BORDER[i] }} />
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
        <div style={{ background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '12px', padding: '20px', marginTop: '8px' }}>
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