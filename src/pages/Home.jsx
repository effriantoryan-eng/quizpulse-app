import { useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'

const STEPS = [
  { icon: '✏️', label: 'Create questions', desc: 'Build a question bank across topics and year levels.', path: '/teacher/create' },
  { icon: '🔧', label: 'Build a quiz',     desc: 'Pick questions, give the quiz a name, and arrange the order.', path: '/teacher/build' },
  { icon: '📤', label: 'Send to a class',  desc: 'Choose a class and push a quiz to students in real time.', path: '/teacher/send' },
  { icon: '📊', label: 'View analytics',   desc: 'See per-question breakdowns and participation rates.', path: null },
]

// ─── Pill label ────────────────────────────────────────────────────────────────
function Pill({ label, variant = 'neutral' }) {
  const styles = {
    neutral: { bg: '#F3F3F3', color: '#666' },
    red:     { bg: '#FCEBEB', color: '#A32D2D' },
    green:   { bg: '#EAF3DE', color: '#3B6D11' },
    purple:  { bg: '#EEEDFE', color: '#3C3489' },
  }
  const s = styles[variant]
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '99px',
      fontSize: '10px',
      fontWeight: '600',
      letterSpacing: '0.6px',
      textTransform: 'uppercase',
      background: s.bg,
      color: s.color,
      marginBottom: '14px',
    }}>{label}</span>
  )
}

