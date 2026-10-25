import { test, expect } from 'playwright/test';
import { fakeSession, REF } from './helpers.mjs';

/* What the landing page downloads before anyone has asked for anything.

   Every visitor used to fetch supabase-js (216KB) so that getSession() could
   report there was no session, and demo-scenarios.js (150KB of plan copy) so
   that a sample plan COULD be opened. Both now load on the first thing that
   needs them. These read the network rather than the module graph, because a
   static import added anywhere in the graph would quietly put either back. */

async function loadLanding(page, { signedIn = false } = {}) {
  if (signedIn) {
    await page.addInitScript(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, [`sb-${REF}-auth-token`, fakeSession()]);
  }
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.route(`**/${REF}.supabase.co/**`, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(/\/auth\/v1\/user/.test(route.request().url()) ? fakeSession().user : fakeSession()),
  }));
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');
  return urls;
}

test('a signed-out visitor does not download the auth library', async ({ page }) => {
  const urls = await loadLanding(page);
  expect(urls.some((u) => /supabase\.esm\.js/.test(u)), 'supabase-js fetched with no session to restore').toBe(false);
  // still signed out from the app's point of view
  await expect(page.locator('#acct-signin')).toBeVisible();
});

test('a stored session still restores the account at startup', async ({ page }) => {
  const urls = await loadLanding(page, { signedIn: true });
  expect(urls.some((u) => /supabase\.esm\.js/.test(u)), 'a stored session must load the library that reads it').toBe(true);
  await expect(page.locator('#acct-btn')).toBeVisible();
});

test('opening the sign-in dialog and sending a code loads the library on demand', async ({ page }) => {
  const urls = await loadLanding(page);
  await page.click('#acct-signin');
  await page.fill('#auth-email', 'tester@example.com');
  await page.route(`**/${REF}.supabase.co/auth/v1/otp**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.click('#auth-send-btn');
  await expect(page.locator('#auth-step-code')).toBeVisible();
  expect(urls.some((u) => /supabase\.esm\.js/.test(u))).toBe(true);
});

test('the plan engine arrives with the first plan, not with the page', async ({ page }) => {
  const urls = await loadLanding(page);
  expect(urls.some((u) => /demo-scenarios\.js/.test(u)), 'demo-scenarios.js fetched before any plan was asked for').toBe(false);
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  expect(urls.some((u) => /demo-scenarios\.js/.test(u))).toBe(true);
  await expect(page.locator('#res-steps .task').first()).toBeVisible();
});

/* The report, the analysis, Adjust and the export, with the modules only
   they reach, were 15 of the landing page's 46 modules and half its script
   bytes (js/planScreens.js). They arrive with the first plan, or while the
   wizard is being answered, and once the report is here its handlers are the
   real functions again, not the stand-ins: other specs call them and read
   the page in the same breath. */
const PLAN_SCREENS = /\/js\/(screens\/(results|loading|customize)|planExport|personalize|setupStructure|catalog)\.js/;

test('the plan screens arrive with the first plan, not with the page', async ({ page }) => {
  const urls = await loadLanding(page);
  expect(urls.filter((u) => PLAN_SCREENS.test(u)), 'fetched before any plan was asked for').toEqual([]);
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await expect(page.locator('#res-steps .task').first()).toBeVisible();
  expect(urls.some((u) => /screens\/results\.js/.test(u))).toBe(true);
  expect(await page.evaluate(() => window.toggleStep.constructor.name), 'still the async stand-in').toBe('Function');
});

test('the wizard fetches the plan screens while it is being answered', async ({ page }) => {
  const urls = await loadLanding(page);
  await page.locator('#screen-landing .btn-primary').first().click();
  await expect(page.locator('#screen-space')).toHaveClass(/active/);
  await expect.poll(() => urls.some((u) => /screens\/results\.js/.test(u)), { timeout: 10_000 }).toBe(true);
});

/* main.js used to statically import viewer3d.js and products.js just to hand
   their functions to window; nothing else on the boot path reaches either. */
test('the 3D viewer arrives when it is opened, not with the page', async ({ page }) => {
  const urls = await loadLanding(page);
  expect(urls.some((u) => /screens\/viewer3d\.js/.test(u)), 'viewer3d.js fetched before it was opened').toBe(false);
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  expect(urls.some((u) => /screens\/viewer3d\.js/.test(u)), 'viewer3d.js fetched before it was opened').toBe(false);
  await page.click('.plan-3d-badge');
  await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/, { timeout: 20_000 });
  expect(urls.some((u) => /screens\/viewer3d\.js/.test(u))).toBe(true);
});

test('the product library arrives when it is opened, not with the page', async ({ page }) => {
  const urls = await loadLanding(page);
  expect(urls.some((u) => /screens\/products\.js/.test(u)), 'products.js fetched before it was opened').toBe(false);
  await page.click('.footer-nav >> text=Products');
  await expect(page.locator('#screen-products')).toHaveClass(/active/);
  expect(urls.some((u) => /screens\/products\.js/.test(u))).toBe(true);
});

test('the italic face never loads: browsers synthesize it from the one face that does', async ({ page }) => {
  const urls = await loadLanding(page);
  expect(urls.some((u) => /archivo-latin-wght-italic/.test(u)), 'a second, italic-only font file was fetched for a handful of small captions').toBe(false);
});

test('the brand face is requested before the stylesheets ask for it', async ({ page }) => {
  const urls = await loadLanding(page);
  const font = urls.findIndex((u) => /archivo-latin-wdth-normal\.woff2/.test(u));
  const firstCss = urls.findIndex((u) => /css\/tokens\.css/.test(u));
  expect(font, 'the preload is missing').toBeGreaterThan(-1);
  expect(font, 'the font is only discovered from inside the stylesheet').toBeLessThan(firstCss + 2);
});
