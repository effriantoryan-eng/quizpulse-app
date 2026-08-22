import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../../api'
import PromoSlot from '../../components/PromoSlot'
import GettingStartedChecklist from '../../components/GettingStartedChecklist'
import HomeCalendar from '../../components/home/HomeCalendar'
import { buildAlsoWaitingCards } from '../../data/alsoWaiting'

const POLL_INTERVAL_MS = 8000

const card = {
  background: 'var(--surface)', border: 'var(--bw) solid var(--border)',
  padding: '18px 20px', marginBottom: '12px',
}
const sectionLabel = { margin: '24px 0 10px' }

function timeLeft(closedAt) {
  if (!closedAt) return 'Open'
  const ms = new Date(closedAt).getTime() - Date.now()
  if (ms <= 0) return 'Closing'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min left`
  return `${Math.round(mins / 60)} hr left`
}

// One card per "also waiting" type — non-submitters, below-target closed quiz, draft-in-progress.
// Nudge (T3) is deferred to v4.8.0: the non-submitter card is count + "Open results" only, no
// "Nudge the N" button yet.
function AlsoWaitingCard({ item, navigate }) {
  if (item.type === 'nonSubmitters') {
    return (
      <div style={card}>
        <div style={{ fontFamily: 'var(--heading)', fontWeight: 800, fontSize: '16px', marginBottom: '8px' }}>{item.name}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--heading)', fontWeight: 800, fontSize: '30px' }}>{item.count}</span>
          <span style={{ fontSize: '13px' }}>of {item.total} haven't submitted</span>
        </div>
        <button onClick={() => navigate(`/teacher/analytics/${item.quizId}`)} className="btn btn-secondary btn-block">
          Open results
        </button>
      </div>
    )
  }
  if (item.type === 'belowTarget') {
    return (
      <div style={card}>
        <div style={{ fontFamily: 'var(--heading)', fontWeight: 800, fontSize: '16px', marginBottom: '8px' }}>{item.name}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--heading)', fontWeight: 800, fontSize: '30px' }}>{item.responseRate}%</span>
          <span style={{ fontSize: '13px' }}>responded — lower than usual</span>
        </div>
        <button onClick={() => navigate(`/teacher/analytics/${item.quizId}`)} className="btn btn-secondary btn-block">
          Open results
        </button>
      </div>
    )
  }
  // draft
  return (
    <div style={card}>
      <div style={{ fontFamily: 'var(--heading)', fontWeight: 800, fontSize: '16px', marginBottom: '8px' }}>{item.name}</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>Draft — not sent yet</div>
      <button onClick={() => navigate(`/teacher/send?quizId=${item.quizId}`)} className="btn btn-secondary btn-block">
        Continue
      </button>
    </div>
  )
}

export default function TeacherHome() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [quizzes, setQuizzes] = useState([])
  // undefined = loading, null = fetch failed (fail open — just show the normal PromoSlot).
  const [gettingStarted, setGettingStarted] = useState(undefined)
  // Captured from the same /api/me call and handed to PromoSlot so it doesn't re-fetch /api/me.
  // null on fetch failure → PromoSlot falls back to fetching for itself.
  const [eligibleIntros, setEligibleIntros] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/me`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setGettingStarted(d.gettingStarted || null); setEligibleIntros(d.eligibleIntros || []) } })
      .catch(() => { if (!cancelled) { setGettingStarted(null); setEligibleIntros(null) } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/dashboard`)
        if (!res.ok) throw new Error('Could not load your dashboard.')
        const d = await res.json()
        if (!cancelled) { setData(d); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Full quiz list — feeds the calendar (sentAt/scheduledFor marks) and the draft-in-progress
  // "also waiting" card. Read-only, teacher-scoped, no new endpoint (v4.7.0 T1).
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/quizzes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!cancelled) setQuizzes(Array.isArray(d) ? d : []) })
      .catch(() => { if (!cancelled) setQuizzes([]) })
    return () => { cancelled = true }
  }, [])

  if (error && !data) return <div style={{ padding: '24px', color: 'var(--danger)' }}>{error}</div>
  if (!data) return <div style={{ padding: '24px', color: 'var(--muted)' }}>Loading…</div>

  const { teacherName, activeQuizzes, recentResults, pendingRequestCount, misconceptions, counts } = data
  const alsoWaiting = buildAlsoWaitingCards({ activeQuizzes, recentResults, quizzes })
  const hasAttention = pendingRequestCount > 0 || misconceptions.length > 0

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '22px' }}>
        {teacherName ? `Welcome back, ${teacherName}` : 'Welcome back'}
      </h2>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
        Here's what's happening with your classes.
      </div>

      {/* Getting Started owns this slot until released/dismissed (v4.6.0 Task 4) — PromoSlot
          returns once it steps aside. Wait for the /api/me fetch so we don't flash PromoSlot
          then swap it out a beat later. */}
      {gettingStarted !== undefined && (
        gettingStarted && !gettingStarted.dismissed && !gettingStarted.released
          ? <GettingStartedChecklist gettingStarted={gettingStarted} variant="full" onChange={setGettingStarted} />
          : <PromoSlot eligibleIntros={eligibleIntros ?? undefined} />
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
        <button onClick={() => navigate('/teacher/build')} className="btn btn-primary" style={{ flex: 1, minWidth: '160px', justifyContent: 'center', padding: '14px 18px' }}>
          Build a quiz
        </button>
        <button onClick={() => navigate('/teacher/create')} className="btn btn-secondary" style={{ flex: 1, minWidth: '160px', justifyContent: 'center', padding: '14px 18px' }}>
          New question
        </button>
      </div>

      {/* Also waiting — non-submitters / below-target / draft-in-progress (v4.7.0 T1) */}
      <div style={sectionLabel}>
        <div className="bp-label">Also waiting</div>
        {alsoWaiting.length === 0 ? (
          <div style={{ ...card, color: 'var(--muted)', fontSize: '14px', textAlign: 'center' }}>
            Nothing waiting — send your first quiz.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2px' }}>
            {alsoWaiting.map((item) => <AlsoWaitingCard key={item.type} item={item} navigate={navigate} />)}
          </div>
        )}
      </div>

      <HomeCalendar quizzes={quizzes} />

      {/* Active quizzes */}
      <div className="bp-label" style={sectionLabel}>Active quizzes</div>
      {activeQuizzes.length === 0 ? (
        <div style={{ ...card, color: 'var(--muted)', fontSize: '14px', textAlign: 'center' }}>
          Nothing running right now. Build a quiz and send it to a class.
        </div>
      ) : (
        activeQuizzes.map(q => (
          <button
            key={q.quizId}
            onClick={() => navigate(`/teacher/analytics/${q.quizId}`)}
            style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</span>
                {q.isDemo && <span className="tag tag-neutral">Demo</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{timeLeft(q.closedAt)}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--primary)' }}>
                {q.totalResponses}{q.classSize ? ` / ${q.classSize}` : ''}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>responded</div>
            </div>
          </button>
        ))
      )}

      {/* Needs attention */}
      {hasAttention && (
        <>
          <div className="bp-label" style={sectionLabel}>Needs attention</div>
          {pendingRequestCount > 0 && (
            <button
              onClick={() => navigate('/teacher/pending-requests')}
              style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '14px', color: 'var(--text)' }}>
                {pendingRequestCount} student{pendingRequestCount !== 1 ? 's' : ''} waiting to join
              </span>
              <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 700 }}>Review →</span>
            </button>
          )}
          {misconceptions.map((m, i) => (
            <button
              key={i}
              onClick={() => navigate(`/teacher/analytics/${m.quizId}`)}
              style={{ ...card, display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', background: 'var(--tipBg)' }}
            >
              <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                {m.confidentButIncorrect} student{m.confidentButIncorrect !== 1 ? 's were' : ' was'} confident but wrong — worth revisiting.
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.quizName}: {m.questionText}
              </div>
            </button>
          ))}
        </>
      )}

      {/* Recent results */}
      {recentResults.length > 0 && (
        <>
          <div className="bp-label" style={sectionLabel}>Recent results</div>
          {recentResults.map(q => (
            <button
              key={q.quizId}
              onClick={() => navigate(`/teacher/analytics/${q.quizId}`)}
              style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</span>
              <span style={{ fontSize: '13px', color: 'var(--muted)', flexShrink: 0 }}>
                {q.responseRate !== null ? `${q.responseRate}% responded` : `${q.totalResponses} responded`}
              </span>
            </button>
          ))}
        </>
      )}

      {/* At-a-glance counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', marginTop: '24px' }}>
        {[
          ['Classes', counts.classes],
          ['Students', counts.students],
          ['Questions', counts.questions],
          ['Quizzes sent', counts.quizzesSent],
        ].map(([label, val]) => (
          <div key={label} style={{ background: 'var(--surface2)', padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{val}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Post-release collapsed strip (v4.6.0 Task 4) — the checklist doesn't disappear once
          released, it demotes here so the promo slot above is free again. */}
      {gettingStarted && !gettingStarted.dismissed && gettingStarted.released && (
        <GettingStartedChecklist gettingStarted={gettingStarted} variant="strip" onChange={setGettingStarted} />
      )}
    </div>
  )
}
