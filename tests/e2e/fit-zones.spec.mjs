import { test, expect } from 'playwright/test';
import { expandChapters } from './helpers.mjs';

/* A reach-in closet the owner ran on 2026-10-10 came back with three things
   wrong about where its products sat:

   - the 3D view said "1 selected organizer group does not fully fit" about a
     basket the card beside it badged "Fits": the card knew the need's own
     maxDims and nothing about the level the basket was drawn on;
   - a bin for the closet FLOOR was badged "Fits your 14" shelf depth" and
     searched for at 14 inches, in a closet 30 inches deep: the shelf's cap
     was applied to everything in a rod closet;
   - and the 3D view drew the shelf over the rod door to back wall, so a
     20-inch bin sat on it there while the card called it too big.

   The plan below is that closet: two shelf rows over the rods and a floor
   row, 60 by 96 by 30 inches. Every test seeds it and asks the card and the
   scene the same question. */
const PLAN = {
  spaceType: 'Closet',
  summary: 'A reach-in closet with a shelf over the rod.',
  categories: ['Hanging clothes', 'Folded clothes'],
  map: [
    { level: 'Upper shelf', icon: 'up', zone: 'Folded knits', why: 'Light and rarely needed.', eye: false, shelfIndex: 0, surface: 'shelf', safety: { flag: null, why: null }, items: [{ name: 'Sweaters', size: 'm', flags: [] }] },
    { level: 'Second shelf', icon: 'up', zone: 'Towels', why: 'Easy to lift down.', eye: false, shelfIndex: 1, surface: 'shelf', safety: { flag: null, why: null }, items: [{ name: 'Towels', size: 'm', flags: [] }] },
    { level: 'Main rod', icon: 'rod', zone: 'Dress shirts', why: 'Worn most.', eye: true, shelfIndex: 2, surface: 'rod', safety: { flag: null, why: null }, items: [{ name: 'Dress shirts', size: 'm', flags: [] }] },
    { level: 'Closet floor', icon: 'down', zone: 'Overflow bins', why: 'Heavy things stay low.', eye: false, shelfIndex: 3, surface: 'floor', safety: { flag: null, why: null }, items: [{ name: 'Spare bedding', size: 'l', flags: [] }] },
  ],
  layout: { type: 'closet-rod', sections: [] },
  geometry: { unit: 'in', width: 60, height: 96, depth: 30, shelfCount: 4, shelfYFracs: [0.1, 0.24, 0.42, 0.92], estimated: false },
  steps: [{ task: 'Empty the upper shelf', time: '10 min', why: 'Start clear.', rows: [0] }],
  productNeeds: [],
  time: '1 hour', cost: '$0',
};

async function seed(page, productNeeds) {
  await page.evaluate(async ({ plan, productNeeds }) => {
    const [{ state }, { normalizeAi }] = await Promise.all([import('/js/state.js'), import('/js/plan.js')]);
    state.space = 'closet';
    state.setup = 'reachinC'; state.setupTouched = true; state.setupLabel = 'Reach-in';
    state.dims = { w_in: 60, h_in: 96, d_in: 30, shelves: null };
    state.arrangement = null;
    state.upgrades = true;
    state.ai = normalizeAi({ ...plan, productNeeds });
    state.planMeta = { model: 'test', source: 'ai', analyzedAt: 0 };
    state.shopping = null;
  }, { plan: PLAN, productNeeds });
}

/* One product, one row: what the card says and what the scene says. The
   product is put on the shopping list the way a pick is (dims_in on the
   selection), so the scene draws it at its own size on the row its need
   names and judges it there. */
