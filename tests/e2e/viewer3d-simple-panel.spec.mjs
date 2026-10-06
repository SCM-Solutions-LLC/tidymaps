import { test, expect } from 'playwright/test';
import { openViewer, openAdjust } from './helpers.mjs';

/* The 3D view opened with ten range sliders on screen: width, depth, height,
   shelf count, and one per shelf. Every one of them is a fine adjustment to a
   number the plan already worked out, and meeting them all at once made a
   preview look like a job of work, the opposite of what the view is for.

   Two tiers, and now two panels. View is what the drawing shows: the zones,
   the organizers, the size it is drawn at. Adjust is what changes it: the
   layout chips, the count, and behind one disclosure the exact sizes. A
   reader arrives on View and meets no control at all; the disclosure still
   shows the size on its face, so nothing is hidden, only folded. */

/* checkVisibility(), not offsetParent: a closed <details> hides its content
   with content-visibility rather than display, so its children keep an
   offsetParent while being unrendered and unreachable. */
const visibleSliders = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#screen-viewer3d input[type=range]')]
    .filter(el => el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }))
    .map(el => el.id || 'shelf-height-' + el.dataset.shelfHeight));

const visibleChips = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#screen-viewer3d .v3d-chip')]
    .filter(el => el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }))
    .map(el => el.textContent.trim()));

test('the panel opens on View, with no slider and no chip in sight', async ({ page }) => {
  await openViewer(page);
  await page.waitForTimeout(800);
  const sliders = await visibleSliders(page);
  expect(sliders, `sliders on arrival: ${sliders.join(', ')}`).toEqual([]);
  const chips = await visibleChips(page);
  expect(chips, `chips on arrival: ${chips.join(', ')}`).toEqual([]);
  await expect(page.locator('#v3d-tab-view')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#v3d-panel-adjust')).toBeHidden();
});

test('Adjust holds a handful of controls, not a workbench', async ({ page }) => {
  /* Folding is only an improvement if the things worth deciding survive it.
     Layout and level count are the two answers that redraw the model; they
     are in front the moment Adjust opens, and the sizes stay folded. */
  await openViewer(page, { adjust: true });
  await page.waitForTimeout(300);
  const shown = await visibleSliders(page);
  expect(shown, `sliders under Adjust: ${shown.join(', ')}`).toEqual(['v3d-shelf-count']);
  await expect(page.locator('#v3d-layouts .v3d-chip').first()).toBeVisible();
  await expect(page.locator('#v3d-shelf-count')).toBeVisible();
  await expect(page.locator('#v3d-shelf-count-label')).toBeVisible();
  await expect(page.locator('#v3d-advanced')).not.toHaveAttribute('open', /.*/);
});

test('the size is readable without opening anything', async ({ page }) => {
  /* Hiding the sliders must not hide their answer: someone who came to check
     the scale should not have to open a drawer, or a panel, to find it. View
     says it in a sentence; the closed disclosure under Adjust says it too. */
  await openViewer(page);
  const line = (await page.locator('#v3d-size-line').textContent()).trim();
  expect(line, 'View shows no size at all').toMatch(/\d/);
  expect(line).toMatch(/wide/);
  const size = (await page.locator('#v3d-adv-size').textContent()).trim();
  expect(size, 'the closed disclosure shows no size at all').toMatch(/\d/);
  expect(size).toMatch(/w .* d .* h/);
});

test('opening it gives back every control that was folded away', async ({ page }) => {
  await openViewer(page, { adjust: true });
  await page.locator('#v3d-advanced > summary').click();
  await page.waitForTimeout(300);
  for (const id of ['v3d-w', 'v3d-d', 'v3d-h', 'v3d-even-shelves']) {
    await expect(page.locator('#' + id)).toBeVisible();
  }
  await expect(page.locator('#v3d-shelf-heights [data-shelf-height]').first()).toBeVisible();
});

test('the summary size follows the sliders', async ({ page }) => {
  /* A stale headline is worse than none: it would report a size the model is
     no longer drawn at. Both headlines, since View has one too. */
  await openViewer(page, { adjust: true });
  const before = await page.locator('#v3d-adv-size').textContent();
  const lineBefore = await page.locator('#v3d-size-line').textContent();
  await page.locator('#v3d-advanced > summary').click();
  const width = page.locator('#v3d-w');
  await width.fill(String(Number(await width.inputValue()) + 18));
  await width.dispatchEvent('input');
  await page.waitForTimeout(400);
  expect(await page.locator('#v3d-adv-size').textContent()).not.toBe(before);
  expect(await page.locator('#v3d-size-line').textContent(), 'the size line in View went stale').not.toBe(lineBefore);
});

test('the column leaves room for a focus ring on its tabs and its first zone', async ({ page }) => {
  /* Above 880px the column clips what overflows it so the list can scroll
     under pinned tabs. A focus ring is drawn 2px outside its element with a
     2px offset, so a tab or a zone flush with the column's edge lost the
     ring on that side; the tabs sit 4px in and the scroller pads the same. */
  await page.setViewportSize({ width: 1280, height: 900 });
  await openViewer(page);
  const inset = await page.evaluate(() => {
    const column = document.getElementById('v3d-zone-sidebar').getBoundingClientRect();
    const tab = document.getElementById('v3d-tab-view').getBoundingClientRect();
    const first = document.querySelector('.v3d-zones-inner > *').getBoundingClientRect();
    return { tabTop: tab.top - column.top, tabLeft: tab.left - column.left, listLeft: first.left - column.left };
  });
  expect(inset.tabTop, 'the View tab is flush with the top of the column').toBeGreaterThanOrEqual(4);
  expect(inset.tabLeft, 'the View tab is flush with the left of the column').toBeGreaterThanOrEqual(4);
  expect(inset.listLeft, 'the list is flush with the left of the column').toBeGreaterThanOrEqual(4);
});

test('a metric reader is not shown feet and inches', async ({ page }) => {
  /* The viewer carried its own feet-and-inches formatter, so the one screen
     that never asks about units ignored the answer given in the wizard. */
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.setItem('tidymap_units', 'metric'));
  await openViewer(page);
  const line = await page.locator('#v3d-size-line').textContent();
  expect(line, 'imperial marks in the metric size line').not.toMatch(/[′″]/);
  expect(line).toMatch(/cm/);
  await openAdjust(page);
  await page.locator('#v3d-advanced > summary').click();
  await page.waitForTimeout(300);
  const text = await page.locator('.v3d-adv-body, #v3d-adv-size').allTextContents();
  const joined = text.join(' ');
  expect(joined, 'imperial marks in a metric view').not.toMatch(/[′″]/);
  expect(joined).toMatch(/cm/);
});
