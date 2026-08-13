import { test, expect } from 'playwright/test';

/* The shelf controls were gated on layout.type === 'shelves'.

   Every archetype under js/three/layouts builds from the same `rows`, so every
   one of them has levels whose count and height a user can reasonably want to
   change. The gate meant a CABINET — a box whose entire content is shelves —
   offered no shelf count, no heights, and a "Space evenly" button that did
   nothing, because the listener bindings sat below an early return. Four of
   the five layouts a pantry can take were in that state, and the sliders left
   over from a previous layout stayed in the DOM, so the panel looked present
   and inert rather than absent.

   It also read wrong: "Shelves" sat in the layout-type row as a peer of
   "Walk-in", when a shelf is something a walk-in HAS. */

async function openViewer(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#v3d-layouts .v3d-chip').first()).toBeVisible({ timeout: 20_000 });
}

test('every layout type offers its level count and heights', async ({ page }) => {
  await openViewer(page);
  const layouts = await page.$$eval('#v3d-layouts .v3d-chip', els => els.map(e => e.dataset.layout));
  expect(layouts.length, 'no layout chips rendered').toBeGreaterThan(1);

  const missing = [];
  for (const layout of layouts) {
    await page.locator(`#v3d-layouts [data-layout="${layout}"]`).click();
    await page.waitForTimeout(700);
    const state = await page.evaluate(() => ({
      count: !!document.getElementById('v3d-shelf-count')?.offsetParent,
      evenBtn: !!document.getElementById('v3d-even-shelves')?.offsetParent,
      handler: !!document.getElementById('v3d-even-shelves')?.onclick,
      sliders: document.querySelectorAll('#v3d-shelf-heights [data-shelf-height]').length,
    }));
    if (!state.count || !state.evenBtn || !state.handler || !state.sliders) {
      missing.push(`${layout}: ${JSON.stringify(state)}`);
    }
  }
  expect(missing, `layouts without working level controls:\n${missing.join('\n')}`).toEqual([]);
});

test('the controls are named for the levels of the chosen layout', async ({ page }) => {
  /* "Number of shelves" on a drawer bank is the wrong noun, and the generic
     word is what made the layout row confusing in the first place. */
  await openViewer(page);
  const seen = {};
  for (const layout of await page.$$eval('#v3d-layouts .v3d-chip', els => els.map(e => e.dataset.layout))) {
    await page.locator(`#v3d-layouts [data-layout="${layout}"]`).click();
    await page.waitForTimeout(500);
    seen[layout] = (await page.locator('#v3d-shelf-count-label').textContent()).trim();
  }
  // a shelved layout says shelves; a walk-in's levels are zones
  expect(seen.shelves || '').toMatch(/shelves/i);
  if (seen['walkin-u']) expect(seen['walkin-u']).toMatch(/zones/i);
  if (seen['drawer-bank']) expect(seen['drawer-bank']).toMatch(/drawers/i);
});

test('"Space evenly" actually changes the shelf positions', async ({ page }) => {
  /* The button existed on the one layout that bound it, so "does it exist" is
     not the question — whether pressing it moves anything is. */
  await openViewer(page);
  await page.locator('#v3d-layouts [data-layout="shelves"]').click();
  await page.waitForTimeout(600);

  const sliders = page.locator('#v3d-shelf-heights [data-shelf-height]');
  await expect(sliders.first()).toBeVisible();

  // drag one shelf well away from even spacing
  const before = await sliders.nth(1).inputValue();
  await sliders.nth(1).fill(String(Math.max(3, Number(before) + 12)));
  await sliders.nth(1).dispatchEvent('input');
  await page.waitForTimeout(400);
  const moved = await sliders.nth(1).inputValue();
  expect(moved, 'the height slider did not take a new value').not.toBe(before);

  await page.locator('#v3d-even-shelves').click();
  await page.waitForTimeout(600);
  const after = await sliders.nth(1).inputValue();
  expect(after, '"Space evenly" left the moved shelf where it was').not.toBe(moved);
});
