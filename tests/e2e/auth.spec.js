// E2E tests — teacher authentication via Azure AD B2C.
// Requires:
//   - B2C tenant fully configured (see docs/azure/B2C_SETUP.md)
//   - E2E_GOOGLE_EMAIL / E2E_GOOGLE_PASSWORD in environment (gitignored .env.test)
//   - E2E_MICROSOFT_EMAIL / E2E_MICROSOFT_PASSWORD in environment
//   - npm run dev (frontend) + func start (api) running
//   - E2E_BASE_URL env var pointing at the running app (default: http://localhost:5173)

import { test, expect } from '@playwright/test';

const googleEmail    = process.env.E2E_GOOGLE_EMAIL;
const googlePassword = process.env.E2E_GOOGLE_PASSWORD;
const msEmail        = process.env.E2E_MICROSOFT_EMAIL;
const msPassword     = process.env.E2E_MICROSOFT_PASSWORD;

// Skip the suite if credentials are not provided (e.g. in CI without secrets).
const skipGoogle    = !googleEmail || !googlePassword;
const skipMicrosoft = !msEmail || !msPassword;

test.describe('B2C authentication — Google provider', () => {
  test.skip(skipGoogle, 'E2E_GOOGLE_EMAIL / E2E_GOOGLE_PASSWORD not set');

  test('teacher can sign in with Google and is redirected to onboarding or dashboard', async ({ page }) => {
    await page.goto('/');

    // Click the Sign in button in the nav
    await page.click('[data-testid="nav-signin"]');

    // Land on B2C login page (or directly on Google)
    await page.click('[data-testid="login-google"]');

    // B2C redirects to Google's sign-in; fill credentials
    await page.waitForURL(/accounts\.google\.com/, { timeout: 15000 });
    await page.fill('input[type="email"]', googleEmail);
    await page.click('#identifierNext');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', googlePassword);
    await page.click('#passwordNext');

    // B2C processes the callback and redirects back to the app
    await page.waitForURL(/localhost:5173/, { timeout: 20000 });

    // Should be on onboarding (new user) or teacher dashboard (existing)
    const url = page.url();
    expect(url).toMatch(/\/(onboarding|teacher)/);

    // Sign out
    await page.click('[data-testid="logout"]');
    await page.waitForURL(/localhost:5173/, { timeout: 10000 });
  });
});

test.describe('B2C authentication — Microsoft provider', () => {
  test.skip(skipMicrosoft, 'E2E_MICROSOFT_EMAIL / E2E_MICROSOFT_PASSWORD not set');

  test('teacher can sign in with Microsoft and is redirected to onboarding or dashboard', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="nav-signin"]');
    await page.click('[data-testid="login-microsoft"]');

    // Microsoft login page
    await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15000 });
    await page.fill('input[type="email"]', msEmail);
    await page.click('input[type="submit"]');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', msPassword);
    await page.click('input[type="submit"]');

    // Handle "Stay signed in?" prompt if it appears
    const staySignedIn = page.locator('input[type="submit"][value="Yes"]');
    if (await staySignedIn.count()) await staySignedIn.click();

    await page.waitForURL(/localhost:5173/, { timeout: 20000 });

    const url = page.url();
    expect(url).toMatch(/\/(onboarding|teacher)/);

    await page.click('[data-testid="logout"]');
    await page.waitForURL(/localhost:5173/, { timeout: 10000 });
  });
});
