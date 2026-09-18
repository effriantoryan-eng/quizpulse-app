import { useState } from 'react'
import { Link } from 'react-router-dom'
import API_BASE from '../api'
import { TERMS_VERSION, TERMS, PRIVACY_POLICY, isLegalPending } from '../data/legalContent'
import { setTermsCurrent } from '../onboardingCache'

// R3 Task 5 — a one-screen interstitial shown by RequireTeacher when GET /api/me reports
// termsCurrent: false (a legacy teacher, or one whose acceptance predates a version bump). Three
// explicit states (design review finding 6): idle, submitting, error. Never auto-dismisses on
// failure, never optimistically marks accepted before the 200 lands (so a network blip can't
// silently record acceptance the teacher never actually agreed to).
export default function TermsUpdate({ onDone }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const pending = isLegalPending(TERMS) || isLegalPending(PRIVACY_POLICY)

  async function agree() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/me/terms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: TERMS_VERSION }),
      })
      if (!res.ok) {
        setError("Couldn't save that — try again.")
        return
      }
      setTermsCurrent(true)
      onDone()
    } catch {
      setError("Couldn't save that — try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '40px 32px', textAlign: 'center', background: 'var(--surface)', border: 'var(--bw) solid var(--border)' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>We've updated our terms</h1>

      {pending ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>
          Our Terms and Privacy Policy are being finalised — check back soon.
        </p>
      ) : (
        <>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
            Please review our{' '}
            <Link to="/terms" target="_blank" style={{ color: 'var(--primary)' }}>Terms</Link>{' '}and{' '}
            <Link to="/privacy" target="_blank" style={{ color: 'var(--primary)' }}>Privacy Policy</Link>{' '}
            before continuing.
          </p>
          {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
          <button onClick={agree} disabled={submitting} className="btn btn-primary btn-block" style={{ justifyContent: 'center' }}>
            {submitting ? 'Saving…' : 'I agree'}
          </button>
        </>
      )}
    </div>
  )
}
