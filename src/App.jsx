import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { getOnboarded, setOnboarded as markOnboarded } from './onboardingCache'
import API_BASE from './api'
import Home from './pages/Home'
import DemoGallery from './pages/DemoGallery'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Classes from './pages/teacher/Classes'
import CreateQuestion from './pages/teacher/CreateQuestion'
import QuestionBank from './pages/teacher/QuestionBank'
import BuildQuiz from './pages/teacher/BuildQuiz'
import SendQuiz from './pages/teacher/SendQuiz'
import Analytics from './pages/teacher/Analytics'
import QuizHistory from './pages/teacher/QuizHistory'
import DemoNav from './components/DemoNav'
import AdminLog from './pages/AdminLog'
import { usePageView } from './hooks/usePageView'
import { useDocumentTitle } from './hooks/useDocumentTitle'

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

function AppRoutes() {
  usePageView()
  useDocumentTitle()
  return (
    <>
      <DemoNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<DemoGallery />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        <Route path="/teacher/classes" element={<RequireTeacher><Classes /></RequireTeacher>} />
        <Route path="/teacher/create" element={<RequireTeacher><CreateQuestion /></RequireTeacher>} />
        <Route path="/teacher/bank" element={<RequireTeacher><QuestionBank /></RequireTeacher>} />
        <Route path="/teacher/build" element={<RequireTeacher><BuildQuiz /></RequireTeacher>} />
        <Route path="/teacher/send" element={<RequireTeacher><SendQuiz /></RequireTeacher>} />
        <Route path="/teacher/quizzes" element={<RequireTeacher><QuizHistory /></RequireTeacher>} />
        <Route path="/teacher/analytics/:quizId" element={<RequireTeacher><Analytics /></RequireTeacher>} />
        <Route path="/admin/log" element={<RequireTeacher><AdminLog /></RequireTeacher>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
