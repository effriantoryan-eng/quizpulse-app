import { useState, useEffect } from 'react'

// ─── Design tokens ────────────────────────────────────────────────
const C = {
  purple:      '#534AB7',
  purpleLight: '#EEEDFE',
  purpleMid:   '#7B6EDE',
  purpleDark:  '#1a1433',
  green:       '#3B6D11',
  greenLight:  '#EAF3DE',
  red:         '#A32D2D',
  redLight:    '#FCEBEB',
  border:      '#eee',
  text:        '#1a1433',
  sub:         '#666',
  muted:       '#aaa',
}

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

function SectionLabel({ role }) {
  const isTeacher = role === 'teacher'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <span style={{
        fontSize: '11px', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase',
        padding: '3px 10px', borderRadius: '20px',
        background: isTeacher ? C.purpleLight : C.greenLight,
        color: isTeacher ? C.purple : C.green,
      }}>
        {isTeacher ? '👩‍🏫 Teacher view' : '🎓 Student view'}
      </span>
      <div style={{ flex: 1, height: '1px', background: C.border }} />
    </div>
  )
}

function Badge({ label, live }) {
  const isLive   = label === 'Live in demo'
  const isActive = label === 'Interactive'
  const bg   = isLive ? C.greenLight : isActive ? C.purpleLight : '#FFF3CD'
  const color = isLive ? C.green     : isActive ? C.purple      : '#856404'
  return (
    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: bg, color, fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {label}
    </span>
  )
}

function CardShell({ title, subtitle, badge, hint, children }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${C.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: C.text }}>{title}</div>
          <Badge label={badge} />
        </div>
        <div style={{ fontSize: '12px', color: C.sub }}>{subtitle}</div>
        {hint && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: C.purple, background: C.purpleLight, borderRadius: '6px', padding: '6px 10px', lineHeight: '1.5' }}>
            {hint}
          </div>
        )}
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Card 1: Student Experience ───────────────────────────────────
const QUIZ_QUESTIONS = [
  {
    text: 'Which organelle is responsible for photosynthesis?',
    options: ['Mitochondria', 'Chloroplast', 'Ribosome', 'Nucleus'],
    correct: 1,
  },
  {
    text: 'What is the chemical symbol for water?',
    options: ['O2', 'CO2', 'H2O', 'NaCl'],
    correct: 2,
  },
]

