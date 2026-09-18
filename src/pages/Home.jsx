import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { loginRequest, signUpRequest } from '../authConfig'
import InstallButton from '../components/InstallButton'
import LegalFooter from '../components/LegalFooter'
import BrandMark from '../components/BrandMark'

// Two-path public landing (v3.2.2). Signed-out visitors choose their path: students join a
// class; teachers sign in or create an account. Signed-in teachers are sent straight to their
// dashboard — they never see this page.
export default function Home() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()

  useEffect(() => {
    if (isAuthenticated) navigate('/teacher/home', { replace: true })
  }, [isAuthenticated, navigate])

  if (isAuthenticated) return null

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '56px 24px' }}>
      {/* Header: brand mark + wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BrandMark size={40} />
          <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>QuizPulse</span>
        </div>
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
            padding: '32px 28px',
            background: 'var(--surface)', border: 'var(--bw) solid var(--border)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', margin: '0 0 8px' }}>
            I'm a student
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6', margin: '0 0 24px', flexGrow: 1 }}>
            Got a join code from your teacher? Hop in and you're ready for the next check-in.
          </p>
          <button
            data-testid="student-join-btn"
            onClick={() => navigate('/join')}
            className="btn btn-primary btn-block"
          >
            Join a class
          </button>
        </div>

        {/* Teacher card */}
        <div
          data-testid="teacher-card"
          style={{
            padding: '32px 28px',
            background: 'var(--surface)', border: 'var(--bw) solid var(--border)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', margin: '0 0 8px' }}>
            I'm a teacher
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6', margin: '0 0 24px', flexGrow: 1 }}>
            Build a question, send it to your class, and see what to revisit — all before the next lesson.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              data-testid="teacher-signin-btn"
              onClick={() => login(loginRequest)}
              className="btn btn-primary"
              style={{ flex: 1, minWidth: '120px' }}
            >
              Sign in
            </button>
            <button
              data-testid="teacher-signup-btn"
              onClick={() => login(signUpRequest)}
              className="btn btn-secondary"
              style={{ flex: 1, minWidth: '120px' }}
            >
              Create account
            </button>
          </div>
        </div>
      </div>

      {/* Add-to-phone — secondary weight, centered, below the two cards. */}
      <InstallButton align="center" />

      <LegalFooter />
    </div>
  )
}
