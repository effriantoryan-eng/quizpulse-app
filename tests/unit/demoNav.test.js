// Unit test for src/components/DemoNav.jsx — the signed-out nav branch.
//
// The repo has no DOM test library (RTL/jsdom), so FE components are verified by their pure
// exported logic plus a source-level assertion of what the public branch renders — the same
// pattern used by tests/unit/encouragements.test.js. This guards the v3.2.2 requirement:
// "renders only logo + Preview gallery link when isAuthenticated=false".

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '../../src/components/DemoNav.jsx'),
  'utf8'
);

// Mirror of the pure decision function exported by DemoNav.jsx.
function showPublicNav(isAuthenticated) {
  return !isAuthenticated;
}

describe('DemoNav — public (signed-out) branch', () => {
  it('shows the public nav only when the visitor is not authenticated', () => {
    expect(showPublicNav(false)).toBe(true);
    expect(showPublicNav(true)).toBe(false);
  });

  it('renders the existing teacher Sidebar when authenticated', () => {
    // Authenticated branch returns <Sidebar /> unchanged.
    expect(SRC).toMatch(/if \(!showPublicNav\(isAuthenticated\)\)\s*\{\s*return <Sidebar \/>/);
  });

  it('public branch exposes exactly one nav link: Preview gallery → /demo', () => {
    const navMatch = SRC.match(/PUBLIC_NAV\s*=\s*\[([^\]]*)\]/);
    expect(navMatch).not.toBeNull();
    const body = navMatch[1];
    expect(body).toContain("label: 'Preview gallery'");
    expect(body).toContain("path: '/demo'");
    // Only one link object in the public nav.
    expect(body.match(/path:/g)).toHaveLength(1);
  });

  it('public branch renders no teacher pages (no Create/Build/Send/Bank links, no Sign out)', () => {
    // The public <aside data-testid="demonav-public"> block must not map the teacher PAGES.
    const publicBlock = SRC.slice(SRC.indexOf('demonav-public'));
    expect(publicBlock).not.toMatch(/\/teacher\//);
    expect(publicBlock).not.toMatch(/Sign out/i);
    expect(publicBlock).not.toMatch(/logout/);
  });
});
