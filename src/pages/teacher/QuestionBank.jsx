import { useState, useEffect, useCallback } from 'react'
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
const YEAR_LEVELS = [7, 8, 9, 10, 11, 12]
const BLANK_FORM = { text: '', options: ['', '', '', ''], correctIndex: 0, topic: 'Science' }
const VISIBILITY_LABELS = { private: 'Private', school: 'School', public: 'Public' }
const VISIBILITY_COLORS = {
  private: { bg: '#f5f5f5', color: '#888', border: '#ddd' },
  school: { bg: '#E6F1FB', color: '#0C447C', border: '#b3d1f7' },
  public: { bg: '#E1F5EE', color: '#085041', border: '#a3d9c0' },
}

function VisibilityPill({ value, onChange }) {
  const cycle = { private: 'school', school: 'public', public: 'private' }
  const s = VISIBILITY_COLORS[value] || VISIBILITY_COLORS.private
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(cycle[value]); }}
      title="Click to change visibility"
      style={{
        padding: '2px 8px', fontSize: '11px', borderRadius: '20px',
        border: `1px solid ${s.border}`, background: s.bg, color: s.color,
        cursor: 'pointer', fontWeight: '500'
      }}
    >
      {value === 'private' ? '🔒' : value === 'school' ? '🏫' : '🌐'} {VISIBILITY_LABELS[value]}
    </button>
  )
}