// ─── Panel 01 SVG ──────────────────────────────────────────────────────────────
function Svg01({ qMarkRef }) {
  return (
    <svg width="160" height="100" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', margin: '0 auto 12px', maxWidth: '100%', height: 'auto' }}>
      {/* Faded question mark — animates */}
      <g ref={qMarkRef}>
        <text x="100" y="88" fontSize="90" fill="#534AB7" fillOpacity="0.07" fontWeight="700" fontFamily="serif">?</text>
      </g>
      {/* Whiteboard */}
      <rect x="10" y="15" width="68" height="45" rx="3" fill="#F5F4FF" stroke="#C5C0F0" strokeWidth="1.5"/>
      <line x1="18" y1="27" x2="58" y2="27" stroke="#A09BD6" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="34" x2="52" y2="34" stroke="#A09BD6" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="41" x2="55" y2="41" stroke="#A09BD6" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="48" x2="46" y2="48" stroke="#A09BD6" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="44" y1="60" x2="38" y2="72" stroke="#C5C0F0" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="44" y1="60" x2="50" y2="72" stroke="#C5C0F0" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Teacher figure */}
      <rect x="88" y="44" width="12" height="18" rx="4" fill="#534AB7" fillOpacity="0.7"/>
      <circle cx="94" cy="38" r="7" fill="#534AB7" fillOpacity="0.7"/>
      <line x1="91" y1="62" x2="87" y2="76" stroke="#534AB7" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round"/>
      <line x1="97" y1="62" x2="103" y2="74" stroke="#534AB7" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round"/>
      <line x1="88" y1="50" x2="82" y2="60" stroke="#534AB7" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="100" y1="50" x2="106" y2="58" stroke="#534AB7" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="112" y1="30" x2="112" y2="78" stroke="#DDD" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Panel 02 SVG ──────────────────────────────────────────────────────────────
function Svg02({ arrowRef }) {
  return (
    <svg width="160" height="118" viewBox="0 0 160 118" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', margin: '0 auto 12px', maxWidth: '100%', height: 'auto' }}>
      {/* Phone frame — dark */}
      <rect x="30" y="0" width="88" height="118" rx="14" fill="#1C1C1E"/>
      {/* Screen */}
      <rect x="32" y="2" width="84" height="114" rx="12" fill="#FFFFFF"/>
      {/* Punch-hole camera */}
      <circle cx="74" cy="9" r="2.5" fill="#1C1C1E"/>
      {/* Status bar */}
      <text x="37" y="16" fontSize="5.5" fontWeight="700" fill="#111" fontFamily="system-ui">9:41</text>
      {/* Signal bars */}
      <rect x="97" y="13.5" width="2" height="2.5" rx="0.5" fill="#111"/>
      <rect x="100.5" y="12" width="2" height="4" rx="0.5" fill="#111"/>
      <rect x="104" y="10.5" width="2" height="5.5" rx="0.5" fill="#111"/>
      {/* Battery */}
      <rect x="108" y="11" width="8.5" height="5" rx="1" fill="none" stroke="#111" strokeWidth="0.7"/>
      <rect x="116.5" y="12.5" width="1.5" height="2" rx="0.5" fill="#111"/>
      <rect x="109" y="12" width="6" height="3" rx="0.5" fill="#111"/>
      {/* App header */}
      <rect x="32" y="19" width="84" height="15" fill="#F2F2F7"/>
      {/* Back chevron */}
      <path d="M39 26.5 l-3-3 l3-3" stroke="#534AB7" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <text x="76" y="29.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#1C1C1E" fontFamily="system-ui">Year 9 Science 🔬</text>
      {/* Divider */}
      <line x1="32" y1="34" x2="116" y2="34" stroke="#E5E5EA" strokeWidth="0.5"/>

      {/* Student bubble — left */}
      <rect x="36" y="37" width="50" height="11" rx="5.5" fill="#E5E5EA"/>
      <text x="61" y="44.7" textAnchor="middle" fontSize="5" fill="#333" fontFamily="system-ui">any hw tonight? 😅</text>

      {/* Teacher link bubble — right (sent) */}
      <rect x="62" y="51" width="50" height="17" rx="7" fill="#534AB7"/>
      <text x="87" y="58.8" textAnchor="middle" fontSize="5" fontWeight="700" fill="white" fontFamily="system-ui">📋 Quiz Check-in</text>
      <text x="87" y="65.6" textAnchor="middle" fontSize="4.3" fill="rgba(255,255,255,0.72)" fontFamily="system-ui">forms.gle/yr9quiz</text>

      {/* Emoji flood */}
      <rect x="36" y="71" width="40" height="11" rx="5.5" fill="#E5E5EA"/>
      <text x="56" y="79.6" textAnchor="middle" fontSize="7" fontFamily="system-ui">😂🔥💀😭</text>
      <rect x="36" y="85" width="40" height="11" rx="5.5" fill="#E5E5EA"/>
      <text x="56" y="93.6" textAnchor="middle" fontSize="7" fontFamily="system-ui">🤣😅🔥😂</text>
      <rect x="36" y="99" width="31" height="11" rx="5.5" fill="#E5E5EA"/>
      <text x="51.5" y="107.6" textAnchor="middle" fontSize="7" fontFamily="system-ui">👀💀🤣</text>

      {/* Home indicator */}
      <rect x="54" y="112" width="40" height="2.5" rx="1.25" fill="#1C1C1E" opacity="0.15"/>

      {/* Red callout arrow — points at buried teacher link, animates */}
      <g ref={arrowRef}>
        <line x1="123" y1="59.5" x2="114" y2="59.5" stroke="#A32D2D" strokeWidth="1.5" strokeLinecap="round"/>
        <polygon points="112,59.5 116,57 116,62" fill="#A32D2D"/>
        <text x="125" y="57" fontSize="6" fontWeight="700" fill="#A32D2D" fontFamily="system-ui">link</text>
        <text x="125" y="65" fontSize="6" fontWeight="700" fill="#A32D2D" fontFamily="system-ui">buried</text>
      </g>
    </svg>
  )
}

// ─── Panel 03 SVG ──────────────────────────────────────────────────────────────
function Svg03({ notifCardRef }) {
  return (
    <svg width="160" height="118" viewBox="0 0 160 118" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', margin: '0 auto 12px', maxWidth: '100%', height: 'auto' }}>
      {/* Phone frame */}
      <rect x="35" y="0" width="90" height="118" rx="14" fill="#0D0D0D"/>
      {/* Screen — dark wallpaper */}
      <rect x="37" y="2" width="86" height="114" rx="12" fill="#1A103A"/>
      {/* Subtle wallpaper gradient suggestion */}
      <ellipse cx="80" cy="55" rx="55" ry="40" fill="#2D1B69" fillOpacity="0.4"/>
      {/* Punch-hole camera */}
      <circle cx="80" cy="10" r="3" fill="#0D0D0D"/>
      {/* Status bar */}
      <text x="42" y="18" fontSize="5.5" fontWeight="700" fill="rgba(255,255,255,0.85)" fontFamily="system-ui">9:14</text>
      {/* Signal bars */}
      <rect x="104" y="15" width="2" height="2.5" rx="0.5" fill="white" fillOpacity="0.7"/>
      <rect x="107.5" y="13.5" width="2" height="4" rx="0.5" fill="white" fillOpacity="0.7"/>
      <rect x="111" y="12" width="2" height="5.5" rx="0.5" fill="white" fillOpacity="0.7"/>
      {/* Battery */}
      <rect x="115" y="13" width="8.5" height="5" rx="1" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.7"/>
      <rect x="123.5" y="14.5" width="1.5" height="2" rx="0.5" fill="white" fillOpacity="0.6"/>
      <rect x="116" y="14" width="6" height="3" rx="0.5" fill="white" fillOpacity="0.7"/>
      {/* Time — large, centered */}
      <text x="80" y="52" textAnchor="middle" fontSize="26" fontWeight="300" fill="white" fontFamily="system-ui" letterSpacing="-1">9:14</text>
      <text x="80" y="62" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.55)" fontFamily="system-ui">Monday, 9 June</text>
      {/* Notification card — animates */}
      <g ref={notifCardRef}>
        {/* Card background — frosted glass look */}
        <rect x="40" y="70" width="80" height="40" rx="12" fill="white" fillOpacity="0.14"/>
        <rect x="40" y="70" width="80" height="40" rx="12" stroke="white" strokeOpacity="0.08" strokeWidth="0.5"/>
        {/* App icon */}
        <rect x="45" y="75" width="11" height="11" rx="3" fill="#534AB7"/>
        <text x="50.5" y="83.5" textAnchor="middle" fontSize="7" fill="white">⚡</text>
        {/* App name + time */}
        <text x="60" y="81" fontSize="6" fontWeight="700" fill="white" fontFamily="system-ui" letterSpacing="0.2">QUIZPULSE</text>
        <text x="116" y="81" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,0.4)" fontFamily="system-ui">now</text>
        {/* Notification body */}
        <text x="45" y="91" fontSize="6" fontWeight="600" fill="white" fontFamily="system-ui">Quiz from Ms. Santos</text>
        <text x="45" y="98.5" fontSize="5" fill="rgba(255,255,255,0.6)" fontFamily="system-ui">Photosynthesis · 3 q's · 90s</text>
        {/* Divider + action buttons */}
        <line x1="40" y1="104" x2="120" y2="104" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5"/>
        <text x="69" y="111" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#A89EFF" fontFamily="system-ui">Start quiz</text>
        <line x1="80" y1="104" x2="80" y2="112" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5"/>
        <text x="100" y="111" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,0.4)" fontFamily="system-ui">Later</text>
      </g>
      {/* Home indicator */}
      <rect x="58" y="113" width="44" height="2.5" rx="1.25" fill="white" fillOpacity="0.25"/>
    </svg>
  )
}

