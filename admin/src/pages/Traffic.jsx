import { useState, useEffect } from 'react'
import { getTraffic } from '../api.js'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const groupStyle = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 20, marginBottom: 16,
}

const headingStyle = {
  fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

function StatTile({ label, value, unit = '' }) {
  const display = value === null || value === undefined ? '—' : `${value}${unit}`
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: value === null || value === undefined ? '#94a3b8' : '#1a1a1a' }}>{display}</div>
    </div>
  )
}

// Horizontal bar row — width proportional to `value / max`. No chart library, matches
// Monitoring.jsx's inline-styled budget bar.
function BarRow({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{value}</span>
      </div>
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#4c8bf5', borderRadius: 3 }} />
      </div>
    </div>
  )
}

function FunnelStep({ label, value, rate }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: value === null || value === undefined ? '#94a3b8' : '#1a1a1a' }}>
        {value === null || value === undefined ? '—' : value}
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
      {rate !== undefined && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          {rate === null ? '—' : `${rate}%`}
        </div>
      )}
    </div>
  )
}

export default function Traffic() {
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        setData(await getTraffic(range))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [range])

  const t = data
  const isEmpty = t && t.totals?.pageViews === 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Traffic</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              style={{
                padding: '4px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                background: range === value ? '#4c8bf5' : '#fff',
                color: range === value ? '#fff' : '#475569',
                border: `1px solid ${range === value ? '#4c8bf5' : '#cbd5e1'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {loading && <span style={{ color: '#94a3b8', fontSize: 12 }}>Loading…</span>}
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>Error: {error}</div>}

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '8px 14px', fontSize: 12, color: '#1e40af', marginBottom: 16 }}>
        Data collection began with v4.4.0 — visitor IDs reset at deploy, so uniques may read high
        and the funnel may read low for the first ~30 days.
      </div>

      {isEmpty && (
        <div style={{ ...groupStyle, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No traffic recorded in this range yet.
        </div>
      )}

      {t && !isEmpty && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            <StatTile label="Page views" value={t.totals.pageViews} />
            <StatTile label="Unique visitors" value={t.totals.uniqueVisitors} />
            <StatTile label="Sessions" value={t.totals.uniqueSessions} />
            <StatTile label="Pages / session" value={t.totals.pagesPerSession} />
            <StatTile label="PWA installs" value={t.pwaInstalls} />
          </div>

          <div style={groupStyle}>
            <h2 style={headingStyle}>Notification funnel</h2>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <FunnelStep label="Quizzes sent" value={t.funnel.quizzesSent} />
              <FunnelStep label="Notifications delivered" value={t.funnel.notificationsSent} />
              <FunnelStep label="Opened" value={t.funnel.quizOpens} rate={t.funnel.openRate} />
              <FunnelStep label="Responses submitted" value={t.funnel.responsesSubmitted} rate={t.funnel.completionRate} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={groupStyle}>
              <h2 style={headingStyle}>Top pages</h2>
              {t.topPages.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>No pages recorded.</div>}
              {t.topPages.map(({ page, count }) => (
                <BarRow key={page} label={page} value={count} max={t.topPages[0]?.count || 0} />
              ))}
            </div>

            <div style={groupStyle}>
              <h2 style={headingStyle}>Daily</h2>
              {t.daily.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>No daily data yet.</div>}
              {t.daily.map(({ date, pageViews }) => (
                <BarRow key={date} label={date} value={pageViews} max={Math.max(...t.daily.map(d => d.pageViews), 1)} />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={groupStyle}>
              <h2 style={headingStyle}>Audience</h2>
              <BarRow label="Teacher" value={t.audience.teacher} max={Math.max(t.audience.teacher, t.audience.student, t.audience.public, 1)} />
              <BarRow label="Student" value={t.audience.student} max={Math.max(t.audience.teacher, t.audience.student, t.audience.public, 1)} />
              <BarRow label="Public" value={t.audience.public} max={Math.max(t.audience.teacher, t.audience.student, t.audience.public, 1)} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                Device/browser breakdowns below are computed from teacher + public traffic only —
                student (/quiz) visits carry no device fingerprint by design.
              </div>
            </div>

            <div style={groupStyle}>
              <h2 style={headingStyle}>Device</h2>
              <BarRow label="Mobile" value={t.devices.mobile} max={Math.max(t.devices.mobile, t.devices.desktop, t.devices.unknown, 1)} />
              <BarRow label="Desktop" value={t.devices.desktop} max={Math.max(t.devices.mobile, t.devices.desktop, t.devices.unknown, 1)} />
              <BarRow label="Unknown" value={t.devices.unknown} max={Math.max(t.devices.mobile, t.devices.desktop, t.devices.unknown, 1)} />
            </div>

            <div style={groupStyle}>
              <h2 style={headingStyle}>Browser</h2>
              {Object.entries(t.browsers).map(([name, count]) => (
                <BarRow key={name} label={name} value={count} max={Math.max(...Object.values(t.browsers), 1)} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
