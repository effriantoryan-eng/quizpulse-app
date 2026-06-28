import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import API_BASE from '../../api'

function CreateQuestion() {
  const { teacherId } = useAuth()
  const [hintVisible, dismissHint, showHint] = useHint('create')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctIndex, setCorrectIndex] = useState(null)
  const [topic, setTopic] = useState('')
  const [yearLevel, setYearLevel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const topics = ['Mathematics', 'Science', 'English', 'History', 'Geography']
  const yearLevels = [7, 8, 9, 10, 11, 12]

  function handleOptionChange(index, value) {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  function handleReset() {
    setQuestion('')
    setOptions(['', '', '', ''])
    setCorrectIndex(null)
    setTopic('')
    setYearLevel(null)
    setError(null)
  }

  async function handleSave() {
    if (!question || options.some(o => !o) || correctIndex === null || !topic) {
      setError('Please fill in all fields, select a correct answer and a topic.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: question, options, correctIndex, topic, yearLevel })
      })

      if (!res.ok) throw new Error('Failed to save question')

      setSaved(true)
      setQuestion('')
      setOptions(['', '', '', ''])
      setCorrectIndex(null)
      setTopic('')
      setYearLevel(null)
      setTimeout(() => setSaved(false), 3000)

    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h1 style={{ margin: 0 }}>Create question</h1>
        {!hintVisible && (
          <button onClick={showHint} style={{ background: 'var(--surface)', border: 'var(--bw) solid var(--border)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--primary)', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadowField)', flex: 'none' }}>?</button>
        )}
      </div>
      {hintVisible && (
        <HintBanner
          text="Write a question, fill in four options, mark the correct answer, and choose a topic. Save it — you can create as many as you like before building a quiz."
          onDismiss={dismissHint}
        />
      )}

      {saved && (
        <div style={{ padding: '14px 18px', background: 'var(--okBg)', color: 'var(--ok)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', marginBottom: '20px', fontSize: '15px', fontWeight: 600 }}>
          ✓ Question saved to bank!
        </div>
      )}

      {error && (
        <div style={{ padding: '14px 18px', background: 'var(--dangerBg)', color: 'var(--danger)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', marginBottom: '20px', fontSize: '15px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '28px' }}>
        <label className="bp-label">Question</label>
        <textarea
          rows={3}
          style={{ width: '100%', fontSize: '17px', fontWeight: 500 }}
          placeholder="Type your question here…"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: '28px' }}>
        <label className="bp-label">Answer options — select the correct one</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {options.map((opt, i) => {
            const selected = correctIndex === i
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  onClick={() => setCorrectIndex(i)}
                  role="radio"
                  aria-checked={selected}
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%', flex: 'none', cursor: 'pointer',
                    border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {selected && <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: 'var(--primary)' }} />}
                </span>
                <input
                  type="text"
                  style={{
                    flex: 1, fontSize: '16px',
                    fontWeight: selected ? 600 : 500,
                    border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                    background: selected ? 'var(--primarySoft)' : 'var(--surface)',
                    boxShadow: selected ? 'none' : 'var(--shadowField)',
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  value={opt}
                  onChange={e => handleOptionChange(i, e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: '28px' }}>
        <label className="bp-label">Topic tag</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {topics.map(t => (
            <button
              key={t}
              className={`bp-chip ${topic === t ? 'active' : ''}`}
              onClick={() => setTopic(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '36px' }}>
        <label className="bp-label">Year level (optional)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button
            className={`bp-chip ${yearLevel === null ? 'active' : ''}`}
            onClick={() => setYearLevel(null)}
          >
            All years
          </button>
          {yearLevels.map(y => (
            <button
              key={y}
              className={`bp-chip ${yearLevel === y ? 'active' : ''}`}
              onClick={() => setYearLevel(y)}
            >
              Year {y}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        <button className="bp-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save question'}
          {!saving && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
        <button className="bp-btn secondary" onClick={handleReset} disabled={saving}>Reset</button>
      </div>
    </div>
  )
}

export default CreateQuestion