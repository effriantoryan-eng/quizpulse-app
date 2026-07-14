import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { getOnboarded, setOnboarded as markOnboarded } from './onboardingCache'
import API_BASE from './api'
import Home from './pages/Home'
import DemoGallery from './pages/DemoGallery'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import OnboardingProfile from './pages/OnboardingProfile'
import Classes from './pages/teacher/Classes'
import CreateQuestion from './pages/teacher/CreateQuestion'
import QuestionBank from './pages/teacher/QuestionBank'
import BuildQuiz from './pages/teacher/BuildQuiz'
import SendQuiz from './pages/teacher/SendQuiz'
import Analytics from './pages/teacher/Analytics'
import Results from './pages/teacher/Results'
import Population from './pages/teacher/Population'
import TeacherHome from './pages/teacher/TeacherHome'
import QuizHistory from './pages/teacher/QuizHistory'
import SubNav from './components/SubNav'
import DemoNav from './components/DemoNav'
import AdminLog from './pages/AdminLog'
import JoinClass from './pages/student/JoinClass'
import TakeQuiz from './pages/student/TakeQuiz'
import PendingRequests from './pages/teacher/PendingRequests'
import ClassRoster from './pages/teacher/ClassRoster'
import ClassSettings from './pages/teacher/ClassSettings'
import { usePageView, usePwaInstallTracking } from './hooks/usePageView'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import SWUpdateBanner from './components/SWUpdateBanner'
import IosInstallBanner from './components/IosInstallBanner'
import Subscribe from './pages/student/Subscribe'

// Used only for the /onboarding route: confirms sign-in but doesn't check onboarding state
// (otherwise the gate would redirect before the teacher can complete onboarding).
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#888' }}>Loading…</div>
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

  useEffect(() => {
    if (loading || !isAuthenticated || getOnboarded() !== null) return
    fetch(`${API_BASE}/me`)
      .then(r => r.json())
      .then(data => {
        const ok = data.onboarded !== false
        markOnboarded(ok)
        setStatus(ok)
        if (!ok) navigate('/onboarding', { replace: true })
      })
      .catch(() => {
        // Fail open so an API error doesn't permanently lock out the teacher dashboard.
        markOnboarded(true)
        setStatus(true)
      })
  }, [isAuthenticated, loading, teacherId, navigate])

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#888' }}>Loading…</div>
  }
  if (!isAuthenticated) return <Login />
  if (status === null) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#888' }}>Loading…</div>
  }
  if (status === false) return null // navigate to /onboarding already in flight
  return children
}

// Public, full-bleed routes (student-facing + auth) render without the teacher sidebar.
const FULL_WIDTH_ROUTES = ['/login', '/onboarding', '/onboarding/profile', '/quiz', '/join', '/student/subscribe']

function AppRoutes() {
  usePageView()
  usePwaInstallTracking()
  useDocumentTitle()
  const { pathname } = useLocation()
  const hideSidebar = FULL_WIDTH_ROUTES.some(p => pathname === p || pathname.startsWith(p + '/'))

  const routes = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/demo" element={<DemoGallery />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
      <Route path="/onboarding/profile" element={<RequireTeacher><OnboardingProfile /></RequireTeacher>} />
      <Route path="/teacher/home" element={<RequireTeacher><TeacherHome /></RequireTeacher>} />
      <Route path="/teacher/classes" element={<RequireTeacher><Classes /></RequireTeacher>} />
      <Route path="/teacher/create" element={<RequireTeacher><CreateQuestion /></RequireTeacher>} />
      <Route path="/teacher/bank" element={<RequireTeacher><QuestionBank /></RequireTeacher>} />
      <Route path="/teacher/build" element={<RequireTeacher><BuildQuiz /></RequireTeacher>} />
      <Route path="/teacher/send" element={<RequireTeacher><SendQuiz /></RequireTeacher>} />
      <Route path="/teacher/quizzes" element={<RequireTeacher><QuizHistory /></RequireTeacher>} />
      <Route path="/teacher/results" element={<RequireTeacher><Results /></RequireTeacher>} />
      <Route path="/teacher/population" element={<RequireTeacher><Population /></RequireTeacher>} />
      <Route path="/teacher/analytics/:quizId" element={<RequireTeacher><Analytics /></RequireTeacher>} />
      <Route path="/admin/log" element={<RequireTeacher><AdminLog /></RequireTeacher>} />
      <Route path="/join" element={<JoinClass />} />
      <Route path="/quiz" element={<TakeQuiz />} />
      <Route path="/student/subscribe" element={<Subscribe />} />
      <Route path="/teacher/pending-requests" element={<RequireTeacher><PendingRequests /></RequireTeacher>} />
      <Route path="/teacher/roster" element={<RequireTeacher><ClassRoster /></RequireTeacher>} />
      <Route path="/teacher/classes/settings" element={<RequireTeacher><ClassSettings /></RequireTeacher>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  return (
    <>
      {hideSidebar ? routes : (
        <div className="app-shell">
          <DemoNav />
          <main className="app-content">
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