async function verdicts(page, { zone, type = 'basket', dims }) {
  return page.evaluate(async ({ zone, type, dims }) => {
    const [{ state }, { fitFor }, { go }, { disposeViewer3d }] = await Promise.all([
      import('/js/state.js'), import('/js/catalog.js'), import('/js/router.js'), import('/js/screens/viewer3d.js'),
    ]);
    const need = { type, qty: 1, purpose: 'Test pick', targetZone: zone, maxDims: { w_in: 40, h_in: 60, d_in: 29 }, priority: 'high' };
    state.ai.productNeeds = [need];
    const card = fitFor({ dims_in: dims }, need);
    state.shopping = [{ needIdx: 0, checked: true, qty: 1, type, productId: 'test-pick', name: 'Test pick', dims_in: dims, fit: card }];
    // openViewer3d keeps a scene it already has, so the last one goes first.
    go('results');
    disposeViewer3d();
    window.__v3dView = null;
    await window.openViewer3d();
    for (let i = 0; i < 100 && !(window.__v3dView && window.__v3dView.organizers.length); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const drawn = (window.__v3dView ? window.__v3dView.organizers : []).filter((o) => (o.userData.spec || {}).source === 'plan');
    return {
      card,
      drawn: drawn.length,
      row: drawn.length ? drawn[0].userData.shelfIndex : null,
      scene: drawn.length ? drawn.every((o) => o.userData.fits !== false) : null,
      layout: document.getElementById('v3d-canvas').dataset.layout,
    };
  }, { zone, type, dims });
}

test('the card and the 3D view give one verdict on height, either side of the row\'s headroom', async ({ page }) => {
  await page.goto('/index.html');
  await seed(page, []);
  const headroom = await page.evaluate(async () => {
    const [{ state }, { rowHeadroomFor }] = await Promise.all([import('/js/state.js'), import('/js/three/roomBoards.js')]);
    return [0, 1, 3].map((i) => rowHeadroomFor('closet-rod', state.ai.map[i].surface, state.ai.geometry, i));
  });
  // 96 x 0.1 = 9.6 inches from the top to the upper shelf: about 8 clear.
  expect(headroom[0]).toBeGreaterThan(7);
  expect(headroom[0]).toBeLessThan(9);

  for (const [zone, row, room] of [['Upper shelf', 0, headroom[0]], ['Second shelf', 1, headroom[1]], ['Closet floor', 3, headroom[2]]]) {
    for (const [h, fits] of [[room - 0.1, true], [room + 0.1, false], [3, true], [room + 4, false]]) {
      const v = await verdicts(page, { zone, dims: { w: 9, h, d: 9 } });
      expect(v.layout).toBe('closet-rod');
      expect(v.drawn, `${zone}: the pick is drawn`).toBeGreaterThan(0);
      expect(v.row, `${zone}: on the row its need names`).toBe(row);
      expect(v.scene, `${zone}, ${h.toFixed(2)}in tall under ${room.toFixed(2)}in: the 3D view`).toBe(fits);
      expect(v.card !== 'no-fit', `${zone}, ${h.toFixed(2)}in tall under ${room.toFixed(2)}in: the card says ${v.card}`).toBe(fits);
    }
  }
});

test('the card and the 3D view give one verdict on depth: 14 inches on the shelf, the closet on the floor', async ({ page }) => {
  await page.goto('/index.html');
  await seed(page, []);
  for (const [zone, d, fits] of [
    ['Upper shelf', 12, true], ['Upper shelf', 13.9, true], ['Upper shelf', 14.2, false], ['Upper shelf', 20, false],
    ['Closet floor', 12, true], ['Closet floor', 20, true], ['Closet floor', 28.5, true],
  ]) {
    const v = await verdicts(page, { zone, type: 'clear-bin', dims: { w: 9, h: 4, d } });
    expect(v.drawn, `${zone}: the pick is drawn`).toBeGreaterThan(0);
    expect(v.scene, `${zone}, ${d}in deep: the 3D view`).toBe(fits);
    expect(v.card !== 'no-fit', `${zone}, ${d}in deep: the card says ${v.card}`).toBe(fits);
  }
});

test('the shelf over the rod is drawn 14 inches deep at the back wall, and its contents sit on it', async ({ page }) => {
  await page.goto('/index.html');
  await seed(page, []);
  const drawn = await page.evaluate(async () => {
    await window.openViewer3d();
    for (let i = 0; i < 100 && !window.__v3dView; i++) await new Promise((r) => setTimeout(r, 50));
    const view = window.__v3dView;
    const surface = (i) => view.surfaces.find((s) => s.index === i);
    const item = (i) => view.items.find((m) => m.userData.shelfIndex === i);
    return {
      shelfDepth: surface(0).depth, floorDepth: surface(3).depth,
      shelfZ: surface(0).hitbox.position.z, floorZ: surface(3).hitbox.position.z,
      itemOnShelfZ: item(0).position.z, itemDepth: item(0).scale.z,
    };
  });
  expect(drawn.shelfDepth).toBe(14);
  expect(drawn.floorDepth).toBe(30);
  // The back wall's inner face is at -15 + 0.75; the board runs 14 inches forward of it.
  const back = -15 + 0.75;
  expect(drawn.shelfZ).toBeCloseTo(back + 7, 5);
  expect(drawn.floorZ).toBe(0);
  expect(drawn.itemOnShelfZ - drawn.itemDepth / 2, 'nothing on the shelf hangs behind the back wall').toBeGreaterThanOrEqual(back - 1e-6);
  expect(drawn.itemOnShelfZ + drawn.itemDepth / 2, 'or in front of the board').toBeLessThanOrEqual(back + 14 + 1e-6);
});

test('the report badges a floor pick against the floor and a shelf pick against the shelf', async ({ page }) => {
  await page.goto('/index.html');
  await seed(page, [
    { type: 'basket', qty: 2, purpose: 'Corral folded knits on the shelf', targetZone: 'Upper shelf', maxDims: { w_in: 16, h_in: 10, d_in: 13 }, priority: 'high' },
    { type: 'clear-bin', qty: 2, purpose: 'Hold folded overflow on the floor', targetZone: 'Closet floor', maxDims: { w_in: 18, h_in: 12, d_in: 25 }, priority: 'nice' },
  ]);
  await page.evaluate(async () => {
    const [{ loadCatalog }, { go }, { buildResults }] = await Promise.all([
      import('/js/catalog.js'), import('/js/router.js'), import('/js/screens/results.js'),
    ]);
    await loadCatalog();
    buildResults();
    go('results');
  });
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  await expandChapters(page);
  const cards = page.locator('#res-upgrades .prod');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText('Fits your 14" shelf depth');
  await expect(cards.nth(1)).toContainText('Fits your 30" floor depth');
  await expect(cards.nth(1)).not.toContainText('shelf depth');
  // The floor pick's "other options" search is capped by what the need asked
  // for, 25 inches, not by the shelf.
  const floorSearch = await cards.nth(1).locator('a[href*="amazon.com/s"]').first().getAttribute('href');
  expect(decodeURIComponent(floorSearch)).toContain('max 25 inch deep');
});

/* ---------- a room: the row its plan puts a pick on ----------

   The card had no row check for a walk-in or an L (rowHeadroomFor returned
   null for a room), so a floor pick was judged by its own maxDims while the
   scene judged it under the lowest shelf. The rows below are spread over
   the walls by the room plan; the floor row in the walk-in is filed under
   its right wall and drawn on the floor all the same. The answer key is the
   live scene's own surface for the row, its gap less the board over it, so
   neither side is checked against the other's arithmetic. */
const roomRow = (i, level, zone, surface = 'shelf') => ({
  level, icon: surface === 'floor' ? 'down' : 'up', zone, why: 'Reachable from the doorway.', eye: false,
  shelfIndex: i, surface, safety: { flag: null, why: null }, items: [{ name: 'Canned goods', size: 'm', flags: [] }],
});
const ROOMS = [
  {
    label: 'a walk-in', type: 'walkin-u', setup: 'walkin', dims: { w_in: 72, h_in: 96, d_in: 72, shelves: null },
    plan: {
      ...PLAN, spaceType: 'Pantry',
      map: [
        roomRow(0, 'Top left shelf', 'Paper towels'), roomRow(1, 'Low left shelf', 'Cereal'),
        roomRow(2, 'Top back shelf', 'Baking'), roomRow(3, 'Low back shelf', 'Soup'),
        roomRow(4, 'Top right shelf', 'Snacks'), roomRow(5, 'Floor', 'Bulk rice', 'floor'),
      ],
      layout: { type: 'walkin-u', sections: [
        { id: 'left', label: 'Left wall', place: 'left', rows: [0, 1] },
        { id: 'back', label: 'Back wall', place: 'back', rows: [2, 3] },
        { id: 'right', label: 'Right wall', place: 'right', rows: [4, 5] },
      ] },
      geometry: { unit: 'in', width: 72, height: 96, depth: 72, shelfCount: 6, estimated: false },
    },
    picks: [['Paper towels', 0], ['Cereal', 1], ['Bulk rice', 5]],
  },
  {
    label: 'an L', type: 'l-run', setup: 'lshape', dims: { w_in: 72, h_in: 84, d_in: 60, shelves: null },
    plan: {
      ...PLAN, spaceType: 'Pantry',
      map: [
        roomRow(0, 'Top back shelf', 'Paper towels'), roomRow(1, 'Low back shelf', 'Cereal'),
        roomRow(2, 'Top side shelf', 'Baking'), roomRow(3, 'Low side shelf', 'Soup'),
        roomRow(4, 'Floor', 'Bulk rice', 'floor'),
      ],
      layout: { type: 'l-run', sections: [
        { id: 'back', label: 'Back wall', place: 'back', rows: [0, 1] },
        { id: 'right', label: 'Right wall', place: 'right', rows: [2, 3] },
        { id: 'floor', label: 'Floor', place: 'floor', rows: [4] },
      ] },
      geometry: { unit: 'in', width: 72, height: 84, depth: 60, shelfCount: 5, estimated: false },
    },
    picks: [['Paper towels', 0], ['Soup', 3], ['Bulk rice', 4]],
  },
];

for (const room of ROOMS) {
  test(`the card and the 3D view give one verdict on height in ${room.label}, row by row`, async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(async ({ plan, setup, dims }) => {
      const [{ state }, { normalizeAi }] = await Promise.all([import('/js/state.js'), import('/js/plan.js')]);
      state.space = 'pantry';
      state.setup = setup; state.setupTouched = true;
      state.dims = dims;
      state.arrangement = null;
      state.upgrades = true;
      state.ai = normalizeAi(plan);
      state.planMeta = { model: 'test', source: 'ai', analyzedAt: 0 };
      state.shopping = null;
    }, { plan: room.plan, setup: room.setup, dims: room.dims });

    for (const [zone, row] of room.picks) {
      const first = await verdicts(page, { zone, dims: { w: 9, h: 3, d: 9 } });
      expect(first.layout).toBe(room.type);
      expect(first.row, `${zone}: on the row its need names`).toBe(row);
      const clearance = await page.evaluate((index) => {
        const surface = window.__v3dView.surfaces.find((s) => s.index === index);
        return surface.gap - 0.75;
      }, row);
      for (const [h, fits] of [[clearance - 0.1, true], [clearance + 0.1, false]]) {
        const v = await verdicts(page, { zone, dims: { w: 9, h, d: 9 } });
        expect(v.row, `${zone}: on the row its need names`).toBe(row);
        expect(v.scene, `${zone}, ${h.toFixed(2)}in tall under ${clearance.toFixed(2)}in: the 3D view`).toBe(fits);
        expect(v.card !== 'no-fit', `${zone}, ${h.toFixed(2)}in tall under ${clearance.toFixed(2)}in: the card says ${v.card}`).toBe(fits);
      }
    }
  });
}

