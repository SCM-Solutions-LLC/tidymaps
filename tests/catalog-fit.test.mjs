import test from 'node:test';
import assert from 'node:assert/strict';
import { fitFor, fitBadge, shelfDepthFor } from '../js/catalog.js';
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