// ─── Panel 04 SVG ──────────────────────────────────────────────────────────────
function Svg04({ answerBRef }) {
  return (
    <svg width="160" height="100" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', margin: '0 auto 12px', maxWidth: '100%', height: 'auto' }}>
      {/* Student figure */}
      <circle cx="28" cy="22" r="8" fill="#534AB7" fillOpacity="0.6"/>
      <rect x="21" y="32" width="14" height="18" rx="4" fill="#534AB7" fillOpacity="0.6"/>
      <line x1="25" y1="50" x2="22" y2="64" stroke="#534AB7" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round"/>
      <line x1="33" y1="50" x2="36" y2="64" stroke="#534AB7" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round"/>
      <line x1="21" y1="38" x2="15" y2="48" stroke="#534AB7" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="35" y="34" width="16" height="24" rx="3" fill="#534AB7" fillOpacity="0.6"/>
      {/* Quiz card */}
      <rect x="60" y="8" width="88" height="84" rx="8" fill="white" stroke="#E8E8E8" strokeWidth="1.5"/>
      <rect x="67" y="16" width="72" height="5" rx="2" fill="#E8E8E8"/>
      <rect x="67" y="24" width="54" height="5" rx="2" fill="#E8E8E8"/>
      {/* Option A */}
      <rect x="67" y="35" width="74" height="12" rx="4" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="1"/>
      <text x="75" y="44" fontSize="7" fill="#888" fontFamily="system-ui">A   Glucose + oxygen</text>
      {/* Option B — highlighted purple, animates */}
      <g ref={answerBRef} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <rect x="67" y="51" width="74" height="12" rx="4" fill="#EEEDFE" stroke="#534AB7" strokeWidth="1.5"/>
        <text x="75" y="60" fontSize="7" fill="#534AB7" fontWeight="600" fontFamily="system-ui">B   Carbon dioxide + water</text>
      </g>
      {/* Option C */}
      <rect x="67" y="67" width="74" height="12" rx="4" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="1"/>
      <text x="75" y="76" fontSize="7" fill="#888" fontFamily="system-ui">C   Sunlight + chlorophyll</text>
      {/* No grade recorded */}
      <rect x="67" y="83" width="58" height="7" rx="2" fill="#F3F3F3"/>
      <text x="96" y="89" textAnchor="middle" fontSize="6" fill="#999" fontFamily="system-ui">no grade recorded</text>
    </svg>
  )
}

