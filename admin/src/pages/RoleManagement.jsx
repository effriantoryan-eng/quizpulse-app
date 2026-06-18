import { useState, useEffect, useCallback } from 'react'
import { useMsal } from '@azure/msal-react'
import { listTeachers, setTeacherRole } from '../api.js'

// Role descriptions shown in the assignment modal
const ROLE_INFO = {
  teacher: { label: 'Teacher', description: 'Standard account. Can manage own classes, quizzes, students.', color: '#1a1a1a' },
  school_admin: { label: 'School admin', description: 'School-scoped reads. Future feature — requires schoolId claim.', color: '#1e40af' },
  support: { label: 'Support', description: 'Read-only cross-tenant access. Cannot mutate any resource.', color: '#7c3aed' },
  platform_admin: { label: 'Platform admin', description: 'Operational mutations: validate schools, create institutions.', color: '#0891b2' },
}

const ASSIGNABLE_ROLES = ['teacher', 'school_admin', 'support', 'platform_admin']

const thStyle = {
  background: '#f1f5f9', borderBottom: '1px solid #e2e8f0',
  padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12,
}
const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #f8fafc', fontSize: 13, verticalAlign: 'middle' }

function RoleBadge({ role }) {
  const info = ROLE_INFO[role] || { label: role, color: '#64748b' }
  return (
    <span style={{
      background: '#f1f5f9', color: info.color, padding: '2px 8px',
      borderRadius: 4, fontSize: 11, fontWeight: 600,
    }}>
      {info.label}
    </span>
  )
}

function RoleModal({ teacher, onConfirm, onCancel }) {
  const [role, setRole] = useState(teacher.role || 'teacher')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onConfirm(teacher.id, role)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Assign role</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          {teacher.name || teacher.id} · {teacher.email}
        </p>

        {ASSIGNABLE_ROLES.map((r) => {
          const info = ROLE_INFO[r]
          return (
            <label key={r} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10, cursor: 'pointer' }}>
              <input
                type="radio" name="role" value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: info.color }}>{info.label}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{info.description}</div>
              </div>
            </label>
          )
        })}

        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 4, padding: '8px 12px', fontSize: 12, color: '#854d0e', marginTop: 8, marginBottom: 16 }}>
          Role changes take effect on next sign-in. The <strong>owner</strong> role is not assignable here — it is granted via the Entra External ID app-role configuration (see docs/azure/ROLE_CLAIMS_SETUP.md).
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '6px 14px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || role === teacher.role}
            style={{ padding: '6px 14px', background: saving || role === teacher.role ? '#e2e8f0' : '#4c8bf5', color: saving || role === teacher.role ? '#94a3b8' : '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Saving…' : 'Save role'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RoleManagement() {
  const { accounts } = useMsal()
  const [teachers, setTeachers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [modal, setModal] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const LIMIT = 50

  // Derive caller role from MSAL account — used to show/hide the Change Role button.
  // The authoritative gate is on the backend; this is just a UI convenience.
  const callerRole = accounts[0]?.idTokenClaims?.role || 'teacher'
  const isOwner = callerRole === 'owner'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listTeachers({ search, limit: LIMIT, offset })
      setTeachers(data.teachers)
      setTotal(data.total)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, offset])

  useEffect(() => { load() }, [load])
  useEffect(() => { setOffset(0) }, [search])

  async function handleRoleSave(teacherId, role) {
    setSaveError(null)
    try {
      await setTeacherRole(teacherId, role)
      setModal(null)
      await load()
    } catch (err) {
      setSaveError(err.message)
      throw err
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Role management</h1>

      {!isOwner && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '8px 14px', fontSize: 13, color: '#1e40af', marginBottom: 16 }}>
          Role assignment requires the <strong>owner</strong> role. You can view teachers but cannot change roles.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Search by name, email, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, width: 300 }}
        />
        <span style={{ alignSelf: 'center', color: '#64748b', fontSize: 12 }}>
          {loading ? 'Loading…' : `${total} teachers`}
        </span>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>Error: {error}</div>}
      {saveError && <div style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>Save failed: {saveError}</div>}

      <div style={{ background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Teacher</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>School</th>
              <th style={thStyle}>Created</th>
              {isOwner && <th style={thStyle}></th>}
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 && !loading && (
              <tr><td colSpan={isOwner ? 5 : 4} style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center', padding: 24 }}>No teachers found</td></tr>
            )}
            {teachers.map((t) => (
              <tr key={t.id}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>{t.name || '—'}</div>
                  <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{t.email || t.id}</div>
                </td>
                <td style={tdStyle}><RoleBadge role={t.role || 'teacher'} /></td>
                <td style={{ ...tdStyle, fontSize: 12, color: '#64748b' }}>
                  {t.schoolId ? (
                    <><div>{t.schoolId}</div><div>{t.schoolStatus}</div></>
                  ) : '—'}
                </td>
                <td style={{ ...tdStyle, fontSize: 12, color: '#64748b' }}>
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                </td>
                {isOwner && (
                  <td style={tdStyle}>
                    <button
                      onClick={() => setModal(t)}
                      style={{ padding: '3px 10px', fontSize: 12, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Change role
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > LIMIT && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', fontSize: 13 }}>
          <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}
            style={{ padding: '4px 12px', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>
            Previous
          </button>
          <span style={{ color: '#64748b' }}>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
          <button onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= total}
            style={{ padding: '4px 12px', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>
            Next
          </button>
        </div>
      )}

      {modal && (
        <RoleModal
          teacher={modal}
          onConfirm={handleRoleSave}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
