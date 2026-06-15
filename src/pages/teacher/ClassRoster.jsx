import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import API_BASE from '../../api'

function ClassRoster() {
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId')

  const [cls, setCls] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [regenerating, setRegenerating] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [togglingNameList, setTogglingNameList] = useState(false)

  useEffect(() => {
    if (classId) fetchData()
  }, [classId])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [classesRes, requestsRes] = await Promise.all([
        fetch(`${API_BASE}/classes`),
        fetch(`${API_BASE}/join-requests?classId=${encodeURIComponent(classId)}`),
      ])
      if (!classesRes.ok) throw new Error('Failed to load class data')
      if (!requestsRes.ok) throw new Error('Failed to load roster')

      const classes = await classesRes.json()
      const found = classes.find(c => c.id === classId)
      if (!found) throw new Error('Class not found')
      setCls(found)
      setRequests(await requestsRes.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function regenerateCode() {
    if (!window.confirm('Regenerate the join code? The old code will stop working immediately.')) return
    setRegenerating(true)
    try {
      const res = await fetch(`${API_BASE}/classes/${classId}/regenerate-code`, { method: 'PUT' })
      if (!res.ok) { alert('Failed to regenerate join code.'); return }
      const updated = await res.json()
      setCls(updated)
    } catch {
      alert('Could not connect to the server. Please try again.')
    } finally {
      setRegenerating(false)
    }
  }

  async function removeStudent(studentId, studentName) {
    if (!window.confirm(`Remove ${studentName} from this class?`)) return
    setRemovingId(studentId)
    try {
      const res = await fetch(`${API_BASE}/classes/${classId}/students/${studentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to remove student.')
        return
      }
      await fetchData()
    } catch {
      alert('Could not connect to the server. Please try again.')
    } finally {
      setRemovingId(null)
    }
  }

  async function toggleNameList(enabled) {
    setTogglingNameList(true)
    try {
      const res = await fetch(`${API_BASE}/classes/${classId}/namelist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameListEnabled: enabled }),
      })
      if (!res.ok) { alert('Failed to update name list setting.'); return }
      const updated = await res.json()
      setCls(updated)
    } catch {
      alert('Could not connect to the server. Please try again.')
    } finally {
      setTogglingNameList(false)
    }
  }

  if (!classId) {
    return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#c0392b', fontSize: '14px' }}>No classId provided.</div>
  }
  if (loading) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#888', fontSize: '14px' }}>Loading roster…</div>
  if (error) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#c0392b', fontSize: '14px' }}>Failed to load roster: {error}</div>

  const approved = requests.filter(r => r.status === 'approved')
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const queuedCount = requests.filter(r => r.status === 'queued').length

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '18px' }}>{cls.name}</h2>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#888' }}>
        {approved.length} active · {pendingCount} pending · {queuedCount} queued
      </p>

      {/* Join code panel */}
      <div style={{ background: '#f8f8f8', border: '1px solid #eee', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Join code</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '22px', letterSpacing: '2px', fontWeight: '600', color: '#534AB7' }}>
            {cls.joinCode}
          </span>
          <button
            onClick={regenerateCode}
            disabled={regenerating}
            style={{ padding: '5px 12px', background: 'white', color: '#534AB7', border: '1px solid #C5C0F0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', opacity: regenerating ? 0.5 : 1 }}
          >
            {regenerating ? '…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* Name list toggle */}
      <div style={{ background: '#f8f8f8', border: '1px solid #eee', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500' }}>Name list validation</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
              {cls.nameListEnabled
                ? `Enabled · ${cls.nameList?.length || 0} names`
                : 'Disabled — any name accepted'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to={`/teacher/classes/settings?classId=${classId}`}
              style={{ fontSize: '12px', color: '#534AB7', textDecoration: 'none' }}
            >
              Edit list
            </Link>
            <button
              onClick={() => toggleNameList(!cls.nameListEnabled)}
              disabled={togglingNameList}
              style={{
                padding: '4px 12px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px',
                background: cls.nameListEnabled ? '#534AB7' : 'white',
                color: cls.nameListEnabled ? 'white' : '#555',
                cursor: 'pointer', opacity: togglingNameList ? 0.5 : 1,
              }}
            >
              {cls.nameListEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>

      {/* Pending requests link */}
      {(pendingCount + queuedCount) > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <Link
            to={`/teacher/pending-requests?classId=${classId}`}
            style={{ fontSize: '13px', color: '#534AB7', textDecoration: 'none', fontWeight: '500' }}
          >
            → Review {pendingCount + queuedCount} pending / queued request{pendingCount + queuedCount !== 1 ? 's' : ''}
          </Link>
        </div>
      )}

      {/* Active students */}
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#555', fontWeight: '500' }}>
        Active students ({approved.length})
      </h3>

      {approved.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#aaa', fontSize: '13px', border: '1px dashed #eee', borderRadius: '10px' }}>
          No approved students yet.{' '}
          <Link to={`/teacher/pending-requests?classId=${classId}`} style={{ color: '#534AB7' }}>
            Review join requests
          </Link>
        </div>
      )}

      {approved.map(req => (
        <div
          key={req.id}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #eee', borderRadius: '10px', padding: '10px 14px', marginBottom: '8px', background: 'white' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.studentName}</div>
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
              Joined {new Date(req.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => removeStudent(req.id, req.studentName)}
            disabled={removingId === req.id}
            style={{ padding: '5px 12px', background: 'white', color: '#c0392b', border: '1px solid #e8b4b0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', flexShrink: 0, opacity: removingId === req.id ? 0.5 : 1 }}
          >
            {removingId === req.id ? '…' : 'Remove'}
          </button>
        </div>
      ))}
    </div>
  )
}

export default ClassRoster
