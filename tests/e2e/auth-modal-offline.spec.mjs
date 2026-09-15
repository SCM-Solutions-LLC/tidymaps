import { test, expect } from 'playwright/test';

/* The sign-in modal prints what sendCode/verifyCode throw. supabase-js reports
   a request that got no answer with the browser's own fetch text, and the
   modal used to print it verbatim: "Failed to fetch". These run the real
   modal against the real vendored library with the auth routes cut at the
   browser, so what is asserted is the sentence a person actually sees.

   Nothing here reaches the project: every auth route is intercepted. */

const CONNECTION = /could not reach the sign-in service/i;

async function openSignIn(page) {
  await page.goto('/index.html');
  await page.evaluate(() => window.openAuth());
  await expect(page.locator('#auth-modal')).not.toHaveClass(/hide/);
  await page.fill('#auth-email', 'someone@example.com');
}

test('sending the code with no connection is explained, not dumped', async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => route.abort('failed'));
  await openSignIn(page);
  await page.click('#auth-send-btn');
  const msg = page.locator('#auth-msg');
  await expect(msg).toHaveText(CONNECTION);
  await expect(msg).not.toContainText(/failed to fetch|typeerror/i);
  // Still on the email step, with the button back, so the person can retry.
  await expect(page.locator('#auth-step-email')).not.toHaveClass(/hide/);
  await expect(page.locator('#auth-step-code')).toHaveClass(/hide/);
  await expect(page.locator('#auth-send-btn')).toBeEnabled();
});

test('the library failing to load reads the same, and the modal still works', async ({ page }) => {
  // A first visit with no connection: the vendored bundle is a dynamic import
  // that has not been fetched yet, so the failure comes from import() itself.
  await page.route('**/vendor/supabase/**', (route) => route.abort('failed'));
  await openSignIn(page);
  await page.click('#auth-send-btn');
  const msg = page.locator('#auth-msg');
  await expect(msg).toHaveText(CONNECTION);
  await expect(msg).not.toContainText(/dynamically imported|failed to fetch/i);
  await expect(page.locator('#auth-send-btn')).toBeEnabled();
});

test('the service being down is named as the service, not the connection', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (route) => route.fulfill({ status: 503, contentType: 'text/html', body: '<html>Service Unavailable</html>' }));
  await openSignIn(page);
  await page.click('#auth-send-btn');
  const msg = page.locator('#auth-msg');
  await expect(msg).toHaveText(/sign-in is temporarily unavailable/i);
  await expect(msg).not.toContainText(/html|unavailable</i);
});

test('losing the connection between the two steps is explained on the code step', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/auth/v1/verify**', (route) => route.abort('failed'));
  await openSignIn(page);
  await page.click('#auth-send-btn');
  await expect(page.locator('#auth-step-code')).not.toHaveClass(/hide/);
  await page.fill('#auth-code', '12345678');
  await page.click('#auth-verify-btn');
  const msg = page.locator('#auth-msg');
  await expect(msg).toHaveText(CONNECTION);
  await expect(msg).not.toContainText(/failed to fetch/i);
  // The modal stays open on the code step; the code has not been used.
  await expect(page.locator('#auth-modal')).not.toHaveClass(/hide/);
  await expect(page.locator('#auth-verify-btn')).toBeEnabled();
});
