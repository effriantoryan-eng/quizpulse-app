import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listSchools, validateSchool } from '../api.js'

const STATUS_BADGE = {
  validated: { background: '#dcfce7', color: '#166534', label: 'Validated' },
  unvalidated: { background: '#fef9c3', color: '#854d0e', label: 'Unvalidated' },
}

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const thStyle = {
  background: '#f1f5f9', borderBottom: '1px solid #e2e8f0',
  padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569',
}
const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }

function Badge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.unvalidated
  return (
    <span style={{ ...s, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {s.label}
    </span>
  )
}

export default function Schools() {
  const navigate = useNavigate()
  const [schools, setSchools] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [validating, setValidating] = useState(null)
  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listSchools({ search, status: statusFilter, limit: LIMIT, offset })
      setSchools(data.schools)
      setTotal(data.total)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, offset])

  useEffect(() => { load() }, [load])

  // Reset offset when filters change
  useEffect(() => { setOffset(0) }, [search, statusFilter])

  async function handleValidate(school) {
    if (!window.confirm(`Validate "${school.name}"? This marks it as a verified institution.`)) return
    setValidating(school.id)
    try {
      await validateSchool(school.id)
      await load()
    } catch (err) {
      alert(`Validation failed: ${err.message}`)
    } finally {
      setValidating(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Schools</h1>
        <button
          onClick={() => navigate('/schools/merge')}
          style={{ padding: '6px 14px', background: '#4c8bf5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
        >
          Merge tool
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, width: 260 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
        >
          <option value="all">All statuses</option>
          <option value="validated">Validated</option>
          <option value="unvalidated">Unvalidated</option>
        </select>
        <span style={{ alignSelf: 'center', color: '#64748b', fontSize: 12 }}>
          {loading ? 'Loading…' : `${total} schools`}
        </span>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>Error: {error}</div>}

      <div style={{ background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Sector</th>
              <th style={thStyle}>State</th>
              <th style={thStyle}>Teachers</th>
              <th style={thStyle}>Classes</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {schools.length === 0 && !loading && (
              <tr><td colSpan={8} style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center', padding: 24 }}>No schools found</td></tr>
            )}
            {schools.map((s) => (
              <tr key={s.id} style={{ ':hover': { background: '#f8fafc' } }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{s.id}</div>
                </td>
                <td style={tdStyle}><Badge status={s.status} /></td>
                <td style={tdStyle}>{s.sector || '—'}</td>
                <td style={tdStyle}>{s.state || '—'}</td>
                <td style={tdStyle}>{s.teacherCount}</td>
                <td style={tdStyle}>{s.classCount}</td>
                <td style={tdStyle}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                <td style={tdStyle}>
                  {s.status !== 'validated' && !s.mergedIntoId && (
                    <button
                      onClick={() => handleValidate(s)}
                      disabled={validating === s.id}
                      style={{ padding: '3px 10px', fontSize: 12, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 4, cursor: 'pointer' }}
                    >
                      {validating === s.id ? 'Validating…' : 'Validate'}
                    </button>
                  )}
                  {s.mergedIntoId && (
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>Merged</span>
                  )}
                </td>
              </tr>
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
          <span style={{ color: '#64748b' }}>
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
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
