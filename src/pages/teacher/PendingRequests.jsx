import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
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
  const { login } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const classId = searchParams.get('classId')

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [actionInProgress, setActionInProgress] = useState(false)
  const [actionError, setActionError] = useState(null)

  // v4.6.0 Task 5 — when there's no ?classId=, resolve it instead of bouncing the teacher to
  // Classes: auto-select if exactly one class has pending requests, else offer an in-place
  // picker among the classes that do. null = still resolving, [] = resolved (possibly empty).
  const [candidateClasses, setCandidateClasses] = useState(null)

  useEffect(() => {
    if (classId) return
    let cancelled = false
    async function resolveCandidates() {
      try {
        const res = await fetch(`${API_BASE}/classes`)
        const classes = await res.json()
        const real = (Array.isArray(classes) ? classes : []).filter((c) => !c.isDemo)
        const withCounts = await Promise.all(real.map(async (c) => {
          try {
            const r = await fetch(`${API_BASE}/join-requests?classId=${encodeURIComponent(c.id)}`)
            if (!r.ok) return { id: c.id, name: c.name, pendingCount: null } // count unknown (e.g. rate-limited)
            const reqs = await r.json()
            const pendingCount = Array.isArray(reqs)
              ? reqs.filter((x) => x.status === 'pending' || x.status === 'queued').length
              : null
            return { id: c.id, name: c.name, pendingCount }
          } catch {
            return { id: c.id, name: c.name, pendingCount: null } // fetch failed — don't claim 0
          }
        }))
        if (cancelled) return
        // Fail open: a class whose count couldn't be loaded (pendingCount null) still appears in
        // the picker, so a rate-limited/failed count can never hide a class that actually has
        // students waiting. Only classes confirmed to have zero pending are dropped.
        const candidates = withCounts.filter((c) => c.pendingCount === null || c.pendingCount > 0)
        setCandidateClasses(candidates)
        // Auto-select only when exactly one class is CONFIRMED to have pending requests and no
        // count failed — otherwise show the picker so an unknown count can't cause a wrong jump.
        const noneFailed = withCounts.every((c) => c.pendingCount !== null)
        const confirmedPending = withCounts.filter((c) => c.pendingCount > 0)
        if (noneFailed && confirmedPending.length === 1) {
          setSearchParams({ classId: confirmedPending[0].id }, { replace: true })
        }
      } catch {
        if (!cancelled) setCandidateClasses([])
      }
    }
    resolveCandidates()
    return () => { cancelled = true }
  }, [classId, setSearchParams])

  useEffect(() => {
    if (classId) fetchRequests()
  }, [classId])

  async function fetchRequests() {
    setLoading(true)
    setError(null)
    setSessionExpired(false)
    try {
      const res = await fetch(`${API_BASE}/join-requests?classId=${encodeURIComponent(classId)}`)
      if (res.status === 401) { setSessionExpired(true); return }
      if (!res.ok) throw new Error('Something went wrong loading requests.')
      const all = await res.json()
      // Show only pending and queued for the approval UI
      setRequests(all.filter(r => r.status === 'pending' || r.status === 'queued'))
    } catch {
      setError('Something went wrong loading requests.')
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
    if (candidateClasses === null) {
      return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#888', fontSize: '14px' }}>Loading…</div>
    }
    if (candidateClasses.length === 0) {
      return (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#555', fontSize: '14px' }}>
          No classes have pending join requests right now. See <Link to="/teacher/classes">Classes</Link> for rosters.
        </div>
      )
    }
    // More than one class has pending requests — pick one in place, rather than bouncing to
    // Classes and asking the teacher to find their own way back here.
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '18px' }}>Which class?</h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#888' }}>
          More than one class has students waiting to join.
        </p>
        {candidateClasses.map((c) => (
          <button
            key={c.id}
            onClick={() => setSearchParams({ classId: c.id })}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
              textAlign: 'left', cursor: 'pointer', padding: '14px 16px', marginBottom: '8px',
              background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '10px',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{c.name}</span>
            <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
              {c.pendingCount === null ? 'Open →' : `${c.pendingCount} waiting →`}
            </span>
          </button>
        ))}
      </div>
    )
  }
  if (loading) return <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', color: '#888', fontSize: '14px' }}>Loading requests…</div>

  if (sessionExpired) return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>Your session has ended. Sign in again to continue.</p>
      <button
        onClick={() => login()}
        style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
      >
        Sign in
      </button>
    </div>
  )

  if (error) return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
      <p style={{ color: '#c0392b', fontSize: '14px', marginBottom: '12px' }}>{error}</p>
      <button
        onClick={fetchRequests}
        style={{ padding: '8px 16px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  )

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