function PhoneShell({ children }) {
  return (
    <div style={{
      width: 'min(200px, 85%)', margin: '0 auto',
      background: '#111', borderRadius: '32px',
      padding: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
    }}>
      {/* notch */}
      <div style={{ background: '#111', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
        <div style={{ width: '60px', height: '10px', background: '#000', borderRadius: '10px' }} />
      </div>
      {/* screen */}
      <div style={{ background: 'white', borderRadius: '22px', minHeight: '340px', overflow: 'hidden', position: 'relative' }}>
        {/* status bar */}
        <div style={{ background: '#f5f5f5', padding: '4px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555' }}>
          <span>9:41</span><span>●●● WiFi 🔋</span>
        </div>
        {children}
      </div>
      {/* home bar */}
      <div style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px' }}>
        <div style={{ width: '60px', height: '4px', background: '#444', borderRadius: '4px' }} />
      </div>
    </div>
  )
}

function NotificationTab() {
  return (
    <PhoneShell>
      {/* home screen apps grid */}
      <div style={{ padding: '10px 8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        {['📷','🎵','📧','🗺️','📅','⚙️','💬','🌐'].map((e,i) => (
          <div key={i} style={{ background: '#e5e5e5', borderRadius: '8px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{e}</div>
        ))}
      </div>
      {/* notification banner */}
      <div style={{ margin: '8px', background: 'rgba(255,255,255,0.95)', borderRadius: '12px', padding: '10px 12px', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <div style={{ width: '18px', height: '18px', background: C.purple, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>⚡</div>
          <span style={{ fontSize: '9px', fontWeight: '600', color: '#333' }}>QUIZPULSE</span>
          <span style={{ fontSize: '8px', color: '#999', marginLeft: 'auto' }}>now</span>
        </div>
        <div style={{ fontSize: '10px', fontWeight: '600', color: '#111', marginBottom: '2px' }}>New quiz from Ms Johnson</div>
        <div style={{ fontSize: '9px', color: '#555', marginBottom: '8px' }}>Week 4 — Photosynthesis check-in • Yr 9 Science</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ flex: 1, background: C.purple, borderRadius: '6px', padding: '4px', textAlign: 'center', fontSize: '9px', fontWeight: '600', color: 'white' }}>Start quiz</div>
          <div style={{ flex: 1, background: '#f0f0f0', borderRadius: '6px', padding: '4px', textAlign: 'center', fontSize: '9px', color: '#555' }}>Later</div>
        </div>
      </div>
    </PhoneShell>
  )
}

function QuizTab({ onDone }) {
  const [qIdx, setQIdx]       = useState(0)
  const [selected, setSelected] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  const q = QUIZ_QUESTIONS[qIdx]

  function confirm() {
    if (selected === null) return
    setConfirmed(true)
  }

  function next() {
    if (qIdx < QUIZ_QUESTIONS.length - 1) {
      setQIdx(qIdx + 1)
      setSelected(null)
      setConfirmed(false)
    } else {
      onDone()
    }
  }

  const pct = Math.round(((qIdx + (confirmed ? 1 : 0)) / QUIZ_QUESTIONS.length) * 100)

  return (
    <PhoneShell>
      {/* header */}
      <div style={{ background: C.purple, padding: '10px 12px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: 'white', marginBottom: '6px' }}>Week 4 — Photosynthesis</div>
        <div style={{ background: 'rgba(255,255,255,0.3)', borderRadius: '4px', height: '4px' }}>
          <div style={{ background: 'white', height: '100%', borderRadius: '4px', width: `${pct}%`, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.8)', marginTop: '3px' }}>Q{qIdx+1} of {QUIZ_QUESTIONS.length}</div>
      </div>
      <div style={{ padding: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: '600', color: C.text, lineHeight: '1.4', marginBottom: '10px' }}>{q.text}</div>
        {q.options.map((opt, i) => {
          let bg = 'white', border = '#ddd', color = '#333'
          if (confirmed) {
            if (i === q.correct)       { bg = C.greenLight; border = C.green; color = C.green }
            else if (i === selected)   { bg = C.redLight;   border = C.red;   color = C.red   }
          } else if (i === selected)   { bg = C.purpleLight; border = C.purple; color = C.purple }
          return (
            <div key={i}
              onClick={() => !confirmed && setSelected(i)}
              style={{ background: bg, border: `1px solid ${border}`, color, borderRadius: '8px', padding: '7px 9px', marginBottom: '5px', fontSize: '9px', fontWeight: '500', cursor: confirmed ? 'default' : 'pointer', transition: 'all 0.2s' }}>
              <span style={{ marginRight: '6px', opacity: 0.6 }}>{String.fromCharCode(65+i)}</span>{opt}
            </div>
          )
        })}
        {!confirmed ? (
          <div onClick={confirm} style={{ marginTop: '8px', background: selected !== null ? C.purple : '#ccc', color: 'white', borderRadius: '8px', padding: '7px', textAlign: 'center', fontSize: '9px', fontWeight: '600', cursor: selected !== null ? 'pointer' : 'not-allowed' }}>
            Confirm
          </div>
        ) : (
          <div onClick={next} style={{ marginTop: '8px', background: C.purple, color: 'white', borderRadius: '8px', padding: '7px', textAlign: 'center', fontSize: '9px', fontWeight: '600', cursor: 'pointer' }}>
            {qIdx < QUIZ_QUESTIONS.length - 1 ? 'Next →' : 'Finish →'}
          </div>
        )}
      </div>
    </PhoneShell>
  )
}

function DoneTab() {
  return (
    <PhoneShell>
      <div style={{ padding: '20px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎉</div>
        <div style={{ fontSize: '12px', fontWeight: '700', color: C.text, marginBottom: '6px' }}>Quiz complete!</div>
        <div style={{ fontSize: '9px', color: C.sub, marginBottom: '16px', lineHeight: '1.5' }}>
          Thanks for participating in<br />Week 4 — Photosynthesis check-in
        </div>
        <div style={{ background: C.purpleLight, borderRadius: '10px', padding: '10px', marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: C.purple }}>2 / 2</div>
          <div style={{ fontSize: '8px', color: C.purple }}>Questions answered</div>
        </div>
        <div style={{ background: C.greenLight, borderRadius: '10px', padding: '8px' }}>
          <div style={{ fontSize: '9px', color: C.green, fontWeight: '600' }}>✓ Participation recorded</div>
          <div style={{ fontSize: '8px', color: C.green, marginTop: '2px' }}>No score shown — this is low-stakes</div>
        </div>
      </div>
    </PhoneShell>
  )
}

function Card1() {
  const TABS = ['Notification', 'Quiz', 'Done']
  const [tab, setTab] = useState(0)
  const [quizDone, setQuizDone] = useState(false)

  function handleDone() { setTab(2); setQuizDone(true) }

  return (
    <CardShell title="Student experience" subtitle="Notification → quiz → completion, all on mobile" badge="Interactive" hint="Switch tabs to walk through the full student journey. The Quiz tab is playable — select an answer and confirm.">
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            style={{ flex: 1, padding: '6px 4px', borderRadius: '8px', border: `1px solid ${tab===i ? C.purple : C.border}`, background: tab===i ? C.purple : 'white', color: tab===i ? 'white' : C.sub, fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>
            {t}
          </button>
        ))}
      </div>
      {tab === 0 && <NotificationTab />}
      {tab === 1 && <QuizTab onDone={handleDone} />}
      {tab === 2 && <DoneTab />}
      {tab === 1 && (
        <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '11px', color: C.muted }}>
          Select an answer, then confirm
        </div>
      )}
    </CardShell>
  )
}

// ─── Card 2: Analytics ────────────────────────────────────────────
const ANALYTICS_DATA = [
  {
    q: 'Which organelle does photosynthesis?',
    correct: 1,
    options: ['Mitochondria', 'Chloroplast', 'Ribosome', 'Nucleus'],
    counts:  [4, 18, 3, 3],
  },
  {
    q: 'What gas do plants absorb?',
    correct: 2,
    options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'],
    counts:  [5, 2, 19, 2],
  },
  {
    q: 'What is needed for photosynthesis?',
    correct: 0,
    options: ['Sunlight', 'Darkness', 'Cold temps', 'Salt water'],
    counts:  [20, 3, 2, 3],
  },
]

const BAR_COLOURS = [C.purpleMid, '#9B93E8', '#C5C0F0', '#DDD9FF']

function Card2() {
  const [qIdx, setQIdx] = useState(0)
  const q = ANALYTICS_DATA[qIdx]
  const total = q.counts.reduce((a, b) => a + b, 0)

  return (
    <CardShell title="Quiz analytics" subtitle="Per-question response breakdown" badge="Live in demo" hint="Click Q1 / Q2 / Q3 to switch questions. Green bar = correct answer. This is the real analytics view already live in the demo.">
      {/* Q selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {ANALYTICS_DATA.map((_, i) => (
          <button key={i} onClick={() => setQIdx(i)}
            style={{ padding: '4px 12px', borderRadius: '20px', border: `1px solid ${qIdx===i ? C.purple : C.border}`, background: qIdx===i ? C.purple : 'white', color: qIdx===i ? 'white' : C.sub, fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>
            Q{i+1}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: C.muted, alignSelf: 'center' }}>{total} students</span>
      </div>

      {/* question text */}
      <div style={{ fontSize: '12px', fontWeight: '600', color: C.text, marginBottom: '12px', lineHeight: '1.4' }}>{q.q}</div>

      {/* bars */}
      {q.options.map((opt, i) => {
        const pct = Math.round((q.counts[i] / total) * 100)
        const isCorrect = i === q.correct
        const barColor = isCorrect ? C.green : BAR_COLOURS[i] || C.purpleMid
        return (
          <div key={i} style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: isCorrect ? C.greenLight : C.purpleLight, color: isCorrect ? C.green : C.purple, fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {String.fromCharCode(65+i)}
              </span>
              <span style={{ fontSize: '11px', color: C.text, flex: 1 }}>{opt}</span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: isCorrect ? C.green : C.purple }}>{pct}%</span>
            </div>
            <div style={{ marginLeft: '22px', height: '10px', background: '#f0f0f0', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '5px', transition: 'width 0.5s', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '4px' }}>
                {pct >= 15 && <span style={{ fontSize: '8px', color: 'white', fontWeight: '600' }}>{pct}%</span>}
              </div>
            </div>
          </div>
        )
      })}
      {q.correct !== null && (
        <div style={{ marginTop: '10px', padding: '6px 10px', background: C.greenLight, borderRadius: '8px', fontSize: '11px', color: C.green, fontWeight: '500' }}>
          ✓ Correct answer: {q.options[q.correct]}
        </div>
      )}
    </CardShell>
  )
}

// ─── Card 3: Scheduling ───────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function Card3() {
  const [mode, setMode]       = useState('now')
  const [days, setDays]       = useState(['Mon'])
  const [time, setTime]       = useState('09:00')
  const [sent, setSent]       = useState(false)

  function toggleDay(d) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function send() { setSent(true); setTimeout(() => setSent(false), 3000) }

  const summary = mode === 'now'
    ? 'Quiz will be sent immediately to all selected classes.'
    : days.length === 0
      ? 'Select at least one day.'
      : `Quiz will be sent every ${days.join(', ')} at ${time}.`

  return (
    <CardShell title="Quiz scheduling" subtitle="Send now or schedule recurring sends" badge="Post-MVP" hint="Toggle between Send now and Schedule, pick days and a time, then try saving — this is a post-MVP mockup.">
      {/* mode toggle */}
      <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: '10px', padding: '3px', marginBottom: '16px' }}>
        {['now', 'schedule'].map(m => (
          <button key={m} onClick={() => { setMode(m); setSent(false) }}
            style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', background: mode===m ? 'white' : 'transparent', color: mode===m ? C.purple : C.sub, fontSize: '12px', fontWeight: mode===m ? '600' : '400', cursor: 'pointer', boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
            {m === 'now' ? '📤 Send now' : '🕐 Schedule'}
          </button>
        ))}
      </div>

      {mode === 'schedule' && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: C.sub, marginBottom: '8px', fontWeight: '500' }}>Repeat on</div>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '12px' }}>
            {DAYS.map(d => (
              <button key={d} onClick={() => toggleDay(d)}
                style={{ flex: 1, padding: '6px 2px', borderRadius: '8px', border: `1px solid ${days.includes(d) ? C.purple : C.border}`, background: days.includes(d) ? C.purple : 'white', color: days.includes(d) ? 'white' : C.sub, fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>
                {d}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: C.sub, marginBottom: '6px', fontWeight: '500' }}>Send at</div>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '13px', color: C.text, boxSizing: 'border-box', outline: 'none' }} />
        </div>
      )}

      {/* summary */}
      <div style={{ padding: '10px 12px', background: C.purpleLight, borderRadius: '8px', fontSize: '11px', color: C.purple, marginBottom: '14px', lineHeight: '1.5' }}>
        {summary}
      </div>

      {sent ? (
        <div style={{ padding: '10px', background: C.greenLight, borderRadius: '8px', fontSize: '12px', color: C.green, fontWeight: '600', textAlign: 'center' }}>
          ✓ {mode === 'now' ? 'Quiz sent!' : 'Schedule saved!'}
        </div>
      ) : (
        <button onClick={send}
          style={{ width: '100%', padding: '10px', background: C.purple, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          {mode === 'now' ? 'Send quiz →' : 'Save schedule →'}
        </button>
      )}
    </CardShell>
  )
}

