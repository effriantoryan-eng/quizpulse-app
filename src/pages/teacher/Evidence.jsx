import { useState, useEffect } from 'react'
import API_BASE from '../../api'
import { APST_DESCRIPTORS, APST_DEFAULTS, VTLM_ALIGNMENT, REFLECTION_TEMPLATE_1, REFLECTION_TEMPLATE_2 } from '../../data/apstContent'

const PD_TYPES = ['School-based professional learning', 'Resource research', 'Online', 'Collegial', 'Seminar', 'Workshop', 'Other']
const PERSONALISE_MARKER = '[PERSONALISE:'
const DOMAINS = ['Professional Knowledge', 'Professional Practice', 'Professional Engagement']

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function downloadPdf(res, filename) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Server error ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function ExportPanel({ quiz, className, onClose }) {
  const [step, setStep] = useState(1)
  const [teacherName, setTeacherName] = useState('')
  const [vitNumber, setVitNumber] = useState('')
  const [subject, setSubject] = useState(quiz.topicTag || '')
  const [activityName, setActivityName] = useState(`Retrieval Practice Quiz — ${quiz.topicTag || quiz.name} — ${formatDate(quiz.sentAt)}`)
  const [pdType, setPdType] = useState('School-based professional learning')
  const [descriptorIds, setDescriptorIds] = useState(APST_DEFAULTS)
  const [durationHours, setDurationHours] = useState(0.6)
  const [reflection1, setReflection1] = useState(REFLECTION_TEMPLATE_1)
  const [reflection2, setReflection2] = useState(REFLECTION_TEMPLATE_2)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  function toggleDescriptor(id) {
    setDescriptorIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const stillHasMarker = reflection1.includes(PERSONALISE_MARKER) || reflection2.includes(PERSONALISE_MARKER)

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/evidence/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id, teacherName, vitNumber, className, subject, activityName, pdType,
          descriptorIds, durationHours, reflection1, reflection2,
        }),
      })
      await downloadPdf(res, `quizpulse-evidence-${quiz.id}.pdf`)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ border: 'var(--bw) solid var(--border)', borderRadius: '12px', padding: '20px', marginTop: '10px', background: '#fafafa' }}>
      {step === 1 && (
        <>
          <h4 style={{ marginTop: 0 }}>Screen 1 — Activity details</h4>
          <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>Teacher name</label>
          <input data-testid="evidence-teacher-name" value={teacherName} onChange={e => setTeacherName(e.target.value)} style={fieldStyle} />
          <label style={{ display: 'block', fontSize: '12px', color: '#555', margin: '10px 0 4px' }}>VIT number (optional)</label>
          <input data-testid="evidence-vit-number" value={vitNumber} onChange={e => setVitNumber(e.target.value)} placeholder="Optional — leave blank if you don't have one yet" style={fieldStyle} />
          <label style={{ display: 'block', fontSize: '12px', color: '#555', margin: '10px 0 4px' }}>Activity name</label>
          <input data-testid="evidence-activity-name" value={activityName} onChange={e => setActivityName(e.target.value.slice(0, 80))} style={fieldStyle} />
          <label style={{ display: 'block', fontSize: '12px', color: '#555', margin: '10px 0 4px' }}>Subject / topic</label>
          <input data-testid="evidence-subject" value={subject} onChange={e => setSubject(e.target.value)} style={fieldStyle} />
          <label style={{ display: 'block', fontSize: '12px', color: '#555', margin: '10px 0 4px' }}>PD type</label>
          <select data-testid="evidence-pd-type" value={pdType} onChange={e => setPdType(e.target.value)} style={fieldStyle}>
            {PD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label style={{ display: 'block', fontSize: '12px', color: '#555', margin: '10px 0 4px' }}>Duration (hours)</label>
          <input data-testid="evidence-duration" type="number" step="0.1" min="0" value={durationHours} onChange={e => setDurationHours(Number(e.target.value))} style={fieldStyle} />

          <div style={{ margin: '14px 0 6px', fontSize: '12px', color: '#555' }}>VTLM 2.0 alignment (pre-populated)</div>
          <div style={{ fontSize: '12px', color: '#333', background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '8px' }}>{VTLM_ALIGNMENT}</div>

          <div style={{ margin: '14px 0 6px', fontSize: '12px', color: '#555' }}>APST descriptors</div>
          <div style={{ maxHeight: '220px', overflowY: 'auto', background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '8px' }}>
            {APST_DESCRIPTORS.map(d => (
              <label key={d.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', padding: '4px 0' }}>
                <input type="checkbox" checked={descriptorIds.includes(d.id)} onChange={() => toggleDescriptor(d.id)} data-testid={`apst-check-${d.id}`} />
                <span><strong>{d.id}</strong> {d.focusArea} <em style={{ color: '#999' }}>({d.domain})</em></span>
              </label>
            ))}
          </div>

          <button onClick={() => setStep(2)} style={primaryBtnStyle}>Next: Reflection</button>
        </>
      )}
      {step === 2 && (
        <>
          <h4 style={{ marginTop: 0 }}>Screen 2 — Reflection</h4>
          <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>What did you learn and how does it link to APST?</label>
          <textarea data-testid="evidence-reflection-1" value={reflection1} onChange={e => setReflection1(e.target.value)} rows={6} style={fieldStyle} />
          <label style={{ display: 'block', fontSize: '12px', color: '#555', margin: '10px 0 4px' }}>How will you apply your learning to improve student outcomes?</label>
          <textarea data-testid="evidence-reflection-2" value={reflection2} onChange={e => setReflection2(e.target.value)} rows={6} style={fieldStyle} />

          {stillHasMarker && (
            <div data-testid="evidence-personalise-warning" style={{ marginTop: '10px', fontSize: '12px', color: '#c0392b' }}>
              Replace the [PERSONALISE: ...] text in both fields before exporting.
            </div>
          )}
          {error && <div style={{ marginTop: '10px', fontSize: '12px', color: '#c0392b' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => setStep(1)} style={secondaryBtnStyle}>Back</button>
            <button
              data-testid="evidence-export-button"
              onClick={handleExport}
              disabled={stillHasMarker || exporting}
              style={{ ...primaryBtnStyle, opacity: (stillHasMarker || exporting) ? 0.5 : 1, cursor: (stillHasMarker || exporting) ? 'not-allowed' : 'pointer' }}
            >
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AnnualLogPanel({ onClose }) {
  const today = new Date().toISOString().slice(0, 10)
  const lastYear = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(lastYear)
  const [to, setTo] = useState(today)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)

  const rangeDays = (new Date(to) - new Date(from)) / (24 * 60 * 60 * 1000)
  const rangeValid = new Date(from) < new Date(to) && rangeDays <= 365

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const res = await fetch(`${API_BASE}/evidence/annual-log?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      await downloadPdf(res, `quizpulse-annual-log-${from}-${to}.pdf`)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ border: 'var(--bw) solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '20px', background: '#fafafa' }}>
      <h4 style={{ marginTop: 0 }}>Generate annual log</h4>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>From</label>
          <input data-testid="annual-log-from" type="date" value={from} onChange={e => setFrom(e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' }}>To</label>
          <input data-testid="annual-log-to" type="date" value={to} onChange={e => setTo(e.target.value)} style={fieldStyle} />
        </div>
      </div>
      {!rangeValid && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#c0392b' }}>Pick a start date before the end date, within 365 days.</div>
      )}
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#555' }}>
        This date range covers descriptors from {DOMAINS.map(d => `${d} ✓`).join(', ')} (based on your defaults — a missing domain is a warning, not a block).
      </div>
      {error && <div style={{ marginTop: '8px', fontSize: '12px', color: '#c0392b' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
        <button
          data-testid="annual-log-generate"
          onClick={handleGenerate}
          disabled={!rangeValid || generating}
          style={{ ...primaryBtnStyle, opacity: (!rangeValid || generating) ? 0.5 : 1, cursor: (!rangeValid || generating) ? 'not-allowed' : 'pointer' }}
        >
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
      </div>
    </div>
  )
}

const fieldStyle = { width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box', background: 'white' }
const primaryBtnStyle = { marginTop: '14px', padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }
const secondaryBtnStyle = { marginTop: '14px', padding: '8px 16px', background: 'white', color: '#333', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }

export default function Evidence() {
  const [quizzes, setQuizzes] = useState([])
  const [classNames, setClassNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openQuizId, setOpenQuizId] = useState(null)
  const [showAnnualLog, setShowAnnualLog] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [quizRes, classRes] = await Promise.all([
          fetch(`${API_BASE}/quizzes`),
          fetch(`${API_BASE}/classes`),
        ])
        if (!quizRes.ok) throw new Error(`Server error ${quizRes.status}`)
        const quizData = await quizRes.json()
        const sent = quizData.filter(q => q.status === 'sent').sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
        setQuizzes(sent)
        if (classRes.ok) {
          const classes = await classRes.json()
          setClassNames(Object.fromEntries(classes.map(c => [c.id, c.name])))
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function classLabel(quiz) {
    const names = (quiz.classIds || []).map(id => classNames[id]).filter(Boolean)
    return names.length ? names.join(', ') : '—'
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ marginBottom: '6px' }}>VIT Evidence</h2>
      <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
        Export quiz data as professional learning evidence for VIT registration and MyPD.
      </p>

      <div style={{ marginBottom: '16px' }}>
        {!showAnnualLog && (
          <button onClick={() => setShowAnnualLog(true)} style={secondaryBtnStyle}>Generate annual log</button>
        )}
        {showAnnualLog && <AnnualLogPanel onClose={() => setShowAnnualLog(false)} />}
      </div>

      {loading && <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Loading…</div>}
      {error && <div style={{ padding: '12px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b' }}>{error}</div>}
      {!loading && !error && quizzes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: '#888', fontSize: '14px', background: '#f8f8f8', borderRadius: '12px' }}>
          No sent quizzes yet — send a quiz to generate evidence from it.
        </div>
      )}

      {quizzes.map(quiz => (
        <div key={quiz.id} data-testid="evidence-quiz-card" style={{ background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{quiz.name}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                {quiz.topicTag || 'No topic'} · {formatDate(quiz.sentAt)} · {classLabel(quiz)}
              </div>
            </div>
            <button
              data-testid="evidence-open-export"
              onClick={() => setOpenQuizId(openQuizId === quiz.id ? null : quiz.id)}
              style={secondaryBtnStyle}
            >
              {openQuizId === quiz.id ? 'Close' : 'Export artefact'}
            </button>
          </div>
          {openQuizId === quiz.id && (
            <ExportPanel quiz={quiz} className={classLabel(quiz)} onClose={() => setOpenQuizId(null)} />
          )}
        </div>
      ))}
    </div>
  )
}
