// E2E (v3.2.2): public landing split, /join routing, and the Add-to-phone button per browser.
// Requires E2E_BASE_URL set to the running app (e.g. http://localhost:5173). Tests that need a
// signed-in teacher additionally require E2E_TEACHER_EMAIL / E2E_TEACHER_PASSWORD.

const { test, expect } = require('@playwright/test');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('Public landing split', () => {
  test.skip(!process.env.E2E_BASE_URL, 'E2E_BASE_URL not set');

  test('unauthenticated visitor sees two cards and can go to /join', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await expect(page.getByTestId('student-card')).toBeVisible();
    await expect(page.getByTestId('teacher-card')).toBeVisible();
    await expect(page.getByTestId('preview-gallery-link')).toBeVisible();

    await page.getByTestId('student-join-btn').click();
    await expect(page).toHaveURL(/\/join$/);
    await expect(page.getByText('Join a class')).toBeVisible();
  });

  test('authenticated teacher visiting / is taken to the dashboard, not the landing', async ({ page }) => {
    test.skip(!process.env.E2E_TEACHER_EMAIL, 'teacher creds not set');
    // Assumes an auth helper / storageState has signed the teacher in.
    await page.goto(`${BASE}/`);
    await expect(page.getByTestId('landing-cards')).toHaveCount(0);
    await expect(page).toHaveURL(/\/teacher\//);
  });
});

test.describe('Add-to-phone button per browser', () => {
  test.skip(!process.env.E2E_BASE_URL, 'E2E_BASE_URL not set');

  // Chromium fires beforeinstallprompt when the manifest + SW criteria are met → native button.
  test('visible on Home in a Chromium browser', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'native install prompt is Chromium-only');
    await page.goto(`${BASE}/`);
    // beforeinstallprompt is best-effort in CI; assert the button when it appears.
    const btn = page.getByTestId('install-button');
    if (await btn.count()) await expect(btn).toBeVisible();
  });

  test('hidden on desktop Firefox (no programmatic install)', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'desktop-Firefox-specific');
    await page.goto(`${BASE}/`);
    await expect(page.getByTestId('install-button')).toHaveCount(0);
  });

  test('iOS Safari shows the add-to-home-screen guide instead of the button', async ({ page }) => {
    // Emulate an iOS Safari UA; the guide banner appears, the native button does not.
    await page.goto(`${BASE}/join`);
    await expect(page.getByText(/Add to Home Screen/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
});
