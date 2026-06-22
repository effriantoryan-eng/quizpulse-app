import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import API_BASE from '../../api'

const CLASS_NAME_MAX = 80

function Classes() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStudentCount, setNewStudentCount] = useState('')
  const [createError, setCreateError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editStudentCount, setEditStudentCount] = useState('')
  const [editError, setEditError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { fetchClasses() }, [])

  async function fetchClasses() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/classes`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      setClasses(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setCreateError('Class name is required.'); return }
    if (name.length > CLASS_NAME_MAX) { setCreateError(`Class name must be ${CLASS_NAME_MAX} characters or fewer.`); return }

    setSaving(true)
    setCreateError(null)
    try {
      const res = await fetch(`${API_BASE}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          studentCount: newStudentCount !== '' ? parseInt(newStudentCount, 10) : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || 'Failed to create class.'); return }
      setClasses(prev => [...prev, data])
      setNewName('')
      setNewStudentCount('')
      setCreating(false)
    } catch {
      setCreateError('Could not connect to the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id) {
    const name = editName.trim()
    if (!name) { setEditError('Class name is required.'); return }
    if (name.length > CLASS_NAME_MAX) { setEditError(`Class name must be ${CLASS_NAME_MAX} characters or fewer.`); return }

    setSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`${API_BASE}/classes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          studentCount: editStudentCount !== '' ? parseInt(editStudentCount, 10) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error || 'Failed to update class.'); return }
      setClasses(prev => prev.map(c => c.id === id ? data : c))
      setEditingId(null)
    } catch {
      setEditError('Could not connect to the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`${API_BASE}/classes/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete class.')
        return
      }
      setClasses(prev => prev.filter(c => c.id !== id))
    } catch {
      alert('Could not connect to the server. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#888', fontSize: '14px' }}>Loading classes…</div>
  if (error) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#c0392b', fontSize: '14px' }}>Failed to load classes: {error}</div>

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Classes</h2>
        <button
          data-testid="class-new-btn"
          onClick={() => { setCreating(true); setCreateError(null) }}
          disabled={creating || classes.length >= 20}
          title={classes.length >= 20 ? 'Maximum 20 classes reached' : 'Add a new class'}
          style={{
            padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)',
            borderRadius: '8px', fontSize: '13px', fontWeight: '500',
            cursor: classes.length >= 20 ? 'not-allowed' : 'pointer',
            opacity: classes.length >= 20 ? 0.5 : 1,
          }}
        >
          + New class
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} style={{ background: '#f8f8f8', border: 'var(--bw) solid var(--border)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>New class</div>
          <input
            data-testid="class-name-input"
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Class name (e.g. Year 9 Science)"
            maxLength={CLASS_NAME_MAX}
            autoFocus
            disabled={saving}
            style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: '6px', border: 'var(--bw) solid var(--border)', boxSizing: 'border-box', marginBottom: '8px' }}
          />
          <input
            type="number"
            value={newStudentCount}
            onChange={e => setNewStudentCount(e.target.value)}
            placeholder="Estimated students (optional, for simulation)"
            min={0}
            max={40}
            disabled={saving}
            style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: '6px', border: 'var(--bw) solid var(--border)', boxSizing: 'border-box', marginBottom: '8px' }}
          />
          {createError && <p style={{ color: '#c0392b', fontSize: '13px', margin: '0 0 8px' }}>{createError}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              data-testid="class-create-submit"
              type="submit"
              disabled={saving}
              style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName(''); setNewStudentCount(''); setCreateError(null) }}
              style={{ padding: '8px 16px', background: 'white', color: '#666', border: 'var(--bw) solid var(--border)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {classes.length === 0 && !creating && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px', border: '1px dashed #eee', borderRadius: '10px' }}>
          No classes yet. Click <strong>+ New class</strong> to get started.
        </div>
      )}

      {classes.map(c => (
        <div key={c.id} style={{ border: 'var(--bw) solid var(--border)', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px', background: 'white' }}>
          {editingId === c.id ? (
            <div>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={CLASS_NAME_MAX}
                disabled={saving}
                style={{ width: '100%', padding: '6px 10px', fontSize: '14px', borderRadius: '6px', border: 'var(--bw) solid var(--border)', boxSizing: 'border-box', marginBottom: '8px' }}
              />
              <input
                type="number"
                value={editStudentCount}
                onChange={e => setEditStudentCount(e.target.value)}
                placeholder="Student count"
                min={0}
                max={40}
                disabled={saving}
                style={{ width: '100%', padding: '6px 10px', fontSize: '14px', borderRadius: '6px', border: 'var(--bw) solid var(--border)', boxSizing: 'border-box', marginBottom: '8px' }}
              />
              {editError && <p style={{ color: '#c0392b', fontSize: '13px', margin: '0 0 8px' }}>{editError}</p>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleUpdate(c.id)}
                  disabled={saving}
                  style={{ padding: '6px 14px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingId(null); setEditError(null) }}
                  style={{ padding: '6px 14px', background: 'white', color: '#666', border: 'var(--bw) solid var(--border)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                  {c.studentCount} student{c.studentCount !== 1 ? 's' : ''}
                  {' · '}
                  Code: <span style={{ fontFamily: 'monospace', letterSpacing: '0.5px', color: '#555' }}>{c.joinCode}</span>
                </div>
              </div>
              <Link
                to={`/teacher/roster?classId=${c.id}`}
                style={{ padding: '5px 12px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', flexShrink: 0, textDecoration: 'none' }}
              >
                Roster
              </Link>
              <button
                data-testid={`class-edit-${c.id}`}
                onClick={() => { setEditingId(c.id); setEditName(c.name); setEditStudentCount(String(c.studentCount ?? '')); setEditError(null) }}
                style={{ padding: '5px 12px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
              >
                Edit
              </button>
              <button
                data-testid={`class-delete-${c.id}`}
                onClick={() => handleDelete(c.id, c.name)}
                disabled={deletingId === c.id}
                style={{ padding: '5px 12px', background: 'white', color: '#c0392b', border: '1px solid #e8b4b0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', flexShrink: 0, opacity: deletingId === c.id ? 0.5 : 1 }}
              >
                {deletingId === c.id ? '…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      ))}

      {classes.length > 0 && (
        <p style={{ fontSize: '12px', color: '#aaa', textAlign: 'right', marginTop: '8px' }}>
          {classes.length} / 20 classes
        </p>
      )}
    </div>
  )
}

export default Classes
