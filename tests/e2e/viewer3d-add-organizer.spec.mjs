import { test, expect } from 'playwright/test';
import { expandChapters, openViewer, openAdjust, WALKIN_PLAN } from './helpers.mjs';

/* Adding an organizer in the 3D view is a PURCHASE, not a sketch: it goes on
   the shopping list and into the cost.

   Which makes attribution the thing to get right. Everything else in that list
   is what the model recommended from the photos; an item the user asked for
   must not wear the same badge, or the plan is taking credit for their idea and
   they have no way to tell the two apart when they come back to it. */

async function openPlan(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

/* The add control is a change to the plan, so it lives under the Adjust tab
   with the other changes; the sample is already open, so the viewer alone. */
async function openAdd(page) {
  await openViewer(page, { sample: false, adjust: true });
}

const costText = (page) => page.locator('#kpi-cost').textContent();

test('adding an organizer puts it on the list and in the cost', async ({ page }) => {
  await openPlan(page);
  const before = await costText(page);
  const beforeCount = await page.locator('#res-upgrades .prod').count();

  await openAdd(page);
  const add = page.locator('#v3d-add-organizer');
  await expect(add).toBeVisible();
  await page.selectOption('#v3d-add-type', 'turntable');
  await page.selectOption('#v3d-add-level', { index: 0 });
  await page.locator('#v3d-add-btn').click();
  await page.waitForTimeout(600);

  await page.evaluate(() => window.go('results'));
  await expandChapters(page);

  const afterCount = await page.locator('#res-upgrades .prod').count();
  expect(afterCount, 'the added organizer did not reach the shopping list').toBe(beforeCount + 1);

  const after = await costText(page);
  expect(after, `cost did not move: ${before} -> ${after}`).not.toBe(before);
});

test('an item the user added is not labelled as recommended', async ({ page }) => {
  await openPlan(page);
  await openAdd(page);
  await page.selectOption('#v3d-add-type', 'basket');
  await page.locator('#v3d-add-btn').click();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.go('results'));
  await expandChapters(page);

  const card = page.locator('#res-upgrades .prod', { hasText: 'Basket' }).last();
  await expect(card).toContainText('you added this');
  expect(await card.textContent()).not.toMatch(/recommended/i);
});

test('the added need survives a re-normalize of the plan', async ({ page }) => {
  /* A saved plan is run back through normalizeAi when it loads, and that
     function is a whitelist — a field it does not name is dropped. `observed`
     and `cite` were both lost that way before. */
  await openPlan(page);
  await openAdd(page);
  await page.selectOption('#v3d-add-type', 'clear-bin');
  await page.locator('#v3d-add-btn').click();
  await page.waitForTimeout(600);

  const survives = await page.evaluate(async () => {
    const { normalizeAi } = await import('/js/plan.js');
    const { state } = await import('/js/state.js');
    const again = normalizeAi(state.ai);
    return (again.productNeeds || []).some(n => n.addedByUser === true);
  });
  expect(survives, 'addedByUser was dropped when the plan was re-normalized').toBe(true);
});

test('a "use what I have" plan offers no way to add a purchase', async ({ page }) => {
  /* Same gate as the organizer panel above it. Someone who asked to use only
     what they own should not be handed a shortcut to a shopping list. */
  await openPlan(page);
  await page.evaluate(() => { window.setUpgrades(false); });
  await openAdd(page);
  await expect(page.locator('#v3d-add-organizer')).toBeHidden();
});

test('an added organizer is sized by the space over its row, the one the card judges', async ({ page }) => {
  /* maxDims.h_in is printed on the card ("Max 29w × 17h × 14d") and in the
     exported list ("must fit"), so it is a number someone shops by. It was
     read from the compartment BELOW the row: the sample's top shelf, about 5
     inches under the top panel, said 17, and its lower shelf said 14 under
     16. The card's own row check (js/catalog.js headroomFor) is the answer
     key, so the two cannot drift apart again. */
  await openPlan(page);
  await openAdd(page);
  const rows = await page.evaluate(async () => {
    const { activeMapV2 } = await import('/js/plan.js');
    return activeMapV2().map((row, i) => ({ i, lv: row.lv, surface: row.surface }))
      .filter((row) => row.surface === 'shelf');
  });
  expect(rows.length, 'the sample has no shelf rows to add to').toBeGreaterThan(2);
  for (const row of rows) {
    await page.selectOption('#v3d-add-type', 'clear-bin');
    await page.selectOption('#v3d-add-level', { index: row.i });
    await page.locator('#v3d-add-btn').click();
    await page.waitForTimeout(300);
  }
  const checks = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const { activeMapV2 } = await import('/js/plan.js');
    const { currentArchetype } = await import('/js/catalog.js');
    const { rowHeadroomFor, arrangementGeometryFor } = await import('/js/three/roomBoards.js');
    const geometry = arrangementGeometryFor(state.arrangement, false) || state.ai.geometry;
    const map = activeMapV2();
    return state.ai.productNeeds.filter((need) => need.addedByUser).map((need) => {
      const row = map.find((r) => r.lv === need.targetZone);
      return {
        zone: need.targetZone,
        h: need.maxDims.h_in,
        headroom: rowHeadroomFor(currentArchetype(), 'shelf', geometry, row.shelfIndex),
      };
    });
  });
  expect(checks.length).toBe(rows.length);
  for (const { zone, h, headroom } of checks) {
    expect(headroom, `the card cannot read the ${zone}'s headroom`).not.toBeNull();
    expect(h, `${zone}: added at ${h} in. under ${headroom.toFixed(2)} in. of headroom`)
      .toBeLessThanOrEqual(headroom + 1e-6);
    expect(h, `${zone}: added at ${h} in. under ${headroom.toFixed(2)} in. of headroom`)
      .toBeGreaterThan(headroom - 1);
  }
});

