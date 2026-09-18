import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setOnboarded as markOnboarded } from '../onboardingCache'
import API_BASE from '../api'
import ProfileWizardSteps from '../components/onboarding/ProfileWizardSteps'
import { Link } from 'react-router-dom'
import LegalFooter from '../components/LegalFooter'
import { TERMS_VERSION, TERMS, PRIVACY_POLICY, isLegalPending } from '../data/legalContent'
import BrandMark from '../components/BrandMark'

// Design review 1: a teacher must not be able to "accept" terms whose text is still a placeholder.
// When either doc is pending, the checkbox is replaced with a being-finalised notice and Continue
// is disabled — acceptance of a placeholder is impossible by construction (the rc1 gate also
// blocks release on the marker, but this stops it reaching a user in the build-before-wording window).
const TERMS_PENDING = isLegalPending(TERMS) || isLegalPending(PRIVACY_POLICY)

const SCHOOL_NAME_MAX = 120

// Step 1 (school name) submits POST /api/onboarding immediately, exactly as before — the
// teacher is onboarded from that moment. Steps 2-5 (profile) accumulate client-side and submit
// once via PUT /api/me/profile when the wizard finishes. Quitting anywhere after step 1 leaves
// the teacher onboarded with profileComplete:false — ProfileNudge picks it up later, never
// re-gating back to this page.
function Onboarding() {
  const navigate = useNavigate()
  const [schoolDone, setSchoolDone] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSchoolSubmit(e) {
    e.preventDefault()
    const name = schoolName.trim()
    if (!name) { setError('School name is required.'); return }
    if (name.length > SCHOOL_NAME_MAX) { setError(`School name must be ${SCHOOL_NAME_MAX} characters or fewer.`); return }
    if (!TERMS_PENDING && !agreed) { setError('Please agree to the Terms and Privacy Policy to continue.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName: name, acceptedTermsVersion: TERMS_VERSION }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      markOnboarded(true)
      setSchoolDone(true)
    } catch {
      setError('Could not connect to the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '44px 32px', textAlign: 'center', background: 'var(--surface)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 20px' }}><BrandMark size={52} /></div>

      {!schoolDone ? (
        <>
          <h1 style={{ fontSize: '30px', fontWeight: '700', marginBottom: '8px' }}>Welcome to QuizPulse</h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '32px' }}>
            Enter your school name to finish setting up your account.
          </p>

          <form onSubmit={handleSchoolSubmit} style={{ textAlign: 'left' }}>
            <label htmlFor="onboarding-school-name" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
              School name
            </label>
            <input
              id="onboarding-school-name"
              data-testid="onboarding-school-name"
              type="text"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              maxLength={SCHOOL_NAME_MAX}
              placeholder="e.g. Westfield Secondary College"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                border: 'var(--bw) solid var(--border)', fontSize: '14px', boxSizing: 'border-box',
              }}
              disabled={submitting}
            />
            {/* R3 Task 5 — required terms acceptance. Disabled (and Continue blocked) while wording
                is still pending, so a teacher can never accept a placeholder. */}
            {!TERMS_PENDING && (
              <label htmlFor="agree-terms" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '16px', fontSize: '13px', lineHeight: '1.5' }}>
                <input
                  id="agree-terms"
                  data-testid="onboarding-agree"
                  type="checkbox"
                  checked={agreed}
                  aria-required="true"
                  onChange={e => setAgreed(e.target.checked)}
                  disabled={submitting}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" style={{ color: 'var(--primary)' }}>Terms</Link>{' '}and{' '}
                  <Link to="/privacy" target="_blank" style={{ color: 'var(--primary)' }}>Privacy Policy</Link>.
                </span>
              </label>
            )}
            {error && (
              <p role="alert" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>{error}</p>
            )}
            <button
              data-testid="onboarding-submit"
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', marginTop: '20px', padding: '12px',
                background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)',
                borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: '500',
                cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Setting up…' : 'Continue'}
            </button>
          </form>
        </>
      ) : (
        <ProfileWizardSteps startStepNumber={2} onDone={() => navigate('/teacher/first-run', { replace: true })} />
      )}
      <LegalFooter />
    </div>
  )
}

export default Onboarding
