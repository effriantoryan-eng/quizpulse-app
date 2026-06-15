import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Maps a pathname to a human-friendly browser-tab title.
// Order matters: more specific prefixes must come before less specific ones.
const TITLES = [
  { path: '/',                  title: 'QuizPulse — Classroom check-ins for teachers' },
  { path: '/demo',              title: 'Preview Gallery · QuizPulse' },
  { path: '/teacher/create',    title: 'Create Question · QuizPulse' },
  { path: '/teacher/bank',      title: 'Question Bank · QuizPulse' },
  { path: '/teacher/build',     title: 'Build a Quiz · QuizPulse' },
  { path: '/teacher/send',      title: 'Send Quiz · QuizPulse' },
  { path: '/teacher/quizzes',   title: 'My Quizzes · QuizPulse' },
  { path: '/teacher/analytics', title: 'Quiz Analytics · QuizPulse' },
  { path: '/admin/log',         title: 'Usage Log · QuizPulse' },
]

function titleFor(pathname) {
  // Exact match for the root, prefix match for everything else.
  if (pathname === '/') return TITLES[0].title
  const match = TITLES.slice(1).find(t => pathname.startsWith(t.path))
  return match ? match.title : 'QuizPulse'
}

export function useDocumentTitle() {
  const location = useLocation()

  useEffect(() => {
    document.title = titleFor(location.pathname)
  }, [location.pathname])
}
