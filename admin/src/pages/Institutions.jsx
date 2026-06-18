import { useState, useEffect } from 'react'
import { listSchools, createInstitution, createInvite } from '../api.js'

const inputStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, width: '100%' }
const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, display: 'block' }
const fieldStyle = { marginBottom: 14 }
const sectionStyle = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 20, marginBottom: 20,
}

export default function Institutions() {
  const [form, setForm] = useState({ name: '', sector: '', suburb: '', state: '' })
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState(null)

  const [institutions, setInstitutions] = useState([])
  const [loadingList, setLoadingList] = useState(false)

  const [inviteStates, setInviteStates] = useState({}) // { [schoolId]: { loading, result, error } }

  useEffect(() => { loadInstitutions() }, [])

  async function loadInstitutions() {
    setLoadingList(true)
    try {
      const data = await listSchools({ status: 'validated', limit: 100 })
      setInstitutions(data.schools)
    } catch {
      // non-blocking
    } finally {
      setLoadingList(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    setCreateResult(null)
    try {
      const school = await createInstitution(form)
      setCreateResult({ type: 'success', message: `Created: ${school.name} (ID: ${school.id})` })
      setForm({ name: '', sector: '', suburb: '', state: '' })
      await loadInstitutions()
    } catch (err) {
      setCreateResult({ type: 'error', message: err.message })
    } finally {
      setCreating(false)
    }
  }

  async function handleInvite(schoolId) {
    setInviteStates((prev) => ({ ...prev, [schoolId]: { loading: true } }))
    try {
      const invite = await createInvite(schoolId)
      const link = `${window.location.origin}/?invite=${invite.token}`
      setInviteStates((prev) => ({ ...prev, [schoolId]: { result: { link, expiresAt: invite.expiresAt } } }))
    } catch (err) {
      setInviteStates((prev) => ({ ...prev, [schoolId]: { error: err.message } }))
    }
  }

  function copyLink(link) {
    navigator.clipboard.writeText(link).catch(() => {})
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Institutions</h1>

      {/* Create institution */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Create validated institution</h2>
        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>School name *</label>
              <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} required />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Sector</label>
              <input style={inputStyle} value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="e.g. Government" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>State</label>
              <input style={inputStyle} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="e.g. VIC" />
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Suburb</label>
              <input style={inputStyle} value={form.suburb} onChange={(e) => setForm({ ...form, suburb: e.target.value })} />
            </div>
          </div>

          {createResult && (
            <div style={{
              borderRadius: 4, padding: '8px 12px', fontSize: 13, marginBottom: 12,
              background: createResult.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: createResult.type === 'success' ? '#166534' : '#991b1b',
              border: `1px solid ${createResult.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {createResult.message}
            </div>
          )}

          <button
            type="submit"
            disabled={creating || !form.name.trim()}
            style={{ padding: '7px 18px', background: '#4c8bf5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {creating ? 'Creating…' : 'Create institution'}
          </button>
        </form>
      </div>

      {/* Institution list with invite generation */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
          Validated institutions {!loadingList && <span style={{ fontWeight: 400, color: '#64748b' }}>({institutions.length})</span>}
        </h2>

        {loadingList && <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>}

        {institutions.map((s) => {
          const inv = inviteStates[s.id] || {}
          return (
            <div key={s.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                    {s.state || '—'} · {s.sector || '—'} · {s.teacherCount} teachers · {s.classCount} classes
                  </div>
                </div>
                <button
                  onClick={() => handleInvite(s.id)}
                  disabled={inv.loading}
                  style={{ flexShrink: 0, padding: '4px 12px', fontSize: 12, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer' }}
                >
                  {inv.loading ? 'Generating…' : 'Generate invite link'}
                </button>
              </div>

              {inv.result && (
                <div style={{ marginTop: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '8px 12px', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ flex: 1, wordBreak: 'break-all', color: '#166534' }}>{inv.result.link}</code>
                    <button
                      onClick={() => copyLink(inv.result.link)}
                      style={{ flexShrink: 0, padding: '3px 10px', background: '#166534', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{ color: '#6b7280', marginTop: 4 }}>
                    Expires {new Date(inv.result.expiresAt).toLocaleDateString()} · One-time use
                  </div>
                </div>
              )}
              {inv.error && (
                <div style={{ marginTop: 6, color: '#dc2626', fontSize: 12 }}>Error: {inv.error}</div>
              )}
            </div>
          )
        })}

        {!loadingList && institutions.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>No validated institutions yet.</div>
        )}
      </div>
    </div>
  )
}