// ─── Panel 05 SVG ─────────────────────────────────────────────────────────────
function Svg05({ badgeRef, q2BarRef }) {
  return (
    <svg width="180" height="100" viewBox="0 0 180 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', margin: '0 auto 12px', maxWidth: '100%', height: 'auto' }}>
      {/* Dashboard card */}
      <rect x="8" y="5" width="164" height="90" rx="8" fill="white" stroke="#E8E8E8" strokeWidth="1.5"/>
      <text x="18" y="21" fontSize="8" fontWeight="700" fill="#1a1433" fontFamily="system-ui">Week 4 Quiz — Results</text>
      <rect x="120" y="12" width="44" height="13" rx="6" fill="#EAF3DE"/>
      <text x="142" y="21" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#3B6D11" fontFamily="system-ui">26 / 28 answered</text>
      <line x1="18" y1="28" x2="162" y2="28" stroke="#F0F0F0" strokeWidth="1"/>
      {/* Q1 — green, long */}
      <text x="18" y="41" fontSize="7" fill="#666" fontFamily="system-ui">Q1</text>
      <rect x="30" y="33" width="100" height="10" rx="3" fill="#EAF3DE"/>
      <rect x="30" y="33" width="92" height="10" rx="3" fill="#3B6D11" fillOpacity="0.6"/>
      <text x="136" y="41" fontSize="6.5" fill="#3B6D11" fontFamily="system-ui">24/26</text>
      {/* Q2 — red, short — bar fill animates */}
      <text x="18" y="57" fontSize="7" fill="#666" fontFamily="system-ui">Q2</text>
      <rect x="30" y="49" width="100" height="10" rx="3" fill="#FCEBEB"/>
      {/* Bar fill: outer g positions, inner g animates scaleX — keeps translate intact */}
      <g transform="translate(30, 49)">
        <g ref={q2BarRef} style={{ transformBox: 'fill-box', transformOrigin: 'left center', transform: 'scaleX(0)' }}>
          <rect width="32" height="10" rx="3" fill="#A32D2D" fillOpacity="0.65"/>
        </g>
      </g>
      <text x="136" y="57" fontSize="6.5" fill="#A32D2D" fontFamily="system-ui">8/26</text>
      {/* Re-teach badge — pulses after bar fills */}
      <g ref={badgeRef}>
        <rect x="64" y="46" width="52" height="16" rx="6" fill="#FCEBEB" stroke="#A32D2D" strokeWidth="1"/>
        <text x="90" y="57" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#A32D2D" fontFamily="system-ui">re-teach this ↑</text>
      </g>
      {/* Q3 — green, long */}
      <text x="18" y="73" fontSize="7" fill="#666" fontFamily="system-ui">Q3</text>
      <rect x="30" y="65" width="100" height="10" rx="3" fill="#EAF3DE"/>
      <rect x="30" y="65" width="85" height="10" rx="3" fill="#3B6D11" fillOpacity="0.6"/>
      <text x="136" y="73" fontSize="6.5" fill="#3B6D11" fontFamily="system-ui">22/26</text>
    </svg>
  )
}

