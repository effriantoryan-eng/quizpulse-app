import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTeacherOverview, getTeacherQuizAnalytics } from '../api.js'

const groupStyle = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 20, marginBottom: 16,
}
const headingStyle = {
  fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '8px 10px', background: '#f8fafc',
  borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: 12,
}
const tdStyle = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }

function StatTile({ label, value }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: value == null ? '#94a3b8' : '#1a1a1a' }}>
        {value == null ? '—' : value}
      </div>
    </div>
  )
}

// Inline option-bar row — percentage bar beside the option text, matching the teacher's Analytics.
function OptionBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 2 }}>
        <span style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontWeight: 600, color: '#1a1a1a', marginLeft: 8 }}>{count} ({pct}%)</span>
      </div>
      <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#4c8bf5', borderRadius: 3 }} />
      </div>
    </div>
  )
}

// Four-cell grid — correctness × confidence, matching the teacher's Analytics layout.
function FourCell({ fourCell, totalResponses }) {
  if (!fourCell || totalResponses === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
        Awaiting responses
      </div>
    )
  }
  const { correctConfident, correctUnsure, incorrectConfident, incorrectUnsure } = fourCell
  function cell(count, label, accent) {
    const pct = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0
    return (
      <div style={{ flex: 1, padding: '8px 10px', background: accent ? '#fbede8' : '#f8fafc', borderRadius: 4, textAlign: 'center', border: `1px solid ${accent ? '#f8b4a5' : '#e2e8f0'}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: accent ? '#ae1800' : '#1a1a1a' }}>{count}</div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{pct}%</div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{label}</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {cell(correctConfident, 'Correct + confident', false)}
      {cell(correctUnsure, 'Correct + unsure', false)}
      {cell(incorrectConfident, 'Wrong + confident', true)}
      {cell(incorrectUnsure, 'Wrong + unsure', false)}
    </div>
  )
}

function QuizBreakdown({ teacherId, quizId, quizName }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)

  async function expand() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (data || loading) return
    setLoading(true)
    setError(null)
    try {
      const resp = await getTeacherQuizAnalytics(teacherId, quizId)
      setData(resp.breakdown)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={expand}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#4c8bf5', padding: '2px 0' }}
      >
        {open ? '▲ Hide breakdown' : '▼ Show breakdown'}
      </button>

      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
          {loading && <div style={{ color: '#94a3b8', fontSize: 12 }}>Loading…</div>}
          {error && <div style={{ color: '#dc2626', fontSize: 12 }}>Error: {error}</div>}
          {data && data.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>No questions in this quiz.</div>
          )}
          {data && data.map((q, i) => (
            <div key={q.questionId} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                Q{i + 1}: {q.text}
              </div>
              <FourCell fourCell={q.fourCell} totalResponses={q.totalResponses || 0} />
              {q.counts && q.counts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {q.counts.map((opt, j) => (
                    <OptionBar
                      key={j}
                      label={`${j + 1}. ${opt.text}`}
                      count={opt.count}
                      total={q.totalResponses || 0}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TeacherData() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        setData(await getTeacherOverview(id))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
        Loading teacher data…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ color: '#dc2626', marginBottom: 16, fontSize: 13 }}>Failed to load: {error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '6px 14px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', background: '#fff' }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const { teacher, schools, classes, quizzes, total } = data
  const realClasses = (classes || []).filter(c => !c.isDemo)
  const demoClasses = (classes || []).filter(c => c.isDemo)
  const sentQuizzes = (quizzes || []).filter(q => q.status === 'sent' || q.status === 'closed')
  const totalResponses = (quizzes || []).reduce((sum, q) => sum + (q.responseCount || 0), 0)
  const lastActive = sentQuizzes.length > 0
    ? sentQuizzes.sort((a, b) => (b.sentAt || '') > (a.sentAt || '') ? 1 : -1)[0]?.sentAt?.slice(0, 10)
    : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/teachers')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c8bf5', fontSize: 13 }}
        >
          ← Teachers
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{teacher.name || teacher.email || teacher.teacherId}</h1>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatTile label="Real classes" value={realClasses.length} />
        <StatTile label="Total quizzes" value={total} />
        <StatTile label="Total responses" value={totalResponses} />
        <StatTile label="Last active" value={lastActive || '—'} />
      </div>

      {/* Teacher info */}
      <div style={groupStyle}>
        <h2 style={headingStyle}>Teacher</h2>
        <table style={tableStyle}>
          <tbody>
            <tr><td style={{ ...tdStyle, color: '#64748b', width: 160 }}>ID</td><td style={tdStyle}><code style={{ fontSize: 11 }}>{teacher.teacherId}</code></td></tr>
            <tr><td style={{ ...tdStyle, color: '#64748b' }}>Email</td><td style={tdStyle}>{teacher.email || '—'}</td></tr>
            <tr><td style={{ ...tdStyle, color: '#64748b' }}>Role</td><td style={tdStyle}>{teacher.role || 'teacher'}</td></tr>
            <tr><td style={{ ...tdStyle, color: '#64748b' }}>School status</td><td style={tdStyle}>{teacher.schoolStatus || '—'}</td></tr>
            <tr><td style={{ ...tdStyle, color: '#64748b' }}>Joined</td><td style={tdStyle}>{teacher.createdAt?.slice(0, 10) || '—'}</td></tr>
            {(schools || []).map(s => (
              <tr key={s.id}><td style={{ ...tdStyle, color: '#64748b' }}>School</td><td style={tdStyle}>{s.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>({s.status})</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Classes */}
      <div style={groupStyle}>
        <h2 style={headingStyle}>Classes</h2>
        {classes.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>No classes yet.</div>
        )}
        {classes.length > 0 && (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Students</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Created</th>
              </tr>
            </thead>
            <tbody>
              {classes.map(c => (
                <tr key={c.id}>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.isDemo ? c.demoStudentCount : c.studentCount}</td>
                  <td style={tdStyle}>
                    {c.isDemo
                      ? <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: '#ede9fe', color: '#5b21b6' }}>Demo</span>
                      : <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: '#f1f5f9', color: '#475569' }}>Real</span>
                    }
                  </td>
                  <td style={tdStyle}>{c.createdAt?.slice(0, 10) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quizzes */}
      <div style={groupStyle}>
        <h2 style={headingStyle}>Quizzes {total > quizzes.length ? `(showing ${quizzes.length} of ${total})` : `(${total})`}</h2>
        {quizzes.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
            This teacher hasn&rsquo;t created any quizzes yet — this is who to reach out to.
          </div>
        )}
        {quizzes.length > 0 && (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Sent</th>
                <th style={thStyle}>Responses</th>
                <th style={thStyle}>Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map(q => (
                <tr key={q.id}>
                  <td style={tdStyle}>
                    {q.name}
                    {q.isDemo && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#ede9fe', color: '#5b21b6' }}>Demo</span>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: q.status === 'sent' ? '#dcfce7' : q.status === 'draft' ? '#f1f5f9' : '#fef3c7', color: q.status === 'sent' ? '#166534' : q.status === 'draft' ? '#475569' : '#92400e' }}>
                      {q.status}
                    </span>
                  </td>
                  <td style={tdStyle}>{q.sentAt?.slice(0, 10) || '—'}</td>
                  <td style={tdStyle}>{q.responseCount}</td>
                  <td style={tdStyle}>
                    {(q.status === 'sent' || q.status === 'closed') ? (
                      <QuizBreakdown teacherId={id} quizId={q.id} quizName={q.name} />
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>Not sent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
        Read-only · cohort-level only · every view is logged to the audit trail
      </div>
    </div>
  )
}
