import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../../api'

// Results hub: pick a class, see every quiz sent to it with its response rate, then drill
// into a single quiz's full breakdown (with that class preselected).
export default function Results() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch(`${API_BASE}/classes`)
        if (!res.ok) throw new Error('Could not load your classes.')
        const data = await res.json()
        setClasses(data)
        if (data.length > 0) setClassId(data[0].id)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadClasses()
  }, [])

  useEffect(() => {
    if (!classId) { setQuizzes([]); return }
    let cancelled = false
    async function loadQuizzes() {
      setListLoading(true)
      try {
        const res = await fetch(`${API_BASE}/analytics/class/${classId}`)
        if (!res.ok) throw new Error('Could not load results for this class.')
        const data = await res.json()
        if (!cancelled) { setQuizzes(data); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }
    loadQuizzes()
    return () => { cancelled = true }
  }, [classId])

  if (loading) return <div style={{ padding: '24px', color: '#888' }}>Loading…</div>

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>Results</h2>
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
        See how each class responded to your quizzes.
      </div>

      {classes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px', background: '#f8f8f8', borderRadius: '12px' }}>
          You don't have any classes yet. Create one to start sending quizzes.
        </div>
      ) : (
        <>
          <label style={{ display: 'block', fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Class
          </label>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px', border: 'var(--bw) solid var(--border)', marginBottom: '20px', background: 'white' }}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.isDemo ? ' (demo)' : ''}</option>
            ))}
          </select>

          {error && <div style={{ padding: '12px', color: '#A32D2D' }}>{error}</div>}

          {listLoading ? (
            <div style={{ padding: '24px', color: '#888' }}>Loading…</div>
          ) : quizzes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px', background: '#f8f8f8', borderRadius: '12px' }}>
              No quizzes have been sent to this class yet.
            </div>
          ) : (
            quizzes.map(q => (
              <button
                key={q.quizId}
                onClick={() => navigate(`/teacher/analytics/${q.quizId}?classId=${classId}`)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '12px',
                  padding: '16px 20px', marginBottom: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.quizName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                    {q.questionCount} question{q.questionCount !== 1 ? 's' : ''}
                    {q.sentAt ? ` · sent ${new Date(q.sentAt).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--primary)' }}>
                    {q.responseCount} / {q.approvedStudents}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>
                    {q.responseRate !== null ? `${q.responseRate}% responded` : 'responded'}
                  </div>
                </div>
              </button>
            ))
          )}
        </>
      )}
    </div>
  )
}
