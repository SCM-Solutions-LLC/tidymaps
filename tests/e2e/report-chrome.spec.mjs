import { test, expect } from 'playwright/test';

/* Three things the 2026-09-14 review saw on the report and the landing page:
   the toast landing on the plan (on a 390 by 844 phone it sat over the
   Summary heading; on a shorter one over the 3D badge and the contents bar),
   the step clips floating in a full-width band on a desktop, and the landing
   gallery's rooms boxed by a rule that belonged to a retired picker. */

async function openSample(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

for (const [width, height] of [[390, 844], [390, 667], [1280, 900]]) {
  test(`at ${width}x${height} the report's toast sits over the running head and covers no plan content`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openSample(page);
    await expect(page.locator('#toast')).toHaveClass(/show/);
    const { toast, bar, covered } = await page.evaluate(() => {
      const box = (el) => el.getBoundingClientRect();
      const t = box(document.getElementById('toast'));
      const covered = [...document.querySelectorAll('#screen-results h1, #screen-results h2, #screen-results h3, .report-toc, .plan-3d-badge, #res-byline, .plan-chips')]
        .filter((e) => e.getClientRects().length)
        .map((e) => ({ what: (e.textContent || '').trim().slice(0, 24), r: box(e) }))
        .filter((e) => e.r.bottom > t.top && e.r.top < t.bottom && e.r.right > t.left && e.r.left < t.right)
        .map((e) => e.what);
      return { toast: { top: t.top, bottom: t.bottom }, bar: box(document.querySelector('.appbar')), covered };
    });
    expect(toast.top, 'the toast is not at the top').toBeLessThan(bar.bottom);
    expect(covered, 'the toast covers plan content').toEqual([]);
  });
}

/* The longest notice the app shows (the reload toast naming lost photos). With
   left:50% and no width the toast could only be half the viewport wide, so on
   a phone this wrapped into a five-line block that reached down into the
   plan. It takes the width of its text up to 90vw or 560px. */
const LONG_NOTICE = 'Your answers are still here, but the photos you added were not kept. Add them again on the photo step.';
for (const [width, height] of [[390, 844], [1280, 900]]) {
  test(`at ${width}x${height} a long notice takes the toast's full width and still covers no plan content`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openSample(page);
    await page.waitForTimeout(2400);
    await page.evaluate((m) => window.toast(m), LONG_NOTICE);
    await page.waitForTimeout(400);
    const { toast, covered } = await page.evaluate(() => {
      const box = (el) => el.getBoundingClientRect();
      const t = box(document.getElementById('toast'));
      const covered = [...document.querySelectorAll('#screen-results h1, #screen-results h2, #screen-results h3, .report-toc, .plan-3d-badge, #res-byline, .plan-chips')]
        .filter((e) => e.getClientRects().length)
        .map((e) => ({ what: (e.textContent || '').trim().slice(0, 24), r: box(e) }))
        .filter((e) => e.r.bottom > t.top && e.r.top < t.bottom && e.r.right > t.left && e.r.left < t.right)
        .map((e) => e.what);
      return { toast: { width: t.width, height: t.height }, covered };
    });
    const cap = Math.min(width * 0.9, 560);
    expect(toast.width, 'the toast is narrower than its text needs').toBeGreaterThan(cap - 30);
    expect(toast.width, 'the toast is wider than its cap').toBeLessThanOrEqual(cap + 1);
    expect(covered, 'the long notice covers plan content').toEqual([]);
  });
}

test('on a wizard step the toast does not sit on the Back and Continue bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.evaluate(() => window.toast('A note for the step'));
  const { toast, foot } = await page.evaluate(() => ({
    toast: document.getElementById('toast').getBoundingClientRect().bottom,
    foot: document.getElementById('flow-foot').getBoundingClientRect().top,
  }));
  expect(toast).toBeLessThan(foot);
});

test('a step clip fills its band on a desktop instead of floating in it', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSample(page);
  const arts = page.locator('#res-steps .step-art');
  const n = await arts.count();
  for (let i = 0; i < n; i++) { await arts.nth(i).scrollIntoViewIfNeeded(); await page.waitForTimeout(100); }
  const clip = page.locator('#res-steps .step-art.has-clip').first();
  await expect(clip).toBeVisible({ timeout: 15_000 });
  const { band, video } = await clip.evaluate((el) => {
    const v = el.querySelector('video');
    const r = el.getBoundingClientRect();
    return { band: { w: r.width, h: r.height }, video: { w: v.videoWidth, h: v.videoHeight } };
  });
  expect(video.w / video.h, 'the clips are 4:1').toBeCloseTo(4, 1);
  // The band is the clip's own shape: no flat tint on either side of it.
  expect(Math.abs(band.w - band.h * (video.w / video.h)), 'the band is wider than the clip it holds').toBeLessThanOrEqual(2);
});

for (const width of [390, 1280]) {
  test(`at ${width} the landing gallery's rooms are not boxed`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/index.html');
    const borders = await page.$$eval('#space-groups .space-group', (els) => els.map((el) => getComputedStyle(el).borderTopWidth));
    expect(borders.length).toBeGreaterThan(2);
    for (const b of borders) expect(b).toBe('0px');
  });
}
