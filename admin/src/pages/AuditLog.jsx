import { useState, useEffect, useCallback } from 'react'
import { listAuditEntries } from '../api.js'

const thStyle = {
  background: '#f1f5f9', borderBottom: '1px solid #e2e8f0',
  padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12,
}
const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #f8fafc', fontSize: 12, verticalAlign: 'top' }

const ACTION_GROUPS = [
  '', 'school.validate', 'school.merge', 'institution.create', 'institution.invite',
  'invite.redeem', 'teacher.role',
]

export default function AuditLog() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const [actorId, setActorId] = useState('')
  const [action, setAction] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: LIMIT, offset }
      if (actorId.trim()) params.actorId = actorId.trim()
      if (action) params.action = action
      if (fromDate) params.from = fromDate
      if (toDate) params.to = toDate
      const data = await listAuditEntries(params)
      setEntries(data.entries)
      setTotal(data.total)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [actorId, action, fromDate, toDate, offset])

  useEffect(() => { load() }, [load])
  useEffect(() => { setOffset(0) }, [actorId, action, fromDate, toDate])

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Audit Log</h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Filter by actor ID…"
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, width: 220 }}
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
        >
          <option value="">All actions</option>
          {ACTION_GROUPS.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
        />
        <span style={{ alignSelf: 'center', color: '#64748b', fontSize: 12 }}>
          {loading ? 'Loading…' : `${total} entries`}
        </span>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>Error: {error}</div>}

      <div style={{ background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Timestamp</th>
              <th style={thStyle}>Actor</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Target</th>
              <th style={thStyle}>IP</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !loading && (
              <tr><td colSpan={7} style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center', padding: 24 }}>No entries found</td></tr>
            )}
            {entries.map((e) => (
              <>
                <tr key={e.id}>
                  <td style={tdStyle}>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{e.actorId}</td>
                  <td style={tdStyle}>
                    <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>{e.actorRole || '—'}</span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{e.action}</td>
                  <td style={tdStyle}>
                    <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{e.targetType}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>{e.targetId}</div>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{e.ip || '—'}</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                      style={{ padding: '2px 8px', fontSize: 11, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, cursor: 'pointer' }}
                    >
                      {expanded === e.id ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>
                {expanded === e.id && (
                  <tr key={`${e.id}-detail`}>
                    <td colSpan={7} style={{ padding: '0 12px 12px', background: '#fafafa' }}>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Before</div>
                          <pre style={{ margin: 0, background: '#f1f5f9', padding: 8, borderRadius: 4, fontSize: 11, overflowX: 'auto' }}>
                            {JSON.stringify(e.before, null, 2) || 'null'}
                          </pre>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>After</div>
                          <pre style={{ margin: 0, background: '#f0fdf4', padding: 8, borderRadius: 4, fontSize: 11, overflowX: 'auto' }}>
                            {JSON.stringify(e.after, null, 2) || 'null'}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {total > LIMIT && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', fontSize: 13 }}>
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
            style={{ padding: '4px 12px', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', background: '#fff' }}
          >
            Previous
          </button>
          <span style={{ color: '#64748b' }}>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
          <button
            onClick={() => setOffset(offset + LIMIT)}
            disabled={offset + LIMIT >= total}
            style={{ padding: '4px 12px', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', background: '#fff' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
