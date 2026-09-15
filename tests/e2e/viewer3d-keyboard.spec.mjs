import { test, expect } from 'playwright/test';

/* The 3D drawing was a bare canvas: no role, no name, not focusable, and
   rearranging was drag-only, so from the keyboard it could be looked at and
   nothing in it moved. It is a named, focusable widget now, and the arrow keys
   choose and carry an item the way a pointer drags one, with each step read
   into a live region. */

async function openViewer(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#v3d-zone-list .v3d-zone-item').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('#v3d-canvas').focus();
}

const live = (page) => page.locator('#v3d-live').textContent();
const item = (page, name) => page.evaluate((n) => {
  const m = window.__v3dView.items.find((x) => x.userData.name === n);
  return m && { shelf: m.userData.shelfIndex, slot: m.userData.slot, label: !!(m.userData.label && m.userData.label.visible) };
}, name);
const named = (text) => /^(.+?), on /.exec(text)[1];

test('the drawing is a named, focusable widget with its keys explained', async ({ page }) => {
  await openViewer(page);
  const canvas = page.locator('#v3d-canvas');
  await expect(canvas).toHaveAttribute('role', 'application');
  await expect(canvas).toHaveAttribute('tabindex', '0');
  await expect(canvas).toHaveAttribute('aria-label', 'Three-dimensional drawing of the sample pantry');
  await expect(canvas).toHaveAttribute('aria-describedby', 'v3d-keys');
  await expect(page.locator('#v3d-keys')).toBeVisible();
  await expect(canvas).toBeFocused();
});

test('the arrow keys choose an item, show its label and say where it sits', async ({ page }) => {
  await openViewer(page);
  await page.keyboard.press('ArrowRight');
  const first = await live(page);
  expect(first).toMatch(/^.+, on .+, 1 of \d+\. Space picks it up\.$/);
  expect(await item(page, named(first)), 'the chosen item shows its label').toMatchObject({ label: true });
  await page.keyboard.press('ArrowRight');
  const second = await live(page);
  expect(second).toMatch(/, 2 of \d+\./);
  expect(await item(page, named(first)), 'the label follows the choice').toMatchObject({ label: false });
  await page.keyboard.press('ArrowLeft');
  expect(await live(page)).toBe(first);
});

test('Space, Down and Space carry an item to the shelf below, through the same drop as a drag', async ({ page }) => {
  await openViewer(page);
  await page.keyboard.press('ArrowRight');
  const name = named(await live(page));
  const before = await item(page, name);
  await page.keyboard.press('Space');
  expect(await live(page)).toMatch(new RegExp(`^Picked up ${name}\\.`));
  await page.keyboard.press('ArrowDown');
  expect(await live(page)).toMatch(new RegExp(`^${name} on .+, position \\d+ of \\d+\\.$`));
  await page.keyboard.press('Space');
  expect(await live(page)).toMatch(new RegExp(`^Put down ${name} on `));
  const after = await item(page, name);
  expect(after.shelf, 'the item moved down one shelf').toBe(before.shelf + 1);
  expect(after.label, 'the item stays chosen after the drop, so its label stays up').toBe(true);
  // The move counts as a change, the way a dragged one does.
  await expect(page.locator('#v3d-save')).toBeEnabled();
  const placed = await page.evaluate((n) => {
    const m = window.__v3dView.items.find((x) => x.userData.name === n);
    return window.__v3dView.placements().find((p) => p.itemId === m.userData.itemId);
  }, name);
  expect(placed.shelfIndex, 'the arrangement records the move').toBe(before.shelf + 1);
});

test('Escape puts a carried item back where it was', async ({ page }) => {
  await openViewer(page);
  await page.keyboard.press('ArrowRight');
  const name = named(await live(page));
  const before = await item(page, name);
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  expect((await item(page, name)).shelf).toBe(before.shelf + 1);
  await page.keyboard.press('Escape');
  expect(await live(page)).toMatch(/^Put back\. /);
  expect(await item(page, name)).toMatchObject({ shelf: before.shelf, slot: before.slot });
});

test('Left and Right move a carried item along its shelf, and the ends are named', async ({ page }) => {
  await openViewer(page);
  // A shelf with more than one item on it, so there is somewhere to move along.
  const crowded = await page.evaluate(() => {
    const byShelf = {};
    window.__v3dView.items.forEach((m) => { byShelf[m.userData.shelfIndex] = (byShelf[m.userData.shelfIndex] || 0) + 1; });
    return Object.entries(byShelf).find(([, n]) => n > 1);
  });
  expect(crowded, 'the sample has no shelf with two items').toBeTruthy();
  // Walk to the first item on that shelf.
  let text;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('ArrowRight');
    text = await live(page);
    const it = await item(page, named(text));
    if (it.shelf === Number(crowded[0]) && it.slot === 0) break;
  }
  const name = named(text);
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowLeft');
  expect(await live(page)).toMatch(/is already at the start of /);
  await page.keyboard.press('ArrowRight');
  expect(await live(page)).toMatch(new RegExp(`^${name} on .+, position 2 of \\d+\\.$`));
  expect((await item(page, name)).slot).toBe(1);
  await page.keyboard.press('Space');
  expect((await item(page, name)).slot).toBe(1);
});