/* A room's floor is drawn by its own rule, not a board's: the walk-in's
   across the room, the L's along its back run, each with the space up to the
   lowest board over it (js/three/roomBoards.js roomFloorRun). An organizer
   added to one fell through to the unit rule, which picks a board gap by row
   number, so its printed limit was one the scene did not draw: the walk-in
   drew its floor 10 inches high. The live floor surface is the answer key,
   read the way the scene judges a fit (its gap less a board), and the limit
   may not pass it: a room has no row check on the card to catch a printed
   "Max 21h" over a floor the scene clears to 20.9. */
const shelfRow = (i, extra = {}) => ({
  level: `Shelf ${i + 1}`, icon: 'up', zone: `Zone ${i + 1}`, why: 'Reachable from the doorway.',
  eye: false, shelfIndex: i, safety: { flag: null, why: null },
  items: [{ name: 'Canned goods', size: 'm', flags: [] }], surface: 'shelf', ...extra,
});
const floorRow = (i) => shelfRow(i, {
  level: 'Floor', icon: 'down', zone: 'Bulk', items: [{ name: 'Bulk rice', size: 'l', flags: [] }], surface: 'floor',
});
const ROOM_FLOORS = [
  {
    label: 'a walk-in floor', type: 'walkin-u', setup: 'walkin', dims: { w_in: 72, h_in: 96, d_in: 72 },
    plan: { ...WALKIN_PLAN, map: WALKIN_PLAN.map.map((row, i) => (i === 11 ? floorRow(i) : row)) },
  },
  {
    label: 'an L-shaped floor', type: 'l-run', setup: 'lshape', dims: { w_in: 72, h_in: 84, d_in: 60 },
    plan: {
      ...WALKIN_PLAN,
      map: [0, 1, 2, 3, 4, 5, 6].map((i) => shelfRow(i)).concat(floorRow(7)),
      geometry: { unit: 'in', width: 72, height: 84, depth: 60, shelfCount: 8, estimated: false },
      layout: {
        type: 'l-run',
        sections: [
          { id: 'back', label: 'Back wall', place: 'back', rows: [0, 1, 2, 3] },
          { id: 'right', label: 'Right wall', place: 'right', rows: [4, 5, 6] },
          { id: 'floor', label: 'Floor', place: 'floor', rows: [7] },
        ],
      },
    },
  },
  {
    /* The same L with its floor row filed under the side wall: a row whose
       surface is the floor is drawn on that run's floor all the same. */
    label: 'an L-shaped floor filed under its side wall', type: 'l-run', setup: 'lshape', dims: { w_in: 72, h_in: 84, d_in: 60 },
    plan: {
      ...WALKIN_PLAN,
      map: [0, 1, 2, 3, 4, 5, 6].map((i) => shelfRow(i)).concat(floorRow(7)),
      geometry: { unit: 'in', width: 72, height: 84, depth: 60, shelfCount: 8, estimated: false },
      layout: {
        type: 'l-run',
        sections: [
          { id: 'back', label: 'Back wall', place: 'back', rows: [0, 1, 2, 3] },
          { id: 'right', label: 'Right wall', place: 'right', rows: [4, 5, 6, 7] },
        ],
      },
    },
  },
];

for (const room of ROOM_FLOORS) {
  test(`an organizer added to ${room.label} is sized by the floor the scene draws`, async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(async ({ ai, setup, dims }) => {
      const [{ state }, { normalizeAi }] = await Promise.all([import('/js/state.js'), import('/js/plan.js')]);
      state.space = 'pantry'; state.setup = setup; state.setupTouched = true;
      state.dims = { ...dims, shelves: null }; state.arrangement = null;
      state.upgrades = true;
      state.ai = normalizeAi(ai);
      await window.openViewer3d();
    }, { ai: room.plan, setup: room.setup, dims: room.dims });
    await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', room.type, { timeout: 20_000 });
    await openAdjust(page);
    const floorAt = room.plan.map.length - 1;
    await page.selectOption('#v3d-add-type', 'basket');
    await page.selectOption('#v3d-add-level', String(floorAt));
    await page.locator('#v3d-add-btn').click();
    await page.waitForTimeout(600);

    const got = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const need = state.ai.productNeeds.find((n) => n.addedByUser);
      const floors = window.__v3dView.surfaces.filter((s) => s.kind === 'floor');
      return { zone: need.targetZone, max: need.maxDims, floors: floors.map((s) => ({ gap: s.gap, length: s.length })) };
    });
    expect(got.zone).toBe('Floor');
    expect(got.floors.length, 'the scene drew no floor row').toBe(1);
    const [{ gap, length }] = got.floors;
    const clearance = gap - 0.75;
    const { w_in: w, h_in: h } = got.max;
    expect(h, `added at ${h} in. high on a floor drawn with ${clearance.toFixed(2)} in. of headroom`)
      .toBeLessThanOrEqual(clearance + 1e-6);
    expect(h, `added at ${h} in. high on a floor drawn with ${clearance.toFixed(2)} in. of headroom`)
      .toBeGreaterThan(clearance - 1);
    expect(w, `added at ${w} in. wide on a floor drawn ${length.toFixed(2)} in. long`).toBeLessThanOrEqual(length);
    expect(w, `added at ${w} in. wide on a floor drawn ${length.toFixed(2)} in. long`).toBeGreaterThan(length - 2);
  });
}
