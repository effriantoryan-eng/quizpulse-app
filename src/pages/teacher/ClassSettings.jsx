import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import API_BASE from '../../api'

const NAME_LIST_MAX = 50

function ClassSettings() {
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId')

  const [cls, setCls] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nameListText, setNameListText] = useState('')
  const [nameListEnabled, setNameListEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (classId) fetchClass()
  }, [classId])

  async function fetchClass() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/classes`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const classes = await res.json()
      const found = classes.find(c => c.id === classId)
      if (!found) throw new Error('Class not found')
      setCls(found)
      setNameListText((found.nameList || []).join('\n'))
      setNameListEnabled(found.nameListEnabled || false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function parsedNames() {
    return nameListText
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0)
  }

  async function handleSave(e) {
    e.preventDefault()
    const names = parsedNames()
    if (names.length > NAME_LIST_MAX) {
      setSaveError(`Maximum ${NAME_LIST_MAX} names allowed. You have ${names.length}.`)
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch(`${API_BASE}/classes/${classId}/namelist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameList: names, nameListEnabled }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || 'Failed to save name list.'); return }
      setCls(data)
      setNameListText((data.nameList || []).join('\n'))
      setNameListEnabled(data.nameListEnabled || false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError('Could not connect to the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!classId) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#c0392b', fontSize: '14px' }}>No classId provided.</div>
  if (loading) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#888', fontSize: '14px' }}>Loading…</div>
  if (error) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#c0392b', fontSize: '14px' }}>Failed to load: {error}</div>

  const names = parsedNames()
  const overLimit = names.length > NAME_LIST_MAX

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Link to={`/teacher/roster?classId=${classId}`} style={{ color: '#888', textDecoration: 'none', fontSize: '13px' }}>
          ← Back to roster
        </Link>
      </div>

      <h2 style={{ margin: '0 0 4px', fontSize: '18px' }}>{cls.name} — Settings</h2>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#888' }}>
        Name list validation helps you confirm students are on your roll. It's an assistance tool — you decide regardless of the match.
      </p>

      <form onSubmit={handleSave}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', fontWeight: '500' }}>Name list validation</label>
          <button
            type="button"
            onClick={() => setNameListEnabled(v => !v)}
            style={{
              padding: '4px 14px', fontSize: '13px', border: 'var(--bw) solid var(--border)', borderRadius: '20px',
              background: nameListEnabled ? 'var(--primary)' : 'white',
              color: nameListEnabled ? 'white' : '#555',
              cursor: 'pointer',
            }}
          >
            {nameListEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
          Student names (one per line, max {NAME_LIST_MAX})
        </label>
        <textarea
          value={nameListText}
          onChange={e => setNameListText(e.target.value)}
          placeholder={'Alice Smith\nBob Jones\nCarol Williams'}
          rows={12}
          disabled={saving}
          style={{
            width: '100%', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit',
            border: `1px solid ${overLimit ? '#c0392b' : '#ddd'}`, borderRadius: '8px',
            boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.5',
          }}
        />
        <p style={{ margin: '4px 0 16px', fontSize: '12px', color: overLimit ? '#c0392b' : '#aaa' }}>
          {names.length} / {NAME_LIST_MAX} names
        </p>

        {saveError && <p style={{ color: '#c0392b', fontSize: '13px', margin: '0 0 12px' }}>{saveError}</p>}
        {saveSuccess && <p style={{ color: '#27ae60', fontSize: '13px', margin: '0 0 12px' }}>Name list saved.</p>}

        <button
          type="submit"
          disabled={saving || overLimit}
          style={{
            padding: '10px 24px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)',
            borderRadius: '8px', fontSize: '14px', fontWeight: '500',
            cursor: saving || overLimit ? 'not-allowed' : 'pointer',
            opacity: saving || overLimit ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save name list'}
        </button>
      </form>
    </div>
  )
}

export default ClassSettings