// ─── Narrative panels section ──────────────────────────────────────────────────
function NarrativePanels() {
  const sectionRef    = useRef(null)
  const qMarkRef      = useRef(null)
  const arrowRef      = useRef(null)
  const notifCardRef  = useRef(null)
  const answerBRef    = useRef(null)
  const q2BarRef      = useRef(null)
  const badgeRef      = useRef(null)
  const timerIds      = useRef([])
  const loopStarted   = useRef(false)

  useEffect(() => {
    const styleId = 'qp-narrative-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        @keyframes qp-float-up {
          0%   { transform: translateY(0); }
          40%  { transform: translateY(-9px); }
          100% { transform: translateY(0); }
        }
        @keyframes qp-arrow-flash {
          0%,100% { opacity: 1; }
          28%,72% { opacity: 0.2; }
        }
        @keyframes qp-notif-bounce {
          0%   { transform: translateY(0); }
          35%  { transform: translateY(-8px); }
          65%  { transform: translateY(-2px); }
          100% { transform: translateY(0); }
        }
        @keyframes qp-tap-pulse {
          0%,100% { transform: scale(1); }
          40%     { transform: scale(1.06); }
        }
        @keyframes qp-bar-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes qp-badge-pulse {
          0%,40%,80%,100% { transform: scale(1); }
          20%,60%         { transform: scale(1.1); }
        }
        .qp-float-up     { animation: qp-float-up 0.6s ease-in-out forwards; }
        .qp-arrow-flash  { animation: qp-arrow-flash 0.55s ease-in-out forwards; }
        .qp-notif-bounce { animation: qp-notif-bounce 0.5s cubic-bezier(0.34,1.4,0.64,1) forwards; }
        .qp-tap-pulse    { animation: qp-tap-pulse 0.4s ease-in-out forwards; }
        .qp-bar-fill     { animation: qp-bar-fill 0.65s cubic-bezier(0.4,0,0.2,1) forwards; }
        .qp-badge-pulse  { animation: qp-badge-pulse 0.75s ease-in-out forwards; }
      `
      document.head.appendChild(style)
    }

    const STAGGER      = 700   // ms between each panel
    const BADGE_OFFSET = 600   // extra delay before badge after bar starts
    const LOOP_PAUSE   = 2000  // gap between end of last animation and next cycle start
    // Sequence ends at: STAGGER*4 + BADGE_OFFSET + 750ms (badge duration)
    const SEQUENCE_DURATION = STAGGER * 4 + BADGE_OFFSET + 750

    const items = [
      { ref: qMarkRef,     cls: 'qp-float-up',     delay: 0 },
      { ref: arrowRef,     cls: 'qp-arrow-flash',  delay: STAGGER },
      { ref: notifCardRef, cls: 'qp-notif-bounce', delay: STAGGER * 2 },
      { ref: answerBRef,   cls: 'qp-tap-pulse',    delay: STAGGER * 3 },
      { ref: q2BarRef,     cls: 'qp-bar-fill',     delay: STAGGER * 4 },
      { ref: badgeRef,     cls: 'qp-badge-pulse',  delay: STAGGER * 4 + BADGE_OFFSET },
    ]

    function clearTimers() {
      timerIds.current.forEach(clearTimeout)
      timerIds.current = []
    }

    function runLoop() {
      clearTimers()

      // Reset: remove classes so animations can restart
      items.forEach(({ ref, cls }) => {
        if (ref.current) ref.current.classList.remove(cls)
      })

      // Fire each item after its stagger delay.
      // getBoundingClientRect() before adding the class forces a reflow so the
      // CSS animation restarts cleanly even if the class was just removed.
      items.forEach(({ ref, cls, delay }) => {
        const id = setTimeout(() => {
          if (!ref.current) return
          ref.current.getBoundingClientRect()
          ref.current.classList.add(cls)
        }, delay)
        timerIds.current.push(id)
      })

      // Schedule the next cycle
      const nextId = setTimeout(runLoop, SEQUENCE_DURATION + LOOP_PAUSE)
      timerIds.current.push(nextId)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loopStarted.current) {
          loopStarted.current = true
          runLoop()
        }
      },
      { threshold: 0.2 }
    )

    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => { observer.disconnect(); clearTimers() }
  }, [])

  const panelBase  = { padding: '20px 16px 18px', background: 'white', position: 'relative' }
  const captionHead = { fontSize: '13px', fontWeight: '600', color: '#1a1433', marginBottom: '4px', lineHeight: '1.4' }
  const captionSub  = { fontSize: '12px', color: '#777', lineHeight: '1.5', margin: 0 }
  const pillRow     = { display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }
  const srOnly      = { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }
  const smallPill   = (bg, color, label) => (
    <span key={label} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: '600', background: bg, color }}>{label}</span>
  )

  return (
    <div ref={sectionRef} style={{ marginBottom: '48px' }}>
      <div style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: '#eee' }}>

        {/* Top row — 3 columns (collapses to 1 on mobile via CSS) */}
        <div className="qp-top-row" style={{ display: 'grid', gap: '1px' }}>

          <div style={{ ...panelBase, borderRadius: '11px 0 0 0' }}>
            <Pill label="every day" variant="neutral" />
            <span style={srOnly}>Teacher walking out of a classroom with a whiteboard and a large faded question mark.</span>
            <Svg01 qMarkRef={qMarkRef} />
            <p style={captionHead}>90 minutes taught. Zero insight.</p>
            <p style={captionSub}>You walked out not knowing if any of it landed.</p>
          </div>

          <div style={{ ...panelBase }}>
            <Pill label="the old way" variant="red" />
            <span style={srOnly}>Phone showing a class chat thread with a Google Forms link buried under student emoji messages.</span>
            <Svg02 arrowRef={arrowRef} />
            <p style={captionHead}>Your link drowned in the chat.</p>
            <p style={captionSub}>Students didn't ignore it — they never saw it.</p>
          </div>

          <div style={{ ...panelBase, borderRadius: '0 11px 0 0' }}>
            <Pill label="with QuizPulse" variant="green" />
            <span style={srOnly}>Phone lock screen showing a QuizPulse push notification from Ms. Santos with Start quiz and Later buttons.</span>
            <Svg03 notifCardRef={notifCardRef} />
            <p style={captionHead}>It arrives on their lock screen.</p>
            <p style={captionSub}>No link to find. No app to open. It's just there.</p>
          </div>
        </div>

        {/* Row gap */}
        <div style={{ height: '1px', background: '#eee' }} />

        {/* Bottom row — 2 columns (collapses to 1 on mobile via CSS) */}
        <div className="qp-bottom-row" style={{ display: 'grid', gap: '1px' }}>

          <div style={{ ...panelBase, borderRadius: '0 0 0 11px' }}>
            <Pill label="for students" variant="purple" />
            <span style={srOnly}>Student holding a phone, quiz card with option B highlighted in purple and a no grade recorded label.</span>
            <Svg04 answerBRef={answerBRef} />
            <p style={captionHead}>No grades. No scores. No pressure.</p>
            <p style={captionSub}>Students see participation only. 90 seconds, then done. No reason to dread it.</p>
            <div style={pillRow}>
              {smallPill('#F3F3F3', '#666', 'ungraded')}
              {smallPill('#F3F3F3', '#666', 'anonymous')}
              {smallPill('#F3F3F3', '#666', '~90 seconds')}
            </div>
          </div>

          <div style={{ ...panelBase, borderRadius: '0 0 11px 0' }}>
            <Pill label="next morning" variant="green" />
            <span style={srOnly}>Dashboard showing Q1 and Q3 with long green bars and Q2 with a short red bar and a re-teach this badge.</span>
            <Svg05 badgeRef={badgeRef} q2BarRef={q2BarRef} />
            <p style={captionHead}>One glance. You know exactly what to re-teach.</p>
            <p style={captionSub}>Not a hunch. Not a guess. Real data from your actual class, ready before first period.</p>
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: '12px', color: '#999', marginTop: '14px', marginBottom: 0 }}>
        That's the whole loop — teach, send, check, re-teach.
      </p>
    </div>
  )
}

// ─── Responsive styles ────────────────────────────────────────────────────────
function NarrativePanelsResponsive() {
  useEffect(() => {
    const styleId = 'qp-narrative-responsive'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .qp-top-row    { grid-template-columns: repeat(3, 1fr); }
        .qp-bottom-row { grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 640px) {
          .qp-top-row    { grid-template-columns: 1fr; }
          .qp-bottom-row { grid-template-columns: 1fr; }
        }
      `
      document.head.appendChild(style)
    }
  }, [])
  return null
}

