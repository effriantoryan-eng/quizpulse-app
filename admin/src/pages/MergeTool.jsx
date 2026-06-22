import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { listSchools, mergeSchools } from '../api.js'
import { adminReauthRequest } from '../authConfig.js'

const cardStyle = {
  flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 20,
}

const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6, display: 'block' }

function SchoolPicker({ label, value, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  async function search(q) {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const data = await listSchools({ search: q, limit: 10 })
      setResults(data.schools)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function select(school) {
    onChange(school)
    setQuery(school.name)
    setResults([])
  }

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={value ? `${value.name} (${value.status})` : query}
        onChange={(e) => { onChange(null); search(e.target.value) }}
        placeholder="Search by name…"
        style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
      />
      {searching && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Searching…</div>}
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
          border: '1px solid #cbd5e1', borderRadius: 4, zIndex: 10, maxHeight: 200, overflowY: 'auto',
        }}>
          {results.map((s) => (
            <div
              key={s.id}
              onClick={() => select(s)}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
            >
              <strong>{s.name}</strong>
              <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 8 }}>{s.status} · {s.teacherCount} teachers</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SchoolSummary({ school, label, color }) {
  if (!school) {
    return (
      <div style={{ ...cardStyle, borderColor: '#f1f5f9' }}>
        <div style={{ color: '#94a3b8', fontSize: 13 }}>No school selected</div>
      </div>
    )
  }
  return (
    <div style={{ ...cardStyle, borderColor: color || '#e2e8f0' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{school.name}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        {school.status} · {school.sector || 'no sector'} · {school.state || 'no state'}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{school.teacherCount}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Teachers</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{school.classCount}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Classes</div>
        </div>
      </div>
    </div>
  )
}

export default function MergeTool() {
  const { instance } = useMsal()
  const [source, setSource] = useState(null)
  const [target, setTarget] = useState(null)
  const [status, setStatus] = useState(null) // { type: 'error'|'success'|'reauth', message }
  const [merging, setMerging] = useState(false)

  async function handleMerge() {
    if (!source || !target) return
    if (source.id === target.id) {
      setStatus({ type: 'error', message: 'Source and target must be different schools.' })
      return
    }
    if (!window.confirm(
      `Merge "${source.name}" INTO "${target.name}"?\n\n` +
      `This will move ${source.teacherCount} teacher(s) and ${source.classCount} class(es). ` +
      `"${source.name}" will be marked merged. This cannot be undone.`
    )) return

    setMerging(true)
    setStatus(null)
    try {
      const result = await mergeSchools(source.id, target.id)
      setStatus({ type: 'success', message: `Merged: ${result.teachersRepointed} teachers and ${result.classesRepointed} classes moved to "${target.name}".` })
      setSource(null)
      setTarget(null)
    } catch (err) {
      if (err.status === 401 && err.body?.reauthRequired) {
        setStatus({
          type: 'reauth',
          message: 'This action requires a fresh sign-in (step-up re-authentication). Click below to sign in again, then retry the merge.',
        })
      } else {
        setStatus({ type: 'error', message: err.message })
      }
    } finally {
      setMerging(false)
    }
  }

  async function handleReauth() {
    await instance.loginRedirect(adminReauthRequest)
  }

  const canMerge = source && target && source.id !== target.id && target.status === 'validated'

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Merge Tool</h1>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 1.6 }}>
          Moves all teachers and classes from the <strong>source</strong> school to the <strong>target</strong> school.
          The target must be validated. The source is tombstoned (not deleted) after the merge.
          <strong style={{ color: '#dc2626' }}> This is irreversible.</strong>
        </p>

        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <SchoolPicker label="Source school (will be merged away)" value={source} onChange={setSource} />
          </div>
          <div style={{ flex: 1 }}>
            <SchoolPicker label="Target school (must be validated)" value={target} onChange={setTarget} />
          </div>
        </div>

        {(source || target) && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <SchoolSummary school={source} label="SOURCE — will be merged" color="#fca5a5" />
            <div style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: 20 }}>→</div>
            <SchoolSummary school={target} label="TARGET — will absorb teachers and classes" color="#86efac" />
          </div>
        )}

        {target && target.status !== 'validated' && (
          <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 4, padding: '8px 12px', fontSize: 13, color: '#854d0e', marginBottom: 12 }}>
            The target school must be validated before merging.
          </div>
        )}

        {status && (
          <div style={{
            borderRadius: 4, padding: '10px 14px', fontSize: 13, marginBottom: 12,
            background: status.type === 'success' ? '#dcfce7' : status.type === 'reauth' ? '#eff6ff' : '#fee2e2',
            color: status.type === 'success' ? '#166534' : status.type === 'reauth' ? '#1e40af' : '#991b1b',
            border: `1px solid ${status.type === 'success' ? '#bbf7d0' : status.type === 'reauth' ? '#bfdbfe' : '#fecaca'}`,
          }}>
            {status.message}
            {status.type === 'reauth' && (
              <button
                onClick={handleReauth}
                style={{ marginLeft: 12, padding: '3px 10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
              >
                Sign in again
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleMerge}
          disabled={!canMerge || merging}
          style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            background: canMerge ? '#dc2626' : '#e2e8f0',
            color: canMerge ? '#fff' : '#94a3b8',
            border: 'none', borderRadius: 4, cursor: canMerge ? 'pointer' : 'not-allowed',
          }}
        >
          {merging ? 'Merging…' : 'Confirm merge'}
        </button>
      </div>
    </div>
  )
}
