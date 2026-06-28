import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { HUBS, activeHub } from '../teacherNav'

// Inline stroke icons (Lucide-style), 17px, currentColor.
const I = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  create: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  bank: 'M4 6h16M4 12h16M4 18h16',
  classes: 'M3 9.5 12 4l9 5.5-9 5.5-9-5.5ZM6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5',
  build: 'M4 6h11M4 12h7M4 18h13M18 4v6M21 7h-6M15 15v6M18 18h-6',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4Z',
  quizzes: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  results: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
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

// Top-level nav is one entry per workspace hub (Classes / Questions / Quizzes / Results);
// each hub links to its default page and the SubNav strip handles the sub-pages within.
// Hub definitions live in src/teacherNav.js so Sidebar and SubNav stay in sync.
const NAV = [
  { label: 'Home', path: '/teacher/home', icon: 'home' },
  ...HUBS.map(h => ({ label: h.label, path: h.path, icon: h.icon, hubId: h.id })),
  { label: 'Preview', path: '/demo', icon: 'preview' },
]

function Logo({ onClick }) {
  return (
    <div className="sidebar-logo" onClick={onClick} aria-label="QuizPulse home">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
      </svg>
    </div>
  )
}

export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isAuthenticated, user, login, logout } = useAuth()
  const [open, setOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Close drawer on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  function go(path) {
    navigate(path)
  }

  const HamburgerIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      {open
        ? <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>
        : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
    </svg>
  )

  return (
    <>
      {/* Mobile-only sticky topbar — never shifts content (sidebar is fixed overlay) */}
      <div className="mobile-topbar">
        <Logo onClick={() => go('/')} />
        <span className="sidebar-wordmark" style={{ flex: 1 }}>QuizPulse</span>
        <span className="sidebar-badge">beta</span>
        <button
          className="sidebar-hamburger"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <HamburgerIcon />
        </button>
      </div>

      {/* Backdrop — tapping it closes the drawer */}
      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar: static column on desktop, fixed overlay drawer on mobile */}
      <aside className={`sidebar sidebar-drawer ${open ? 'drawer-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo onClick={() => go('/')} />
          <span className="sidebar-wordmark">QuizPulse</span>
          <span className="sidebar-badge">beta</span>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            if (item.group) return <span key={i} className="nav-group-label">{item.group}</span>
            const hub = activeHub(pathname)
            const active = item.hubId
              ? hub?.id === item.hubId
              : item.path === '/'
                ? pathname === '/'
                : pathname === item.path || pathname.startsWith(item.path + '/')
            return (
              <button
                key={item.path}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => go(item.path)}
              >
                <Icon d={I[item.icon]} />
                {item.label}
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
    </>
  )
}
