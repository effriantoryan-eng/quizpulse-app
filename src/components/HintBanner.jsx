export default function HintBanner({ text, onDismiss }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
      background: '#EEEDFE', border: '1px solid #C5C0F0', borderRadius: '10px',
      padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: '#3C3489', lineHeight: '1.5',
    }}>
      <span>💡 {text}</span>
      <button onClick={onDismiss} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: '#7B6EDE',
        fontSize: '16px', lineHeight: 1, flexShrink: 0, padding: '0 2px',
      }}>×</button>
    </div>
  )
}
