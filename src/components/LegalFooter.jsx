import { Link } from 'react-router-dom'

// Three small legal links, tokens only. Rendered on the public / student / auth surfaces and in
// the teacher sidebar foot so a privacy policy, collection notice and terms are always reachable
// (audit B3 — no disclosure surface existed anywhere before R3).
export default function LegalFooter() {
  const linkStyle = {
    color: 'var(--muted)', fontSize: '12px', textDecoration: 'none',
  }
  return (
    <footer
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 14px', justifyContent: 'center',
        padding: '20px 16px', color: 'var(--muted)', fontSize: '12px',
      }}
    >
      <Link to="/privacy" style={linkStyle}>Privacy</Link>
      <span aria-hidden="true">·</span>
      <Link to="/collection-notice" style={linkStyle}>Collection notice</Link>
      <span aria-hidden="true">·</span>
      <Link to="/terms" style={linkStyle}>Terms</Link>
    </footer>
  )
}
