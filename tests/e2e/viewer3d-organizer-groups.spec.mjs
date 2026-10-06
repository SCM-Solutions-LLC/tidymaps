import { test, expect } from 'playwright/test';
import { openViewer } from './helpers.mjs';

/* The organizer panel said "These match your plan. Quantity and spacing
   adjust to the measured space." over one list, and the list was built one
   organizer per ITEM. A plan whose style answer was woven baskets read
   "32 × Woven baskets", a bill for a look nobody was buying, beside the four
   clear bins that were.

   Three groups now, named for where each came from. What is on the shopping
   list is counted by quantity, because each is a thing to buy. What the plan
   says is already owned, and what is drawn only to match the style picked,
   are counted by the zones they appear in, because one per zone is what is
   drawn (js/three/organizerKinds.js groupOrganizers). */

async function openStyled(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  /* The sample answers no style question. "Woven baskets" is the answer that
     draws a basket on every shelf that could hold one (organizerSpecFor
     reads it out of state.styles), and the sample already shops. */
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    state.styles = ['Woven baskets'];
    state.upgrades = true;
  });
  await openViewer(page, { sample: false });
  await expect(page.locator('#v3d-organizer-list .v3d-organizer-chip').first()).toBeVisible({ timeout: 15_000 });
}

/* Each chip with the heading it sits under, in document order, whatever
   wraps the chips between one heading and the next. */
const chips = (page) => page.evaluate(() => {
  const out = [];
  let group = '';
  document.querySelectorAll('#v3d-organizer-list .v3d-org-h, #v3d-organizer-list .v3d-organizer-chip').forEach((el) => {
    if (el.classList.contains('v3d-org-h')) group = el.textContent.trim();
    else out.push({ group, type: el.dataset.type, text: el.textContent.trim().replace(/\s+/g, ' ') });
  });
  return out;
});

test('organizers are grouped by where they came from, and a style is counted in zones, not items', async ({ page }) => {
  await openStyled(page);
  const headings = await page.locator('#v3d-organizer-list .v3d-org-h').allTextContents();
  expect(headings).toContain('On your shopping list');
  expect(headings).toContain('Shown to match your style');

  const all = await chips(page);
  const shopping = all.filter((c) => c.group === 'On your shopping list');
  expect(shopping.length, 'the sample buys nothing').toBeGreaterThan(0);
  for (const c of shopping) expect(c.text, `shopping chip "${c.text}" is not a quantity`).toMatch(/^\d+ ×/);

  const style = all.filter((c) => c.group === 'Shown to match your style');
  const basket = style.find((c) => c.type === 'basket');
  expect(basket, `style chips: ${style.map((c) => c.text).join(' | ') || 'none'}`).toBeTruthy();
  expect(basket.text).toMatch(/in \d+ zones?/);
  const zones = Number(/in (\d+) zone/.exec(basket.text)[1]);

  /* The number is the rows a style basket is drawn on, read off the scene:
     not the baskets, and not the items they hold. */
  const scene = await page.evaluate(() => {
    const view = window.__v3dView;
    const rows = new Set();
    const rowOf = (o, data) => (Number.isInteger(data.shelfIndex)
      ? data.shelfIndex
      : (view.items.find((it) => it.userData.organizer === o) || { userData: {} }).userData.shelfIndex);
    const perRow = new Map();
    view.organizers.forEach((o) => {
      const data = o.userData || o;
      const spec = data.spec || {};
      const source = data.source || spec.source;
      if (source !== 'plan') perRow.set(rowOf(o, data), (perRow.get(rowOf(o, data)) || 0) + 1);
      if ((data.type || spec.type) !== 'basket' || source !== 'style') return;
      rows.add(rowOf(o, data));
    });
    return {
      styleRows: rows.size,
      items: view.items.length,
      repeatedRows: [...perRow].filter(([, n]) => n > 1).map(([row]) => row),
    };
  });
  /* One non-purchase organizer per row and no more (scene.js
     claimedRowOrganizers): a second basket on the same board is the old
     "32 ×" in another coat, and "in 4 zones" would be counting rows that
     each hold several. */
  expect(scene.repeatedRows, 'rows drawn with more than one non-purchase organizer').toEqual([]);
  const zoneRows = await page.locator('#v3d-zone-list .v3d-zone-item').count();
  expect(zones).toBe(scene.styleRows);
  expect(zones).toBeLessThanOrEqual(zoneRows);
  // "32 ×" was the item count; the sample has more items than zones, so the
  // comparison below means something.
  expect(scene.items).toBeGreaterThan(zoneRows);
  expect(zones).toBeLessThan(scene.items);
});

test('the panel no longer claims every organizer matches the plan', async ({ page }) => {
  await openStyled(page);
  await expect(page.locator('#screen-viewer3d')).not.toContainText('These match your plan');
});
