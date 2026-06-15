import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Home from './pages/Home'
import DemoGallery from './pages/DemoGallery'
import Login from './pages/Login'
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

// Gates teacher/admin routes behind a real B2C sign-in. Public marketing routes stay open.
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
        <Route path="/teacher/create" element={<RequireAuth><CreateQuestion /></RequireAuth>} />
        <Route path="/teacher/bank" element={<RequireAuth><QuestionBank /></RequireAuth>} />
        <Route path="/teacher/build" element={<RequireAuth><BuildQuiz /></RequireAuth>} />
        <Route path="/teacher/send" element={<RequireAuth><SendQuiz /></RequireAuth>} />
        <Route path="/teacher/quizzes" element={<RequireAuth><QuizHistory /></RequireAuth>} />
        <Route path="/teacher/analytics/:quizId" element={<RequireAuth><Analytics /></RequireAuth>} />
        <Route path="/admin/log" element={<RequireAuth><AdminLog /></RequireAuth>} />
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
