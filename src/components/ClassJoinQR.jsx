import QRCode from './QRCode'

// "Join this class" QR panel — shown on the student class-home and the join-approved screen so a
// student can hand a classmate (or their own phone, if they started on a shared/desktop browser)
// a scannable way in. Client-only, works offline (v4.7.0 T4). Distinct from the T7 device-link QR
// (not built this sprint) — that one re-pairs an existing identity, this one joins a new one.
export default function ClassJoinQR({ joinCode, className }) {
  const url = `${window.location.origin}/join?code=${encodeURIComponent(joinCode)}`

  return (
    <div style={{ background: 'var(--surface)', border: 'var(--bw) solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <span className="tag tag-neutral">Join this class</span>
      <div>
        <QRCode value={url} size={160} />
      </div>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
          Or type this in
        </div>
        <div style={{ fontFamily: 'var(--heading)', fontWeight: 800, fontSize: '15px', wordBreak: 'break-all' }}>
          {url.replace(/^https?:\/\//, '')}
        </div>
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {['Point your phone camera at the square', 'Tap the link that appears', `Join ${className || 'the class'}`].map((step, i) => (
          <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--text)' }}>
            <span style={{ fontFamily: 'var(--heading)', fontWeight: 800 }}>{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
