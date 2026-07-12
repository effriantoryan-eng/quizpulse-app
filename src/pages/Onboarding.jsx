import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setOnboarded as markOnboarded } from '../onboardingCache'
import API_BASE from '../api'
import ProfileWizardSteps from '../components/onboarding/ProfileWizardSteps'

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
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSchoolSubmit(e) {
    e.preventDefault()
    const name = schoolName.trim()
    if (!name) { setError('School name is required.'); return }
    if (name.length > SCHOOL_NAME_MAX) { setError(`School name must be ${SCHOOL_NAME_MAX} characters or fewer.`); return }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName: name }),
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
      <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'var(--logoGrad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '26px', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--shadowField)' }}>⚡</div>

      {!schoolDone ? (
        <>
          <h1 style={{ fontSize: '30px', fontWeight: '700', marginBottom: '8px' }}>Welcome to QuizPulse</h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '32px' }}>
            Enter your school name to finish setting up your account.
          </p>

          <form onSubmit={handleSchoolSubmit} style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
              School name
            </label>
            <input
              data-testid="onboarding-school-name"
              type="text"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              maxLength={SCHOOL_NAME_MAX}
              placeholder="e.g. Westfield Secondary College"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                border: 'var(--bw) solid var(--border)', fontSize: '14px', boxSizing: 'border-box',
              }}
              disabled={submitting}
            />
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>{error}</p>
            )}
            <button
              data-testid="onboarding-submit"
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', marginTop: '20px', padding: '12px',
                background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)',
                borderRadius: '8px', fontSize: '14px', fontWeight: '500',
                cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Setting up…' : 'Continue'}
            </button>
          </form>
        </>
      ) : (
        <ProfileWizardSteps startStepNumber={2} onDone={() => navigate('/teacher/create', { replace: true })} />
      )}
    </div>
  )
}

export default Onboarding
