import { test, expect } from 'playwright/test';

/* A real plan told a user with buying intent that "5 selected organizers do not
   fit the available matching shelves. Increase width, reduce quantity, or
   choose a smaller product."

   Almost none of that was true. matchingNeed returns the single best-scoring
   need for a row, so when several needs share a targetZone — "Middle shelf" for
   a turntable, a can riser and two airtight containers — the first one
   encountered won every tie on every row, and the rest could never be placed
   anywhere. Not on a wider shelf, not with a smaller product.

   And the warning counted only needs some row had already claimed, so the
   products that failed hardest were the ones it stayed silent about. On the
   sample plan: 10 purchased units, 4 drawn, 2 admitted to. */

const VISUAL_TYPES = ['clear-bin', 'airtight-container', 'basket', 'drawer-organizer',
  'turntable', 'can-riser', 'shelf-riser', 'door-rack', 'hook-rack'];

async function openViewer(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#v3d-layouts .v3d-chip').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
}

async function readScene(page) {
  return page.evaluate(async (visualTypes) => {
    const { activeProductNeeds } = await import('/js/plan.js');
    const needs = activeProductNeeds() || [];
    const chips = [...document.querySelectorAll('#v3d-organizer-list .v3d-organizer-chip')];
    const shown = chips.reduce((sum, el) => {
      const m = el.textContent.trim().match(/^(\d+)\s*×/);
      return sum + (m ? Number(m[1]) : 1);
    }, 0);
    const note = document.getElementById('v3d-fit-note');
    const warned = note && !note.classList.contains('hide')
      ? Number((note.textContent.match(/^(\d+)/) || [])[1] || 0) : 0;
    return {
      visualOnList: needs.filter(n => visualTypes.includes(n.type))
        .reduce((sum, n) => sum + Math.max(1, Number(n.qty) || 1), 0),
      nonVisualOnList: needs.filter(n => !visualTypes.includes(n.type)).length,
      shownTotal: shown,
      warned,
      types: needs.map(n => n.type),
    };
  }, VISUAL_TYPES);
}

test('needs that share a target zone are not shadowed by the first one', async ({ page }) => {
  /* The sample plan targets three different products at "Middle shelf". Under
     winner-take-all only one of them could ever appear, whatever the geometry. */
  await openViewer(page);
  const chips = await page.$$eval('#v3d-organizer-list .v3d-organizer-chip',
    els => els.map(e => e.getAttribute('data-type')));
  const distinct = new Set(chips);
  expect(distinct.size, `only ${distinct.size} organizer type(s) drawn: ${[...distinct].join(', ')}`)
    .toBeGreaterThan(1);
  // the turntable is the one that lost every tie before
  expect(chips, 'the turntable is still being shadowed').toContain('turntable');
});

test('a product with no shelf presence never raises a fit warning', async ({ page }) => {
  /* A label set and a safety latch are real purchases with nothing to draw.
     They are not unplaced, they are not placeable — and "your label set does
     not fit the shelf" is a sentence the app should never produce.

     Proved causally rather than by arithmetic: leave ONLY the non-visual
     product ticked, and there is nothing the view could fail to place. */
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  const nonVisual = await page.evaluate(async (visualTypes) => {
    const { activeProductNeeds } = await import('/js/plan.js');
    const needs = activeProductNeeds() || [];
    const keep = needs.findIndex(n => !visualTypes.includes(n.type));
    if (keep < 0) return -1;
    needs.forEach((_, i) => { if (i !== keep) window.toggleUpgrade(i); });
    return keep;
  }, VISUAL_TYPES);
  expect(nonVisual, 'sample plan has no non-visual product, so this proves nothing')
    .toBeGreaterThanOrEqual(0);

  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#v3d-layouts .v3d-chip').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('#v3d-fit-note')).toBeHidden();
});

test('the warning never claims more than the list contains', async ({ page }) => {
  await openViewer(page);
  const s = await readScene(page);
  expect(s.warned).toBeLessThanOrEqual(s.visualOnList);
});

test('the warning does not blame size for a placement problem', async ({ page }) => {
  await openViewer(page);
  const note = page.locator('#v3d-fit-note');
  if (await note.isVisible()) {
    const text = await note.textContent();
    /* The old copy said "choose a smaller product", which sends someone at a
       problem they do not have: the item was never too big, there was nowhere
       matching left to put it. */
    expect(text).not.toMatch(/smaller product/i);
    expect(text).toMatch(/no spot|full/i);
  }
});
