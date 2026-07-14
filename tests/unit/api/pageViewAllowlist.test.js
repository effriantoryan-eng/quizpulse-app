const fs = require('fs');
const path = require('path');
const { ALLOWED_PREFIXES, classifyPage } = require('../../../api/shared/pageViewAllowlist');

describe('classifyPage', () => {
  test('root path passes through unchanged', () => {
    expect(classifyPage('/')).toBe('/');
  });

  test('known static routes pass through unchanged', () => {
    expect(classifyPage('/quiz')).toBe('/quiz');
    expect(classifyPage('/join')).toBe('/join');
    expect(classifyPage('/teacher/build')).toBe('/teacher/build');
    expect(classifyPage('/admin/log')).toBe('/admin/log');
  });

  test('dynamic segments under an allowed prefix pass through unchanged', () => {
    expect(classifyPage('/teacher/analytics/abc-123')).toBe('/teacher/analytics/abc-123');
    expect(classifyPage('/teacher/classes/settings')).toBe('/teacher/classes/settings');
  });

  test('unknown pages bucket to "other" — never rejected, never stored verbatim', () => {
    expect(classifyPage('/junk')).toBe('other');
    expect(classifyPage('/teacher/nonexistent')).toBe('other');
    expect(classifyPage('/../etc/passwd')).toBe('other');
  });

  test('a prefix does not falsely match an unrelated route sharing a substring', () => {
    // '/joinclass' should NOT match the '/join' prefix rule (no '/' boundary).
    expect(classifyPage('/joinclass')).toBe('other');
  });
});

// Mandatory (outside voice D10): every route declared in src/App.jsx's <Routes> must be
// covered by the allowlist, or it silently buckets to 'other' forever. This walks the real
// route table (not a hand-copied list) so an added route without a matching allowlist entry
// fails loudly here instead of rotting silently in production.
describe('pageView allowlist — coupling with src/App.jsx routes', () => {
  const appJsxPath = path.join(__dirname, '../../../src/App.jsx');
  const appJsxSource = fs.readFileSync(appJsxPath, 'utf8');

  // Matches <Route path="/some/path" ...> — captures the path attribute value.
  const routeMatches = [...appJsxSource.matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1]);

  test('extracted at least the known route count from App.jsx (sanity check the regex still matches)', () => {
    expect(routeMatches.length).toBeGreaterThanOrEqual(20);
  });

  const DECLARED_ROUTES = routeMatches.filter(p => p !== '*'); // catch-all redirects to '/', not a real page

  test.each(DECLARED_ROUTES)('route "%s" is covered by the pageView allowlist', (routePath) => {
    // Substitute React Router dynamic segments (e.g. :quizId) with a sample value before
    // classifying, since classifyPage operates on real pathnames, not route patterns.
    const samplePath = routePath.replace(/:[^/]+/g, 'sample-id');
    expect(classifyPage(samplePath)).not.toBe('other');
  });
});

describe('ALLOWED_PREFIXES', () => {
  test('is a non-empty array of leading-slash paths', () => {
    expect(Array.isArray(ALLOWED_PREFIXES)).toBe(true);
    expect(ALLOWED_PREFIXES.length).toBeGreaterThan(0);
    for (const p of ALLOWED_PREFIXES) expect(p.startsWith('/')).toBe(true);
  });
});
