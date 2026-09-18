// E2E accessibility tests using axe-core via @axe-core/playwright.
// Requires:
//   - npm run dev (frontend) running at E2E_BASE_URL (default: http://localhost:5173)
//   - B2C_ALLOW_UNVERIFIED_DEV=true in api/local.settings.json (dev-auth bypass)
//   - A dev-auth teacher token in E2E_DEV_TOKEN (optional; unauthenticated routes tested without it)
//
// Run: npx playwright test tests/e2e/a11y.spec.js
// Run with auth: E2E_DEV_TOKEN=<token> npx playwright test tests/e2e/a11y.spec.js
//
// A11y: WCAG 2.1 AA; axe checks contrast, labels, ARIA, keyboard traps, headings, landmarks.
// Each page is tested at 1280px (desktop) and 375px (mobile, drawer closed).

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173'

// Routes accessible without auth
const PUBLIC_ROUTES = [
  { path: '/', label: 'Home / landing' },
  { path: '/login', label: 'Login' },
  { path: '/join', label: 'Join class' },
  { path: '/privacy', label: 'Privacy policy' },
  { path: '/collection-notice', label: 'Collection notice' },
  { path: '/terms', label: 'Terms' },
]

// Viewports to test
const VIEWPORTS = [
  { width: 1280, height: 800, label: 'desktop' },
  { width: 375, height: 812, label: 'mobile' },
]

for (const vp of VIEWPORTS) {
  test.describe(`WCAG 2.1 AA — ${vp.label} (${vp.width}px)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
    })

    for (const route of PUBLIC_ROUTES) {
      test(route.label, async ({ page }) => {
        await page.goto(`${BASE}${route.path}`)
        // Wait for content to settle
        await page.waitForLoadState('networkidle')

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          // Exclude the legal-pending banner — it intentionally shows a "being finalised" state
          // and the placeholder text fails colour checks on purpose until wording is supplied.
          .exclude('[data-legal-pending]')
          .analyze()

        expect(results.violations, `${route.label} @ ${vp.label}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([])
      })
    }

    test('skip link is visible on focus and targets #main-content', async ({ page }) => {
      await page.goto(`${BASE}/`)
      await page.waitForLoadState('networkidle')
      // Tab once to focus the skip link
      await page.keyboard.press('Tab')
      const skipLink = page.locator('.skip-link')
      await expect(skipLink).toBeFocused()
      // Activate it
      await page.keyboard.press('Enter')
      const mainContent = page.locator('#main-content')
      await expect(mainContent).toBeFocused()
    })
  })
}
