import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../../api'
import PromoSlot from '../../components/PromoSlot'
import GettingStartedChecklist from '../../components/GettingStartedChecklist'

const POLL_INTERVAL_MS = 8000

const card = {
  background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '12px',
  padding: '18px 20px', marginBottom: '12px',
}
const sectionLabel = {
  fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', margin: '24px 0 10px',
}
const demoPill = {
  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
  background: '#EEEDFE', color: '#3C3489', flexShrink: 0,
}

function timeLeft(closedAt) {
  if (!closedAt) return 'Open'
  const ms = new Date(closedAt).getTime() - Date.now()
  if (ms <= 0) return 'Closing'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min left`
  return `${Math.round(mins / 60)} hr left`
}

export default function TeacherHome() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
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

  if (error && !data) return <div style={{ padding: '24px', color: '#A32D2D' }}>{error}</div>
  if (!data) return <div style={{ padding: '24px', color: '#888' }}>Loading…</div>

  const { teacherName, activeQuizzes, recentResults, pendingRequestCount, misconceptions, counts } = data
  const hasAttention = pendingRequestCount > 0 || misconceptions.length > 0

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '22px' }}>
        {teacherName ? `Welcome back, ${teacherName}` : 'Welcome back'}
      </h2>
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
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
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/teacher/build')}
          style={{ flex: 1, minWidth: '160px', padding: '14px 18px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
        >
          Build a quiz
        </button>
        <button
          onClick={() => navigate('/teacher/create')}
          style={{ flex: 1, minWidth: '160px', padding: '14px 18px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--primary)', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
        >
          New question
        </button>
      </div>

      {/* Active quizzes */}
      <div style={sectionLabel}>Active quizzes</div>
      {activeQuizzes.length === 0 ? (
        <div style={{ ...card, color: '#aaa', fontSize: '14px', textAlign: 'center' }}>
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
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</span>
                {q.isDemo && <span style={demoPill}>Demo</span>}
              </div>
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>{timeLeft(q.closedAt)}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--primary)' }}>
                {q.totalResponses}{q.classSize ? ` / ${q.classSize}` : ''}
              </div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>responded</div>
            </div>
          </button>
        ))
      )}

      {/* Needs attention */}
      {hasAttention && (
        <>
          <div style={sectionLabel}>Needs attention</div>
          {pendingRequestCount > 0 && (
            <button
              onClick={() => navigate('/teacher/pending-requests')}
              style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '14px', color: '#333' }}>
                {pendingRequestCount} student{pendingRequestCount !== 1 ? 's' : ''} waiting to join
              </span>
              <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>Review →</span>
            </button>
          )}
          {misconceptions.map((m, i) => (
            <button
              key={i}
              onClick={() => navigate(`/teacher/analytics/${m.quizId}`)}
              style={{ ...card, display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', background: '#FFF8E6', border: '1px solid #F5C842' }}
            >
              <div style={{ fontSize: '14px', color: '#7A5C00' }}>
                {m.confidentButIncorrect} student{m.confidentButIncorrect !== 1 ? 's were' : ' was'} confident but wrong — worth revisiting.
              </div>
              <div style={{ fontSize: '12px', color: '#9c7a1a', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.quizName}: {m.questionText}
              </div>
            </button>
          ))}
        </>
      )}

      {/* Recent results */}
      {recentResults.length > 0 && (
        <>
          <div style={sectionLabel}>Recent results</div>
          {recentResults.map(q => (
            <button
              key={q.quizId}
              onClick={() => navigate(`/teacher/analytics/${q.quizId}`)}
              style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '14px', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</span>
              <span style={{ fontSize: '13px', color: '#888', flexShrink: 0 }}>
                {q.responseRate !== null ? `${q.responseRate}% responded` : `${q.totalResponses} responded`}
              </span>
            </button>
          ))}
        </>
      )}

      {/* At-a-glance counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '24px' }}>
        {[
          ['Classes', counts.classes],
          ['Students', counts.students],
          ['Questions', counts.questions],
          ['Quizzes sent', counts.quizzesSent],
        ].map(([label, val]) => (
          <div key={label} style={{ background: 'var(--surface2, #f7f7f9)', borderRadius: '10px', padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a' }}>{val}</div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>{label}</div>
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
