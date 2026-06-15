import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import DemoGallery from './pages/DemoGallery'
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

function AppRoutes() {
  usePageView()
  useDocumentTitle()
  return (
    <>
      <DemoNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<DemoGallery />} />
        <Route path="/teacher/create" element={<CreateQuestion />} />
        <Route path="/teacher/bank" element={<QuestionBank />} />
        <Route path="/teacher/build" element={<BuildQuiz />} />
        <Route path="/teacher/send" element={<SendQuiz />} />
        <Route path="/teacher/quizzes" element={<QuizHistory />} />
        <Route path="/teacher/analytics/:quizId" element={<Analytics />} />
        <Route path="/admin/log" element={<AdminLog />} />
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
