import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';
import { WALKIN_PLAN, WALKIN_ROWS, mockAnalyzeSpace, driveWizardToReview, openViewer, openAdjust } from './helpers.mjs';

/* A walk-in used to be drawn with one shelf tier per plan row: a 12-row
   pantry became 12 boards stacked on every one of its three walls, and the
   rows were dealt onto the walls round-robin by their index, so the wall the
   plan named was ignored and the wall the report's tabs showed a row on was
   not the wall the drawing put it on.

   A room is one fitted system now. Every wall carries the same N boards at
   the same heights, N being the most rows any one wall holds; each row sits
   on one board of its own wall, spread top to bottom; and the wall is the
   one placementFor gives the report (js/three/roomBoards.js). The drawing
   is a canvas, so this reads the surfaces the scene built, which is where
   each of those decisions is made. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url));

// Boards per wall for the plan: the left and back walls carry five rows each.
const N = 5;

/* Every wall surface by the wall it is on. The back wall's slots run along
   x; a side wall's run along z, and its normal points into the aisle, so a
   normal toward +x is the left wall. The floor is not a wall. */
const wallSurfaces = (page) => page.evaluate(() => window.__v3dView.surfaces
  .filter((s) => s.kind !== 'floor')
  .map((s) => ({
    index: s.index,
    y: Math.round(s.y * 1000) / 1000,
    wall: Math.abs(s.uDir.x) > 0.9 ? 'back' : s.normal.x > 0 ? 'left' : 'right',
  })));

const distinct = (values) => [...new Set(values)];
const byIndex = (a, b) => a.index - b.index;

// The floor slab's top: a wall surface at this height is a row drawn on the floor.
const SLAB = 0.75;

/* The walk-in plan loaded straight into state, the way three-editor loads
   its demo: the first test proves the wizard path lands the same plan, and
   the rest of the file reads the drawing, so they need not pay for the
   wizard each time. `plan` is the fixture or a variation of it. */
async function openWalkIn(page, plan = WALKIN_PLAN, { adjust = false, setup = 'walkin' } = {}) {
  await page.goto('/index.html');
  await page.evaluate(async ({ ai, setup: card }) => {
    const [{ state }, { normalizeAi }] = await Promise.all([import('/js/state.js'), import('/js/plan.js')]);
    state.space = 'pantry'; state.setup = card; state.setupTouched = true;
    // shelves stays null, as the wizard leaves it: the plan's own count is the count.
    state.dims = { w_in: 72, h_in: 96, d_in: 72, shelves: null }; state.arrangement = null;
    state.ai = normalizeAi(ai);
    await window.openViewer3d();
  }, { ai: plan, setup });
  await page.locator('#v3d-canvas[data-layout]').waitFor({ state: 'attached', timeout: 20_000 });
  if (adjust) await openAdjust(page);
}

const wallHeadings = (page) => page.locator('#v3d-zone-list .v3d-wall-h').allTextContents();

/* The same plan with the wall on every row (the field the model writes
   since PR 4), so the walls survive a layout switch: an override replaces
   the plan's sections with one unplaced run, and the fixture's walls live in
   its sections. */
const WALLED = {
  ...WALKIN_PLAN,
  map: WALKIN_PLAN.map.map((row, i) => ({ ...row, wall: i < 5 ? 'left' : i < 10 ? 'back' : 'right' })),
};
// The same with the last row's wall unknown: one "Other" row among the placed ones.
const WALLED_BUT_ONE = {
  ...WALLED,
  map: WALLED.map.map((row, i) => (i === 11 ? (({ wall: _w, ...rest }) => rest)(row) : row)),
};

