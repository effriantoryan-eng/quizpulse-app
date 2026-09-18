import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { activeHub, activeTab } from '../teacherNav'

const CLASS_SCOPED_TABS = ['/teacher/roster', '/teacher/pending-requests', '/teacher/classes/settings']

export default function SubNav() {
  const { pathname, search } = useLocation()
  const hub = activeHub(pathname)
  if (!hub || hub.tabs.length < 2) return null

  const current = activeTab(hub, pathname)
  const classId = new URLSearchParams(search).get('classId')

  return (
    <nav aria-label={`${hub.label} sections`} style={{
      display: 'flex', gap: '4px', flexWrap: 'wrap',
      borderBottom: 'var(--bw) solid var(--border)',
      margin: '0 0 20px', paddingBottom: '0',
    }}>
      {hub.tabs.map(tab => {
        const active = current && current.path === tab.path
        const to = classId && CLASS_SCOPED_TABS.includes(tab.path)
          ? `${tab.path}?classId=${classId}`
          : tab.path
        return (
          <Link
            key={tab.path}
            to={to}
            aria-current={active ? 'page' : undefined}
            style={{
              textDecoration: 'none',
              padding: '10px 14px', fontSize: '14px',
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--primary)' : 'var(--muted)',
              borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px', display: 'inline-block',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
