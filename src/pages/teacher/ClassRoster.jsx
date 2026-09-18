import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import API_BASE from '../../api'
import { SkeletonLines } from '../../components/Skeleton'
import { ATTESTATION_VERSION, isLegalPending, CLASS_ATTESTATION } from '../../data/legalContent'

const ATTESTATION_PENDING = isLegalPending(CLASS_ATTESTATION)

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
  const [attesting, setAttesting] = useState(false)
  const [attestError, setAttestError] = useState(null)

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
    if (!window.confirm(`Remove ${studentName} from this class? They'll stop getting notifications, and their answers stay in your results without their name.`)) return
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

  async function attest() {
    setAttesting(true)
    setAttestError(null)
    try {
      const res = await fetch(`${API_BASE}/classes/${classId}/attest`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: ATTESTATION_VERSION }),
      })
      if (!res.ok) { setAttestError("Couldn't save that — try again."); return }
      setCls(await res.json())
    } catch {
      setAttestError('Could not connect to the server. Please try again.')
    } finally {
      setAttesting(false)
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
    return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#555', fontSize: '14px' }}>Pick a class first — open <Link to="/teacher/classes">Classes</Link> and choose Roster on the class you want.</div>
  }
  if (loading) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}><SkeletonLines lines={4} /></div>
  if (error) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#c0392b', fontSize: '14px' }}>Failed to load roster: {error}</div>

  const approved = requests.filter(r => r.status === 'approved')
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const queuedCount = requests.filter(r => r.status === 'queued').length

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '18px' }}>{cls.name}</h2>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--muted)' }}>
        {approved.length} active · {pendingCount} pending · {queuedCount} queued
      </p>

      {cls && !cls.attestedAt && !ATTESTATION_PENDING && (
        <div style={{ background: '#fff8e6', border: '1px solid #f0d999', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: '#8a6d1a', marginBottom: '8px', lineHeight: '1.5' }}>
            {CLASS_ATTESTATION.text}
          </div>
          {attestError && <p role="alert" style={{ color: '#c0392b', fontSize: '12px', margin: '0 0 8px' }}>{attestError}</p>}
          <button
            onClick={attest}
            disabled={attesting}
            style={{ padding: '6px 14px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', cursor: 'pointer', opacity: attesting ? 0.7 : 1 }}
          >
            {attesting ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      )}

      {/* Join code panel */}
      <div style={{ background: '#f8f8f8', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Join code</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '22px', letterSpacing: '2px', fontWeight: '600', color: 'var(--primary)' }}>
            {cls.joinCode}
          </span>
          <button
            onClick={regenerateCode}
            disabled={regenerating}
            style={{ padding: '5px 12px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', cursor: 'pointer', opacity: regenerating ? 0.5 : 1 }}
          >
            {regenerating ? '…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* Name list toggle */}
      <div style={{ background: '#f8f8f8', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500' }}>Name list validation</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {cls.nameListEnabled
                ? `Enabled · ${cls.nameList?.length || 0} names`
                : 'Disabled — any name accepted'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to={`/teacher/classes/settings?classId=${classId}`}
              style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none' }}
            >
              Edit list
            </Link>
            <button
              onClick={() => toggleNameList(!cls.nameListEnabled)}
              disabled={togglingNameList}
              style={{
                padding: '4px 12px', fontSize: '12px', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)',
                background: cls.nameListEnabled ? 'var(--primary)' : 'white',
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
            style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }}
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
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', fontSize: '13px', border: '1px dashed #eee', borderRadius: 'var(--radius)' }}>
          No approved students yet.{' '}
          <Link to={`/teacher/pending-requests?classId=${classId}`} style={{ color: 'var(--primary)' }}>
            Review join requests
          </Link>
        </div>
      )}

      {approved.map(req => (
        <div
          key={req.id}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '8px', background: 'white' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.studentName}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              Joined {new Date(req.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => removeStudent(req.id, req.studentName)}
            disabled={removingId === req.id}
            style={{ padding: '5px 12px', background: 'white', color: '#c0392b', border: '1px solid #e8b4b0', borderRadius: 'var(--radius)', fontSize: '12px', cursor: 'pointer', flexShrink: 0, opacity: removingId === req.id ? 0.5 : 1 }}
          >
            {removingId === req.id ? '…' : 'Remove'}
          </button>
        </div>
      ))}
    </div>
  )
}

export default ClassRoster