/* ---------- the small things from the same day's runs ---------- */

/* The measure step's heading is built from the space's short name, and two of
   the nine are plural: "How big is your drawers?". */
test('the measure step asks about plural spaces in the plural', async ({ page }) => {
  for (const [area, heading] of [['drawers', 'How big are your drawers?'], ['cabinet', 'How big are your cabinets?'], ['closet', 'How big is your closet?']]) {
    await page.goto('/index.html');
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) { /* private mode */ } });
    await page.goto('/index.html');
    await page.locator('#screen-landing .btn-primary').first().click();
    await page.locator(`#space-cards .room-card[data-area="${area}"]`).first().click();
    await page.locator('#flow-next').click();
    await page.locator('#flow-next').click();
    await expect(page.locator('#screen-measure h1')).toHaveText(heading);
  }
});

/* Continue used to smooth-scroll to the top, and a smooth scroll only moves
   while the tab is being painted: driven from a tool, or in a covered window,
   it stopped part-way and the next step opened with its heading under the
   appbar. Read in the same task as the click, before any frame, so a scroll
   that still needs frames to arrive fails here every time. */
test('a step change lands at the top at once, not at the end of an animation', async ({ page }) => {
  await page.setViewportSize({ width: 1126, height: 669 });
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  const closet = page.locator('#space-cards .room-card[data-area="closet"]').first();
  await closet.scrollIntoViewIfNeeded();
  await closet.click();
  expect(await page.evaluate(() => window.scrollY), 'the closet card is below the fold').toBeGreaterThan(50);
  const after = await page.evaluate(() => {
    document.getElementById('flow-next').click();
    return { y: window.scrollY, screen: document.querySelector('.screen.active').id };
  });
  expect(after.screen).toBe('screen-setup');
  expect(after.y).toBe(0);
});

