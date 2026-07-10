import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import API_BASE from '../../api'
import TOPIC_TAGS from '../../data/topicTags'

function SendQuiz() {
  const location = useLocation()
  const navigate = useNavigate()
  const [hintVisible, dismissHint, showHint] = useHint('send')
  const { quizName = '', questionIds = [] } = location.state || {}

  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [classesError, setClassesError] = useState(null)
  const [selectedClasses, setSelectedClasses] = useState([])
  const [sending, setSending] = useState(false)
  const [sendingMsg, setSendingMsg] = useState('')
  const [sentResult, setSentResult] = useState(null) // { quizId, scheduled }
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('now') // 'now' | 'schedule'
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [scheduledFor, setScheduledFor] = useState('')
  const [topicTag, setTopicTag] = useState('')

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
          style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
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

  const sendingToDemo = classes.some(c => selectedClasses.includes(c.id) && c.isDemo)

  async function handleSend() {
    setError(null)

    if (mode === 'now' && (!durationMinutes || durationMinutes < 5)) {
      setError('Quiz duration must be at least 5 minutes.')
      return
    }
    if (mode === 'schedule') {
      if (!scheduledFor) {
        setError('Pick a date and time to schedule this quiz.')
        return
      }
      if (new Date(scheduledFor).getTime() <= Date.now()) {
        setError('Scheduled time must be in the future.')
        return
      }
    }

    setSending(true)
    try {
      setSendingMsg('Saving quiz…')
      const quizRes = await fetch(`${API_BASE}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'now'
            ? {
                name: quizName,
                questionIds,
                classIds: selectedClasses,
                classSize: totalStudents,
                status: 'sent',
                sentAt: new Date().toISOString(),
                durationMinutes,
                ...(topicTag && { topicTag }),
              }
            : {
                name: quizName,
                questionIds,
                classIds: selectedClasses,
                classSize: totalStudents,
                status: 'scheduled',
                scheduledFor: new Date(scheduledFor).toISOString(),
                durationMinutes,
                ...(topicTag && { topicTag }),
              }
        ),
      })
      if (!quizRes.ok) {
        const data = await quizRes.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      const quiz = await quizRes.json()

      if (mode === 'now') {
        // Send push notifications to subscribed students (best-effort — failures don't block).
        setSendingMsg('Sending notifications…')
        try {
          await fetch(`${API_BASE}/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quizId: quiz.id,
              quizTitle: quizName,
              questionCount: questionIds.length,
            }),
          })
        } catch {
          // Push delivery is best-effort; don't fail the whole send flow.
        }
      }

      setSentResult({ quizId: quiz.id, scheduled: mode === 'schedule', demo: sendingToDemo })
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
      setSendingMsg('')
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Send quiz</h2>
        {!hintVisible && (
          <button onClick={showHint} style={{ background: 'none', border: 'var(--bw) solid var(--border)', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: 'var(--primary)', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
        )}
      </div>
      {hintVisible && (
        <HintBanner
          text="Pick which class(es) to send to, choose how long the quiz stays open, then send now or schedule it for later."
          onDismiss={dismissHint}
        />
      )}

      {/* Quiz summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', background: '#f8f8f8', borderRadius: '10px', marginBottom: '24px', border: 'var(--bw) solid var(--border)' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px' }}>📋</div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>{quizName}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{questionIds.length} question{questionIds.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {sentResult ? (
        <div style={{ background: '#E1F5EE', border: '1px solid #1a7a5e', borderRadius: '10px', padding: '24px' }}>
          <div style={{ fontSize: '22px', marginBottom: '10px' }}>{sentResult.scheduled ? '🕐' : '🎉'}</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#085041', marginBottom: '8px' }}>
            {sentResult.scheduled ? 'Quiz scheduled!' : 'Quiz sent!'}
          </div>
          <div style={{ fontSize: '12px', color: '#3a7a65', marginBottom: '20px' }}>
            {sentResult.demo
              ? (sentResult.scheduled
                  ? 'Responses will be generated automatically at the scheduled time — no one is notified.'
                  : 'Responses are generated automatically — open analytics to see them come in.')
              : (sentResult.scheduled
                  ? 'It will be sent automatically at the scheduled time.'
                  : 'Students will receive a notification and analytics will update as they respond.')}
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
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
            Topic <span style={{ fontWeight: '400', color: '#aaa' }}>(optional)</span>
          </label>
          <select
            data-testid="send-topic-select"
            value={topicTag}
            onChange={e => setTopicTag(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '8px', background: 'white' }}
          >
            <option value="">No topic</option>
            {TOPIC_TAGS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <p style={{ fontSize: '12px', color: '#aaa', marginTop: 0, marginBottom: '20px' }}>
            Picking a topic lets this quiz count toward your school's benchmark on the Population page.
          </p>

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
                style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
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
                  border: `${isSelected ? '2px' : '1px'} solid ${isSelected ? 'var(--primary)' : '#e0e0e0'}`,
                  borderRadius: '8px', background: isSelected ? 'var(--surface2)11' : 'white',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: `1px solid ${isSelected ? 'var(--primary)' : '#ccc'}`,
                  background: isSelected ? 'var(--primary)' : 'white',
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

          {sendingToDemo && (
            <div
              data-testid="send-demo-note"
              style={{ padding: '12px 14px', background: '#EEEDFE', border: '1px solid #d6d2f5', borderRadius: '8px', fontSize: '13px', color: '#3C3489', marginTop: '12px' }}
            >
              This is a demo class. Responses are generated automatically — no one is notified.
            </div>
          )}

          <div style={{ borderTop: '1px solid #eee', margin: '20px 0' }}></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <div
              onClick={() => setMode('now')}
              style={{
                padding: '14px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                border: `2px solid ${mode === 'now' ? 'var(--primary)' : '#e0e0e0'}`,
                background: mode === 'now' ? 'var(--surface2)22' : '#fafafa',
              }}
            >
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>📤</div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: mode === 'now' ? 'var(--primary)' : '#888' }}>Send now</div>
            </div>
            <div
              onClick={() => setMode('schedule')}
              style={{
                padding: '14px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                border: `2px solid ${mode === 'schedule' ? 'var(--primary)' : '#e0e0e0'}`,
                background: mode === 'schedule' ? 'var(--surface2)22' : '#fafafa',
              }}
            >
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>🕐</div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: mode === 'schedule' ? 'var(--primary)' : '#888' }}>Schedule</div>
            </div>
          </div>

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
            Quiz stays open for (minutes)
          </label>
          <input
            type="number"
            min={5}
            value={durationMinutes}
            onChange={e => setDurationMinutes(Number(e.target.value))}
            style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '16px' }}
          />

          {mode === 'schedule' && (
            <>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
                Send at
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '16px' }}
              />
            </>
          )}

          {sending && sendingMsg && (
            <div style={{ padding: '10px 14px', background: 'var(--surface2)', border: 'var(--bw) solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⏳</span>
              {sendingMsg}
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
              background: selectedClasses.length === 0 || sending ? '#ccc' : 'var(--primary)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: '500',
              cursor: selectedClasses.length === 0 || sending ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSend}
          >
            {sending
              ? 'Working…'
              : mode === 'schedule'
                ? `Schedule for ${totalStudents} student${totalStudents === 1 ? '' : 's'} →`
                : `Send to ${totalStudents} student${totalStudents === 1 ? '' : 's'} →`}
          </button>

          <p style={{ fontSize: '12px', color: '#aaa', textAlign: 'center', marginTop: '10px' }}>
            You'll see live analytics update as students respond to the quiz.
          </p>
        </>
      )}
    </div>
  )
}

export default SendQuiz
