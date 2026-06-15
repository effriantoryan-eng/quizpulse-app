// E2E tests — Sprint 3: iOS install banner, subscribe flow, notification (manual step).
// Requires:
//   - npm run dev (frontend) + func start (api) running
//   - E2E_BASE_URL env var (default: http://localhost:5173)
//
// Push notification delivery requires a real push subscription and teacher send action.
// That step is marked as a manual confirmation step below.

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

// --- iOS install prompt detection ---

test.describe('iOS install banner', () => {
  test('does not show on desktop Chrome (non-iOS user-agent)', async ({ page }) => {
    await page.goto(BASE_URL);
    // The banner is only rendered in iOS Safari outside standalone mode.
    // On desktop this element must not exist.
    const banner = page.locator('text=Install QuizPulse');
    await expect(banner).toHaveCount(0);
  });

  test('shows and can be dismissed on simulated iOS Safari', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    // Clear any prior dismissal stored in localStorage.
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.removeItem('quizpulse_ios_banner_dismissed'));
    await page.reload();

    const banner = page.locator('text=Install QuizPulse');
    await expect(banner).toBeVisible({ timeout: 5000 });

    // Dismiss it.
    await page.locator('button[aria-label="Dismiss"]').last().click();
    await expect(banner).toHaveCount(0);

    // Reload — banner should not reappear.
    await page.reload();
    await expect(banner).toHaveCount(0);

    await context.close();
  });
});

// --- Subscribe page ---

test.describe('/student/subscribe', () => {
  test('renders the subscribe form', async ({ page }) => {
    await page.goto(`${BASE_URL}/student/subscribe`);
    await expect(page.locator('h2')).toContainText('Subscribe to quiz notifications');
  });

  test('shows an error for a missing class ID', async ({ page }) => {
    await page.goto(`${BASE_URL}/student/subscribe`);

    // In a real browser the pushManager.subscribe call won't work without HTTPS + real VAPID.
    // We intercept the API call and verify the UI handles a 403 gracefully.
    await page.route('**/vapid-public-key', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ publicKey: 'test-key' }) })
    );
    await page.route('**/subscribe', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'No approved join request found' }) })
    );

    // Click subscribe with empty class ID — should show inline error before reaching API.
    await page.locator('button', { hasText: 'Subscribe to notifications' }).click();
    await expect(page.locator('text=Class ID is required')).toBeVisible();
  });
});

// --- Push notification (manual confirmation step) ---

test.describe('push notification delivery', () => {
  test.skip('teacher sends quiz → subscribed student receives notification', async () => {
    // Manual confirmation step:
    // 1. Student subscribes via /student/subscribe with an approved class ID.
    // 2. Teacher sends a quiz via /teacher/send.
    // 3. Student's device shows a browser push notification.
    //
    // This requires a real HTTPS environment with VAPID keys configured.
    // Automated assertion: after teacher sends, GET /api/quizzes/:id returns
    // notificationSentAt set to a non-null ISO string.
  });
});
