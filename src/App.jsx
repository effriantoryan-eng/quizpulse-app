import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { getOnboarded, setOnboarded as markOnboarded, getTermsCurrent, setTermsCurrent } from './onboardingCache'
import TermsUpdate from './components/TermsUpdate'
import API_BASE from './api'
import Home from './pages/Home'
import Pricing from './pages/Pricing'
import DemoGallery from './pages/DemoGallery'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import OnboardingProfile from './pages/OnboardingProfile'
import FirstRunFinale from './pages/FirstRunFinale'
import Classes from './pages/teacher/Classes'
import CreateQuestion from './pages/teacher/CreateQuestion'
import QuestionBank from './pages/teacher/QuestionBank'
import BuildQuiz from './pages/teacher/BuildQuiz'
import SendQuiz from './pages/teacher/SendQuiz'
import Analytics from './pages/teacher/Analytics'
import Results from './pages/teacher/Results'
import Population from './pages/teacher/Population'
import Evidence from './pages/teacher/Evidence'
import GenerateQuiz from './pages/teacher/GenerateQuiz'
import ReviewDraft from './pages/teacher/ReviewDraft'
import TeacherHome from './pages/teacher/TeacherHome'
import QuizHistory from './pages/teacher/QuizHistory'
import Account from './pages/teacher/Account'
import SubNav from './components/SubNav'
import DemoNav from './components/DemoNav'
import JoinClass from './pages/student/JoinClass'
import TakeQuiz from './pages/student/TakeQuiz'
import QuizReview from './pages/student/QuizReview'
import PendingRequests from './pages/teacher/PendingRequests'
import ClassRoster from './pages/teacher/ClassRoster'
import ClassSettings from './pages/teacher/ClassSettings'
import { usePageView, usePwaInstallTracking } from './hooks/usePageView'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { useRouteFocus } from './hooks/useRouteFocus'
import SWUpdateBanner from './components/SWUpdateBanner'
import IosInstallBanner from './components/IosInstallBanner'
import StudentClass from './pages/student/StudentClass'
import LegalPage from './pages/LegalPage'
import { PRIVACY_POLICY, COLLECTION_NOTICE, TERMS } from './data/legalContent'

// Used only for the /onboarding route: confirms sign-in but doesn't check onboarding state
// (otherwise the gate would redirect before the teacher can complete onboarding).
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return <div role="status" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
  }
  if (!isAuthenticated) {
    return <Login />
  }
  return children
}

// Used for all teacher/admin routes: confirms sign-in AND that the teacher has completed
// onboarding. On first login (GET /api/me returns onboarded: false) redirects to /onboarding.
// The result is cached module-level so subsequent route changes avoid re-fetching.
function RequireTeacher({ children }) {
  const { isAuthenticated, loading, teacherId } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState(getOnboarded()) // null | true | false
  // R3 Task 5 — null | true | false. Fails open to true on any /api/me fetch error (same posture
  // as onboarded below) so an API blip can never lock a teacher out behind an unresolvable screen.
  const [termsCurrent, setTermsCurrentState] = useState(getTermsCurrent())

  useEffect(() => {
    if (loading || !isAuthenticated || getOnboarded() !== null) return
    fetch(`${API_BASE}/me`)
      .then(r => r.json())
      .then(data => {
        const ok = data.onboarded !== false
        markOnboarded(ok)
        setStatus(ok)
        const terms = data.termsCurrent !== false
        setTermsCurrent(terms)
        setTermsCurrentState(terms)
        if (!ok) navigate('/onboarding', { replace: true })
      })
      .catch(() => {
        // Fail open so an API error doesn't permanently lock out the teacher dashboard.
        markOnboarded(true)
        setStatus(true)
        setTermsCurrent(true)
        setTermsCurrentState(true)
      })
  }, [isAuthenticated, loading, teacherId, navigate])

  if (loading) {
    return <div role="status" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
  }
  if (!isAuthenticated) return <Login />
  if (status === null) {
    return <div role="status" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
  }
  if (status === false) return null // navigate to /onboarding already in flight
  if (termsCurrent === false) {
    return <TermsUpdate onDone={() => setTermsCurrentState(true)} />
  }
  return children
}

