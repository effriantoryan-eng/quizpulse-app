import { NavLink } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'

const navStyle = {
  background: '#1e1e2e',
  padding: '0 16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
}

const navInnerStyle = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 0,
  minHeight: 48,
}

const brandStyle = {
  color: '#a8b3cf',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginRight: 24,
  flexShrink: 0,
  padding: '12px 0',
}

const linkStyle = {
  color: '#a8b3cf',
  textDecoration: 'none',
  padding: '14px 10px',
  display: 'flex',
  alignItems: 'center',
  fontSize: 13,
  borderBottom: '2px solid transparent',
  whiteSpace: 'nowrap',
}

const activeLinkStyle = {
  ...linkStyle,
  color: '#ffffff',
  borderBottomColor: '#4c8bf5',
}

const spacer = { flex: 1, minWidth: 8 }

const userStyle = {
  color: '#6b7690',
  fontSize: 12,
  marginRight: 12,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 160,
}

const logoutStyle = {
  background: 'none',
  border: '1px solid #3a3a52',
  color: '#a8b3cf',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  flexShrink: 0,
}

const NAV_LINKS = [
  { to: '/schools', label: 'Schools' },
  { to: '/institutions', label: 'Institutions' },
  { to: '/teachers', label: 'Teachers' },
  { to: '/monitoring', label: 'Monitoring' },
  { to: '/traffic', label: 'Traffic' },
  { to: '/audit', label: 'Audit Log' },
  { to: '/roles', label: 'Roles' },
  { to: '/erasure', label: 'Erasure' },
]

export default function AdminNav({ sessionWarning }) {
  const { instance, accounts } = useMsal()
  const user = accounts[0]

  function handleLogout() {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
  }

  return (
    <nav style={navStyle}>
      <div style={navInnerStyle}>
        <span style={brandStyle}>QuizPulse Admin</span>
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => (isActive ? activeLinkStyle : linkStyle)}
          >
            {label}
          </NavLink>
        ))}
        <div style={spacer} />
        {sessionWarning && (
          <span style={{ color: '#f59e0b', fontSize: 12, marginRight: 12, whiteSpace: 'nowrap' }}>
            Session expiring soon
          </span>
        )}
        {user && <span style={userStyle}>{user.username || user.name}</span>}
        <button style={logoutStyle} onClick={handleLogout}>Sign out</button>
      </div>
    </nav>
  )
}
