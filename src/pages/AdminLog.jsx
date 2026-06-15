import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import API_BASE from '../api'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Section({ title, count, rows, columns, truncatedAt }) {
  const [open, setOpen] = useState(true)

  return (
    <div style={{ marginBottom: '32px' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}
      >
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1a1433' }}>{title}</h3>
        <span style={{ fontSize: '12px', background: '#EEEDFE', color: '#534AB7', borderRadius: '12px', padding: '2px 8px', fontWeight: '500' }}>
          {count}{count >= truncatedAt ? '+' : ''}
        </span>
        <span style={{ fontSize: '12px', color: '#aaa', marginLeft: 'auto' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </div>

      {open && (
        count === 0 ? (
          <div style={{ fontSize: '13px', color: '#aaa', padding: '12px 0' }}>No records.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid #eee', color: '#888', fontWeight: '500', whiteSpace: 'nowrap' }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id || i} style={{ background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                    {columns.map(col => (
                      <td key={col.key} style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0', color: '#333', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {col.render ? col.render(row) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {count >= truncatedAt && (
              <div style={{ fontSize: '11px', color: '#e67e22', marginTop: '6px' }}>
                Results capped at {truncatedAt}. Add ?limit=N to the URL to increase (max 1000).
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}

export default function AdminLog() {
  const location = useLocation()
  const code = new URLSearchParams(location.search).get('code')

  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    async function fetchLog() {
      try {
        const url = `${API_BASE}/usageLog?code=${encodeURIComponent(code || '')}`
        const res = await fetch(url)
        if (res.status === 401) { setError('Unauthorised — invalid or missing key.'); return }
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        setData(await res.json())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchLog()
  }, [code])

  if (loading) return <div style={{ padding: '40px', color: '#888', fontSize: '14px' }}>Loading admin log…</div>
  if (error)   return <div style={{ padding: '40px', color: '#c0392b', fontSize: '14px' }}>{error}</div>

  const QUESTION_COLS = [
    { key: 'id',           label: 'ID',          render: r => r.id?.slice(0, 8) + '…' },
    { key: 'teacherId',    label: 'Teacher ID',   render: r => r.teacherId?.slice(0, 8) + '…' },
    { key: 'topic',        label: 'Topic' },
    { key: 'text',         label: 'Question' },
    { key: 'createdAt',    label: 'Created',      render: r => formatDate(r.createdAt) },
  ]

  const QUIZ_COLS = [
    { key: 'id',           label: 'ID',           render: r => r.id?.slice(0, 8) + '…' },
    { key: 'teacherId',    label: 'Teacher ID',   render: r => r.teacherId?.slice(0, 8) + '…' },
    { key: 'name',         label: 'Quiz name' },
    { key: 'status',       label: 'Status' },
    { key: 'classIds',     label: 'Classes',      render: r => (r.classIds || []).join(', ') },
    { key: 'classSize',    label: 'Class size' },
    { key: 'questionIds',  label: 'Questions',    render: r => r.questionIds?.length ?? 0 },
    { key: 'sentAt',       label: 'Sent',         render: r => formatDate(r.sentAt) },
    { key: 'createdAt',    label: 'Created',      render: r => formatDate(r.createdAt) },
  ]

  const RESPONSE_COLS = [
    { key: 'id',           label: 'ID',           render: r => r.id?.slice(0, 8) + '…' },
    { key: 'quizId',       label: 'Quiz ID',      render: r => r.quizId?.slice(0, 8) + '…' },
    { key: 'studentId',    label: 'Student ID',   render: r => r.studentId?.slice(0, 8) + '…' },
    { key: 'simulated',    label: 'Simulated',    render: r => r.simulated ? 'Yes' : 'No' },
    { key: 'answers',      label: 'Answers',      render: r => `${r.answers?.length ?? 0} answers` },
    { key: 'completedAt',  label: 'Completed',    render: r => formatDate(r.completedAt) },
  ]

  const uniqueTeachers = new Set([
    ...data.questions.map(q => q.teacherId),
    ...data.quizzes.map(q => q.teacherId),
  ]).size

  const uniqueSessions = new Set((data.pageviews || []).map(p => p.sessionId).filter(Boolean)).size

  // Sort pageviews newest first
  const sortedPageviews = [...(data.pageviews || [])].sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt))

  const PAGEVIEW_COLS = [
    { key: 'visitedAt',   label: 'Time',        render: r => formatDate(r.visitedAt) },
    { key: 'page',        label: 'Page' },
    { key: 'teacherId',   label: 'Teacher ID',  render: r => r.teacherId?.slice(0, 8) + '…' },
    { key: 'sessionId',   label: 'Session',     render: r => r.sessionId?.slice(0, 8) + '…' },
    { key: 'referrer',    label: 'Referrer',    render: r => r.referrer || '—' },
    { key: 'language',    label: 'Language' },
    { key: 'timezone',    label: 'Timezone' },
    { key: 'screen',      label: 'Screen',      render: r => r.screenWidth && r.screenHeight ? `${r.screenWidth}×${r.screenHeight}` : '—' },
    { key: 'userAgent',   label: 'User agent',  render: r => r.userAgent || '—' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ background: '#1a1433', borderRadius: '14px', padding: '24px 28px', marginBottom: '28px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: '#9b93e8', textTransform: 'uppercase', marginBottom: '6px' }}>
              QuizPulse — Admin
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: '700', color: 'white' }}>Usage log</h2>
            <p style={{ margin: '0', fontSize: '13px', color: '#b0a8e0', lineHeight: '1.5' }}>
              Raw historic data across all visitors. Each browser session generates a unique teacher ID stored in localStorage.
              Data is never deleted — records accumulate from all demo users since launch.
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#9b93e8', marginBottom: '4px' }}>Retrieved</div>
            <div style={{ fontSize: '13px', color: 'white', fontWeight: '500' }}>{formatDate(data.retrievedAt)}</div>
            <div style={{ fontSize: '11px', color: '#9b93e8', marginTop: '8px', marginBottom: '4px' }}>Unique teachers</div>
            <div style={{ fontSize: '20px', color: '#a78bfa', fontWeight: '700' }}>{uniqueTeachers}</div>
            <div style={{ fontSize: '11px', color: '#9b93e8', marginTop: '8px', marginBottom: '4px' }}>Unique sessions</div>
            <div style={{ fontSize: '20px', color: '#a78bfa', fontWeight: '700' }}>{uniqueSessions}</div>
          </div>
        </div>
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', color: '#9b93e8' }}>
          Rows capped at {data.truncatedAt} per table · Secured by Azure Function key · Not linked from public nav
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        {[
          { label: 'Page views', value: data.counts.pageviews },
          { label: 'Questions',  value: data.counts.questions },
          { label: 'Quizzes',    value: data.counts.quizzes },
          { label: 'Responses',  value: data.counts.responses },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, minWidth: '100px', background: '#EEEDFE', borderRadius: '10px', padding: '16px 20px' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#534AB7' }}>{value}</div>
            <div style={{ fontSize: '12px', color: '#7a72c9', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      <Section title="Page views" count={sortedPageviews.length} rows={sortedPageviews} columns={PAGEVIEW_COLS} truncatedAt={data.truncatedAt} />
      <Section title="Questions"  count={data.counts.questions}  rows={data.questions}  columns={QUESTION_COLS} truncatedAt={data.truncatedAt} />
      <Section title="Quizzes"    count={data.counts.quizzes}    rows={data.quizzes}    columns={QUIZ_COLS}     truncatedAt={data.truncatedAt} />
      <Section title="Responses"  count={data.counts.responses}  rows={data.responses}  columns={RESPONSE_COLS} truncatedAt={data.truncatedAt} />
    </div>
  )
}
