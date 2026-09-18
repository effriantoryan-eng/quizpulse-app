import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from './Sidebar'
import BrandMark from './BrandMark'

// The only link a signed-out visitor sees in the nav. Kept as a tiny data model so the
// branch decision is unit-testable without a DOM (see tests/unit/demoNav.test.js).
export const PUBLIC_NAV = [{ label: 'Preview gallery', path: '/demo' }]

// Returns true when the minimal public nav (logo + Preview gallery) should be shown instead
// of the full teacher nav. Pure — exported for tests.
export function showPublicNav(isAuthenticated) {
  return !isAuthenticated
}

// Top-level navigation chrome. Signed-in teachers get the existing Sidebar unchanged.
// Signed-out visitors get a minimal rail: the logo (home) plus a single "Preview gallery"
// link — no teacher pages, no sign-out.
export default function DemoNav() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  if (!showPublicNav(isAuthenticated)) {
    return <Sidebar />
  }

  return (
    <aside className="sidebar" data-testid="demonav-public">
      <div className="sidebar-brand">
        <button
          type="button"
          className="sidebar-logo"
          onClick={() => navigate('/')}
          aria-label="QuizPulse home"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <BrandMark size={34} />
        </button>
        <span className="sidebar-wordmark">QuizPulse</span>
        <span className="sidebar-badge">beta</span>
      </div>

      <nav className="sidebar-nav open">
        {PUBLIC_NAV.map(({ label, path }) => (
          <button
            key={path}
            data-testid="demonav-preview-link"
            className="nav-item"
            onClick={() => navigate(path)}
          >
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
