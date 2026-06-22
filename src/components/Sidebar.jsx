import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Inline stroke icons (Lucide-style), 17px, currentColor.
const I = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  create: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  bank: 'M4 6h16M4 12h16M4 18h16',
  classes: 'M3 9.5 12 4l9 5.5-9 5.5-9-5.5ZM6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5',
  build: 'M4 6h11M4 12h7M4 18h13M18 4v6M21 7h-6M15 15v6M18 18h-6',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4Z',
  quizzes: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  preview: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
}

function Icon({ d }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  )
}

const PAGES = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'Create Question', path: '/teacher/create', icon: 'create' },
  { label: 'Question Bank', path: '/teacher/bank', icon: 'bank' },
  { label: 'Classes', path: '/teacher/classes', icon: 'classes' },
  { label: 'Build Quiz', path: '/teacher/build', icon: 'build' },
  { label: 'Send Quiz', path: '/teacher/send', icon: 'send' },
  { label: 'My Quizzes', path: '/teacher/quizzes', icon: 'quizzes' },
  { label: 'Preview', path: '/demo', icon: 'preview' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isAuthenticated, user, login, logout } = useAuth()
  const [open, setOpen] = useState(false)

  function go(path) {
    setOpen(false)
    navigate(path)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo" onClick={() => go('/')} aria-label="QuizPulse home">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
          </svg>
        </div>
        <span className="sidebar-wordmark">QuizPulse</span>
        <span className="sidebar-badge">beta</span>
        <button
          className="sidebar-hamburger"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round">
            {open
              ? <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>
              : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
          </svg>
        </button>
      </div>

      <nav className={`sidebar-nav ${open ? 'open' : ''}`}>
        {PAGES.map(({ label, path, icon }) => {
          const active = path === '/'
            ? pathname === '/'
            : pathname === path || pathname.startsWith(path + '/')
          return (
            <button
              key={path}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => go(path)}
            >
              <Icon d={I[icon]} />
              {label}
            </button>
          )
        })}

        <div className="sidebar-foot">
          {isAuthenticated ? (
            <>
              {user?.email && <span className="sidebar-email">{user.email}</span>}
              <button
                data-testid="logout"
                className="sidebar-auth-btn signout"
                onClick={() => logout()}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              data-testid="nav-signin"
              className="sidebar-auth-btn signin"
              onClick={() => login()}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>
    </aside>
  )
}
