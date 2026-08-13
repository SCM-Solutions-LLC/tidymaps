import { test, expect } from 'playwright/test';

/* The 3D view opened with ten range sliders on screen: width, depth, height,
   shelf count, and one per shelf. Every one of them is a fine adjustment to a
   number the plan already worked out, and meeting them all at once made a
   preview look like a job of work — the opposite of what the view is for.

   Two tiers now. The choices that change what the picture IS stay in front;
   the numbers sit behind one disclosure that still shows the size on its face,
   so nothing is hidden, only folded. */

async function openViewer(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#v3d-layouts .v3d-chip').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
}

/* checkVisibility(), not offsetParent: a closed <details> hides its content
   with content-visibility rather than display, so its children keep an
   offsetParent while being unrendered and unreachable. */
const visibleSliders = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#screen-viewer3d input[type=range]')]
    .filter(el => el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }))
    .map(el => el.id || 'shelf-height-' + el.dataset.shelfHeight));

test('the panel opens with a handful of controls, not a workbench', async ({ page }) => {
  await openViewer(page);
  const shown = await visibleSliders(page);
  expect(shown, `sliders on arrival: ${shown.join(', ')}`).toEqual(['v3d-shelf-count']);
  await expect(page.locator('#v3d-advanced')).not.toHaveAttribute('open', /.*/);
});

test('the choices that change the shape are still in front', async ({ page }) => {
  /* Folding is only an improvement if the things worth deciding survive it.
     Layout and level count are the two answers that redraw the model. */
  await openViewer(page);
  await expect(page.locator('#v3d-layouts .v3d-chip').first()).toBeVisible();
  await expect(page.locator('#v3d-shelf-count')).toBeVisible();
  await expect(page.locator('#v3d-shelf-count-label')).toBeVisible();
});

test('the size is readable without opening anything', async ({ page }) => {
  /* Hiding the sliders must not hide their answer: someone who came to check
     the scale should not have to open a drawer to find it. */
  await openViewer(page);
  const size = (await page.locator('#v3d-adv-size').textContent()).trim();
  expect(size, 'the closed disclosure shows no size at all').toMatch(/\d/);
  expect(size).toMatch(/w .* d .* h/);
});

test('opening it gives back every control that was folded away', async ({ page }) => {
  await openViewer(page);
  await page.locator('#v3d-advanced > summary').click();
  await page.waitForTimeout(300);
  for (const id of ['v3d-w', 'v3d-d', 'v3d-h', 'v3d-even-shelves']) {
    await expect(page.locator('#' + id)).toBeVisible();
  }
  await expect(page.locator('#v3d-shelf-heights [data-shelf-height]').first()).toBeVisible();
});

test('the summary size follows the sliders', async ({ page }) => {
  /* A stale headline is worse than none — it would report a size the model is
     no longer drawn at. */
  await openViewer(page);
  const before = await page.locator('#v3d-adv-size').textContent();
  await page.locator('#v3d-advanced > summary').click();
  const width = page.locator('#v3d-w');
  await width.fill(String(Number(await width.inputValue()) + 18));
  await width.dispatchEvent('input');
  await page.waitForTimeout(400);
  expect(await page.locator('#v3d-adv-size').textContent()).not.toBe(before);
});

test('a metric reader is not shown feet and inches', async ({ page }) => {
  /* The viewer carried its own feet-and-inches formatter, so the one screen
     that never asks about units ignored the answer given in the wizard. */
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.setItem('tidymap_units', 'metric'));
  await openViewer(page);
  await page.locator('#v3d-advanced > summary').click();
  await page.waitForTimeout(300);
  const text = await page.locator('.v3d-adv-body, #v3d-adv-size').allTextContents();
  const joined = text.join(' ');
  expect(joined, 'imperial marks in a metric view').not.toMatch(/[′″]/);
  expect(joined).toMatch(/cm/);
});
