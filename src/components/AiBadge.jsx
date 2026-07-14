// v4.3.0 — marks an AI-drafted question wherever it appears. Its own colour slot (blue,
// informational) — purple stays demo-only, terracotta stays misconception-only (§6.9).
function AiBadge() {
  return (
    <span
      data-testid="ai-badge"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
        background: '#E8F1FB', color: '#2C6BAA',
      }}
    >
      🤖 AI-drafted
    </span>
  )
}

export default AiBadge
