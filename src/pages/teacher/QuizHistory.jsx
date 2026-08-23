import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import API_BASE from '../../api'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function QuizHistory() {
  const { teacherId, login } = useAuth()
  const navigate = useNavigate()
  const [hintVisible, dismissHint, showHint] = useHint('history')
  const [quizzes, setQuizzes] = useState([])
  const [classNames, setClassNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  async function fetchQuizzes() {
    setLoading(true)
    setError(null)
    setSessionExpired(false)
    try {
      const res = await fetch(`${API_BASE}/quizzes?teacherId=${teacherId}`)
      if (res.status === 401) { setSessionExpired(true); return }
      if (!res.ok) throw new Error('Something went wrong loading your quizzes.')
      const data = await res.json()
      setQuizzes(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      const clsRes = await fetch(`${API_BASE}/classes`)
      if (clsRes.ok) {
        const classes = await clsRes.json()
        setClassNames(Object.fromEntries(classes.map(c => [c.id, c.name])))
      }
    } catch {
      setError('Something went wrong loading your quizzes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!teacherId) return
    fetchQuizzes()
  }, [teacherId])

  if (loading) return <div style={{ padding: '24px', color: '#888', fontSize: '14px' }}>Loading quizzes…</div>

  if (sessionExpired) return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
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
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <p style={{ color: '#c0392b', fontSize: '14px', marginBottom: '12px' }}>{error}</p>
      <button
        onClick={fetchQuizzes}
        style={{ padding: '8px 16px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>Quiz history</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!hintVisible && (
            <button onClick={showHint} style={{ background: 'none', border: 'var(--bw) solid var(--border)', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: 'var(--primary)', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
          )}
          <button
            onClick={() => navigate('/teacher/build')}
            style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
          >
            + New quiz
          </button>
        </div>
      </div>
      {hintVisible && (
        <HintBanner
          text="All quizzes you've sent are listed here. Click any row to view its full analytics breakdown."
          onDismiss={dismissHint}
        />
      )}

      {quizzes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px', border: '1px dashed #ddd', borderRadius: '12px' }}>
          No quizzes sent yet.{' '}
          <span
            onClick={() => navigate('/teacher/build')}
            style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Build your first quiz
          </span>
        </div>
      ) : (
        <div>
          {quizzes.map(quiz => {
            const classLabels = (quiz.classIds || [])
              .map(id => classNames[id] || 'Class no longer exists')
              .join(', ')

            return (
              <div
                key={quiz.id}
                onClick={() => navigate(`/teacher/analytics/${quiz.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '16px 18px', marginBottom: '10px',
                  background: 'var(--surface)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow)',
                  cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-2px,-2px)'; e.currentTarget.style.boxShadow = '6px 6px 0 #111111' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
              >
                {/* Icon */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'var(--surface2)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '18px', flexShrink: 0,
                }}>📋</div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {quiz.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {classLabels || 'No class'} · {quiz.questionIds?.length ?? 0} question{(quiz.questionIds?.length ?? 0) !== 1 ? 's' : ''} · {formatDate(quiz.sentAt || quiz.createdAt)}
                  </div>
                </div>

                {/* Class size / status */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {quiz.classSize > 0 && (
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--primary)' }}>
                      {quiz.classSize} student{quiz.classSize === 1 ? '' : 's'}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: quiz.status === 'sent' ? '#085041' : '#aaa', marginTop: '2px' }}>
                    {quiz.status === 'sent' ? '● Sent' : quiz.status}
                  </div>
                </div>

                {/* Arrow */}
                <div style={{ color: '#ccc', fontSize: '16px', flexShrink: 0 }}>›</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
