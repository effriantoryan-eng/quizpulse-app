import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import API_BASE from '../../api'

function matchBadge(req) {
  if (!req.matchedName) {
    if (req.matchScore === 0) return null // no name list configured
    return <span style={{ fontSize: '11px', padding: '2px 7px', background: '#fdecea', color: '#c0392b', borderRadius: '10px' }}>not on list</span>
  }
  const pct = Math.round(req.matchScore * 100)
  if (req.matchScore >= 0.85) {
    return <span style={{ fontSize: '11px', padding: '2px 7px', background: '#eafaf1', color: '#27ae60', borderRadius: '10px' }}>likely: {req.matchedName} ({pct}%)</span>
  }
  if (req.matchScore >= 0.60) {
    return <span style={{ fontSize: '11px', padding: '2px 7px', background: '#fef9e7', color: '#e67e22', borderRadius: '10px' }}>partial: {req.matchedName} ({pct}%)</span>
  }
  return <span style={{ fontSize: '11px', padding: '2px 7px', background: '#fdecea', color: '#c0392b', borderRadius: '10px' }}>not on list</span>
}

function sortRequests(requests) {
  return [...requests].sort((a, b) => {
    const scoreA = a.matchScore || 0
    const scoreB = b.matchScore || 0
    // queued last
    if (a.status === 'queued' && b.status !== 'queued') return 1
    if (b.status === 'queued' && a.status !== 'queued') return -1
    // green (>=0.85) first, amber (0.6-0.85) second, red last
    if (scoreA >= 0.85 && scoreB < 0.85) return -1
    if (scoreB >= 0.85 && scoreA < 0.85) return 1
    if (scoreA >= 0.60 && scoreB < 0.60) return -1
    if (scoreB >= 0.60 && scoreA < 0.60) return 1
    // within same tier, newest first
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
}

function PendingRequests() {
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId')

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [actionInProgress, setActionInProgress] = useState(false)
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    if (classId) fetchRequests()
  }, [classId])

  async function fetchRequests() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/join-requests?classId=${encodeURIComponent(classId)}`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const all = await res.json()
      // Show only pending and queued for the approval UI
      setRequests(all.filter(r => r.status === 'pending' || r.status === 'queued'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const pendingIds = requests.filter(r => r.status === 'pending').map(r => r.id)
    if (selected.size === pendingIds.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingIds))
    }
  }

  async function approveSelected() {
    if (selected.size === 0) return
    setActionInProgress(true)
    setActionError(null)
    try {
      const res = await fetch(`${API_BASE}/join-requests/approve-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, ids: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error || 'Failed to approve requests.'); return }
      setSelected(new Set())
      await fetchRequests()
    } catch {
      setActionError('Could not connect to the server. Please try again.')
    } finally {
      setActionInProgress(false)
    }
  }

  async function approveAll() {
    const pendingIds = requests.filter(r => r.status === 'pending').map(r => r.id)
    if (pendingIds.length === 0) return
    setActionInProgress(true)
    setActionError(null)
    try {
      const res = await fetch(`${API_BASE}/join-requests/approve-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, ids: pendingIds }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error || 'Failed to approve requests.'); return }
      setSelected(new Set())
      await fetchRequests()
    } catch {
      setActionError('Could not connect to the server. Please try again.')
    } finally {
      setActionInProgress(false)
    }
  }

  async function rejectRequest(id) {
    if (!window.confirm('Reject this student\'s request?')) return
    setActionInProgress(true)
    setActionError(null)
    try {
      const res = await fetch(`${API_BASE}/join-requests/${id}/reject?classId=${encodeURIComponent(classId)}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        setActionError(data.error || 'Failed to reject request.')
        return
      }
      await fetchRequests()
    } catch {
      setActionError('Could not connect to the server. Please try again.')
    } finally {
      setActionInProgress(false)
    }
  }

  if (!classId) {
    return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#555', fontSize: '14px' }}>Pick a class first — open <Link to="/teacher/classes">Classes</Link>, choose Roster on the class you want, then switch to this tab.</div>
  }
  if (loading) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#888', fontSize: '14px' }}>Loading requests…</div>
  if (error) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#c0392b', fontSize: '14px' }}>Failed to load requests: {error}</div>

  const sorted = sortRequests(requests)
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const queuedCount = requests.filter(r => r.status === 'queued').length

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Join Requests</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selected.size > 0 && (
            <button
              onClick={approveSelected}
              disabled={actionInProgress}
              style={{ padding: '7px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', opacity: actionInProgress ? 0.6 : 1 }}
            >
              Accept selected ({selected.size})
            </button>
          )}
          {pendingCount > 0 && (
            <button
              onClick={approveAll}
              disabled={actionInProgress}
              style={{ padding: '7px 14px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', opacity: actionInProgress ? 0.6 : 1 }}
            >
              Accept all ({pendingCount})
            </button>
          )}
        </div>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#888' }}>
        {pendingCount} pending · {queuedCount} queued
      </p>

      {actionError && (
        <p style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{actionError}</p>
      )}

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px', border: '1px dashed #eee', borderRadius: '10px' }}>
          No pending join requests.
        </div>
      )}

      {pendingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '0 4px' }}>
          <input
            type="checkbox"
            checked={selected.size === pendingCount && pendingCount > 0}
            onChange={toggleAll}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: '#888' }}>Select all pending</span>
        </div>
      )}

      {sorted.map(req => (
        <div
          key={req.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            border: 'var(--bw) solid var(--border)', borderRadius: '10px', padding: '12px 14px',
            marginBottom: '8px', background: req.status === 'queued' ? '#fafafa' : 'white',
            opacity: req.status === 'queued' ? 0.75 : 1,
          }}
        >
          {req.status === 'pending' && (
            <input
              type="checkbox"
              checked={selected.has(req.id)}
              onChange={() => toggleSelect(req.id)}
              disabled={actionInProgress}
              style={{ cursor: 'pointer', flexShrink: 0 }}
            />
          )}
          {req.status === 'queued' && (
            <span style={{ fontSize: '11px', color: '#aaa', flexShrink: 0, width: '16px', textAlign: 'center' }}>Q</span>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>{req.studentName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#aaa' }}>
                {req.status === 'queued' ? 'Queued' : 'Pending'} · {new Date(req.createdAt).toLocaleDateString()}
              </span>
              {matchBadge(req)}
            </div>
          </div>

          {req.status === 'pending' && (
            <button
              onClick={() => rejectRequest(req.id)}
              disabled={actionInProgress}
              style={{ padding: '5px 12px', background: 'white', color: '#c0392b', border: '1px solid #e8b4b0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', flexShrink: 0, opacity: actionInProgress ? 0.5 : 1 }}
            >
              Reject
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default PendingRequests
