import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { weekDays, monthGrid, quizzesOnDay, sameDay } from '../../data/homeCalendar'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Read-only aggregate over the teacher's own quizzes (GET /api/quizzes, already teacher-scoped) —
// no new endpoint. Week is the default; Month is a toggle. <1024px collapses to week-only via CSS
// (the Month segment is hidden, matching the site's 1024px breakpoint convention).
export default function HomeCalendar({ quizzes }) {
  const navigate = useNavigate()
  const [view, setView] = useState('week')
  const today = new Date()
  const days = view === 'month' ? monthGrid(today) : weekDays(today)
  const hasAny = quizzes.length > 0

  return (
    <div style={{ border: 'var(--bw) solid var(--border)', padding: '16px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="bp-label" style={{ margin: 0 }}>Calendar</div>
        <div className="seg home-calendar-seg">
          <button type="button" className={`seg-opt${view === 'week' ? ' active' : ''}`} onClick={() => setView('week')}>Week</button>
          <button type="button" className={`seg-opt home-calendar-month-opt${view === 'month' ? ' active' : ''}`} onClick={() => setView('month')}>Month</button>
        </div>
      </div>

      {!hasAny ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '28px 0' }}>
          No quizzes scheduled yet
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', background: 'var(--surface2)', border: '1px solid var(--surface2)' }}>
          {days.map((day, i) => {
            const dayQuizzes = quizzesOnDay(quizzes, day)
            const isToday = sameDay(day, today)
            return (
              <div
                key={i}
                role={dayQuizzes.length ? 'button' : undefined}
                tabIndex={dayQuizzes.length ? 0 : undefined}
                onClick={dayQuizzes.length ? () => navigate(`/teacher/analytics/${dayQuizzes[0].id}`) : undefined}
                style={{
                  background: 'var(--surface)', minHeight: view === 'month' ? '52px' : '76px',
                  padding: '6px', cursor: dayQuizzes.length ? 'pointer' : 'default',
                }}
              >
                {view === 'week' && (
                  <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{DAY_LABELS[i]}</div>
                )}
                <div style={{ fontSize: '11px', color: isToday ? 'var(--primary)' : 'var(--muted)', fontWeight: isToday ? 700 : 400 }}>
                  {day.getDate()}
                </div>
                {dayQuizzes.slice(0, view === 'month' ? 1 : 3).map((q) => (
                  <div key={q.id} style={{ fontSize: '10px', marginTop: '3px', color: q.status === 'scheduled' ? 'var(--muted)' : 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.name}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
