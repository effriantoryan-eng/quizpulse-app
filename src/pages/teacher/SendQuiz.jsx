import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import API_BASE from '../../api'

function SendQuiz() {
  const location = useLocation()
  const navigate = useNavigate()
  const [hintVisible, dismissHint, showHint] = useHint('send')
  const { quizName = '', questionIds = [], questions = [] } = location.state || {}

  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [classesError, setClassesError] = useState(null)
  const [selectedClasses, setSelectedClasses] = useState([])
  const [sending, setSending] = useState(false)
  const [simulatingMsg, setSimulatingMsg] = useState('')
  const [sentResult, setSentResult] = useState(null) // { quizId, generated }
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch(`${API_BASE}/classes`)
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        const data = await res.json()
        setClasses(data)
      } catch (err) {
        setClassesError(err.message)
      } finally {
        setClassesLoading(false)
      }
    }
    fetchClasses()
  }, [])

  if (!quizName || questionIds.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Send quiz</h2>
        <p style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>
          No quiz to send. Please build a quiz first.
        </p>
        <button
          onClick={() => navigate('/teacher/build')}
          style={{ padding: '10px 20px', background: '#534AB7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
        >
          Go to Build quiz
        </button>
      </div>
    )
  }

  function toggleClass(id) {
    setSelectedClasses(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const totalStudents = classes
    .filter(c => selectedClasses.includes(c.id))
    .reduce((sum, c) => sum + (c.studentCount || 0), 0)

  async function handleSend() {
    setError(null)
    setSending(true)
    try {
      setSimulatingMsg('Saving quiz…')
      const quizRes = await fetch(`${API_BASE}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quizName,
          questionIds,
          classIds: selectedClasses,
          classSize: totalStudents,
          status: 'sent',
          sentAt: new Date().toISOString(),
        }),
      })
      if (!quizRes.ok) throw new Error(`Quiz save failed (${quizRes.status})`)
      const quiz = await quizRes.json()

      setSimulatingMsg(`Simulating ${totalStudents} student responses…`)
      const simRes = await fetch(`${API_BASE}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          questions: questions.map(q => ({ id: q.id, optionCount: q.options?.length ?? 4 })),
          classSize: totalStudents,
        }),
      })
      if (!simRes.ok) throw new Error(`Simulation failed (${simRes.status})`)
      const sim = await simRes.json()

      setSentResult({ quizId: quiz.id, generated: sim.generated })
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
      setSimulatingMsg('')
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Send quiz</h2>
        {!hintVisible && (
          <button onClick={showHint} style={{ background: 'none', border: '1px solid #C5C0F0', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: '#7B6EDE', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
        )}
      </div>
      {hintVisible && (
        <HintBanner
          text="Pick which class(es) to send to — student responses will be simulated automatically. Click Send to post the quiz and jump straight to analytics."
          onDismiss={dismissHint}
        />
      )}

      {/* Quiz summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', background: '#f8f8f8', borderRadius: '10px', marginBottom: '24px', border: '1px solid #eee' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px' }}>📋</div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>{quizName}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{questionIds.length} question{questionIds.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {sentResult ? (
        <div style={{ background: '#E1F5EE', border: '1px solid #1a7a5e', borderRadius: '10px', padding: '24px' }}>
          <div style={{ fontSize: '22px', marginBottom: '10px' }}>🎉</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#085041', marginBottom: '8px' }}>Quiz sent!</div>
          <div style={{ fontSize: '13px', color: '#085041', marginBottom: '6px' }}>
            <strong>{sentResult.generated}</strong> simulated responses received.
          </div>
          <div style={{ fontSize: '12px', color: '#3a7a65', marginBottom: '20px' }}>
            Responses were automatically generated to simulate a real class submission.
          </div>
          <button
            onClick={() => navigate(`/teacher/analytics/${sentResult.quizId}`)}
            style={{ width: '100%', padding: '11px', background: '#085041', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
          >
            View analytics →
          </button>
          <button
            onClick={() => navigate('/teacher/quizzes')}
            style={{ width: '100%', marginTop: '8px', padding: '11px', background: 'white', color: '#085041', border: '1px solid #085041', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
          >
            All quizzes
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '10px' }}>Send to class</div>

          {classesLoading && (
            <div style={{ fontSize: '13px', color: '#888', padding: '16px', textAlign: 'center' }}>Loading classes…</div>
          )}

          {classesError && (
            <div style={{ fontSize: '13px', color: '#c0392b', padding: '12px', background: '#fdecea', borderRadius: '8px', marginBottom: '16px' }}>
              Failed to load classes: {classesError}
            </div>
          )}

          {!classesLoading && !classesError && classes.length === 0 && (
            <div style={{ fontSize: '13px', color: '#888', padding: '16px', textAlign: 'center', border: '1px dashed #ddd', borderRadius: '8px', marginBottom: '16px' }}>
              No classes yet.{' '}
              <span
                style={{ color: '#534AB7', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigate('/teacher/classes')}
              >
                Create a class first
              </span>
              .
            </div>
          )}

          {classes.map(c => {
            const isSelected = selectedClasses.includes(c.id)
            return (
              <div
                key={c.id}
                onClick={() => toggleClass(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', marginBottom: '8px',
                  border: `${isSelected ? '2px' : '1px'} solid ${isSelected ? '#534AB7' : '#e0e0e0'}`,
                  borderRadius: '8px', background: isSelected ? '#EEEDFE11' : 'white',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: `1px solid ${isSelected ? '#534AB7' : '#ccc'}`,
                  background: isSelected ? '#534AB7' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: '12px', color: 'white',
                }}>
                  {isSelected ? '✓' : ''}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>{c.name}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>{c.studentCount || 0} students</div>
                </div>
              </div>
            )
          })}

          <div style={{ borderTop: '1px solid #eee', margin: '20px 0' }}></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
            <div style={{ padding: '14px', textAlign: 'center', borderRadius: '8px', border: '2px solid #534AB7', background: '#EEEDFE22' }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>📤</div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#534AB7' }}>Send now</div>
            </div>
            <div style={{ padding: '14px', textAlign: 'center', borderRadius: '8px', border: '1px solid #e0e0e0', background: '#fafafa', opacity: 0.5 }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>🕐</div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#aaa' }}>Schedule</div>
              <div style={{ fontSize: '11px', color: '#bbb' }}>Coming soon</div>
            </div>
          </div>

          {sending && simulatingMsg && (
            <div style={{ padding: '10px 14px', background: '#EEEDFE', border: '1px solid #c5c0f0', borderRadius: '8px', fontSize: '13px', color: '#534AB7', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⏳</span>
              {simulatingMsg}
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button
            disabled={selectedClasses.length === 0 || sending}
            style={{
              width: '100%', padding: '12px',
              background: selectedClasses.length === 0 || sending ? '#ccc' : '#534AB7',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: '500',
              cursor: selectedClasses.length === 0 || sending ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSend}
          >
            {sending ? 'Working…' : `Send to ${totalStudents} students →`}
          </button>

          <p style={{ fontSize: '12px', color: '#aaa', textAlign: 'center', marginTop: '10px' }}>
            Responses will be simulated automatically so you can view analytics right away.
          </p>
        </>
      )}
    </div>
  )
}

export default SendQuiz
