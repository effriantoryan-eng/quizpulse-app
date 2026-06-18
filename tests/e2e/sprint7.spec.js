// E2E tests for Sprint 7 — admin portal.
//
// These tests require the admin portal to be running at http://localhost:5174
// and the Function App at http://localhost:7071.
//
// Run with: RUN_E2E=true npx playwright test tests/e2e/sprint7.spec.js
//
// Note: full auth flow E2E tests (sign-in, merge with step-up, role assignment)
// require a configured CIAM tenant and a test admin account. The tests below cover
// the redirect-to-auth gate (unauthenticated access) and the teacher-identity-rejection
// smoke test, which can run without credentials.

const { test, expect } = require('@playwright/test');

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5174';
const FUNC_URL  = process.env.FUNC_URL  || 'http://localhost:7071/api';
const RUN       = process.env.RUN_E2E   === 'true';
const jwt       = require('jsonwebtoken');

// ─── Auth gate ────────────────────────────────────────────────────────────────

test.describe('Admin portal auth gate', () => {
  test.skip(!RUN, 'Set RUN_E2E=true to run E2E tests');

  test('unauthenticated visit to / redirects to CIAM sign-in', async ({ page }) => {
    await page.goto(ADMIN_URL);
    // MSAL redirects to ciamlogin.com for auth; we just verify we leave the admin origin
    await page.waitForURL(/ciamlogin\.com/, { timeout: 10000 }).catch(() => {});
    const url = page.url();
    // Either we're at ciamlogin or we see a "Redirecting to sign in" message
    const isRedirected = url.includes('ciamlogin.com') || url.includes('microsoftonline.com');
    const bodyText = await page.textContent('body').catch(() => '');
    const showsRedirectMsg = bodyText.toLowerCase().includes('sign in');
    expect(isRedirected || showsRedirectMsg).toBe(true);
  });

  test('unauthenticated visit to /schools also redirects', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/schools`);
    await page.waitForURL(/ciamlogin\.com/, { timeout: 10000 }).catch(() => {});
    const url = page.url();
    const bodyText = await page.textContent('body').catch(() => '');
    const isRedirected = url.includes('ciamlogin.com') || url.includes('microsoftonline.com');
    const showsRedirectMsg = bodyText.toLowerCase().includes('sign in');
    expect(isRedirected || showsRedirectMsg).toBe(true);
  });
});

// ─── Teacher identity rejected at admin API endpoints ────────────────────────

test.describe('Teacher token rejected at admin endpoints (API-level)', () => {
  test.skip(!RUN, 'Set RUN_E2E=true to run E2E tests');

  const TEACHER_CLIENT_ID = process.env.AUTH_CLIENT_ID || 'teacher-client-id';

  function mintTeacherToken(oid) {
    return jwt.sign(
      { oid, name: 'Teacher', emails: [`${oid}@example.com`], aud: TEACHER_CLIENT_ID, role: 'owner' },
      'dev-key',
      { expiresIn: '1h' }
    );
  }

  test('teacher-app token is rejected by /api/manage/metrics with 401', async ({ request }) => {
    const token = mintTeacherToken('e2e-teacher');
    const res = await request.get(`${FUNC_URL}/manage/metrics?range=today`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(401);
  });

  test('teacher-app token is rejected by /api/manage/schools with 401', async ({ request }) => {
    const token = mintTeacherToken('e2e-teacher');
    const res = await request.get(`${FUNC_URL}/manage/schools`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(401);
  });

  test('teacher-app token is rejected by /api/manage/audit with 401', async ({ request }) => {
    const token = mintTeacherToken('e2e-teacher');
    const res = await request.get(`${FUNC_URL}/manage/audit`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(401);
  });
});

// ─── Authenticated admin flows (manual / CI with test credentials) ────────────
// The following tests are documented as the expected flow but skipped in automated
// runs without real credentials. Run manually against the deployed admin portal with
// a real admin account to verify:
//
// 1. Merge with step-up re-auth
//    a. Sign in as owner. Navigate to Schools > Merge tool.
//    b. Select a test source and target school.
//    c. Click "Confirm merge" immediately → expect "Re-authentication required" message.
//    d. Click "Sign in again" → redirects to CIAM, forces fresh auth.
//    e. Returns to admin portal. Try merge again → succeeds.
//    f. Source school shows "Merged" badge in Schools list.
//
// 2. Monitoring + log export
//    a. Navigate to Monitoring. Time-range selector shows Today / 7d / 30d.
//    b. Stubbed metrics show "—" for all values; yellow banner explains the stub.
//    c. Click "↓ Security log" with no date range → downloads .jsonl file.
//    d. Click "↓ Error log" → not available (button disabled).
//
// 3. Role assignment (owner only)
//    a. Navigate to Roles. Search for a teacher by name.
//    b. Click "Change role" → modal opens with current role pre-selected.
//    c. Select "support". Click "Save role" → success, table refreshes.
//    d. Sign in as the target teacher on the teacher app — they cannot reach admin endpoints.
//    e. Log back in as owner. Revert the role to "teacher".
