import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SkeletonLines } from '../../components/Skeleton'
import API_BASE from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import { ATTESTATION_VERSION, CLASS_ATTESTATION, isLegalPending } from '../../data/legalContent'

const CLASS_NAME_MAX = 80
const ATTESTATION_PENDING = isLegalPending(CLASS_ATTESTATION)

function Classes() {
  const { login } = useAuth()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)
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
  const [creatingDemo, setCreatingDemo] = useState(false)
  const [attesting, setAttesting] = useState(false)
  const [attestError, setAttestError] = useState(null)
  const [newAttested, setNewAttested] = useState(false)

  const realClasses = classes.filter(c => !c.isDemo)
  const hasDemoClass = classes.some(c => c.isDemo)
  // R3 Task 6 — real classes created before attestation existed (or shells, which skip it).
  const unattestedClasses = realClasses.filter(c => !c.attestedAt)

  useEffect(() => { fetchClasses() }, [])

  async function fetchClasses() {
    setLoading(true)
    setError(null)
    setSessionExpired(false)
    try {
      const res = await fetch(`${API_BASE}/classes`)
      if (res.status === 401) { setSessionExpired(true); return }
      if (!res.ok) throw new Error('Something went wrong loading your classes.')
      setClasses(await res.json())
    } catch {
      setError('Something went wrong loading your classes.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setCreateError('Class name is required.'); return }
    if (name.length > CLASS_NAME_MAX) { setCreateError(`Class name must be ${CLASS_NAME_MAX} characters or fewer.`); return }
    if (!ATTESTATION_PENDING && !newAttested) { setCreateError('Please confirm your school has authorised QuizPulse.'); return }

    setSaving(true)
    setCreateError(null)
    try {
      const res = await fetch(`${API_BASE}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          studentCount: newStudentCount !== '' ? parseInt(newStudentCount, 10) : 0,
          ...(ATTESTATION_PENDING ? {} : { attestation: { schoolAuthorised: true, version: ATTESTATION_VERSION } }),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || 'Failed to create class.'); return }
      setClasses(prev => [...prev, data])
      setNewName('')
      setNewStudentCount('')
      setNewAttested(false)
      setCreating(false)
    } catch {
      setCreateError('Could not connect to the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // R3 Task 6 — one confirm attests every un-attested class at once (design review finding 7:
  // per-class banner spam trains teachers to click without reading). Sequential, not Promise.all —
  // same convention as school merge / class shells, so one failure doesn't corrupt the batch.
  async function attestAll() {
    setAttesting(true)
    setAttestError(null)
    const failed = []
    for (const c of unattestedClasses) {
      try {
        const res = await fetch(`${API_BASE}/classes/${c.id}/attest`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: ATTESTATION_VERSION }),
        })
        if (!res.ok) { failed.push(c.name); continue }
        const updated = await res.json()
        setClasses(prev => prev.map(x => x.id === c.id ? updated : x))
      } catch {
        failed.push(c.name)
      }
    }
    if (failed.length > 0) setAttestError(`Couldn't confirm: ${failed.join(', ')}. Try again.`)
    setAttesting(false)
  }

  async function handleCreateDemo() {
    setCreatingDemo(true)
    try {
      const res = await fetch(`${API_BASE}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDemo: true, name: 'Demo class' }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Could not create the demo class. Please try again.'); return }
      await fetchClasses()
    } catch {
      alert('Could not connect to the server. Please try again.')
    } finally {
      setCreatingDemo(false)
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
    if (!window.confirm(`Delete "${name}"? Students' names and notification sign-ups are removed. Their answers stay in your quiz results without names. This can't be undone.`)) return
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

  if (loading) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}><SkeletonLines lines={4} /></div>

  if (sessionExpired) return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '12px' }}>Your session has ended. Sign in again to see your classes.</p>
      <button
        onClick={() => login()}
        style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
      >
        Sign in
      </button>
    </div>
  )

  if (error) return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
      <p style={{ color: '#c0392b', fontSize: '14px', marginBottom: '12px' }}>{error}</p>
      <button
        onClick={fetchClasses}
        style={{ padding: '8px 16px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '8px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Classes</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!hasDemoClass && (
            <button
              data-testid="class-demo-btn"
              onClick={handleCreateDemo}
              disabled={creatingDemo}
              title="Create a class with practice students so you can try sending a quiz right away"
              className="btn btn-secondary"
              style={{ cursor: creatingDemo ? 'wait' : 'pointer', opacity: creatingDemo ? 0.7 : 1 }}
            >
              {creatingDemo ? 'Setting up…' : 'Try with a demo class'}
            </button>
          )}
          <button
            data-testid="class-new-btn"
            onClick={() => { setCreating(true); setCreateError(null) }}
            disabled={creating || realClasses.length >= 20}
            title={realClasses.length >= 20 ? 'Maximum 20 classes reached' : 'Add a new class'}
            style={{
              padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)',
              borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: '500',
              cursor: realClasses.length >= 20 ? 'not-allowed' : 'pointer',
              opacity: realClasses.length >= 20 ? 0.5 : 1,
            }}
          >
            + New class
          </button>
        </div>
      </div>

      {creating && (
        <form onSubmit={handleCreate} style={{ background: '#f8f8f8', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>New class</div>
          <input
            data-testid="class-name-input"
            type="text"
            aria-label="Class name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Class name (e.g. Year 9 Science)"
            maxLength={CLASS_NAME_MAX}
            autoFocus
            disabled={saving}
            style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: 'var(--radius)', border: 'var(--bw) solid var(--border)', boxSizing: 'border-box', marginBottom: '8px' }}
          />
          <input
            type="number"
            aria-label="Estimated number of students (optional)"
            value={newStudentCount}
            onChange={e => setNewStudentCount(e.target.value)}
            placeholder="Estimated students (optional, for simulation)"
            min={0}
            max={40}
            disabled={saving}
            style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: 'var(--radius)', border: 'var(--bw) solid var(--border)', boxSizing: 'border-box', marginBottom: '8px' }}
          />
          {ATTESTATION_PENDING ? (
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 10px', lineHeight: '1.5' }}>
              The school-authorisation confirmation is being finalised — you can still create classes.
            </p>
          ) : (
            <label htmlFor="attest-new-class" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '0 0 10px', fontSize: '12px', lineHeight: '1.5' }}>
              <input
                id="attest-new-class"
                type="checkbox"
                checked={newAttested}
                aria-required="true"
                onChange={e => setNewAttested(e.target.checked)}
                disabled={saving}
                style={{ marginTop: '2px' }}
              />
              <span>{CLASS_ATTESTATION.text}</span>
            </label>
          )}
          {createError && <p role="alert" style={{ color: '#c0392b', fontSize: '13px', margin: '0 0 8px' }}>{createError}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              data-testid="class-create-submit"
              type="submit"
              disabled={saving}
              style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: 'var(--radius)', fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName(''); setNewStudentCount(''); setCreateError(null) }}
              style={{ padding: '8px 16px', background: 'white', color: 'var(--muted)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {unattestedClasses.length > 0 && !ATTESTATION_PENDING && (
        <div style={{ background: '#fff8e6', border: '1px solid #f0d999', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: '#8a6d1a', marginBottom: '8px', lineHeight: '1.5' }}>
            {unattestedClasses.length} class{unattestedClasses.length !== 1 ? 'es' : ''} need{unattestedClasses.length === 1 ? 's' : ''} you
            to confirm your school has authorised QuizPulse before students keep joining.
          </div>
          {attestError && <p role="alert" style={{ color: '#c0392b', fontSize: '12px', margin: '0 0 8px' }}>{attestError}</p>}
          <button
            onClick={attestAll}
            disabled={attesting}
            style={{ padding: '6px 14px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', cursor: 'pointer', opacity: attesting ? 0.7 : 1 }}
          >
            {attesting ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      )}

      {classes.length === 0 && !creating && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px', border: '1px dashed #eee', borderRadius: 'var(--radius)' }}>
          No classes yet. Click <strong>+ New class</strong> to get started.
        </div>
      )}

      {classes.map(c => (
        <div key={c.id} style={{ border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '10px', background: 'white' }}>
          {editingId === c.id ? (
            <div>
              <input
                type="text"
                aria-label="Class name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={CLASS_NAME_MAX}
                disabled={saving}
                style={{ width: '100%', padding: '6px 10px', fontSize: '14px', borderRadius: 'var(--radius)', border: 'var(--bw) solid var(--border)', boxSizing: 'border-box', marginBottom: '8px' }}
              />
              <input
                type="number"
                aria-label="Student count"
                value={editStudentCount}
                onChange={e => setEditStudentCount(e.target.value)}
                placeholder="Student count"
                min={0}
                max={40}
                disabled={saving}
                style={{ width: '100%', padding: '6px 10px', fontSize: '14px', borderRadius: 'var(--radius)', border: 'var(--bw) solid var(--border)', boxSizing: 'border-box', marginBottom: '8px' }}
              />
              {editError && <p style={{ color: '#c0392b', fontSize: '13px', margin: '0 0 8px' }}>{editError}</p>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleUpdate(c.id)}
                  disabled={saving}
                  style={{ padding: '6px 14px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: 'var(--radius)', fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingId(null); setEditError(null) }}
                  style={{ padding: '6px 14px', background: 'white', color: 'var(--muted)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {c.name}
                  {c.isDemo && (
                    <span
                      data-testid={`class-demo-pill-${c.id}`}
                      className="tag tag-neutral" style={{ flexShrink: 0 }}
                    >
                      Demo
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {c.studentCount} student{c.studentCount !== 1 ? 's' : ''}
                  {c.isDemo ? (
                    <> · practice students — no one is notified</>
                  ) : (
                    <> · Code: <span style={{ fontFamily: 'monospace', letterSpacing: '0.5px', color: '#555' }}>{c.joinCode}</span></>
                  )}
                </div>
              </div>
              {!c.isDemo && (
                <Link
                  to={`/teacher/roster?classId=${c.id}`}
                  style={{ padding: '5px 12px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', cursor: 'pointer', flexShrink: 0, textDecoration: 'none' }}
                >
                  Roster
                </Link>
              )}
              <button
                data-testid={`class-edit-${c.id}`}
                onClick={() => { setEditingId(c.id); setEditName(c.name); setEditStudentCount(String(c.studentCount ?? '')); setEditError(null) }}
                style={{ padding: '5px 12px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
              >
                Edit
              </button>
              <button
                data-testid={`class-delete-${c.id}`}
                onClick={() => handleDelete(c.id, c.name)}
                disabled={deletingId === c.id}
                style={{ padding: '5px 12px', background: 'white', color: '#c0392b', border: '1px solid #e8b4b0', borderRadius: 'var(--radius)', fontSize: '12px', cursor: 'pointer', flexShrink: 0, opacity: deletingId === c.id ? 0.5 : 1 }}
              >
                {deletingId === c.id ? '…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      ))}

      {realClasses.length > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'right', marginTop: '8px' }}>
          {realClasses.length} / 20 classes
        </p>
      )}
    </div>
  )
}

export default Classes
