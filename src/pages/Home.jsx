import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { loginRequest, signUpRequest } from '../authConfig'
import InstallButton from '../components/InstallButton'
import LegalFooter from '../components/LegalFooter'
import BrandMark from '../components/BrandMark'

// Real screenshots of the running app, shown to signed-out visitors as a preview. Files live in
// public/preview/ and are captured from the app. The three teacher (landscape) screens share the
// same aspect ratio so they tile evenly; the student phone shot is portrait, so it sits on its own
// centered row rather than fighting the grid.
const TEACHER_PREVIEWS = [
  {
    src: '/preview/send.png',
    alt: 'The Send screen: a short quiz being sent to a class, with a topic option and a class picker.',
    caption: 'Write a quick question and send it to your class in a couple of taps.',
  },
  {
    src: '/preview/analytics.png',
    alt: 'The Results screen: a class summary with a “confident but wrong” misconception signal above a per-question breakdown.',
    caption: 'Read the whole class at a glance — the misconception signal flags where confident answers were wrong.',
  },
  {
    src: '/preview/analytics-question.png',
    alt: 'One question’s breakdown: a four-way split of correct/confident, correct/unsure, misconception, and incorrect/unsure, plus a bar for each answer option showing how many students chose it.',
    caption: 'Per question, see how many were confident-but-wrong — and exactly which wrong answer they picked.',
  },
  {
    src: '/preview/home.png',
    alt: 'The teacher home dashboard: a week calendar of check-ins, quizzes waiting on responses, and recent results.',
    caption: 'Every class’s check-ins, drafts and results together in one place.',
  },
]

const STUDENT_PREVIEW = {
  src: '/preview/student.png',
  alt: 'A student’s phone showing one multiple-choice question with a “How sure are you?” Sure / Pretty sure / Just guessing selector.',
  caption: 'And here’s what students see: tap an answer, then say how sure you are — no marks, no pressure.',
}

const previewImg = {
  display: 'block', width: '100%', height: 'auto',
  border: 'var(--bw) solid var(--border)', background: 'var(--surface)',
}

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
          Low-stakes questions that reach students where they are.
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

      {/* Preview — real screenshots of the app, in the order a teacher meets them.
          Captured from the running app (public/preview/*.png); plain-language captions, no jargon. */}
      <section aria-labelledby="preview-heading" style={{ marginTop: '8px', marginBottom: '32px' }}>
        <h2 id="preview-heading" style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', margin: '0 0 24px' }}>
          What it looks like
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>
          {TEACHER_PREVIEWS.map(({ src, alt, caption }) => (
            <figure key={src} style={{ margin: 0 }}>
              <img src={src} alt={alt} loading="lazy" style={previewImg} />
              <figcaption style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6', margin: '10px 2px 0' }}>
                {caption}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Student phone shot — portrait, paired with text so the row fills. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 300px) 1fr', gap: '32px', alignItems: 'center', marginTop: '28px' }}>
          <figure style={{ margin: 0 }}>
            <img src={STUDENT_PREVIEW.src} alt={STUDENT_PREVIEW.alt} loading="lazy" style={previewImg} />
          </figure>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: '1.7', margin: 0 }}>
            {STUDENT_PREVIEW.caption}
          </p>
        </div>
      </section>

      {/* Add-to-phone — secondary weight, centered, below the two cards. */}
      <InstallButton align="center" />

      <LegalFooter />
    </div>
  )
}
