// Route prefixes mirrored from src/App.jsx's <Routes>. Kept in sync by
// tests/unit/pageViewAllowlist.test.js, which walks the real route table and asserts
// every declared route is covered here — a route added to App.jsx without a matching
// entry silently buckets to 'other' forever, so that test fails loudly instead.
const ALLOWED_PREFIXES = [
  '/demo',
  '/login',
  '/onboarding',
  '/teacher/home',
  '/teacher/classes',
  '/teacher/create',
  '/teacher/bank',
  '/teacher/build',
  '/teacher/send',
  '/teacher/quizzes',
  '/teacher/results',
  '/teacher/population',
  '/teacher/evidence',
  '/teacher/generate',
  '/teacher/drafts',
  '/teacher/analytics',
  '/admin/log',
  '/join',
  '/quiz',
  '/student/subscribe',
  '/teacher/pending-requests',
  '/teacher/roster',
];

// Anything not on the allowlist buckets to 'other' rather than being stored verbatim —
// keeps junk/garbage page values from an anonymous POST from exploding topPages cardinality.
// Never rejects the write (a beacon must never break navigation).
function classifyPage(page) {
  if (page === '/') return '/';
  if (ALLOWED_PREFIXES.some(p => page === p || page.startsWith(p + '/'))) return page;
  return 'other';
}

module.exports = { ALLOWED_PREFIXES, classifyPage };