/* "Eye level" is a height. The model marks one row of every unit as its eye
   row, and a kitchen drawer plan came back with the top drawer tagged "Eye
   level". A drawer keeps the highlight and loses the words; a shelf keeps both. */
test('a drawer row is highlighted but never labelled "Eye level"', async ({ page }) => {
  await page.goto('/index.html');
  const marks = await page.evaluate(async (plan) => {
    const [{ state }, { normalizeAi }, { go }, { buildResults }] = await Promise.all([
      import('/js/state.js'), import('/js/plan.js'), import('/js/router.js'), import('/js/screens/results.js'),
    ]);
    const read = (rows) => {
      state.space = 'drawers'; state.setup = 'incounter'; state.setupTouched = true;
      state.arrangement = null; state.shopping = null; state.upgrades = false;
      state.ai = normalizeAi({ ...plan, map: rows, geometry: { ...plan.geometry, shelfCount: rows.length, shelfYFracs: rows.map((_, i) => 0.92 * (i + 1) / rows.length) } });
      state.planMeta = { model: 'test', source: 'ai', analyzedAt: 0 };
      buildResults();
      go('results');
      return [...document.querySelectorAll('#res-map .shelf')].map((el) => ({
        highlighted: el.classList.contains('eye'),
        words: /eye level/i.test(el.querySelector('.shelf-head').textContent),
      }));
    };
    const row = (level, shelfIndex, surface, eye) => ({ level, icon: surface === 'drawer' ? 'drawer' : 'up', zone: 'Daily things', why: 'Used most.', eye, shelfIndex, surface, safety: { flag: null, why: null }, items: [{ name: 'Utensils', size: 's', flags: [] }] });
    return {
      drawers: read([row('Top drawer', 0, 'drawer', true), row('Bottom drawer', 1, 'drawer', false)]),
      shelves: read([row('Middle shelf', 0, 'shelf', true), row('Bottom shelf', 1, 'shelf', false)]),
    };
  }, PLAN);
  expect(marks.drawers).toEqual([{ highlighted: true, words: false }, { highlighted: false, words: false }]);
  expect(marks.shelves).toEqual([{ highlighted: true, words: true }, { highlighted: false, words: false }]);
});
