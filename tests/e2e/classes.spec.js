// E2E tests — Classes management CRUD via the teacher UI.
// Requires the same setup as auth.spec.js (B2C + running local servers + credentials).
// These tests sign in using the Google provider; change to Microsoft if preferred.

import { test, expect } from '@playwright/test';

const googleEmail    = process.env.E2E_GOOGLE_EMAIL;
const googlePassword = process.env.E2E_GOOGLE_PASSWORD;
const skipSuite = !googleEmail || !googlePassword;

async function signIn(page) {
  await page.goto('/');
  await page.click('[data-testid="nav-signin"]');
  await page.click('[data-testid="login-google"]');
  await page.waitForURL(/accounts\.google\.com/, { timeout: 15000 });
  await page.fill('input[type="email"]', googleEmail);
  await page.click('#identifierNext');
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.fill('input[type="password"]', googlePassword);
  await page.click('#passwordNext');
  // Handle onboarding if new account
  await page.waitForURL(/localhost:5173/, { timeout: 20000 });
  if (page.url().includes('/onboarding')) {
    await page.fill('[data-testid="onboarding-school-name"]', 'E2E Test School');
    await page.click('[data-testid="onboarding-submit"]');
    await page.waitForURL(/\/teacher\/create/, { timeout: 10000 });
  }
}

test.describe('Classes CRUD', () => {
  test.skip(skipSuite, 'E2E_GOOGLE_EMAIL / E2E_GOOGLE_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/teacher/classes');
    await page.waitForSelector('h2:has-text("Classes")', { timeout: 10000 });
  });

  test('teacher can create a class', async ({ page }) => {
    await page.click('[data-testid="class-new-btn"]');
    await page.fill('[data-testid="class-name-input"]', 'Playwright Test Class');
    await page.click('[data-testid="class-create-submit"]');

    // New class should appear in the list
    await expect(page.locator('text=Playwright Test Class')).toBeVisible({ timeout: 5000 });
  });

  test('teacher can see the class list', async ({ page }) => {
    // List should render (possibly empty, that's fine)
    const heading = page.locator('h2:has-text("Classes")');
    await expect(heading).toBeVisible();
  });

  test('teacher can delete a class they created', async ({ page }) => {
    // Create one first
    await page.click('[data-testid="class-new-btn"]');
    await page.fill('[data-testid="class-name-input"]', 'Class To Delete');
    await page.click('[data-testid="class-create-submit"]');
    await expect(page.locator('text=Class To Delete')).toBeVisible({ timeout: 5000 });

    // Click delete on the newly created class
    const classRow = page.locator('text=Class To Delete').locator('..');
    const deleteBtn = classRow.locator('button:has-text("Delete")');
    page.once('dialog', d => d.accept());
    await deleteBtn.click();

    // Should disappear
    await expect(page.locator('text=Class To Delete')).not.toBeVisible({ timeout: 5000 });
  });
});
