import { test, expect } from 'playwright/test';

/* Produced step clips: when data/step-media.json declares a ready clip for a
   step's media key, the checklist slot upgrades to a playing <video> (the
   .has-clip class is added only on canplay, so this asserts real playback,
   not just markup). Under prefers-reduced-motion the upgrade must not happen
   at all — the CSS stills the inline SVG scenes and a playing clip would
   reintroduce the motion the user opted out of. */

/* Same 12-step drive as wizard-matrix.spec.mjs, pantry path, no photos. */
async function driveToResults(page) {
  const next = () => page.locator('#flow-next').click();
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#room-cards .room-card', { hasText: 'Kitchen' }).first().click();
  await next();
  await page.locator('#area-cards .room-card', { hasText: 'Pantry' }).first().click();
  await next();
  await expect(page.locator('#setup-cards .wz-setup.sel')).toHaveCount(1);
  await next();
  await page.fill('#m-num-w', '3');
  await page.fill('#m-num-h', '6');
  await page.fill('#m-num-d', '1.33');
  await next(); // measurements → photos
  await next(); // photos (none) → household
  await next(); // household defaults → contents
  await next(); // contents → goals
  await page.locator('#goal-list .wz-goal').first().click();
  await next(); // goals → style
  await next(); // style → effort
  await next(); // effort → shopping
  await next(); // shopping → review
  await expect(page.locator('#flow-next')).toContainText('Build my plan');
  await next();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 25_000 });
}

test('declared-ready clips upgrade in-view steps to playing video', async ({ page }) => {
  const manifest = await (await fetch('http://localhost:8123/data/step-media.json')).json();
  test.skip(!Object.values(manifest.clips || {}).some((c) => c.status === 'ready'),
    'no ready clips declared — nothing to verify');

  await driveToResults(page);
  const slots = page.locator('#res-steps .step-art');
  expect(await slots.count()).toBeGreaterThan(0);

  // Scroll the checklist so the lazy IntersectionObserver upgrade fires.
  const first = slots.first();
  await first.scrollIntoViewIfNeeded();
  await expect(first).toHaveClass(/has-clip/, { timeout: 15_000 });
  await expect(first.locator('video')).toHaveCount(1);
});

test('prefers-reduced-motion keeps the stilled SVG scenes, no video at all', async ({ browser }) => {
  const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  await driveToResults(page);
  const slots = page.locator('#res-steps .step-art');
  expect(await slots.count()).toBeGreaterThan(0);
  await slots.first().scrollIntoViewIfNeeded();
  // Give the (absent) upgrade every chance to fire before asserting stillness.
  await page.waitForTimeout(1500);
  await expect(page.locator('#res-steps .step-art video')).toHaveCount(0);
  await expect(page.locator('#res-steps .step-art.has-clip')).toHaveCount(0);
});
