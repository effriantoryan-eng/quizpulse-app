import { useState, useEffect } from 'react'
import { getMetrics, buildLogsExportUrl, apiFetch } from '../api.js'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const cardStyle = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16,
}

const groupStyle = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 20, marginBottom: 16,
}

function MetricRow({ label, value, unit = '' }) {
  const display = value === null || value === undefined ? '—' : `${value}${unit}`
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
      <span style={{ color: '#475569' }}>{label}</span>
      <span style={{ fontWeight: 600, color: value === null ? '#94a3b8' : '#1a1a1a' }}>{display}</span>
    </div>
  )
}

const LOG_TYPES = [
  { type: 'security', label: 'Security log', available: true },
  { type: 'errors', label: 'Error log', available: false },
  { type: 'usage', label: 'Usage log', available: false },
]

export default function Monitoring() {
  const [range, setRange] = useState('today')
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [logFrom, setLogFrom] = useState('')
  const [logTo, setLogTo] = useState('')
  const [downloading, setDownloading] = useState(null)
  const [downloadError, setDownloadError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getMetrics(range)
        setMetrics(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [range])

  async function handleDownload(type) {
    setDownloading(type)
    setDownloadError(null)
    const url = buildLogsExportUrl(type, logFrom || undefined, logTo || undefined)
    try {
      const res = await apiFetch(url.replace('/api', ''), { headers: {} })
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${type}-log-export.jsonl`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      setDownloadError(`${type}: ${err.message}`)
    } finally {
      setDownloading(null)
    }
  }

  const m = metrics

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Monitoring</h1>
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

      {m && (m.systemHealth?.stubbed || m.security?.stubbed || m.spending?.stubbed) && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 4, padding: '8px 14px', fontSize: 12, color: '#854d0e', marginBottom: 16 }}>
          System health, security, and spending are stubbed — App Insights wiring is not yet
          built (values shown as "—"). Usage/growth and engagement carry real Cosmos-backed
          values (v4.4.0).
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={groupStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>System health</h2>
          <MetricRow label="Error rate" value={m?.systemHealth?.errorRate} unit="%" />
          <MetricRow label="p95 latency" value={m?.systemHealth?.p95LatencyMs} unit=" ms" />
          <MetricRow label="Active instances" value={m?.systemHealth?.activeInstances} />
        </div>

        <div style={groupStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spending</h2>
          <MetricRow label="Month cost (USD)" value={m?.spending?.monthCostUsd} unit="" />
          <MetricRow label="Budget (USD)" value={m?.spending?.budgetUsd} />
          {m?.spending?.monthCostUsd !== null && m?.spending?.budgetUsd && (
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${Math.min(100, (m.spending.monthCostUsd / m.spending.budgetUsd) * 100)}%`,
                  background: m.spending.monthCostUsd / m.spending.budgetUsd > 0.8 ? '#dc2626' : '#4c8bf5',
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {Math.round((m.spending.monthCostUsd / m.spending.budgetUsd) * 100)}% of budget
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={groupStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usage &amp; growth</h2>
          <MetricRow label="Schools" value={m?.usageGrowth?.schools} />
          <MetricRow label="Teachers" value={m?.usageGrowth?.teachers} />
          <MetricRow label="Students" value={m?.usageGrowth?.students} />
          <MetricRow label="Quizzes / day" value={m?.usageGrowth?.quizzesPerDay} />
          <MetricRow label="Push delivery rate" value={m?.usageGrowth?.pushDeliveryRate} unit="%" />
        </div>

        <div style={groupStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engagement</h2>
          <MetricRow label="Avg response rate" value={m?.engagement?.avgResponseRate} unit="%" />
          <MetricRow label="Avg time to respond" value={m?.engagement?.avgTimeToRespondSec} unit=" s" />
          <MetricRow label="Completion rate" value={m?.engagement?.completionRate} unit="%" />
        </div>

        <div style={groupStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security</h2>
          <MetricRow label="Rate-limit hits" value={m?.security?.rateLimitHits} />
          <MetricRow label="Join rejection rate" value={m?.security?.joinRejectionRate} unit="%" />
          <MetricRow label="Failed auth count" value={m?.security?.failedAuthCount} />
        </div>
      </div>

      {/* Log download */}
      <div style={groupStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Log export</h2>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
          Security log streams from the audit_log container. Error and usage logs require App Insights wiring (not yet built).
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>From</label>
            <input type="date" value={logFrom} onChange={(e) => setLogFrom(e.target.value)}
              style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>To</label>
            <input type="date" value={logTo} onChange={(e) => setLogTo(e.target.value)}
              style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {LOG_TYPES.map(({ type, label, available }) => (
            <button
              key={type}
              onClick={() => handleDownload(type)}
              disabled={!available || downloading === type}
              title={available ? '' : 'Not yet available — requires App Insights wiring'}
              style={{
                padding: '6px 14px', fontSize: 12, borderRadius: 4, cursor: available ? 'pointer' : 'not-allowed',
                background: available ? '#eff6ff' : '#f8fafc',
                color: available ? '#1e40af' : '#94a3b8',
                border: `1px solid ${available ? '#bfdbfe' : '#e2e8f0'}`,
              }}
            >
              {downloading === type ? 'Downloading…' : `↓ ${label}`}
            </button>
          ))}
        </div>

        {downloadError && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>Error: {downloadError}</div>}
      </div>
    </div>
  )
}
