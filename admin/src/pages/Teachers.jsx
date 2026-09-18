import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTeachers, listSchools } from '../api.js'

const tableStyle = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
}
const thStyle = {
  textAlign: 'left', padding: '8px 10px', background: '#f8fafc',
  borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: 12,
}
const tdStyle = {
  padding: '8px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle',
}

export default function Teachers() {
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState([])
  const [total, setTotal] = useState(0)
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: LIMIT, offset }
      if (search.trim()) params.search = search.trim()
      if (schoolFilter) params.schoolId = schoolFilter
      const data = await listTeachers(params)
      setTeachers(data.teachers || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, schoolFilter, offset])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    listSchools({ limit: 200 }).then(d => setSchools(d.schools || [])).catch(() => {})
  }, [])

  // Reset offset when filters change
  useEffect(() => { setOffset(0) }, [search, schoolFilter])

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Teachers</h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by name, email, or id…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 4, flex: '1 1 200px', minWidth: 0 }}
        />
        <select
          value={schoolFilter}
          onChange={e => setSchoolFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 4, flex: '0 1 200px', minWidth: 0 }}
        >
          <option value="">All schools</option>
          {schools.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {loading && <span style={{ color: '#64748b', fontSize: 12, alignSelf: 'center' }}>Loading…</span>}
      </div>

      {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>Error: {error}</div>}

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        Showing {teachers.length} of {total} teachers
      </div>

      {teachers.length === 0 && !loading && (
        <div style={{ color: '#64748b', fontSize: 13, padding: 20, textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 6 }}>
          No teachers found.
        </div>
      )}

      {teachers.length > 0 && (
        <>
          {/* Desktop table — hidden below 640px via the card list below */}
          <div className="teachers-table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>School</th>
                  <th style={thStyle}>Joined</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id}>
                    <td style={tdStyle}>{t.name || <span style={{ color: '#64748b' }}>—</span>}</td>
                    <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.email || <span style={{ color: '#64748b' }}>—</span>}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 11, padding: '2px 6px', borderRadius: 3,
                        background: t.role === 'owner' ? '#fef3c7' : t.role === 'support' ? '#ede9fe' : '#f1f5f9',
                        color: t.role === 'owner' ? '#92400e' : t.role === 'support' ? '#5b21b6' : '#475569',
                      }}>
                        {t.role || 'teacher'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#64748b', fontSize: 11 }}>{t.schoolId ? t.schoolId.slice(0, 8) + '…' : '—'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{t.createdAt ? t.createdAt.slice(0, 10) : '—'}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => navigate(`/teachers/${t.teacherId}`)}
                        style={{ padding: '3px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', whiteSpace: 'nowrap' }}
                      >
                        View data ›
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {total > LIMIT && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            style={{ padding: '4px 12px', fontSize: 12, cursor: offset === 0 ? 'default' : 'pointer', opacity: offset === 0 ? 0.5 : 1, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <button
            disabled={offset + LIMIT >= total}
            onClick={() => setOffset(offset + LIMIT)}
            style={{ padding: '4px 12px', fontSize: 12, cursor: offset + LIMIT >= total ? 'default' : 'pointer', opacity: offset + LIMIT >= total ? 0.5 : 1, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
