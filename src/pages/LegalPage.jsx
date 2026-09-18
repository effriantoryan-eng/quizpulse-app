import { Link } from 'react-router-dom'
import { isLegalPending } from '../data/legalContent'
import LegalFooter from '../components/LegalFooter'

// Renders one legal document (Privacy Policy / Collection Notice / Terms) passed by prop.
//
// Placeholder guard (design review finding 1): until the reviewer supplies approved wording, the
// document's text is the literal "[LEGAL TEXT PENDING]" marker. Rendering that verbatim to a
// visitor would look broken and, for a consent artifact, is a legal own-goal. So when the doc is
// still pending we render a neutral "being finalised" state instead of the marker. The rc1 gate
// (grep for the marker in src/) still blocks release — this guard is what keeps a placeholder
// from ever reaching a user in the build-before-wording window.
export default function LegalPage({ doc }) {
  const pending = isLegalPending(doc)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', minHeight: '60vh' }}>
      <Link
        to="/"
        style={{ color: 'var(--muted)', fontSize: '13px', textDecoration: 'none', display: 'inline-block', marginBottom: '16px' }}
      >
        ← Back
      </Link>

      <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 8px' }}>{doc?.title || 'Legal'}</h1>

      {pending ? (
        <div
          role="status"
          style={{ marginTop: '24px', padding: '20px', border: 'var(--bw) solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)', fontSize: '15px', lineHeight: '1.6' }}
        >
          This information is being finalised — please check back soon.
        </div>
      ) : (
        <>
          {doc.updated && (
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 24px' }}>
              Last updated {doc.updated}
            </p>
          )}
          {doc.sections.map((s, i) => (
            <section key={i} style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>{s.heading}</h2>
              <div style={{ fontSize: '15px', lineHeight: '1.7', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{s.body}</div>
            </section>
          ))}
        </>
      )}

      <LegalFooter />
    </div>
  )
}
