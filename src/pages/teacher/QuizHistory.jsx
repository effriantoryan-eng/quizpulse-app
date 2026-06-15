import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import API_BASE from '../../api'

const CLASS_NAMES = {
  'yr9-sci':  'Year 9 Science',
  'yr10-mth': 'Year 10 Maths',
  'yr7-eng':  'Year 7 English',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function QuizHistory() {
  const { teacherId } = useAuth()
  const navigate = useNavigate()
  const [hintVisible, dismissHint, showHint] = useHint('history')
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!teacherId) return
    async function fetchQuizzes() {
      try {
        const res = await fetch(`${API_BASE}/quizzes?teacherId=${teacherId}`)
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        const data = await res.json()
        setQuizzes(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchQuizzes()
  }, [teacherId])

  if (loading) return <div style={{ padding: '24px', color: '#888', fontSize: '14px' }}>Loading quizzes…</div>
  if (error) return <div style={{ padding: '24px', color: '#c0392b', fontSize: '14px' }}>{error}</div>

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>Quiz history</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!hintVisible && (
            <button onClick={showHint} style={{ background: 'none', border: '1px solid #C5C0F0', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: '#7B6EDE', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
          )}
          <button
            onClick={() => navigate('/teacher/build')}
            style={{ padding: '8px 16px', background: '#534AB7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
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
            style={{ color: '#534AB7', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Build your first quiz
          </span>
        </div>
      ) : (
        <div>
          {quizzes.map(quiz => {
            const classLabels = (quiz.classIds || [])
              .map(id => CLASS_NAMES[id] || id)
              .join(', ')

            return (
              <div
                key={quiz.id}
                onClick={() => navigate(`/teacher/analytics/${quiz.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '16px 18px', marginBottom: '10px',
                  background: 'white', border: '1px solid #eee', borderRadius: '10px',
                  cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(83,74,183,0.1)'; e.currentTarget.style.borderColor = '#c5c0f0' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = '#eee' }}
              >
                {/* Icon */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: '#EEEDFE', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '18px', flexShrink: 0,
                }}>📋</div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1433', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {quiz.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {classLabels || 'No class'} · {quiz.questionIds?.length ?? 0} question{(quiz.questionIds?.length ?? 0) !== 1 ? 's' : ''} · {formatDate(quiz.sentAt || quiz.createdAt)}
                  </div>
                </div>

                {/* Class size / status */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {quiz.classSize > 0 && (
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#534AB7' }}>
                      {quiz.classSize} students
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
