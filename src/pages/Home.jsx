import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { loginRequest, signUpRequest } from '../authConfig'

// Brand accents for the public landing.
const BRAND = '#534AB7'
const BRAND_LIGHT = '#EEEDFE'

// Two-path public landing (v3.2.2). Signed-out visitors choose their path: students join a
// class; teachers sign in or create an account. Signed-in teachers are sent straight to their
// dashboard — they never see this page.
export default function Home() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()

  useEffect(() => {
    if (isAuthenticated) navigate('/teacher/classes', { replace: true })
  }, [isAuthenticated, navigate])

  // Don't flash the landing while the redirect is in flight.
  if (isAuthenticated) return null

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '56px 24px' }}>
      {/* Header: logo + preview gallery link */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '40px', height: '40px', borderRadius: '11px',
            background: BRAND, color: '#fff', fontSize: '20px',
          }}>⚡</div>
          <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>QuizPulse</span>
        </div>
        <button
          data-testid="preview-gallery-link"
          onClick={() => navigate('/demo')}
          style={{
            background: 'none', border: 'none', color: BRAND, fontSize: '14px',
            fontWeight: '600', cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Preview gallery
        </button>
      </div>

      {/* Hero line */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '38px', fontWeight: '700', color: 'var(--text)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Quick classroom check-ins
        </h1>
        <p style={{ fontSize: '17px', color: 'var(--muted)', maxWidth: '480px', margin: '0 auto', lineHeight: '1.6' }}>
          Low-stakes questions that reach students where they are. No grades — just a pulse on what landed.
        </p>
      </div>

      {/* Two-path cards */}
      <div
        data-testid="landing-cards"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}
      >
        {/* Student card */}
        <div
          data-testid="student-card"
          style={{
            padding: '32px 28px', borderRadius: '16px',
            background: BRAND_LIGHT, border: `2px solid ${BRAND}`,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>🎒</div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', margin: '0 0 8px' }}>
            I'm a student
          </h2>
          <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 24px', flexGrow: 1 }}>
            Got a join code from your teacher? Hop in and you're ready for the next check-in.
          </p>
          <button
            data-testid="student-join-btn"
            onClick={() => navigate('/join')}
            style={{
              padding: '13px 20px', background: BRAND, color: '#fff', border: 'none',
              borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            Join a class
          </button>
        </div>

        {/* Teacher card */}
        <div
          data-testid="teacher-card"
          style={{
            padding: '32px 28px', borderRadius: '16px',
            background: 'var(--surface)', border: `2px solid ${BRAND}`,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>🎓</div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', margin: '0 0 8px' }}>
            I'm a teacher
          </h2>
          <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 24px', flexGrow: 1 }}>
            Build a question, send it to your class, and see what to revisit — all before the next lesson.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              data-testid="teacher-signin-btn"
              onClick={() => login(loginRequest)}
              style={{
                flex: 1, minWidth: '120px', padding: '13px 16px', background: BRAND, color: '#fff',
                border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              Sign in
            </button>
            <button
              data-testid="teacher-signup-btn"
              onClick={() => login(signUpRequest)}
              style={{
                flex: 1, minWidth: '120px', padding: '13px 16px', background: '#fff', color: BRAND,
                border: `2px solid ${BRAND}`, borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              Create account
            </button>
          </div>
        </div>
      </div>

      {/* Install button slot — populated in the PWA install feature (v3.2.2). */}
    </div>
  )
}