export default function Home() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 24px' }}>
      <NarrativePanelsResponsive />

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '56px', maxWidth: 680, margin: '0 auto 56px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '64px', height: '64px', borderRadius: '16px',
          background: 'linear-gradient(135deg, #534AB7 0%, #7B6EDE 100%)',
          fontSize: '28px', marginBottom: '20px',
          boxShadow: '0 8px 24px rgba(83,74,183,0.35)',
        }}>⚡</div>

        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#1a1433', marginBottom: '12px', letterSpacing: '-0.5px' }}>
          QuizPulse
        </h1>
        <p style={{ fontSize: '16px', color: '#666', maxWidth: '420px', margin: '0 auto 28px', lineHeight: '1.6' }}>
          Low-stakes classroom check-ins for school teachers.
          No grades. Just participation.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/teacher/create')}
            style={{
              padding: '12px 28px', borderRadius: '8px',
              background: '#534AB7', color: 'white',
              border: 'none', fontSize: '15px', fontWeight: '500',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(83,74,183,0.35)',
            }}
          >
            Get started →
          </button>
          <button
            onClick={() => navigate('/demo')}
            style={{
              padding: '12px 28px', borderRadius: '8px',
              background: 'white', color: '#534AB7',
              border: '1px solid #534AB7', fontSize: '15px', fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Preview mockups
          </button>
        </div>
      </div>

      {/* Narrative panels */}
      <NarrativePanels />

      {/* How it works */}
      <div style={{ maxWidth: 680, margin: '0 auto', marginBottom: '48px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#999', marginBottom: '20px', textAlign: 'center' }}>
          How it works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {STEPS.map((step, i) => (
            <div
              key={step.label}
              onClick={() => step.path && navigate(step.path)}
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #eee',
                background: 'white',
                cursor: step.path ? 'pointer' : 'default',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (step.path) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(83,74,183,0.12)'; e.currentTarget.style.borderColor = '#c5c0f0' } }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = '#eee' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '28px', height: '28px', borderRadius: '7px',
                  background: '#EEEDFE', fontSize: '14px', flexShrink: 0,
                }}>{step.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1433' }}>{i + 1}. {step.label}</span>
              </div>
              <p style={{ fontSize: '13px', color: '#777', lineHeight: '1.5', margin: 0 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Callout */}
      <div style={{
        maxWidth: 680, margin: '0 auto',
        padding: '20px 24px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #f5f4ff 0%, #ede9ff 100%)',
        border: '1px solid #c5c0f0',
        display: 'flex', gap: '16px', alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: '22px', flexShrink: 0, marginTop: '2px' }}>🎓</span>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#3C3489', marginBottom: '4px' }}>
            Teacher view
          </div>
          <p style={{ fontSize: '13px', color: '#5a5298', lineHeight: '1.6', margin: 0 }}>
            QuizPulse is a working beta shown here from the teacher's perspective. When you send a quiz,
            students receive a real notification and analytics update live as they respond.
            Some flows are shown as mockups in the{' '}
            <span
              onClick={() => navigate('/demo')}
              style={{ textDecoration: 'underline', cursor: 'pointer' }}
            >
              Preview gallery
            </span>.
          </p>
        </div>
      </div>
    </div>
  )
}
