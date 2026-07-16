import { useLocation, useNavigate } from 'react-router-dom'
import { activeHub, activeTab } from '../teacherNav'

// Horizontal tab strip for the current teacher hub. Rendered once in the app shell;
// returns null on non-teacher pages and on single-tab hubs (where a strip would be noise).
// Class-scoped tabs: switching between these keeps the ?classId context instead of
// dropping to the "pick a class first" empty state.
const CLASS_SCOPED_TABS = ['/teacher/roster', '/teacher/pending-requests', '/teacher/classes/settings']

export default function SubNav() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const hub = activeHub(pathname)
  if (!hub || hub.tabs.length < 2) return null

  const current = activeTab(hub, pathname)
  const classId = new URLSearchParams(search).get('classId')

  return (
    <div role="tablist" aria-label={`${hub.label} sections`} style={{
      display: 'flex', gap: '4px', flexWrap: 'wrap',
      borderBottom: 'var(--bw) solid var(--border)',
      margin: '0 0 20px', paddingBottom: '0',
    }}>
      {hub.tabs.map(tab => {
        const active = current && current.path === tab.path
        return (
          <button
            key={tab.path}
            role="tab"
            aria-selected={active}
            onClick={() => navigate(
              classId && CLASS_SCOPED_TABS.includes(tab.path)
                ? `${tab.path}?classId=${classId}`
                : tab.path
            )}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 14px', fontSize: '14px',
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--primary)' : '#777',
              borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
