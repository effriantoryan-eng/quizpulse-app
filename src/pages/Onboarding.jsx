import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setOnboarded as markOnboarded } from '../onboardingCache'
import API_BASE from '../api'

const SCHOOL_NAME_MAX = 120

function Onboarding() {
  const navigate = useNavigate()
  const [schoolName, setSchoolName] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
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
      navigate('/teacher/create', { replace: true })
    } catch {
      setError('Could not connect to the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '48px 32px', textAlign: 'center', border: '1px solid #eee', borderRadius: '16px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>⚡</div>
      <h1 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '8px' }}>Welcome to QuizPulse</h1>
      <p style={{ fontSize: '14px', color: '#888', marginBottom: '32px' }}>
        Enter your school name to finish setting up your account.
      </p>

      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
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
            border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box',
          }}
          disabled={submitting}
        />
        {error && (
          <p style={{ color: '#c0392b', fontSize: '13px', marginTop: '8px' }}>{error}</p>
        )}
        <button
          data-testid="onboarding-submit"
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', marginTop: '20px', padding: '12px',
            background: '#534AB7', color: 'white', border: 'none',
            borderRadius: '8px', fontSize: '14px', fontWeight: '500',
            cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Setting up…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

export default Onboarding