test('a 12-row walk-in draws the same five boards on every wall, each row on a board of its own wall', async ({ page }) => {
  await mockAnalyzeSpace(page, WALKIN_PLAN);
  await driveWizardToReview(page, { photo: PHOTO, setup: 'Walk-in', dims: ['6', '8', '6'] });
  await page.locator('#flow-next').click();          // review → build
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await openViewer(page, { sample: false });
  await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', 'walkin-u');

  const surfaces = await wallSurfaces(page);
  const left = surfaces.filter((s) => s.wall === 'left').sort(byIndex);
  const back = surfaces.filter((s) => s.wall === 'back').sort(byIndex);
  const right = surfaces.filter((s) => s.wall === 'right').sort(byIndex);

  // The wall the plan named, for every row: left 0-4, back 5-9, right 10-11.
  expect(left.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
  expect(back.map((s) => s.index)).toEqual([5, 6, 7, 8, 9]);
  expect(right.map((s) => s.index)).toEqual([10, 11]);

  /* The same N boards on every wall: the back wall's rows sit at no more
     than five heights, and the whole room uses no more than five, where the
     old drawing stacked twelve. */
  expect(distinct(back.map((s) => s.y)).length, `back wall heights: ${back.map((s) => s.y).join(', ')}`).toBeLessThanOrEqual(N);
  expect(distinct(surfaces.map((s) => s.y)).length, `heights in the room: ${distinct(surfaces.map((s) => s.y)).join(', ')}`).toBeLessThanOrEqual(N);

  // Tier 0 is the top board: the left wall's five rows step down in row order.
  for (let i = 1; i < left.length; i++) {
    expect(left[i].y, `row ${left[i].index} is not below row ${left[i - 1].index}`).toBeLessThan(left[i - 1].y);
  }

  // A two-row wall uses its top and bottom boards, the same boards the full wall uses.
  const leftYs = left.map((s) => s.y);
  expect(distinct(right.map((s) => s.y)).sort((a, b) => b - a)).toEqual([Math.max(...leftYs), Math.min(...leftYs)]);

  /* No wall row on the floor. A room's lowest board is a shelf above the
     slab (viewerOptions.roomShelfFracs); the even spread's last fraction
     snapped to the floor, so "Shelf 5" and "Shelf 10" were drawn on the
     slab beside the floor rows, and three boards read as two. */
  for (const s of surfaces) expect(s.y, `row ${s.index} is drawn on the floor slab`).toBeGreaterThan(SLAB + 1);

  // And the sidebar reads the same way: grouped by the three walls, in order.
  await expect(page.locator('#v3d-zones-h')).toContainText(new RegExp(`${WALKIN_ROWS} zones on 3 walls`));
  expect(await page.locator('#v3d-zone-list .v3d-wall-h').allTextContents()).toEqual(['Left wall', 'Back wall', 'Right wall']);

  /* The count slider cannot go below the fullest wall's five rows: fewer
     boards than rows would put two rows on one board with their items on
     top of each other. */
  await openAdjust(page);
  const count = page.locator('#v3d-shelf-count');
  await expect(count).toHaveValue(String(N));
  await expect(count).toHaveAttribute('min', String(N));
});

test('the heading counts the walls the drawing shelves, and the sub-line says the strays were spread', async ({ page }) => {
  /* Rows the plan did not place are drawn on the emptiest wall but listed
     under "Other", the honest heading. The heading describes the drawing,
     "on 3 walls", because that is where a hovered zone lights up; the list
     describes what the plan knew, two walls and two strays; and the line
     between them says so, so the two numbers do not disagree in silence. */
  const twoWalls = { ...WALKIN_PLAN, layout: { type: 'walkin-u', sections: WALKIN_PLAN.layout.sections.slice(0, 2) } };
  await openWalkIn(page, twoWalls);
  expect(await wallHeadings(page)).toEqual(['Left wall', 'Back wall', 'Other']);
  await expect(page.locator('#v3d-zones-h')).toHaveText(new RegExp(`${WALKIN_ROWS} zones on 3 walls`));
  await expect(page.locator('#v3d-zones-sub')).toContainText('the zones under Other');
  await expect(page.locator('#v3d-zones-sub')).not.toContainText('not drawn');
  const surfaces = await wallSurfaces(page);
  expect(surfaces.filter((s) => s.wall === 'right').map((s) => s.index)).toEqual([10, 11]);
});

test('an L lists one side wall, named for the side it is drawn on', async ({ page }) => {
  /* The L draws its short run on one side; a plan's left and right rows are
     both on it (roomBoards drawnWallFor). The list used to head them "Left
     wall" and "Right wall" as the report does, two headings for one run, and
     the heading counted three walls over a two-wall drawing. */
  await openWalkIn(page, WALLED_BUT_ONE, { adjust: true });
  await page.locator('#v3d-layouts [data-layout="l-run"]').click();
  await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', 'l-run', { timeout: 20_000 });
  await expect(page.locator('#v3d-zones-h')).toHaveText(new RegExp(`${WALKIN_ROWS} zones on 2 walls`));
  /* Nothing in the switched layout names a side, so the run is drawn on the
     right and listed after the back wall. The row with no wall keeps its
     own "Other" heading: the side run takes the left and right rows, not
     everything that is not the back wall. */
  expect(await wallHeadings(page)).toEqual(['Back wall', 'Right wall', 'Other']);
  await expect(page.locator('#v3d-zones-sub')).toContainText('the zones under Other');
  const zonesUnder = (heading) => page.evaluate((h) => {
    const out = [];
    let on = false;
    document.querySelectorAll('#v3d-zone-list .v3d-wall-h, #v3d-zone-list .v3d-zone-item').forEach((el) => {
      if (el.classList.contains('v3d-wall-h')) on = el.textContent.trim() === h;
      else if (on) out.push(el.textContent.trim());
    });
    return out.length;
  }, heading);
  expect(await zonesUnder('Right wall'), 'the side wall lists the left rows and the right rows together').toBe(6);
  expect(await zonesUnder('Back wall')).toBe(5);
  expect(await zonesUnder('Other')).toBe(1);

  // Moving the run to the left renames the heading and lists it first, the way the room reads from the doorway.
  await page.locator('#v3d-l-side-control [data-side="left"]').click();
  await expect(page.locator('#v3d-zone-list .v3d-wall-h').first()).toHaveText('Left wall', { timeout: 10_000 });
  expect(await wallHeadings(page)).toEqual(['Left wall', 'Back wall', 'Other']);
  expect(await zonesUnder('Left wall')).toBe(6);
  await expect(page.locator('#v3d-zones-h')).toHaveText(/on 2 walls/);
});

test('a room\'s board count is derived again for the next room', async ({ page }) => {
  /* A dragged size stamps the preview with the walk-in's five boards. The L
     puts the left and right rows on one side run, seven rows, so it needs
     seven boards; carried over, the five put two pairs of rows on shared
     boards with their items drawn on top of each other, and the slider's
     floor (the fullest wall, capped at the count) hid it. */
  await openWalkIn(page, WALLED, { adjust: true });
  const count = page.locator('#v3d-shelf-count');
  await expect(count).toHaveValue(String(N));
  await page.locator('#v3d-advanced > summary').click();
  const width = page.locator('#v3d-w');
  await width.fill(String(Number(await width.inputValue()) + 12));
  await width.dispatchEvent('input');
  await page.waitForTimeout(500);
  await page.locator('#v3d-layouts [data-layout="l-run"]').click();
  await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', 'l-run', { timeout: 20_000 });
  await expect(count, 'the walk-in\'s board count rode the preview into the L').toHaveValue('7');
  await expect(count).toHaveAttribute('min', '7');
  const side = (await wallSurfaces(page)).filter((s) => s.wall !== 'back');
  expect(side.length).toBe(7);
  expect(distinct(side.map((s) => s.y)).length, 'two side rows share a board').toBe(7);
});

test('a look at the walk-in does not change the cabinet\'s shelves', async ({ page }) => {
  /* The sizes a reader drags are kept across a layout switch. The level
     count is not the same kind of number on both sides: a room's is boards
     per wall, a unit's is its levels, one per plan row. The room's count
     used to ride the preview back into the cabinet and draw twelve rows on
     five shelves. The 12-row plan is opened as a cabinet, so the plan's
     count (12) is not the five a missing count defaults to. */
  await openWalkIn(page, WALKIN_PLAN, { adjust: true, setup: 'cabinet' });
  await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', 'cabinet');
  const count = page.locator('#v3d-shelf-count');
  const chip = (layout) => page.locator(`#v3d-layouts [data-layout="${layout}"]`);
  const drawn = (layout) => expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', layout, { timeout: 20_000 });
  await expect(count).toHaveValue(String(WALKIN_ROWS));

  // Untouched: the walk-in shows its five boards, the cabinet keeps the plan's twelve.
  await chip('walkin-u').click();
  await drawn('walkin-u');
  await expect(count).toHaveValue(String(N));
  await page.locator('#v3d-advanced > summary').click();
  const width = page.locator('#v3d-w');
  const wider = String(Number(await width.inputValue()) + 12);
  await width.fill(wider);
  await width.dispatchEvent('input');
  await page.waitForTimeout(500);
  await chip('cabinet').click();
  await drawn('cabinet');
  await expect(count, 'the room\'s board count leaked into the cabinet').toHaveValue(String(WALKIN_ROWS));
  await expect(page.locator('#v3d-w'), 'the width the reader dragged was lost').toHaveValue(wider);

  /* Adjusted: seven shelves set on the cabinet come back after the walk-in,
     not the plan's twelve and not the room's five. Before, the room's
     geometry overwrote the preview and the seven were gone, and Save after
     the round trip would have stored the plan's count over them. */
  await count.fill('7');
  await count.dispatchEvent('input');
  await page.waitForTimeout(500);
  await expect(page.locator('#v3d-shelf-heights [data-shelf-height]')).toHaveCount(7);
  await chip('walkin-u').click();
  await drawn('walkin-u');
  await expect(count).toHaveValue(String(N));
  await chip('cabinet').click();
  await drawn('cabinet');
  await expect(count, 'the cabinet\'s own count was lost on the way through the walk-in').toHaveValue('7');
  await expect(page.locator('#v3d-shelf-heights [data-shelf-height]')).toHaveCount(7);
});

test('a plan whose rows name no wall still shelves all three walls', async ({ page }) => {
  /* The sample pantry's rows say nothing about walls. Drawn as a walk-in,
     each goes to the wall with the fewest rows so far, so no wall stands
     empty beside a crowded one, and the heading counts the walls that carry
     rows rather than claiming the plan said where they go. */
  await openViewer(page, { adjust: true });
  await page.locator('#v3d-layouts [data-layout="walkin-u"]').click();
  await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', 'walkin-u', { timeout: 20_000 });
  await page.waitForTimeout(700);

  const surfaces = await wallSurfaces(page);
  expect(surfaces.length).toBeGreaterThan(2);
  expect(distinct(surfaces.map((s) => s.wall)).sort()).toEqual(['back', 'left', 'right']);
  // Still one set of boards for the room: no more heights than the slider says.
  const boards = Number(await page.locator('#v3d-shelf-count').inputValue());
  expect(distinct(surfaces.map((s) => s.y)).length).toBeLessThanOrEqual(boards);
  await expect(page.locator('#v3d-zones-h')).toContainText(/on 3 walls/);
  /* The sample's one door row and four unplaced rows list under "Door" and
     "Other"; neither is a drawn wall, and the sub-line says where each went. */
  expect(await wallHeadings(page)).toEqual(['Door', 'Other']);
  await expect(page.locator('#v3d-zones-sub')).toContainText('The door is not drawn');
  await expect(page.locator('#v3d-zones-sub')).toContainText('the zones under Other');
});
