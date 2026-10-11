import test from 'node:test';
import assert from 'node:assert/strict';
import { fitFor, fitBadge, shelfDepthFor, searchLinks, currentArchetype, targetRowFor } from '../js/catalog.js';
import { state } from '../js/state.js';

/* Fit verdicts must respect the TIGHTER of the two constraints: the need's
   own maxDims and the user's measured space. maxDims used to override a
   smaller measured depth outright — a scenario shipped with an 18″ maxDims
   put a 12.9″-deep tray on a 9″ shelf under a green "Fits your 9″ shelf
   depth" badge. */

test('measured space caps the fit on every axis, even when maxDims is larger', () => {
  state.dims = { w_in: 30, h_in: 30, d_in: 9, shelves: null };
  const need = { maxDims: { w_in: 12, h_in: 18, d_in: 18 } }; // stale scenario depth
  assert.equal(fitFor({ dims_in: { w: 10, h: 6, d: 12.9 } }, need), 'no-fit',
    'a product deeper than the measured shelf must never fit');
  assert.equal(fitFor({ dims_in: { w: 10, h: 6, d: 7 } }, need), 'fits');
});

test('without measurements, the need maxDims still governs alone', () => {
  state.dims = null;
  const need = { maxDims: { w_in: 12, h_in: 8, d_in: 14 } };
  assert.equal(fitFor({ dims_in: { w: 10, h: 6, d: 12 } }, need), 'fits');
  assert.equal(fitFor({ dims_in: { w: 14, h: 6, d: 12 } }, need), 'no-fit');
});

test('a product wider than the whole measured space is refused even with no maxDims', () => {
  state.dims = { w_in: 18, h_in: 40, d_in: 16, shelves: null };
  assert.equal(fitFor({ dims_in: { w: 22, h: 4, d: 12 } }, { maxDims: null }), 'no-fit');
});

test('nothing measurable at all stays unknown', () => {
  state.dims = null;
  assert.equal(fitFor({ dims_in: { w: 10, h: 6, d: 12 } }, { maxDims: null }), 'unknown');
});

/* Door racks and hook racks mount on a door, wall, or pegboard — outside the
   measured carcass. Capping them by the enclosure's width/height ruled out
   every wall-mounted rail wider than the shelf unit it hangs beside. */
test('wall/door-mounted needs are not bounded by the measured enclosure', () => {
  state.dims = { w_in: 36, h_in: 78, d_in: 18, shelves: null };
  const wideRail = { dims_in: { w: 41.75, h: 5, d: 3 } };
  for (const type of ['hook-rack', 'door-rack']) {
    assert.notEqual(fitFor(wideRail, { type, maxDims: null }), 'no-fit',
      `${type} is mounted outside the carcass; the enclosure must not veto it`);
  }
  // ...but an explicit maxDims on the need is still honoured.
  assert.equal(fitFor(wideRail, { type: 'hook-rack', maxDims: { w_in: 24, h_in: 8, d_in: 4 } }), 'no-fit');
});

test('everything that sits INSIDE the space is still capped by the measurement', () => {
  state.dims = { w_in: 36, h_in: 78, d_in: 18, shelves: null };
  assert.equal(fitFor({ dims_in: { w: 41, h: 5, d: 3 } }, { type: 'clear-bin', maxDims: null }), 'no-fit');
  state.dims = { w_in: 30, h_in: 30, d_in: 9, shelves: null };
  assert.equal(fitFor({ dims_in: { w: 10, h: 6, d: 12.9 } },
    { type: 'drawer-organizer', maxDims: { w_in: 12, h_in: 18, d_in: 18 } }), 'no-fit',
    'the original bug: a stale maxDims must not outrank a smaller measured depth');
});

/* A walk-in or L-shaped space is measured as a room: 72 inches of floor. Its
   shelving is 14 to 18 inches deep (the 3D builders and the server's
   usableShelfDepth agree on the formula), so judging a bin against the room
   called a 20-inch bin a fit and badged every product "Fits your 72" shelf
   depth", label sets included. */
