import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import { useAuth } from '../../contexts/AuthContext'
import API_BASE from '../../api'
import TOPIC_TAGS from '../../data/topicTags'
import matchTopics from '../../data/topicPrefilter'
import { isOutsideSchoolHours } from '../../data/schoolHours'

// Copyable manual escape hatch for a flaky push — a teacher can paste this into a group chat
// or a slide when a student's notification doesn't arrive.
function ShareLink({ quizId }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/quiz?quizId=${quizId}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard permission denied — the link is still visible/selectable in the input
    }
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', color: '#3a7a65', marginBottom: '6px' }}>
        Or share this link directly — for a student whose notification doesn't arrive:
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          readOnly
          value={link}
          onClick={(e) => e.target.select()}
          style={{ flex: 1, padding: '8px 10px', fontSize: '12px', border: '1px solid #1a7a5e', borderRadius: 'var(--radius)', background: 'white', color: '#085041' }}
        />
        <button
          onClick={copy}
          style={{ padding: '8px 14px', background: '#085041', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function SendQuiz() {
  const { login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [hintVisible, dismissHint, showHint] = useHint('send')
  // v4.3.0 quizId mode: an approved AI draft (or, since v4.6.0, a manually built quiz saved via
  // BuildQuiz's "Save & go to send") is already a real quiz doc (status 'draft') — load it
  // instead of building a new one from questionIds, and skip question-picking. The id is read
  // from the URL (?quizId=), not just router state, so a refresh or a shared link doesn't lose
  // the in-progress quiz — router state (ReviewDraft's approve->send bridge) is kept as a
  // fallback for the one existing caller that doesn't pass it via URL yet.
  const {
    quizName: quizNameFromState = '',
    questionIds: questionIdsFromState = [],
    quizId: quizIdFromState = null,
    spacedRepeats: incomingSpacedRepeats = null,
  } = location.state || {}
  const incomingQuizId = quizIdFromState || searchParams.get('quizId')
  const [loadedQuiz, setLoadedQuiz] = useState(null)
  const [loadingQuiz, setLoadingQuiz] = useState(!!incomingQuizId)
  const quizName = incomingQuizId ? (loadedQuiz?.name || '') : quizNameFromState
  const questionIds = incomingQuizId ? (loadedQuiz?.questionIds || []) : questionIdsFromState

  useEffect(() => {
    if (!incomingQuizId) return
    fetch(`${API_BASE}/quizzes/${incomingQuizId}`)
      .then(r => r.json())
      .then(setLoadedQuiz)
      .catch(() => {})
      .finally(() => setLoadingQuiz(false))
  }, [incomingQuizId])

  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [classesError, setClassesError] = useState(null)
  const [classesSessionExpired, setClassesSessionExpired] = useState(false)
  const [selectedClasses, setSelectedClasses] = useState([])
  const [sending, setSending] = useState(false)
  const [sendingMsg, setSendingMsg] = useState('')
  const [sentResult, setSentResult] = useState(null) // { quizId, scheduled }
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('now') // 'now' | 'schedule'
  const [armedAfterHours, setArmedAfterHours] = useState(false) // D2.5 — one confirmed "Send anyway"
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [scheduledFor, setScheduledFor] = useState('')
  const [topicTag, setTopicTag] = useState('')
  const [matchedTopics, setMatchedTopics] = useState([])
  const [showAllTopics, setShowAllTopics] = useState(true)
  // E3 — spaced repeats for ANY quiz. Comma-separated day offsets, e.g. "2,7,21"; max 5.
  // Approve → send bridge (§6.4) carries the schedule chips chosen in ReviewDraft over here.
  const [spacedRepeatsInput, setSpacedRepeatsInput] = useState(
    Array.isArray(incomingSpacedRepeats) ? incomingSpacedRepeats.join(', ') : ''
  )

  // v4.2.0 topic prefilter: segment the dropdown to the teacher's own subjects/year levels
  // first. Zero-match fallback (e.g. a Year 8 Maths teacher — no preset tag covers that
  // combination) suppresses the "matched" segment entirely rather than showing an empty one.
  useEffect(() => {
    fetch(`${API_BASE}/me`)
      .then((r) => r.json())
      .then((data) => {
        const { subjects, yearLevels } = data.profile || {}
        const matched = matchTopics(subjects, yearLevels, TOPIC_TAGS)
        if (matched.length > 0) {
          setMatchedTopics(matched)
          setShowAllTopics(false)
        }
      })
      .catch(() => {})
  }, [])

  async function fetchClasses() {
    setClassesLoading(true)
    setClassesError(null)
    setClassesSessionExpired(false)
    try {
      const res = await fetch(`${API_BASE}/classes`)
      if (res.status === 401) { setClassesSessionExpired(true); return }
      if (!res.ok) throw new Error('Something went wrong loading your classes.')
      const data = await res.json()
      setClasses(data)
    } catch {
      setClassesError('Something went wrong loading your classes.')
    } finally {
      setClassesLoading(false)
    }
  }

  useEffect(() => { fetchClasses() }, [])

  // D2.5 — any change to when the quiz goes out re-requires the explicit "Send anyway"
  // confirmation. Must run unconditionally (before the early returns below) — Rules of Hooks.
  useEffect(() => { setArmedAfterHours(false) }, [mode, scheduledFor, spacedRepeatsInput])

  if (incomingQuizId && loadingQuiz) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
  }

  if (!quizName || questionIds.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Send quiz</h2>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>
          No quiz to send. Please build a quiz first.
        </p>
        <button
          onClick={() => navigate('/teacher/build')}
          style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: 'var(--radius)', fontSize: '14px', cursor: 'pointer' }}
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
  // Demo responses never feed population benchmarking (see api/analyticsPopulation.js),
  // so don't promise a benchmark contribution when only a demo class is selected.
  const onlyDemoSelected = selectedClasses.length > 0 &&
    selectedClasses.every(id => classes.find(c => c.id === id)?.isDemo)

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

    const spacedRepeats = spacedRepeatsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(Number)
    if (spacedRepeats.some(d => !Number.isInteger(d) || d < 1 || d > 365)) {
      setError('Spaced repeats must be whole numbers of days (1-365), separated by commas.')
      return
    }
    if (spacedRepeats.length > 5) {
      setError('You can schedule at most 5 spaced repeats.')
      return
    }

    setSending(true)
    try {
      // v4.3.0: one send path for both manual and AI-generated quizzes. A manual quiz is first
      // created as status:'draft' (no push, no clones yet), then transitions through the same
      // POST /api/quizzes/{id}/send every approved AI draft uses — that endpoint sets sentAt/
      // closedAt, creates spaced-repeat clones, and fires the push notification itself.
      let quizId = incomingQuizId
      if (!quizId) {
        setSendingMsg('Saving quiz…')
        const createRes = await fetch(`${API_BASE}/quizzes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: quizName, questionIds, status: 'draft', ...(topicTag && { topicTag }) }),
        })
        if (!createRes.ok) {
          const data = await createRes.json().catch(() => ({}))
          throw new Error(data.error || 'Something went wrong. Please try again.')
        }
        quizId = (await createRes.json()).id
      }

      setSendingMsg(mode === 'schedule' ? 'Scheduling quiz…' : 'Sending quiz…')
      const sendRes = await fetch(`${API_BASE}/quizzes/${quizId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classIds: selectedClasses,
          durationMinutes,
          mode,
          ...(mode === 'schedule' && { scheduledFor: new Date(scheduledFor).toISOString() }),
          ...(spacedRepeats.length > 0 && { spacedRepeats }),
        }),
      })
      if (!sendRes.ok) {
        const data = await sendRes.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      const sendResult = await sendRes.json()

      setSentResult({ quizId, scheduled: mode === 'schedule', demo: sendingToDemo, clonesCreated: sendResult.clonesCreated || 0 })
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
      setSendingMsg('')
    }
  }

  // D2.5 — every moment this send would notify students: the base send (now, or the scheduled time)
  // plus each spaced repeat (same clock time N days later). setDate keeps the wall-clock time across
  // month/DST boundaries. Recomputed each render so it tracks the schedule/repeat inputs live.
  function sendMoments() {
    const base = mode === 'schedule' && scheduledFor ? new Date(scheduledFor) : new Date()
    if (isNaN(base.getTime())) return []
    const moments = [base]
    for (const n of spacedRepeatsInput.split(',').map(s => s.trim()).filter(Boolean).map(Number)) {
      if (Number.isInteger(n) && n >= 1 && n <= 365) {
        const d = new Date(base)
        d.setDate(d.getDate() + n)
        moments.push(d)
      }
    }
    return moments
  }
  const anyAfterHours = sendMoments().some(m => isOutsideSchoolHours(m))

  // First click on an after-hours send only arms the warning; the second (on "Send anyway") sends.
  function handleSendClick() {
    if (anyAfterHours && !armedAfterHours) { setArmedAfterHours(true); return }
    handleSend()
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px' }}>
      {!sentResult && (
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0, marginBottom: '16px' }}
        >
          ← Back
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Send quiz</h2>
        {!hintVisible && (
          <button onClick={showHint} aria-label="Show tips" style={{ background: 'none', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', width: '26px', height: '26px', cursor: 'pointer', color: 'var(--primary)', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
        )}
      </div>
      {hintVisible && (
        <HintBanner
          text="Pick which class(es) to send to, choose how long the quiz stays open, then send now or schedule it for later."
          onDismiss={dismissHint}
        />
      )}

      {incomingQuizId && (
        <div data-testid="send-approved-banner" style={{ padding: '12px 14px', background: '#E1F5EE', border: '1px solid #1a7a5e', borderRadius: 'var(--radius)', fontSize: '13px', color: '#085041', marginBottom: '16px' }}>
          Approved — pick who gets it.
        </div>
      )}

      {/* Quiz summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', background: '#f8f8f8', borderRadius: 'var(--radius)', marginBottom: '24px', border: 'var(--bw) solid var(--border)' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="2" width="6" height="4" rx="0"/><path d="M4 4h16v18H4z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>{quizName}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{questionIds.length} question{questionIds.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {sentResult ? (
        <div style={{ background: '#E1F5EE', border: '1px solid #1a7a5e', borderRadius: 'var(--radius)', padding: '24px' }}>
          <div style={{ marginBottom: '10px' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{sentResult.scheduled ? <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> : <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>}</svg></div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#085041', marginBottom: '8px' }}>
            {sentResult.scheduled ? 'Quiz scheduled!' : 'Quiz sent!'}
          </div>
          <div style={{ fontSize: '12px', color: '#3a7a65', marginBottom: '8px' }}>
            {sentResult.demo
              ? (sentResult.scheduled
                  ? 'Responses will be generated automatically at the scheduled time — no one is notified.'
                  : 'Responses are generated automatically — open analytics to see them come in.')
              : (sentResult.scheduled
                  ? 'It will be sent automatically at the scheduled time.'
                  : 'Students will receive a notification and analytics will update as they respond.')}
          </div>
          {sentResult.clonesCreated > 0 && (
            <div data-testid="send-repeats-confirmation" style={{ fontSize: '12px', color: '#3a7a65', marginBottom: '20px' }}>
              {sentResult.clonesCreated} practice repeat{sentResult.clonesCreated === 1 ? '' : 's'} scheduled.
            </div>
          )}
          {sentResult.clonesCreated === 0 && <div style={{ marginBottom: '20px' }} />}
          {!sentResult.scheduled && !sentResult.demo && (
            <ShareLink quizId={sentResult.quizId} />
          )}
          <button
            onClick={() => navigate(`/teacher/analytics/${sentResult.quizId}`)}
            style={{ width: '100%', padding: '11px', background: '#085041', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
          >
            View analytics →
          </button>
          <button
            onClick={() => navigate('/teacher/quizzes')}
            style={{ width: '100%', marginTop: '8px', padding: '11px', background: 'white', color: '#085041', border: '1px solid #085041', borderRadius: 'var(--radius)', fontSize: '14px', cursor: 'pointer' }}
          >
            All quizzes
          </button>
        </div>
      ) : (
        <>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
            Topic <span style={{ fontWeight: '400', color: 'var(--muted)' }}>(optional)</span>
          </label>
          <select
            data-testid="send-topic-select"
            value={topicTag}
            onChange={e => setTopicTag(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', boxSizing: 'border-box', marginBottom: '8px', background: 'white' }}
          >
            <option value="">No topic</option>
            {matchedTopics.length > 0 ? (
              <>
                <optgroup label="Your subjects">
                  {matchedTopics.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </optgroup>
                {showAllTopics && (
                  <optgroup label="All topics">
                    {TOPIC_TAGS.filter(t => !matchedTopics.includes(t)).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </optgroup>
                )}
              </>
            ) : (
              TOPIC_TAGS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))
            )}
          </select>
          {matchedTopics.length > 0 && !showAllTopics && (
            <button
              type="button"
              data-testid="send-topic-show-all"
              onClick={() => setShowAllTopics(true)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', cursor: 'pointer', padding: 0, marginBottom: '8px' }}
            >
              Show all topics
            </button>
          )}
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: 0, marginBottom: '20px' }}>
            {onlyDemoSelected
              ? 'Practice quizzes sent to a demo class don’t count toward your school’s benchmark on the Population page.'
              : 'Picking a topic lets this quiz count toward your school’s benchmark on the Population page.'}
          </p>

          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--muted)', marginBottom: '10px' }}>Send to class</div>

          {classesLoading && (
            <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '16px', textAlign: 'center' }}>Loading classes…</div>
          )}

          {classesSessionExpired && (
            <div style={{ fontSize: '13px', color: '#c0392b', padding: '12px', background: '#fdecea', borderRadius: 'var(--radius)', marginBottom: '16px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px' }}>Your session has ended. Sign in again to continue.</p>
              <button
                onClick={() => login()}
                style={{ padding: '6px 14px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
              >
                Sign in
              </button>
            </div>
          )}

          {classesError && !classesSessionExpired && (
            <div style={{ fontSize: '13px', color: '#c0392b', padding: '12px', background: '#fdecea', borderRadius: 'var(--radius)', marginBottom: '16px', textAlign: 'center' }}>
              {classesError}{' '}
              <button
                onClick={fetchClasses}
                style={{ marginLeft: '8px', padding: '4px 10px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
          )}

          {!classesLoading && !classesError && !classesSessionExpired && classes.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '16px', textAlign: 'center', border: '1px dashed #ddd', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
              No classes yet.{' '}
              <button type="button" className="link-button" onClick={() => navigate('/teacher/classes')}>
                Create a class first
              </button>
              .
            </div>
          )}

          {classes.map(c => {
            const isSelected = selectedClasses.includes(c.id)
            return (
              <label
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', marginBottom: '8px',
                  border: `${isSelected ? '2px' : '1px'} solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', background: isSelected ? 'var(--surface2)' : 'white',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleClass(c.id)}
                  style={{ accentColor: 'var(--primary)', width: '18px', height: '18px', flexShrink: 0, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>{c.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{c.studentCount || 0} students</div>
                </div>
              </label>
            )
          })}

          {sendingToDemo && (
            <div
              data-testid="send-demo-note"
              style={{ padding: '12px 14px', background: 'var(--surface2)', border: 'var(--bw) solid var(--border)', fontSize: '13px', marginTop: '12px' }}
            >
              This is a demo class. Responses are generated automatically — no one is notified.
            </div>
          )}

          <div style={{ borderTop: '1px solid #eee', margin: '20px 0' }}></div>
          <div role="group" aria-label="When to send" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              className="seg-opt"
              aria-pressed={mode === 'now'}
              onClick={() => setMode('now')}
              style={{
                padding: '14px', textAlign: 'center', borderRadius: 'var(--radius)', cursor: 'pointer',
                border: `2px solid ${mode === 'now' ? 'var(--primary)' : '#e0e0e0'}`,
                background: mode === 'now' ? 'var(--surface2)' : '#fafafa',
                fontWeight: '500', fontSize: '13px',
                color: mode === 'now' ? 'var(--primary)' : 'var(--muted)',
              }}
            >
              Send now
            </button>
            <button
              type="button"
              className="seg-opt"
              aria-pressed={mode === 'schedule'}
              onClick={() => setMode('schedule')}
              style={{
                padding: '14px', textAlign: 'center', borderRadius: 'var(--radius)', cursor: 'pointer',
                border: `2px solid ${mode === 'schedule' ? 'var(--primary)' : '#e0e0e0'}`,
                background: mode === 'schedule' ? 'var(--surface2)' : '#fafafa',
                fontWeight: '500', fontSize: '13px',
                color: mode === 'schedule' ? 'var(--primary)' : 'var(--muted)',
              }}
            >
              Schedule
            </button>
          </div>

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
            Quiz stays open for (minutes)
          </label>
          <input
            type="number"
            min={5}
            value={durationMinutes}
            onChange={e => setDurationMinutes(Number(e.target.value))}
            style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', boxSizing: 'border-box', marginBottom: '16px' }}
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
                style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', boxSizing: 'border-box', marginBottom: '16px' }}
              />
            </>
          )}

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
            Schedule spaced repeats <span style={{ fontWeight: '400', color: 'var(--muted)' }}>(optional, up to 5)</span>
          </label>
          <input
            data-testid="send-spaced-repeats-input"
            type="text"
            placeholder="e.g. 2, 7, 21 (days after send)"
            value={spacedRepeatsInput}
            onChange={e => setSpacedRepeatsInput(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', boxSizing: 'border-box', marginBottom: '4px' }}
          />
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: 0, marginBottom: '16px' }}>
            After you send this quiz, we'll resend practice on the days you list here.
          </p>

          {sending && sendingMsg && (
            <div style={{ padding: '10px 14px', background: 'var(--surface2)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⏳</span>
              {sendingMsg}
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: 'var(--radius)', fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {anyAfterHours && (
            <div data-testid="after-hours-warning" role="status" style={{ padding: '10px 14px', background: 'var(--surface2)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
              Students may get this notification outside school hours.
            </div>
          )}

          <button
            disabled={selectedClasses.length === 0 || sending}
            style={{
              width: '100%', padding: '12px',
              background: selectedClasses.length === 0 || sending ? '#ccc' : 'var(--primary)',
              color: 'white', border: 'none', borderRadius: 'var(--radius)',
              fontSize: '15px', fontWeight: '500',
              cursor: selectedClasses.length === 0 || sending ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSendClick}
          >
            {sending
              ? 'Working…'
              : anyAfterHours && armedAfterHours
                ? 'Send anyway →'
                : mode === 'schedule'
                  ? `Schedule for ${totalStudents} student${totalStudents === 1 ? '' : 's'} →`
                  : `Send to ${totalStudents} student${totalStudents === 1 ? '' : 's'} →`}
          </button>

          <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '10px' }}>
            You'll see live analytics update as students respond to the quiz.
          </p>
        </>
      )}
    </div>
  )
}

export default SendQuiz