// ─── Card 4: Push Notifications ───────────────────────────────────
function LockScreenPhone() {
  return (
    <div style={{ width: 'min(180px, 85%)', margin: '0 auto', background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 100%)', borderRadius: '28px', padding: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {/* notch */}
      <div style={{ height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
        <div style={{ width: '50px', height: '8px', background: '#000', borderRadius: '8px' }} />
      </div>
      {/* screen */}
      <div style={{ borderRadius: '20px', overflow: 'hidden', minHeight: '280px', background: 'linear-gradient(160deg, #0f3460 0%, #533483 100%)', padding: '10px', position: 'relative' }}>
        {/* status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>
          <span>9:41</span><span>●●● 🔋</span>
        </div>
        {/* lock screen time */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '36px', fontWeight: '200', color: 'white', lineHeight: 1 }}>9:41</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>Monday, 9 June</div>
        </div>
        {/* notification banner */}
        <div style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '12px', padding: '10px 10px', border: '1px solid rgba(255,255,255,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
            <div style={{ width: '16px', height: '16px', background: C.purple, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', flexShrink: 0 }}>⚡</div>
            <span style={{ fontSize: '8px', fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.5px' }}>QUIZPULSE</span>
            <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>now</span>
          </div>
          <div style={{ fontSize: '9px', fontWeight: '700', color: 'white', marginBottom: '1px' }}>Ms Johnson sent a quiz</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.75)', marginBottom: '8px' }}>Week 4 — Photosynthesis check-in</div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.25)', borderRadius: '6px', padding: '4px', textAlign: 'center', fontSize: '8px', fontWeight: '600', color: 'white' }}>Start</div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px', textAlign: 'center', fontSize: '8px', color: 'rgba(255,255,255,0.7)' }}>Later</div>
          </div>
        </div>
      </div>
      {/* home bar */}
      <div style={{ height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px' }}>
        <div style={{ width: '50px', height: '3px', background: 'rgba(255,255,255,0.3)', borderRadius: '3px' }} />
      </div>
    </div>
  )
}

function Card4() {
  return (
    <CardShell title="Native push notifications" subtitle="iOS & Android via Azure Notification Hubs" badge="Post-MVP" hint="This shows what students will see on their lock screen when a teacher sends a quiz.">
      <LockScreenPhone />
      <div style={{ marginTop: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: C.text, marginBottom: '8px' }}>How it works</div>
        {[
          { icon: '📤', text: 'Teacher sends or schedules a quiz' },
          { icon: '☁️', text: 'Azure Notification Hubs fans out to all class devices' },
          { icon: '📱', text: 'Students get a native lock-screen notification on iOS & Android' },
          { icon: '⚡', text: 'Tap to open QuizPulse and start the quiz instantly' },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
            <span style={{ fontSize: '12px', color: C.sub, lineHeight: '1.4' }}>{text}</span>
          </div>
        ))}
        <div style={{ marginTop: '10px', padding: '8px 10px', background: '#FFF3CD', borderRadius: '8px', fontSize: '11px', color: '#856404' }}>
          Planned for post-MVP using Azure Notification Hubs with APNs + FCM.
        </div>
      </div>
    </CardShell>
  )
}

// ─── Page ─────────────────────────────────────────────────────────
export default function DemoGallery() {
  const width = useWindowWidth()
  const cols = width >= 600 ? 'repeat(2, 1fr)' : '1fr'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: '36px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: C.text, marginBottom: '8px', letterSpacing: '-0.3px' }}>
          Preview gallery
        </h2>
        <p style={{ fontSize: '14px', color: C.sub, margin: 0 }}>
          Interactive mockups of the student experience and upcoming features.
        </p>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <SectionLabel role="student" />
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '20px' }}>
          <Card1 />
          <Card4 />
        </div>
      </div>

      <div>
        <SectionLabel role="teacher" />
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '20px' }}>
          <Card2 />
          <Card3 />
        </div>
      </div>
    </div>
  )
}
