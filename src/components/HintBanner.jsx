export default function HintBanner({ text, onDismiss }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '14px',
      background: 'var(--tipBg)', border: 'var(--bw) solid var(--tipBorder)',
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      padding: '18px 20px', marginBottom: '30px', fontSize: '15.5px',
      color: 'var(--text)', lineHeight: '1.5',
    }}>
      <span style={{
        width: '30px', height: '30px', borderRadius: '9px', flex: 'none',
        background: 'var(--primarySoft)', color: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
        </svg>
      </span>
      <span style={{ flex: 1 }}>{text}</span>
      <button onClick={onDismiss} aria-label="Dismiss" style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
        fontSize: '20px', lineHeight: 1, flexShrink: 0, padding: '0 2px',
      }}>×</button>
    </div>
  )
}
