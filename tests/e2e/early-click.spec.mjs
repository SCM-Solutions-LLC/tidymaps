import { test, expect } from 'playwright/test';

/* The header and landing buttons are plain HTML, so they are on screen and
   clickable before js/main.js has run, and each calls a global main.js has
   not defined yet. A click in that window (about 0.9s on a cold load, 10-13)
   used to vanish: no dialog, no error the visitor could see. The inline guard
   in index.html now holds the click and main.js replays it once ready.

   main.js is held at the network so "before ready" is a fact of the test, not
   a race against a fast local server. */

async function holdMain(page) {
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/js/main.js', async (route) => {
    await gate;
    await route.continue();
  });
  return () => release();
}

test('a Sign in click before startup opens the dialog once startup finishes', async ({ page }) => {
  const releaseMain = await holdMain(page);
  // 'commit': DOMContentLoaded itself waits for the held module.
  await page.goto('/index.html', { waitUntil: 'commit' });

  await expect(page.locator('#acct-signin')).toBeVisible();
  expect(await page.evaluate(() => window.__tidymapReady)).toBe(false);
  await page.click('#acct-signin');
  // Held, not run: the dialog cannot open before openAuth exists.
  await expect(page.locator('#auth-modal')).toHaveClass(/hide/);

  releaseMain();
  await expect.poll(() => page.evaluate(() => window.__tidymapReady)).toBe(true);
  await expect(page.locator('#auth-modal')).not.toHaveClass(/hide/);
  await expect(page.locator('#auth-email')).toBeFocused();
});

test('only the last early click is replayed', async ({ page }) => {
  const releaseMain = await holdMain(page);
  // 'commit': DOMContentLoaded itself waits for the held module.
  await page.goto('/index.html', { waitUntil: 'commit' });

  await expect(page.locator('#nav-cta')).toBeVisible();
  await page.click('#acct-signin');
  await page.click('#nav-cta'); // "Plan my space", the one they meant last
  releaseMain();

  await expect(page.locator('#screen-space')).toHaveClass(/active/);
  await expect(page.locator('#auth-modal')).toHaveClass(/hide/);
});

test('clicks after startup are not held or doubled', async ({ page }) => {
  await page.goto('/index.html');
  await expect.poll(() => page.evaluate(() => window.__tidymapReady)).toBe(true);
  await page.click('#acct-signin');
  await expect(page.locator('#auth-modal')).not.toHaveClass(/hide/);
  await page.click('#auth-modal .modal-x');
  await expect(page.locator('#auth-modal')).toHaveClass(/hide/);
});
