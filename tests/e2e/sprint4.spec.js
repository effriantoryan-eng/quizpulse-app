// E2E tests — Sprint 4: student quiz-taking flow, closed quiz state, CSV export.
// Requires:
//   - npm run dev (frontend) + func start (api) running
//   - E2E_BASE_URL env var (default: http://localhost:5173)
//
// API calls are mocked via page.route() so these run without a live Cosmos/Functions backend.
// The full join → approve → notify → quiz → analytics loop and live CSV export require a real
// backend and are marked as manual confirmation steps below.

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('/quiz — student quiz-taking screen', () => {
  test('shows an error when quizId is missing', async ({ page }) => {
    await page.goto(`${BASE_URL}/quiz`);
    await expect(page.locator('text=No quiz specified.')).toBeVisible();
  });

  test('shows "This quiz has closed." for a closed quiz and does not render questions', async ({ page }) => {
    await page.route('**/quizzes/closed-quiz', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'closed-quiz', name: 'Closed Quiz', closedAt: new Date(Date.now() - 60000).toISOString() }),
      })
    );

    await page.goto(`${BASE_URL}/quiz?quizId=closed-quiz`);
    await expect(page.locator('text=This quiz has closed.')).toBeVisible();
    await expect(page.locator('input[type="radio"]')).toHaveCount(0);
  });

  test('renders all questions at once and submits successfully', async ({ page }) => {
    await page.route('**/quizzes/open-quiz', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'open-quiz', name: 'Open Quiz', closedAt: new Date(Date.now() + 600000).toISOString() }),
      })
    );
    await page.route('**/quizzes/open-quiz/questions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'q1', text: 'Capital of France?', options: ['Paris', 'Rome'] },
          { id: 'q2', text: '2 + 2 = ?', options: ['3', '4'] },
        ]),
      })
    );
    await page.route('**/responses', (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'r1' }) })
    );

    await page.goto(`${BASE_URL}/quiz?quizId=open-quiz`);
    await expect(page.locator('text=2 questions')).toBeVisible();

    await page.locator('input[type="radio"]').nth(0).check();
    await page.locator('input[type="radio"]').nth(2).check();
    await page.locator('button', { hasText: 'Submit answers' }).click();

    await expect(page.locator('text=Thanks for completing the quiz!')).toBeVisible();
  });

  test('shows "You have already submitted this quiz." on a 409 response', async ({ page }) => {
    await page.route('**/quizzes/open-quiz', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'open-quiz', name: 'Open Quiz', closedAt: new Date(Date.now() + 600000).toISOString() }),
      })
    );
    await page.route('**/quizzes/open-quiz/questions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'q1', text: 'Capital of France?', options: ['Paris', 'Rome'] }]),
      })
    );
    await page.route('**/responses', (route) =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'already submitted' }) })
    );

    await page.goto(`${BASE_URL}/quiz?quizId=open-quiz`);
    await page.locator('input[type="radio"]').nth(0).check();
    await page.locator('button', { hasText: 'Submit answers' }).click();

    await expect(page.locator('text=You have already submitted this quiz.')).toBeVisible();
  });
});

test.describe('full loop and live CSV export (manual confirmation steps)', () => {
  test.skip('join → approve → notify → quiz → analytics', async () => {
    // Manual confirmation step against a real backend:
    // 1. Student submits a join request and is approved by the teacher.
    // 2. Teacher sends a quiz — student receives a push notification.
    // 3. Student opens /quiz?quizId=... and submits answers.
    // 4. Teacher's /teacher/analytics/:quizId updates within ~3s (poll interval) without a
    //    manual refresh, showing the new response in the "X / Y responded" counter.
  });

  test.skip('CSV export downloads a file with the documented columns', async () => {
    // Manual confirmation step: on /teacher/analytics/:quizId, click "Export CSV" and verify
    // the downloaded {quizId}_responses.csv has columns studentName, question, answer, timestamp.
  });
});
