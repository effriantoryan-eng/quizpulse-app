import { NavLink } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'

const navStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  background: '#1e1e2e',
  padding: '0 24px',
  height: 48,
  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
}

const brandStyle = {
  color: '#a8b3cf',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginRight: 32,
  flexShrink: 0,
}

const linkStyle = {
  color: '#a8b3cf',
  textDecoration: 'none',
  padding: '0 12px',
  height: 48,
  display: 'flex',
  alignItems: 'center',
  fontSize: 13,
  borderBottom: '2px solid transparent',
}

const activeLinkStyle = {
  ...linkStyle,
  color: '#ffffff',
  borderBottomColor: '#4c8bf5',
}

const spacer = { flex: 1 }

const userStyle = {
  color: '#6b7690',
  fontSize: 12,
  marginRight: 16,
}

const logoutStyle = {
  background: 'none',
  border: '1px solid #3a3a52',
  color: '#a8b3cf',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
}

const NAV_LINKS = [
  { to: '/schools', label: 'Schools' },
  { to: '/institutions', label: 'Institutions' },
  { to: '/monitoring', label: 'Monitoring' },
  { to: '/traffic', label: 'Traffic' },
  { to: '/audit', label: 'Audit Log' },
  { to: '/roles', label: 'Roles' },
]

export default function AdminNav({ sessionWarning }) {
  const { instance, accounts } = useMsal()
  const user = accounts[0]

  function handleLogout() {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
  }

  return (
    <nav style={navStyle}>
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
        <span style={{ color: '#f59e0b', fontSize: 12, marginRight: 16 }}>
          Session expiring soon
        </span>
      )}
      {user && <span style={userStyle}>{user.username || user.name}</span>}
      <button style={logoutStyle} onClick={handleLogout}>Sign out</button>
    </nav>
  )
}