function QuestionCard({ q, isSelected, isEditing, onToggleSelect, onStartEdit, onCancelEdit, onSaveEdit, onDelete, onVisibilityChange, editForm, setEditForm, saving, editError, showActions = true }) {
  const topicStyle = TOPIC_COLORS[q.topic] || { bg: '#EEEDFE', color: '#3C3489' }

  if (isEditing) {
    return (
      <div style={{ padding: '16px', marginBottom: '10px', border: '2px solid #534AB7', borderRadius: '10px', background: '#FAFAFE' }}>
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
              <input type="radio" name={`correct-${q.id}`} checked={editForm.correctIndex === i} onChange={() => setEditForm(f => ({ ...f, correctIndex: i }))} style={{ accentColor: '#534AB7' }} />
              <input
                value={opt}
                onChange={e => { const opts = [...editForm.options]; opts[i] = e.target.value; setEditForm(f => ({ ...f, options: opts })); }}
                style={{ flex: 1, padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: `1px solid ${editForm.correctIndex === i ? '#534AB7' : '#ddd'}` }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', display: 'block', marginBottom: '4px' }}>Topic</label>
            <select value={editForm.topic} onChange={e => setEditForm(f => ({ ...f, topic: e.target.value }))} style={{ padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ddd' }}>
              {ALLOWED_TOPICS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', display: 'block', marginBottom: '4px' }}>Year level</label>
            <select value={editForm.yearLevel || ''} onChange={e => setEditForm(f => ({ ...f, yearLevel: e.target.value ? parseInt(e.target.value) : null }))} style={{ padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ddd' }}>
              <option value="">All years</option>
              {YEAR_LEVELS.map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', display: 'block', marginBottom: '4px' }}>Visibility</label>
            <select value={editForm.visibility || 'private'} onChange={e => setEditForm(f => ({ ...f, visibility: e.target.value }))} style={{ padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ddd' }}>
              <option value="private">Private</option>
              <option value="school">School</option>
              <option value="public">Public</option>
            </select>
          </div>
        </div>
        {editError && <div style={{ fontSize: '12px', color: '#c0392b', marginBottom: '10px' }}>{editError}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onSaveEdit(q.id)} disabled={saving} style={{ padding: '7px 16px', background: saving ? '#ccc' : '#534AB7', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onCancelEdit} style={{ padding: '7px 16px', background: 'white', color: '#555', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => showActions && onToggleSelect && onToggleSelect(q.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '14px 16px', marginBottom: '10px',
        border: `1px solid ${isSelected ? '#534AB7' : '#e0e0e0'}`,
        borderRadius: '10px', background: isSelected ? '#EEEDFE22' : 'white',
        cursor: showActions && onToggleSelect ? 'pointer' : 'default'
      }}
    >
      {onToggleSelect && (
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect(q.id)} style={{ marginTop: '3px', accentColor: '#534AB7' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', marginBottom: '6px', lineHeight: '1.5' }}>{q.text}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: topicStyle.bg, color: topicStyle.color }}>{q.topic}</span>
          {q.yearLevel && <span style={{ fontSize: '11px', color: '#888' }}>Year {q.yearLevel}</span>}
          {q.upvoteCount > 0 && <span style={{ fontSize: '11px', color: '#534AB7' }}>▲ {q.upvoteCount}</span>}
          {q.usageCount > 0 && <span style={{ fontSize: '11px', color: '#aaa' }}>{q.usageCount} uses</span>}
        </div>
      </div>
      {showActions && (
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {onVisibilityChange && (
            <VisibilityPill value={q.visibility || 'private'} onChange={v => onVisibilityChange(q.id, v)} />
          )}
          {onStartEdit && (
            <button onClick={e => onStartEdit(q, e)} style={{ padding: '4px 10px', fontSize: '12px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', color: '#555' }}>Edit</button>
          )}
          {onDelete && (
            <button onClick={e => onDelete(q.id, e)} style={{ padding: '4px 10px', fontSize: '12px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', color: '#c0392b' }}>Delete</button>
          )}
        </div>
      )}
    </div>
  )
}

function CommunityCard({ q, onUpvote, onCopy, onReport, upvotedIds, copyingId, reportingId }) {
  const topicStyle = TOPIC_COLORS[q.topic] || { bg: '#EEEDFE', color: '#3C3489' }
  const upvoted = upvotedIds.has(q.id)
  return (
    <div style={{ padding: '14px 16px', marginBottom: '10px', border: '1px solid #e0e0e0', borderRadius: '10px', background: 'white' }}>
      <div style={{ fontSize: '14px', marginBottom: '8px', lineHeight: '1.5' }}>{q.text}</div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: topicStyle.bg, color: topicStyle.color }}>{q.topic}</span>
        {q.yearLevel && <span style={{ fontSize: '11px', color: '#888' }}>Year {q.yearLevel}</span>}
        {q.upvoteCount > 0 && <span style={{ fontSize: '11px', color: upvoted ? '#534AB7' : '#aaa' }}>▲ {q.upvoteCount}</span>}
        {q.usageCount > 0 && <span style={{ fontSize: '11px', color: '#aaa' }}>{q.usageCount} uses</span>}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onUpvote(q)}
          style={{ padding: '4px 10px', fontSize: '12px', background: upvoted ? '#EEEDFE' : 'white', border: `1px solid ${upvoted ? '#534AB7' : '#ddd'}`, borderRadius: '6px', cursor: 'pointer', color: upvoted ? '#534AB7' : '#555' }}
        >
          {upvoted ? '▲ Upvoted' : '▲ Upvote'}
        </button>
        <button
          onClick={() => onCopy(q)}
          disabled={copyingId === q.id}
          style={{ padding: '4px 10px', fontSize: '12px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', cursor: copyingId === q.id ? 'not-allowed' : 'pointer', color: '#555' }}
        >
          {copyingId === q.id ? 'Copying…' : 'Copy to mine'}
        </button>
        <button
          onClick={() => onReport(q)}
          disabled={reportingId === q.id}
          style={{ padding: '4px 10px', fontSize: '12px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', cursor: reportingId === q.id ? 'not-allowed' : 'pointer', color: '#c0392b' }}
        >
          {reportingId === q.id ? 'Reported' : 'Report'}
        </button>
      </div>
    </div>
  )
}

function QuestionBank() {
  const { teacherId } = useAuth()
  const [hintVisible, dismissHint, showHint] = useHint('bank')
  const [questions, setQuestions] = useState([])
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('my')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  // Community / school state
  const [communityQuestions, setCommunityQuestions] = useState([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityError, setCommunityError] = useState(null)
  const [communityOffset, setCommunityOffset] = useState(0)
  const [communityHasMore, setCommunityHasMore] = useState(true)
  const [communityTopic, setCommunityTopic] = useState('')
  const [communityYear, setCommunityYear] = useState('')
  const [communitySearch, setCommunitySearch] = useState('')
  const [communitySearchInput, setCommunitySearchInput] = useState('')
  const [upvotedIds, setUpvotedIds] = useState(new Set())
  const [copyingId, setCopyingId] = useState(null)
  const [reportingId, setReportingId] = useState(null)
  const [communityMode, setCommunityMode] = useState('public') // 'public' | 'school'
  const [copySuccess, setCopySuccess] = useState(null)
  const [reportSuccess, setReportSuccess] = useState(null)

  useEffect(() => {
    if (!teacherId) return
    async function fetchOwn() {
      try {
        const res = await fetch(`${API_BASE}/questions`)
        if (!res.ok) throw new Error('Failed to load questions')
        setQuestions(await res.json())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchOwn()
  }, [teacherId])

  const fetchCommunity = useCallback(async ({ mode, topic, year, search, offset, append }) => {
    setCommunityLoading(true)
    setCommunityError(null)
    try {
      const params = new URLSearchParams({ visibility: mode, offset: String(offset) })
      if (topic) params.set('topic', topic)
      if (year) params.set('year', year)
      if (search) params.set('q', search)
      const res = await fetch(`${API_BASE}/questions?${params}`)
      if (!res.ok) throw new Error('Failed to load questions')
      const data = await res.json()
      if (append) {
        setCommunityQuestions(prev => [...prev, ...data])
      } else {
        setCommunityQuestions(data)
      }
      setCommunityHasMore(data.length === 50)
    } catch (err) {
      setCommunityError(err.message)
    } finally {
      setCommunityLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'community') return
    setCommunityOffset(0)
    setCommunityHasMore(true)
    fetchCommunity({ mode: communityMode, topic: communityTopic, year: communityYear, search: communitySearch, offset: 0, append: false })
  }, [activeTab, communityMode, communityTopic, communityYear, communitySearch, fetchCommunity])

  function loadMore() {
    const newOffset = communityOffset + 50
    setCommunityOffset(newOffset)
    fetchCommunity({ mode: communityMode, topic: communityTopic, year: communityYear, search: communitySearch, offset: newOffset, append: true })
  }

  const topics = ['All', ...new Set(questions.map(q => q.topic))]
  const filtered = filter === 'All' ? questions : questions.filter(q => q.topic === filter)

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function startEdit(q, e) {
    e.stopPropagation()
    setEditingId(q.id)
    setEditForm({ text: q.text, options: [...q.options], correctIndex: q.correctIndex, topic: q.topic, yearLevel: q.yearLevel || null, visibility: q.visibility || 'private' })
    setEditError(null)
  }

  function cancelEdit() { setEditingId(null); setEditError(null) }

  async function saveEdit(id) {
    setEditError(null)
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `Server error ${res.status}`) }
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
      const res = await fetch(`${API_BASE}/questions/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error(`Server error ${res.status}`)
      setQuestions(prev => prev.filter(q => q.id !== id))
      setSelected(prev => prev.filter(i => i !== id))
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  async function changeVisibility(id, newVisibility) {
    try {
      const q = questions.find(x => x.id === id)
      if (!q) return
      const res = await fetch(`${API_BASE}/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: q.text, options: q.options, correctIndex: q.correctIndex, topic: q.topic, yearLevel: q.yearLevel, visibility: newVisibility }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `Error ${res.status}`) }
      const updated = await res.json()
      setQuestions(prev => prev.map(x => x.id === id ? updated : x))
    } catch (err) {
      alert(`Could not update visibility: ${err.message}`)
    }
  }

  async function handleUpvote(q) {
    try {
      const res = await fetch(`${API_BASE}/questions/${q.id}/upvote`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      setUpvotedIds(prev => {
        const next = new Set(prev)
        data.upvoted ? next.add(q.id) : next.delete(q.id)
        return next
      })
      setCommunityQuestions(prev => prev.map(x => x.id === q.id ? { ...x, upvoteCount: data.upvoteCount } : x))
    } catch (_) { /* silent */ }
  }

  async function handleCopy(q) {
    if (copyingId) return
    setCopyingId(q.id)
    try {
      const res = await fetch(`${API_BASE}/questions/${q.id}/copy`, { method: 'POST' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `Error ${res.status}`) }
      const clone = await res.json()
      setQuestions(prev => [...prev, clone])
      setCopySuccess(q.id)
      setTimeout(() => setCopySuccess(null), 3000)
    } catch (err) {
      alert(`Copy failed: ${err.message}`)
    } finally {
      setCopyingId(null)
    }
  }

  async function handleReport(q) {
    if (reportingId === q.id) return
    const reason = window.prompt('Why are you reporting this question? (optional)')
    if (reason === null) return
    setReportingId(q.id)
    try {
      const res = await fetch(`${API_BASE}/questions/${q.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `Error ${res.status}`) }
      setReportSuccess(q.id)
      setTimeout(() => setReportSuccess(null), 3000)
    } catch (err) {
      alert(`Report failed: ${err.message}`)
    } finally {
      setReportingId(null)
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
          text="Your private questions are here. Toggle visibility to share with your school or the whole community. Browse and upvote questions from other teachers on the School and Community tabs."
          onDismiss={dismissHint}
        />
      )}

      {copySuccess && (
        <div style={{ padding: '10px 14px', background: '#EAF3DE', color: '#3B6D11', borderRadius: '8px', marginBottom: '12px', fontSize: '14px' }}>
          ✓ Question copied to your bank as a private question.
        </div>
      )}
      {reportSuccess && (
        <div style={{ padding: '10px 14px', background: '#FFF9E6', color: '#7A5E00', borderRadius: '8px', marginBottom: '12px', fontSize: '14px' }}>
          ✓ Report submitted. Our moderators will review it.
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #eee', marginBottom: '20px' }}>
        {[
          { key: 'my', label: 'My Questions' },
          { key: 'community', label: '🌐 Community' },
        ].map(tab => (
          <button
            key={tab.key}
            data-testid={`tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 18px', background: 'none', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #534AB7' : '2px solid transparent',
              color: activeTab === tab.key ? '#534AB7' : '#666',
              fontSize: '13px', fontWeight: activeTab === tab.key ? '600' : '400',
              cursor: 'pointer', marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── MY QUESTIONS ── */}
      {activeTab === 'my' && (questions.length === 0 ? (
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
                    cursor: 'pointer', fontSize: '12px', fontWeight: filter === t ? '500' : '400'
                  }}
                >
                  {t} ({t === 'All' ? questions.length : questions.filter(q => q.topic === t).length})
                </button>
              ))}
            </div>
          </div>

          {filtered.map(q => (
            <QuestionCard
              key={q.id}
              q={q}
              isSelected={selected.includes(q.id)}
              isEditing={editingId === q.id}
              onToggleSelect={toggleSelect}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onDelete={deleteQuestion}
              onVisibilityChange={changeVisibility}
              editForm={editForm}
              setEditForm={setEditForm}
              saving={saving}
              editError={editError}
            />
          ))}

          {selected.length > 0 && (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#666' }}>{selected.length} question{selected.length > 1 ? 's' : ''} selected</span>
              <button
                style={{ padding: '8px 18px', background: '#534AB7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
                onClick={() => alert('Add to quiz — head to Build Quiz and select questions there')}
              >
                Add to quiz →
              </button>
            </div>
          )}
        </>
      ))}

      {/* ── COMMUNITY ── */}
      {activeTab === 'community' && (
        <div>
          {/* Mode toggle: School / Public */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[{ key: 'school', label: '🏫 My School' }, { key: 'public', label: '🌐 All Schools' }].map(m => (
              <button
                key={m.key}
                onClick={() => setCommunityMode(m.key)}
                style={{
                  padding: '6px 14px', borderRadius: '20px', border: '1px solid',
                  borderColor: communityMode === m.key ? '#534AB7' : '#ddd',
                  background: communityMode === m.key ? '#534AB7' : 'white',
                  color: communityMode === m.key ? 'white' : '#555',
                  cursor: 'pointer', fontSize: '12px', fontWeight: communityMode === m.key ? '500' : '400'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <form onSubmit={e => { e.preventDefault(); setCommunitySearch(communitySearchInput) }} style={{ display: 'flex', gap: '6px', flex: '1 1 200px' }}>
              <input
                value={communitySearchInput}
                onChange={e => setCommunitySearchInput(e.target.value)}
                placeholder="Search questions…"
                style={{ flex: 1, padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ddd', minWidth: 0 }}
              />
              <button type="submit" style={{ padding: '6px 12px', background: '#534AB7', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>Go</button>
              {communitySearch && (
                <button type="button" onClick={() => { setCommunitySearch(''); setCommunitySearchInput('') }} style={{ padding: '6px 10px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#888' }}>✕</button>
              )}
            </form>
            <select value={communityTopic} onChange={e => setCommunityTopic(e.target.value)} style={{ padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ddd' }}>
              <option value="">All topics</option>
              {ALLOWED_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={communityYear} onChange={e => setCommunityYear(e.target.value)} style={{ padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ddd' }}>
              <option value="">All years</option>
              {YEAR_LEVELS.map(y => <option key={y} value={String(y)}>Year {y}</option>)}
            </select>
          </div>

          {communityLoading && communityQuestions.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>Loading…</div>
          )}
          {communityError && (
            <div style={{ padding: '12px', background: '#FCEBEB', color: '#A32D2D', borderRadius: '8px', marginBottom: '12px', fontSize: '14px' }}>{communityError}</div>
          )}

          {!communityLoading && !communityError && communityQuestions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#aaa', fontSize: '14px', border: '1px dashed #eee', borderRadius: '10px' }}>
              {communityMode === 'school'
                ? "No school questions found. Teachers at your school can share questions by setting visibility to 'School' or 'Public'."
                : 'No public questions found. Try different filters, or share your own by setting a question to Public.'}
            </div>
          )}

          {communityQuestions.map(q => (
            <CommunityCard
              key={q.id}
              q={q}
              onUpvote={handleUpvote}
              onCopy={handleCopy}
              onReport={handleReport}
              upvotedIds={upvotedIds}
              copyingId={copyingId}
              reportingId={reportingId}
            />
          ))}

          {communityHasMore && communityQuestions.length > 0 && (
            <button
              onClick={loadMore}
              disabled={communityLoading}
              style={{ width: '100%', padding: '10px', marginTop: '8px', background: 'white', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', color: '#555', cursor: communityLoading ? 'not-allowed' : 'pointer' }}
            >
              {communityLoading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default QuestionBank
