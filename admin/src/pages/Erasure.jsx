import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { listTeachers, getTeacherOverview, getErasureCandidates, eraseDevice, eraseTeacher } from '../api.js'
import { adminReauthRequest } from '../authConfig.js'

const panel = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16, marginBottom: 16 }
const label = { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6, display: 'block' }
const input = { padding: '6px 10px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 4 }
const th = { textAlign: 'left', padding: '8px 10px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: 12 }
const td = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', fontSize: 13 }
const dangerBtn = (enabled) => ({
  padding: '6px 14px', fontSize: 13, fontWeight: 600, borderRadius: 4, border: 'none',
  background: enabled ? '#dc2626' : '#e2e8f0', color: enabled ? '#fff' : '#94a3b8',
  cursor: enabled ? 'pointer' : 'not-allowed',
})
const plainBtn = { padding: '4px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer', background: '#fff', border: '1px solid #cbd5e1', color: '#475569' }

export default function Erasure() {
  const { instance } = useMsal()
  const [tq, setTq] = useState('')
  const [teachers, setTeachers] = useState([])
  const [teacher, setTeacher] = useState(null)
  const [overview, setOverview] = useState(null)
  const [selectedClass, setSelectedClass] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [reauth, setReauth] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [deviceModal, setDeviceModal] = useState(null) // the candidate being erased
  const [deviceRef, setDeviceRef] = useState('')
  const [teacherRef, setTeacherRef] = useState('')

  function handleErr(err) {
    if (err.status === 401 && err.body?.reauthRequired) { setReauth(true); return }
    setError(err.message || 'Something went wrong')
  }

  async function searchTeachers(e) {
    e.preventDefault()
    setError(null); setNotice(null)
    try {
      const data = await listTeachers({ search: tq.trim(), limit: 25 })
      setTeachers(data.teachers || [])
    } catch (err) { handleErr(err) }
  }

  async function pickTeacher(t) {
    setError(null); setNotice(null); setReauth(false)
    setTeacher(t); setOverview(null); setSelectedClass(null); setCandidates([]); setTeacherRef('')
    try {
      setOverview(await getTeacherOverview(t.teacherId))
    } catch (err) { handleErr(err) }
  }

  async function pickClass(c) {
    setError(null); setNotice(null); setSelectedClass(c); setCandidates([])
    try {
      const data = await getErasureCandidates(c.id)
      setCandidates(data.candidates || [])
    } catch (err) { handleErr(err) }
  }

  async function confirmEraseDevice() {
    if (!deviceModal || !deviceRef.trim()) return
    setBusy(true); setError(null)
    try {
      const { counts } = await eraseDevice(deviceModal.deviceId, deviceRef.trim())
      setNotice(`Erased this student's data. Removed: ${JSON.stringify(counts)}`)
      setDeviceModal(null); setDeviceRef('')
      if (selectedClass) await pickClass(selectedClass)
    } catch (err) { handleErr(err) } finally { setBusy(false) }
  }

  async function confirmEraseTeacher() {
    if (!teacher || !teacherRef.trim()) return
    if (!window.confirm(
      `Delete the ENTIRE account for ${teacher.name || teacher.email || teacher.teacherId}?\n\n` +
      'This erases every class, quiz, answer, question and draft, and their school if unshared. ' +
      'It cannot be undone.'
    )) return
    setBusy(true); setError(null)
    try {
      const { counts } = await eraseTeacher(teacher.teacherId, teacherRef.trim())
      setNotice(`Deleted the teacher account. Removed: ${JSON.stringify(counts)}`)
      setTeacher(null); setOverview(null); setSelectedClass(null); setCandidates([]); setTeacherRef('')
    } catch (err) { handleErr(err) } finally { setBusy(false) }
  }

  async function handleReauth() { await instance.loginRedirect(adminReauthRequest) }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Erasure</h1>

      {reauth && (
        <div style={{ ...panel, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: 13 }}>
          This action needs a fresh sign-in (step-up re-authentication).{' '}
          <button onClick={handleReauth} style={{ ...plainBtn, marginLeft: 8, background: '#1e40af', color: '#fff', border: 'none' }}>Sign in again</button>
        </div>
      )}
      {error && <div style={{ ...panel, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>Error: {error}</div>}
      {notice && <div style={{ ...panel, background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>{notice}</div>}

      {/* Step 1 — find a teacher */}
      <div style={panel}>
        <form onSubmit={searchTeachers} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="Search teachers by name, email, or id…"
            value={tq} onChange={e => setTq(e.target.value)}
            style={{ ...input, flex: '1 1 240px' }}
          />
          <button type="submit" style={plainBtn}>Search</button>
        </form>
        {teachers.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}></th></tr></thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.id}>
                  <td style={td}>{t.name || '—'}</td>
                  <td style={td}>{t.email || '—'}</td>
                  <td style={td}><button onClick={() => pickTeacher(t)} style={plainBtn}>Select ›</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Step 2 — the selected teacher: classes + whole-account deletion */}
      {teacher && (
        <div style={panel}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{teacher.name || teacher.email || teacher.teacherId}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{teacher.email} · {teacher.teacherId}</div>

          {!overview && <div style={{ fontSize: 13, color: '#64748b' }}>Loading classes…</div>}
          {overview && (
            <>
              <div style={label}>Pick a class to find a student to erase</div>
              {(overview.classes || []).length === 0 && <div style={{ fontSize: 13, color: '#64748b' }}>This teacher has no classes.</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {(overview.classes || []).map(c => (
                  <button
                    key={c.id}
                    onClick={() => pickClass(c)}
                    style={{ ...plainBtn, borderColor: selectedClass?.id === c.id ? '#4c8bf5' : '#cbd5e1' }}
                  >
                    {c.name}{c.isDemo ? ' (demo)' : ''} · {c.studentCount ?? 0}
                  </button>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                <div style={{ ...label, color: '#991b1b' }}>Delete this whole teacher account</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="text" placeholder="Request reference (email or ticket)"
                    value={teacherRef} onChange={e => setTeacherRef(e.target.value)} maxLength={120}
                    style={{ ...input, flex: '1 1 240px' }}
                  />
                  <button onClick={confirmEraseTeacher} disabled={busy || !teacherRef.trim()} style={dangerBtn(!busy && !!teacherRef.trim())}>
                    Delete this teacher's account
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3 — candidates in the selected class */}
      {selectedClass && (
        <div style={panel}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Students in “{selectedClass.name}”</div>
          {candidates.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748b' }}>No join requests found for this class.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Name</th><th style={th}>Status</th><th style={th}>Joined</th><th style={th}></th></tr></thead>
              <tbody>
                {candidates.map(c => (
                  <tr key={c.joinRequestId}>
                    <td style={td}>{c.studentName || '—'}</td>
                    <td style={td}>{c.status}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.createdAt ? c.createdAt.slice(0, 10) : '—'}</td>
                    <td style={td}>
                      <button onClick={() => { setDeviceModal(c); setDeviceRef('') }} style={{ ...plainBtn, borderColor: '#fecaca', color: '#991b1b' }}>
                        Erase this student's data
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Erase-student confirm modal */}
      {deviceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ ...panel, maxWidth: 460, width: '90%', marginBottom: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Erase student data</div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              Erase all data for <strong>{deviceModal.studentName || 'this device'}</strong> in
              class <strong>“{selectedClass?.name}”</strong>: their answers, notification sign-up,
              join requests and page views, across every class this device joined. This cannot be undone.
            </p>
            <div style={label}>Request reference (email or ticket)</div>
            <input
              type="text" value={deviceRef} onChange={e => setDeviceRef(e.target.value)} maxLength={120}
              placeholder="e.g. ticket #1234 / parent email" style={{ ...input, width: '100%', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeviceModal(null)} style={plainBtn}>Cancel</button>
              <button onClick={confirmEraseDevice} disabled={busy || !deviceRef.trim()} style={dangerBtn(!busy && !!deviceRef.trim())}>
                {busy ? 'Erasing…' : 'Erase this data'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#64748b', marginTop: 20 }}>
        Read-only lookups and irreversible erasures. Owner-only · every action is logged to the audit trail.
      </div>
    </div>
  )
}
