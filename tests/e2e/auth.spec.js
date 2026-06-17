// E2E tests — teacher authentication via Entra External ID (CIAM).
// Requires:
//   - CIAM tenant fully configured (see docs/azure/B2C_SETUP.md)
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

// ---------------------------------------------------------------------------
// Regression tests — sign-in redirect behaviour (no credentials required).
// These tests catch regressions in the auth flow without needing real users.
// ---------------------------------------------------------------------------

// Catches the v3.0.1 desktop regression: stale CSP connect-src (*.b2clogin.com instead
// of *.ciamlogin.com) blocked MSAL's OIDC discovery fetch → silent button failure.
test.describe('sign-in button initiates CIAM redirect', () => {
  test('Microsoft button navigates away from the app toward ciamlogin.com (desktop)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="login-microsoft"]', { timeout: 10000 });

    let navigatedUrl = null;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url() !== 'about:blank') {
        navigatedUrl = frame.url();
      }
    });

    await page.click('[data-testid="login-microsoft"]');
    await page.waitForFunction(
      () => !window.location.href.includes('localhost'),
      { timeout: 8000 }
    ).catch(() => {});

    const currentUrl = page.url();
    const redirected = currentUrl.includes('ciamlogin.com') || (navigatedUrl && navigatedUrl.includes('ciamlogin.com'));
    expect(redirected, `Expected navigation to ciamlogin.com but stayed on: ${currentUrl}`).toBe(true);
  });

  // Same assertion in a mobile viewport. Playwright's Chromium engine does not apply iOS
  // ITP or standalone restrictions, so this test only validates that the button is
  // visible + tappable at 390px and that MSAL still initiates a redirect at mobile size.
  test('Microsoft button navigates toward ciamlogin.com on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 dimensions
    await page.goto('/');
    await page.waitForSelector('[data-testid="login-microsoft"]', { timeout: 10000 });

    let navigatedUrl = null;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url() !== 'about:blank') {
        navigatedUrl = frame.url();
      }
    });

    await page.click('[data-testid="login-microsoft"]');
    await page.waitForFunction(
      () => !window.location.href.includes('localhost'),
      { timeout: 8000 }
    ).catch(() => {});

    const currentUrl = page.url();
    const redirected = currentUrl.includes('ciamlogin.com') || (navigatedUrl && navigatedUrl.includes('ciamlogin.com'));
    expect(redirected, `Mobile: Expected navigation to ciamlogin.com but stayed on: ${currentUrl}`).toBe(true);
  });
});

// Catches the v3.0.1 mobile regression: in-app browsers (Instagram, Facebook, etc.) cannot
// complete OAuth. The Login page should detect them and show a "open in Safari/Chrome" prompt
// instead of buttons that silently fail.
test.describe('in-app browser detection', () => {
  // Helper: load the login page with a spoofed in-app-browser user-agent.
  async function loadWithIABUserAgent(page, ua) {
    await page.setExtraHTTPHeaders({ 'User-Agent': ua });
    // Override navigator.userAgent before any JS runs via page init script.
    await page.addInitScript((spoofedUa) => {
      Object.defineProperty(navigator, 'userAgent', { get: () => spoofedUa });
    }, ua);
    await page.goto('/');
    await page.waitForTimeout(1000); // allow React to mount
  }

  test('shows "open in Safari or Chrome" prompt for Facebook in-app browser', async ({ page }) => {
    const fbUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/16.0;FBSS/3;FBID/phone;FBLC/en_AU;FBOP/5]';
    await loadWithIABUserAgent(page, fbUA);

    const copyBtn = page.locator('[data-testid="copy-link-button"]');
    await expect(copyBtn).toBeVisible({ timeout: 5000 });

    // Sign-in buttons must NOT be shown in an in-app browser.
    const msBtn = page.locator('[data-testid="login-microsoft"]');
    await expect(msBtn).not.toBeVisible();
  });

  test('shows "open in Safari or Chrome" prompt for Instagram in-app browser', async ({ page }) => {
    const igUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 250.0.0.16.108 (iPhone14,2; iOS 16_0; en_AU; en-AU; scale=3.00; 1170x2532; 380084034)';
    await loadWithIABUserAgent(page, igUA);

    const copyBtn = page.locator('[data-testid="copy-link-button"]');
    await expect(copyBtn).toBeVisible({ timeout: 5000 });
  });

  test('shows normal sign-in buttons in a standard mobile browser', async ({ page }) => {
    const safariUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    await loadWithIABUserAgent(page, safariUA);

    const msBtn = page.locator('[data-testid="login-microsoft"]');
    await expect(msBtn).toBeVisible({ timeout: 5000 });
  });
});

// Catches the iOS standalone mode regression: loginRedirect() escapes to Safari, which has
// a separate data store from the PWA on iOS 16.4+. The Login page should detect this and
// show a guidance prompt instead of buttons.
test.describe('iOS standalone PWA mode', () => {
  test('shows "sign in via Safari first" guidance when running as iOS home-screen PWA', async ({ page }) => {
    const iosUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20G75';
    await page.addInitScript((ua) => {
      Object.defineProperty(navigator, 'userAgent', { get: () => ua });
      // Simulate standalone display-mode (matchMedia override).
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (query === '(display-mode: standalone)') {
          return { matches: true, media: query, addListener: () => {}, removeListener: () => {} };
        }
        return original(query);
      };
    }, iosUA);

    await page.goto('/');
    await page.waitForTimeout(1000);

    const safariLink = page.locator('[data-testid="open-in-safari-link"]');
    await expect(safariLink).toBeVisible({ timeout: 5000 });

    // Sign-in buttons must NOT be shown in standalone mode on iOS.
    const msBtn = page.locator('[data-testid="login-microsoft"]');
    await expect(msBtn).not.toBeVisible();
  });

  test('shows normal sign-in buttons in standalone mode on Android (not iOS)', async ({ page }) => {
    const androidUA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36';
    await page.addInitScript((ua) => {
      Object.defineProperty(navigator, 'userAgent', { get: () => ua });
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (query === '(display-mode: standalone)') {
          return { matches: true, media: query, addListener: () => {}, removeListener: () => {} };
        }
        return original(query);
      };
    }, androidUA);

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Android standalone PWA should show normal sign-in buttons.
    const msBtn = page.locator('[data-testid="login-microsoft"]');
    await expect(msBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('CIAM authentication — Google provider', () => {
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

test.describe('CIAM authentication — Microsoft provider', () => {
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