// Public, full-bleed routes (student-facing + auth) render without the teacher sidebar.
const FULL_WIDTH_ROUTES = ['/login', '/onboarding', '/onboarding/profile', '/teacher/first-run', '/quiz', '/join', '/student/class', '/privacy', '/collection-notice', '/terms']

function AppRoutes() {
  usePageView()
  usePwaInstallTracking()
  useDocumentTitle()
  useRouteFocus()
  const { pathname } = useLocation()
  const hideSidebar = FULL_WIDTH_ROUTES.some(p => pathname === p || pathname.startsWith(p + '/'))

  const routes = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/demo" element={<DemoGallery />} />
      {/* hidden: <Route path="/pricing" element={<Pricing />} /> */}
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
      <Route path="/onboarding/profile" element={<RequireTeacher><OnboardingProfile /></RequireTeacher>} />
      <Route path="/teacher/first-run" element={<RequireTeacher><FirstRunFinale /></RequireTeacher>} />
      <Route path="/teacher/home" element={<RequireTeacher><TeacherHome /></RequireTeacher>} />
      <Route path="/teacher/classes" element={<RequireTeacher><Classes /></RequireTeacher>} />
      <Route path="/teacher/create" element={<RequireTeacher><CreateQuestion /></RequireTeacher>} />
      <Route path="/teacher/bank" element={<RequireTeacher><QuestionBank /></RequireTeacher>} />
      <Route path="/teacher/build" element={<RequireTeacher><BuildQuiz /></RequireTeacher>} />
      <Route path="/teacher/send" element={<RequireTeacher><SendQuiz /></RequireTeacher>} />
      <Route path="/teacher/quizzes" element={<RequireTeacher><QuizHistory /></RequireTeacher>} />
      <Route path="/teacher/results" element={<RequireTeacher><Results /></RequireTeacher>} />
      <Route path="/teacher/population" element={<RequireTeacher><Population /></RequireTeacher>} />
      <Route path="/teacher/evidence" element={<RequireTeacher><Evidence /></RequireTeacher>} />
      <Route path="/teacher/generate" element={<RequireTeacher><GenerateQuiz /></RequireTeacher>} />
      <Route path="/teacher/drafts/:id" element={<RequireTeacher><ReviewDraft /></RequireTeacher>} />
      <Route path="/teacher/analytics/:quizId" element={<RequireTeacher><Analytics /></RequireTeacher>} />
      <Route path="/join" element={<JoinClass />} />
      <Route path="/quiz" element={<TakeQuiz />} />
      <Route path="/quiz/review" element={<QuizReview mode="review" />} />
      <Route path="/quiz/practice" element={<QuizReview mode="practice" />} />
      <Route path="/student/class" element={<StudentClass />} />
      <Route path="/privacy" element={<LegalPage doc={PRIVACY_POLICY} />} />
      <Route path="/collection-notice" element={<LegalPage doc={COLLECTION_NOTICE} />} />
      <Route path="/terms" element={<LegalPage doc={TERMS} />} />
      <Route path="/teacher/pending-requests" element={<RequireTeacher><PendingRequests /></RequireTeacher>} />
      <Route path="/teacher/roster" element={<RequireTeacher><ClassRoster /></RequireTeacher>} />
      <Route path="/teacher/classes/settings" element={<RequireTeacher><ClassSettings /></RequireTeacher>} />
      <Route path="/teacher/account" element={<RequireTeacher><Account /></RequireTeacher>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {hideSidebar ? (
        <div id="main-content" tabIndex={-1}>{routes}</div>
      ) : (
        <div className="app-shell">
          <DemoNav />
          <main id="main-content" tabIndex={-1} className="app-content">
            <div className="app-content-inner">
              <SubNav />
              {routes}
            </div>
          </main>
        </div>
      )}
      <SWUpdateBanner />
      <IosInstallBanner />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
