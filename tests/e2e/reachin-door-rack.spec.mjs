import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';
import { driveWizardToReview, mockAnalyzeSpace, expandChapters } from './helpers.mjs';

/* A reach-in pantry is drawn as shelves, and the honesty pass that keeps a
   report from describing fittings the drawing lacks read only the archetype.
   `shelves` has no door, so a reach-in plan's door rack came out as a "Front
   shelf", its over-the-door step and its door rack to buy were deleted, the
   summary's "back of the door" became "the wall beside it", and the 3D view
   drew the rack as one more board. A reach-in stands behind a door; the setup
   says so now (setupStructure.SETUP_SURFACES). */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url));

const row = (shelfIndex, level, surface, zone, icon = 'middle') => ({
  level, icon, zone, why: 'Placed where it is reached.', eye: shelfIndex === 1, shelfIndex,
  safety: { flag: null, why: null }, items: [{ name: zone, size: 's', flags: [] }], surface,
});

const PLAN = {
  spaceType: 'Reach-in pantry',
  summary: 'A reach-in pantry with three deep shelves. The back of the door is unused.',
  seenLayout: 'shelves',
  categories: ['Spices', 'Snacks'],
  map: [
    row(0, 'Top shelf', 'shelf', 'Bulk', 'up'),
    row(1, 'Eye level', 'shelf', 'Snacks', 'eye'),
    row(2, 'Lower shelf', 'shelf', 'Cans', 'down'),
    row(3, 'Door rack', 'door', 'Spices · Packets', 'door'),
  ],
  geometry: { unit: 'in', width: 30, height: 84, depth: 16, shelfCount: 4, estimated: false },
  layout: { type: 'shelves' },
  safetyNotes: [],
  productNeeds: [{ type: 'door-rack', qty: 1, purpose: 'Over-the-door rack for spices and packets.', targetZone: 'Door rack', priority: 'high' }],
  steps: [
    { task: 'Empty the shelves', time: '10 min', why: 'A clear shelf is easier to plan.' },
    { task: 'Hang an over-the-door rack for spices', time: '10 min', why: 'Frees a whole shelf.' },
    { task: 'Group snacks at eye level', time: '10 min', why: 'One place to look.' },
    { task: 'Put backstock up top', time: '5 min', why: 'Daily items stay in reach.' },
    { task: 'Label the shelf fronts', time: '10 min', why: 'Everyone can put things back.' },
    { task: 'Set a restock spot', time: '5 min', why: 'You see gaps before you shop.' },
  ],
  time: '45-60 min',
  cost: '$0 / $30',
};

test("a reach-in plan keeps its door rack in the report and hangs it on the door in 3D", async ({ page }) => {
  await mockAnalyzeSpace(page, PLAN);
  await driveWizardToReview(page, { photo: PHOTO, setup: 'Reach-in', dims: ['2.5', '7', '1.33'] });
  await page.locator('#flow-next').click();          // review → build
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 30_000 });
  await expandChapters(page);

  const text = await page.evaluate(() => document.body.innerText);
  expect(text).toContain('Door rack');
  expect(text).not.toContain('Front shelf');
  expect(text).toContain('Hang an over-the-door rack for spices');
  expect(text).toContain('The back of the door is unused.');
  const ai = await page.evaluate(async () => (await import('/js/state.js')).state.ai);
  expect(ai.map.find((r) => r.lv === 'Door rack').surface).toBe('door');

  await page.evaluate(() => window.openViewer3d());
  await page.locator('#v3d-canvas[data-layout="shelves"]').waitFor({ state: 'attached', timeout: 20_000 });
  await expect(page.locator('#v3d-zones-h')).toHaveText('4 zones: 3 shelves, 1 on the door');
});

/* A reach-in closet is drawn as a closet rod, and its door is where an
   over-the-door shoe rack hangs. The rack was a shelf board over the clothes.
   The heading counts the rest as "inside": a closet's zones are a shelf, a
   rod and a floor, not shelves. A wardrobe has no such door here. */
test("a reach-in closet's shoe rack hangs on its door; a wardrobe's stays inside", async ({ page }) => {
  const headings = {};
  for (const setup of ['reachinC', 'wardrobe']) {
    // A fresh page each time: the second build would otherwise be read off
    // the first one's canvas, which already says closet-rod.
    await page.goto('/index.html');
    await page.evaluate(async (setup) => {
      const [{ state }, { normalizeAi }, { enforceArchetypeHonesty }] = await Promise.all([
        import('/js/state.js'), import('/js/plan.js'), import('/js/setupStructure.js'),
      ]);
      const r = (shelfIndex, level, surface, zone) => ({
        level, icon: 'middle', zone, why: 'Placed where it is reached.', eye: false, shelfIndex,
        safety: { flag: null, why: null }, items: [{ name: zone, size: 'm', flags: [] }], surface,
      });
      const plan = {
        spaceType: 'Reach-in closet', summary: 'A reach-in closet.', categories: ['Shoes'],
        map: [r(0, 'Top shelf', 'shelf', 'Sweaters'), r(1, 'Hanging rod', 'rod', 'Shirts'),
          r(2, 'Floor', 'floor', 'Boots'), r(3, 'Door rack', 'door', 'Shoes')],
        geometry: { unit: 'in', width: 48, height: 96, depth: 24, shelfCount: 4 },
        layout: { type: 'closet-rod' }, safetyNotes: [], productNeeds: [],
        steps: [{ task: 'Hang a shoe rack on the door', time: '10 min', why: 'Frees the floor.' }],
        time: '30 min', cost: '$0',
      };
      enforceArchetypeHonesty(plan, 'closet-rod', setup);
      state.space = 'closet'; state.setup = setup; state.setupTouched = true;
      state.styles = []; state.prefs = new Set(); state.dims = { w_in: 48, h_in: 96, d_in: 24 };
      state.ai = normalizeAi(plan);
      await window.openViewer3d();
    }, setup);
    await page.locator('#v3d-canvas[data-layout="closet-rod"]').waitFor({ state: 'attached', timeout: 20_000 });
    headings[setup] = await page.locator('#v3d-zones-h').innerText();
  }
  expect(headings.reachinC).toBe('4 zones: 3 inside, 1 on the door');
  expect(headings.wardrobe).not.toContain('on the door');
});