test('a room-shaped space is measured as a room, but products sit on its shelves', () => {
  state.dims = { w_in: 72, h_in: 96, d_in: 72, shelves: null };
  state.setup = 'walkin';
  assert.ok(Math.abs(shelfDepthFor(state.dims, 'walkin') - 14.4) < 1e-9, 'a 72-inch walk-in has 14.4-inch shelving');
  const need = { type: 'clear-bin', maxDims: null };
  assert.equal(fitFor({ dims_in: { w: 10, h: 8, d: 20 } }, need), 'no-fit', 'a 20-inch bin does not fit 14-inch shelving');
  assert.equal(fitFor({ dims_in: { w: 10, h: 8, d: 12 } }, need), 'fits');
  assert.match(fitBadge('fits', 'clear-bin').txt, /14" shelf depth/, 'the badge names the shelf, not the room');
  assert.equal(fitBadge('fits', 'label-set').txt, '', 'a label set has no depth to fit');
  assert.equal(fitBadge('fits', 'safety-latch').txt, '', 'a latch screws to a door; a shelf depth means nothing for it');
  assert.ok(Math.abs(shelfDepthFor(state.dims, 'walkin-u') - 14.4) < 1e-9, 'an archetype is accepted in place of a setup id');

  // The whole of the builders' formula, term by term: the 18-inch cap, the
  // half-room term, the 8-inch floor and the L-run's own factor. A review
  // found the cap and the half-room term silently dropped by a stray edit.
  assert.equal(shelfDepthFor({ w_in: 120, h_in: 96, d_in: 120 }, 'walkin'), 18, 'a 10-foot walk-in still has 18-inch shelving, not 24');
  assert.equal(shelfDepthFor({ w_in: 24, h_in: 96, d_in: 24 }, 'walkin'), 12, 'a 2-foot room keeps half its depth for the aisle');
  assert.equal(shelfDepthFor({ w_in: 10, h_in: 96, d_in: 10 }, 'walkin'), 8, 'never shallower than 8 inches');
  assert.ok(Math.abs(shelfDepthFor({ w_in: 80, h_in: 96, d_in: 80 }, 'lshape') - 17.6) < 1e-9, 'an L-run uses its own factor');

  // The 3D builders draw a 4-foot walk-in with 14-inch shelves (their floor);
  // the matcher has to agree, or the plan's pick is flagged in its own view.
  assert.equal(shelfDepthFor({ w_in: 48, h_in: 96, d_in: 48 }, 'walkinL'), 14, 'the builders\' 14-inch floor is missing');
  state.setup = 'walkinL';
  state.dims = { w_in: 48, h_in: 96, d_in: 48, shelves: null };
  assert.equal(fitFor({ dims_in: { w: 6.3, h: 5.3, d: 13.6 } }, { type: 'basket', maxDims: null }), 'fits',
    'depth is yes or no, as in the 3D view: a basket that fills the shelf is not "tight"');
  assert.equal(fitFor({ dims_in: { w: 6.3, h: 5.3, d: 14.2 } }, { type: 'basket', maxDims: null }), 'no-fit');

  state.setup = 'cabinet';
  state.dims = { w_in: 36, h_in: 78, d_in: 18, shelves: null };
  assert.equal(shelfDepthFor(state.dims, 'cabinet'), 18, 'a cabinet\'s measured depth is its shelf depth');
  assert.match(fitBadge('fits', 'clear-bin').txt, /18" shelf depth/);
});

/* The card and the 3D view have to judge the same bin against the same
   shelf. The wizard preselects a cabinet for every area and most people leave
   it, so when the photos show a walk-in the viewer draws 14-inch shelving
   (resolveLayout) while a fit keyed on state.setup still used the room's 72
   inches: a 20-inch bin "fit", the badge said 72, and the viewer flagged it. */
test('the shelf depth follows the layout the 3D view draws, not the preselected setup', () => {
  state.space = 'pantry';
  state.setup = 'cabinet'; state.setupTouched = false;
  state.dims = { w_in: 72, h_in: 96, d_in: 72, shelves: null };
  state.ai = { layout: { type: 'walkin-u', sections: [] }, map: [] };
  state.planMeta = { model: 'test', source: 'ai', analyzedAt: 0 };
  state.arrangement = null;
  try {
    assert.equal(currentArchetype(), 'walkin-u');
    const need = { type: 'clear-bin', maxDims: null };
    assert.equal(fitFor({ dims_in: { w: 10, h: 8, d: 20 } }, need), 'no-fit', 'a 20-inch bin is judged against the walk-in shelving the viewer draws');
    assert.match(fitBadge('fits', 'clear-bin').txt, /14" shelf depth/);
    assert.match(searchLinks(need)[0].url, /max%2014%20inch%20deep/);

    // A setup the user actually picked outranks the photos, in the viewer and so here.
    state.setup = 'walkin'; state.setupTouched = true;
    state.ai = { layout: { type: 'shelves', sections: [] }, map: [] };
    assert.equal(currentArchetype(), 'walkin-u', 'their own choice of a walk-in wins over photos that read as shelving');
    assert.equal(fitFor({ dims_in: { w: 10, h: 8, d: 20 } }, need), 'no-fit');

    // A layout picked in the 3D view outranks everything there, and so here.
    state.arrangement = { layoutOverride: 'shelves' };
    assert.equal(currentArchetype(), 'shelves');
    assert.equal(fitFor({ dims_in: { w: 10, h: 8, d: 20 } }, need), 'fits', 'open shelving is as deep as it was measured');
    assert.match(fitBadge('fits', 'clear-bin').txt, /72" shelf depth/);
  } finally {
    state.ai = null; state.planMeta = null; state.arrangement = null;
    state.setup = 'cabinet'; state.setupTouched = false;
  }
});

/* A reach-in closet is measured door to back wall, and most of that is
   hanging space: the shelf over the rod is 12 to 16 inches deep. A 2026-10-10
   test run on a 30-inch reach-in badged its picks "Fits your 30" shelf depth"
   and would have let a 20-inch bin through. */
test('a closet with a hanging rod is judged by the shelf over the rod, not the closet', () => {
  state.space = 'closet';
  state.setup = 'reachinC'; state.setupTouched = true;
  state.dims = { w_in: 60, h_in: 96, d_in: 30, shelves: null };
  try {
    assert.equal(currentArchetype(), 'closet-rod');
    assert.equal(shelfDepthFor(state.dims, 'reachinC'), 14, 'a 30-inch reach-in has a 14-inch shelf');
    assert.equal(shelfDepthFor(state.dims, 'closet-rod'), 14, 'an archetype is accepted in place of a setup id');
    assert.equal(shelfDepthFor(state.dims, 'wardrobe'), 14, 'a wardrobe is the same closet-rod layout');
    assert.equal(shelfDepthFor({ w_in: 36, h_in: 84, d_in: 12 }, 'reachinC'), 12, 'a closet shallower than the shelf keeps its own depth');
    const need = { type: 'clear-bin', maxDims: null };
    assert.equal(fitFor({ dims_in: { w: 12, h: 8, d: 20 } }, need), 'no-fit', 'a 20-inch bin does not fit the shelf over the rod');
    assert.equal(fitFor({ dims_in: { w: 12, h: 8, d: 12 } }, need), 'fits');
    assert.match(fitBadge('fits', 'clear-bin').txt, /14" shelf depth/, 'the badge names the shelf, not the closet');

    // Only the rod closet changes: a built-in system and a linen reach-in keep their measured depth.
    assert.equal(shelfDepthFor(state.dims, 'builtin'), 30);
    assert.equal(shelfDepthFor(state.dims, 'reachinL'), 30);
  } finally {
    state.space = 'pantry';
    state.setup = 'cabinet'; state.setupTouched = false;
  }
});

/* The reach-in the owner ran on 2026-10-10, as the plan came back: two shelf
   rows over the rods and a floor row, 60 by 96 by 30 inches. One fixture for
   the two things that run found. */
function reachInPlan(shelfYFracs) {
  const row = (lv, zone, shelfIndex, surface) => ({ lv, zone, shelfIndex, surface, items: [{ name: 'Sweaters', size: 'm' }] });
  return {
    layout: { type: 'closet-rod', sections: [] },
    geometry: { unit: 'in', width: 60, height: 96, depth: 30, shelfCount: 4, shelfYFracs, estimated: false },
    map: [
      row('Upper shelf: left side', 'Folded knits', 0, 'shelf'),
      row('Upper shelf: right side', 'Towels', 1, 'shelf'),
      row('Main rod', 'Dress shirts', 2, 'rod'),
      row('Floor: bins and hamper', 'Folded overflow bin', 3, 'floor'),
    ],
  };
}
function withReachIn(shelfYFracs, fn) {
  state.space = 'closet';
  state.setup = 'reachinC'; state.setupTouched = true;
  state.dims = { w_in: 60, h_in: 96, d_in: 30, shelves: null };
  state.ai = reachInPlan(shelfYFracs);
  state.arrangement = null;
  try { fn(); } finally {
    state.ai = null; state.arrangement = null;
    state.space = 'pantry'; state.setup = 'cabinet'; state.setupTouched = false;
  }
}

/* The 14-inch cap is the shelf's. That run recommended a bin "to hold folded
   overflow on the floor", badged it "Fits your 14" shelf depth" and searched
   for one no deeper than 14 inches, in a closet 30 inches deep: the cap was
   applied to every need, whatever it sat on. */
test('a rod closet judges what sits on its floor against the closet, and what sits on its shelf against the shelf', () => {
  withReachIn([0.14, 0.3, 0.5, 0.92], () => {
    const onFloor = { type: 'clear-bin', targetZone: 'Floor: bins and hamper', maxDims: { w_in: 18, h_in: 12, d_in: 25 } };
    const onShelf = { type: 'basket', targetZone: 'Upper shelf: left side', maxDims: { w_in: 16, h_in: 10, d_in: 25 } };
    assert.equal(targetRowFor(onFloor).surface, 'floor');
    assert.equal(targetRowFor(onShelf).surface, 'shelf');
    assert.equal(shelfDepthFor(state.dims, 'closet-rod', 'floor'), 30, 'the floor is the whole closet');
    assert.equal(shelfDepthFor(state.dims, 'closet-rod', 'shelf'), 14);
    assert.equal(shelfDepthFor(state.dims, 'closet-rod', 'rod'), 14, 'only the floor is the exception');

    const bin = { dims_in: { w: 12, h: 8, d: 20 } };
    assert.equal(fitFor(bin, onFloor), 'fits', 'a 20-inch bin fits a 30-inch closet floor');
    assert.equal(fitFor(bin, onShelf), 'no-fit', 'and still does not fit the shelf over the rod');
    assert.match(fitBadge('fits', 'clear-bin', onFloor).txt, /^Fits your 30" floor depth$/, 'the badge names the floor it was judged against');
    assert.match(fitBadge('fits', 'basket', onShelf).txt, /^Fits your 14" shelf depth$/);
    assert.match(fitBadge('fits', 'clear-bin').txt, /14" shelf depth/, 'with no need to read, it is a shelf, as before');
    assert.match(searchLinks(onFloor)[0].url, /max%2025%20inch%20deep/, 'the floor search is capped by the need, not by the shelf');
    assert.match(searchLinks(onShelf)[0].url, /max%2014%20inch%20deep/);

    // The floor is still a floor: nothing deeper than the closet.
    assert.equal(fitFor({ dims_in: { w: 12, h: 8, d: 31 } }, { ...onFloor, maxDims: null }), 'no-fit');
    // A need that names no row is judged as a shelf, the careful reading.
    assert.equal(targetRowFor({ type: 'clear-bin', targetZone: 'Somewhere else entirely' }), null);
    assert.equal(fitFor(bin, { type: 'clear-bin', targetZone: 'Somewhere else entirely', maxDims: null }), 'no-fit');
  });
});

/* The card knew the space and the need's own maxDims and nothing about the
   level in between, so a 7-inch basket for a top shelf drawn with 6.9 inches
   over it was "Fits" on the card and "does not fully fit" in the 3D view of
   the same plan. The card reads the row's headroom from the function the
   scene draws with (js/three/roomBoards.js gapsAboveFor). */
test('a product taller than the row it is drawn on does not fit, whatever the need allows', () => {
  // Top board 6 inches under the top panel: 96 x 0.0703 = 6.75 from the top,
  // less the 0.75-inch panel, less the 0.75-inch board over it in the scene's count.
  withReachIn([0.0703125, 0.3, 0.5, 0.92], () => {
    const need = { type: 'basket', targetZone: 'Upper shelf: left side', maxDims: { w_in: 16, h_in: 10, d_in: 13 } };
    assert.equal(fitFor({ dims_in: { w: 9.75, h: 7, d: 10.25 } }, need), 'no-fit', 'a 7-inch basket under 5.25 inches of clearance');
    assert.equal(fitFor({ dims_in: { w: 9.75, h: 5, d: 10.25 } }, need), 'fits');
    // The row below has the room, and a need aimed there is judged there.
    const lower = { ...need, targetZone: 'Upper shelf: right side' };
    assert.equal(fitFor({ dims_in: { w: 9.75, h: 7, d: 10.25 } }, lower), 'fits');
    // A saved arrangement is what the viewer opens with, so it is what is read.
    state.arrangement = { version: 3, geometry: { ...state.ai.geometry, shelfYFracs: [0.3, 0.5, 0.7, 0.92] } };
    assert.equal(fitFor({ dims_in: { w: 9.75, h: 7, d: 10.25 } }, need), 'fits', 'the shelf was moved down in the 3D view');
  });
  // A layout whose rows this cannot read is judged as before: no row, no veto.
  state.setup = 'cabinet'; state.setupTouched = false;
  state.dims = { w_in: 36, h_in: 78, d_in: 18, shelves: null };
  state.ai = { layout: { type: 'shelves', sections: [] }, geometry: { width: 36, height: 78, depth: 18, shelfCount: 2, shelfYFracs: [0.05, 0.92] },
    map: [{ lv: 'Top shelf', zone: 'Bulk', shelfIndex: 0, surface: 'shelf', items: [{ name: 'Rice' }] }, { lv: 'Floor', zone: 'Bins', shelfIndex: 1, surface: 'floor', items: [{ name: 'Bin' }] }] };
  state.arrangement = { layoutOverride: 'shelves' };
  try {
    const need = { type: 'clear-bin', targetZone: 'Top shelf', maxDims: { w_in: 12, h_in: 10, d_in: 14 } };
    assert.equal(currentArchetype(), 'shelves');
    assert.equal(fitFor({ dims_in: { w: 10, h: 9, d: 12 } }, need), 'fits',
      'a floating top shelf is open above; this module does not guess at it');
    // The same plan drawn as a cabinet has a top panel 3 inches over that board.
    state.arrangement = { layoutOverride: 'cabinet' };
    assert.equal(fitFor({ dims_in: { w: 10, h: 9, d: 12 } }, need), 'no-fit');
  } finally { state.ai = null; state.arrangement = null; }
});
