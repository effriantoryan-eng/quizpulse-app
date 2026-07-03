// Single source of truth for the teacher workspace hubs and their sub-tabs.
// Both the Sidebar (top-level hubs) and SubNav (tab strip inside a hub) read from this,
// so adding a tab or moving a page is a one-place edit.
//
// Ordered to match teacher workflow: set up classes → build content → run quizzes → read results.

export const HUBS = [
  {
    id: 'classes', label: 'Classes', icon: 'classes', path: '/teacher/classes',
    tabs: [
      { label: 'My Classes', path: '/teacher/classes' },
      { label: 'Roster', path: '/teacher/roster' },
      { label: 'Requests', path: '/teacher/pending-requests' },
      { label: 'Settings', path: '/teacher/classes/settings' },
    ],
  },
  {
    id: 'questions', label: 'Questions', icon: 'bank', path: '/teacher/bank',
    tabs: [
      { label: 'Question Bank', path: '/teacher/bank' },
      { label: 'New Question', path: '/teacher/create' },
    ],
  },
  {
    id: 'quizzes', label: 'Quizzes', icon: 'quizzes', path: '/teacher/build',
    tabs: [
      { label: 'Build & Send', path: '/teacher/build', match: ['/teacher/send'] },
      { label: 'History', path: '/teacher/quizzes' },
    ],
  },
  {
    id: 'results', label: 'Results', icon: 'results', path: '/teacher/results',
    tabs: [
      { label: 'By Class', path: '/teacher/results', match: ['/teacher/analytics'] },
      { label: 'Population', path: '/teacher/population' },
    ],
  },
]

function matches(pathname, p) {
  return pathname === p || pathname.startsWith(p + '/')
}

// The active tab is the one whose path (or a `match` prefix) is the longest match for the
// current pathname — so /teacher/classes/settings resolves to Settings, not My Classes.
export function activeTab(hub, pathname) {
  let best = null, bestLen = -1
  for (const t of hub.tabs) {
    for (const p of [t.path, ...(t.match || [])]) {
      if (matches(pathname, p) && p.length > bestLen) { best = t; bestLen = p.length }
    }
  }
  return best
}

export function activeHub(pathname) {
  for (const h of HUBS) {
    if (activeTab(h, pathname)) return h
  }
  return null
}
