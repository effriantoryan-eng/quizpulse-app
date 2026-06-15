import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import API_BASE from '../../api'

const TOPIC_COLORS = {
  Science: { bg: '#E1F5EE', color: '#085041' },
  History: { bg: '#FAEEDA', color: '#633806' },
  Mathematics: { bg: '#E6F1FB', color: '#0C447C' },
  English: { bg: '#FBEAF0', color: '#4B1528' },
  Geography: { bg: '#EEEDFE', color: '#3C3489' },
}

const ALLOWED_TOPICS = ['Science', 'History', 'Mathematics', 'English', 'Geography']

const BLANK_FORM = { text: '', options: ['', '', '', ''], correctIndex: 0, topic: 'Science' }

function QuestionBank() {
  const { teacherId } = useAuth()
  const [hintVisible, dismissHint, showHint] = useHint('bank')
  const [questions, setQuestions] = useState([])
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  useEffect(() => {
    if (!teacherId) return
    async function fetchQuestions() {
      try {
        const res = await fetch(`${API_BASE}/questions?teacherId=${teacherId}`)
        if (!res.ok) throw new Error('Failed to load questions')
        const data = await res.json()
        setQuestions(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchQuestions()
  }, [teacherId])

  const topics = ['All', ...new Set(questions.map(q => q.topic))]
  const filtered = filter === 'All' ? questions : questions.filter(q => q.topic === filter)

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function startEdit(q, e) {
    e.stopPropagation()
    setEditingId(q.id)
    setEditForm({ text: q.text, options: [...q.options], correctIndex: q.correctIndex, topic: q.topic })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit(id) {
    setEditError(null)
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, teacherId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Server error ${res.status}`)
      }
      const updated = await res.json()
      setQuestions(prev => prev.map(q => q.id === id ? updated : q))
      setEditingId(null)
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteQuestion(id, e) {
    e.stopPropagation()
    if (!window.confirm('Delete this question? This cannot be undone.')) return
    try {
      const res = await fetch(`${API_BASE}/questions/${id}?teacherId=${teacherId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error(`Server error ${res.status}`)
      setQuestions(prev => prev.filter(q => q.id !== id))
      setSelected(prev => prev.filter(i => i !== id))
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  if (loading) return <div style={{ padding: '24px', color: '#888' }}>Loading questions...</div>
  if (error) return <div style={{ padding: '24px', color: '#A32D2D' }}>{error}</div>

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Question bank</h2>
        {!hintVisible && (
          <button onClick={showHint} style={{ background: 'none', border: '1px solid #C5C0F0', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: '#7B6EDE', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
        )}
      </div>
      {hintVisible && (
        <HintBanner
          text="These are your saved questions. Filter by topic, edit inline, or delete. Head to Build Quiz when you're ready to assemble them into a quiz."
          onDismiss={dismissHint}
        />
      )}

      {questions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px' }}>
          No questions yet. Go to Create Question to add some.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {topics.map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  style={{
                    padding: '5px 12px', borderRadius: '20px', border: '1px solid',
                    borderColor: filter === t ? '#534AB7' : '#ddd',
                    background: filter === t ? '#534AB7' : 'white',
                    color: filter === t ? 'white' : '#555',
                    cursor: 'pointer', fontSize: '12px',
                    fontWeight: filter === t ? '500' : '400'
                  }}
                >
                  {t} ({t === 'All' ? questions.length : questions.filter(q => q.topic === t).length})
                </button>
              ))}
            </div>
          </div>

          {filtered.map(q => {
            const topicStyle = TOPIC_COLORS[q.topic] || { bg: '#EEEDFE', color: '#3C3489' }
            const isSelected = selected.includes(q.id)
            const isEditing = editingId === q.id

            if (isEditing) {
              return (
                <div key={q.id} style={{ padding: '16px', marginBottom: '10px', border: '2px solid #534AB7', borderRadius: '10px', background: '#FAFAFE' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', display: 'block', marginBottom: '4px' }}>Question</label>
                    <textarea
                      value={editForm.text}
                      onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))}
                      rows={2}
                      style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', display: 'block', marginBottom: '4px' }}>Options (select correct answer)</label>
                    {editForm.options.map((opt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={editForm.correctIndex === i}
                          onChange={() => setEditForm(f => ({ ...f, correctIndex: i }))}
                          style={{ accentColor: '#534AB7' }}
                        />
                        <input
                          value={opt}
                          onChange={e => {
                            const opts = [...editForm.options]
                            opts[i] = e.target.value
                            setEditForm(f => ({ ...f, options: opts }))
                          }}
                          style={{ flex: 1, padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: `1px solid ${editForm.correctIndex === i ? '#534AB7' : '#ddd'}` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', display: 'block', marginBottom: '4px' }}>Topic</label>
                    <select
                      value={editForm.topic}
                      onChange={e => setEditForm(f => ({ ...f, topic: e.target.value }))}
                      style={{ padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ddd' }}
                    >
                      {ALLOWED_TOPICS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  {editError && (
                    <div style={{ fontSize: '12px', color: '#c0392b', marginBottom: '10px' }}>{editError}</div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => saveEdit(q.id)}
                      disabled={saving}
                      style={{ padding: '7px 16px', background: saving ? '#ccc' : '#534AB7', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer' }}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{ padding: '7px 16px', background: 'white', color: '#555', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={q.id}
                onClick={() => toggleSelect(q.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '14px 16px', marginBottom: '10px',
                  border: `1px solid ${isSelected ? '#534AB7' : '#e0e0e0'}`,
                  borderRadius: '10px',
                  background: isSelected ? '#EEEDFE22' : 'white',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(q.id)}
                  style={{ marginTop: '3px', accentColor: '#534AB7' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', marginBottom: '6px', lineHeight: '1.5' }}>{q.text}</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: topicStyle.bg, color: topicStyle.color }}>{q.topic}</span>
                    <span style={{ fontSize: '11px', color: '#aaa' }}>{q.options?.length || 4} options</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={e => startEdit(q, e)}
                    style={{ padding: '4px 10px', fontSize: '12px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', color: '#555' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={e => deleteQuestion(q.id, e)}
                    style={{ padding: '4px 10px', fontSize: '12px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', color: '#c0392b' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}

          {selected.length > 0 && (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#666' }}>{selected.length} question{selected.length > 1 ? 's' : ''} selected</span>
              <button
                style={{ padding: '8px 18px', background: '#534AB7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
                onClick={() => alert('Add to quiz — coming soon')}
              >
                Add to quiz →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default QuestionBank
