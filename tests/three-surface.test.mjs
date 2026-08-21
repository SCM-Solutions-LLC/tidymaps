import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSurfaceOffset,
  pointOnSurface,
  surfaceRotationY,
  itemYForSurface,
  depthRankStep,
  displayJitter,
  hashString,
  ITEM_NORMAL_OFFSET,
} from '../js/three/surfaceMath.js';

test('pointOnSurface follows an x-axis shelf and its outward normal', () => {
  const surface = {
    center: { x: 4, y: 0, z: -3 },
    uDir: { x: 1, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  };
  assert.deepEqual(pointOnSurface(surface, 6, 0.375), { x: 10, y: 0, z: -2.625 });
});

test('pointOnSurface follows a side wall whose usable axis is z', () => {
  const surface = {
    center: { x: -15, y: 0, z: -8 },
    uDir: { x: 0, y: 0, z: 1 },
    normal: { x: 1, y: 0, z: 0 },
  };
  assert.deepEqual(pointOnSurface(surface, 5, 0.375), { x: -14.625, y: 0, z: -3 });
  assert.equal(surfaceRotationY(surface), -Math.PI / 2);
});

test('drag offset clamps using surface length and item width', () => {
  assert.equal(clampSurfaceOffset(20, 30, 8), 11);
  assert.equal(clampSurfaceOffset(-20, 30, 8), -11);
});

test('rod items hang below the rod while shelf items stand above it', () => {
  assert.equal(itemYForSurface({ kind: 'rod', y: 40 }, 8, 1.2), 37.2);
  assert.equal(itemYForSurface({ kind: 'shelf', y: 10 }, 8, 1.2), 15.2);
});

test('pegboard items center on the vertical hit area instead of standing on an imaginary shelf', () => {
  const surface = { kind: 'pegboard', y: 20, center: { x: 0, y: 31, z: 0 } };
  assert.equal(itemYForSurface(surface, 8), 31);
});

/* ---------- two-rank shelf packing ----------

   The failure this guards is an item quietly standing behind the shelf it is
   meant to be on: the step is measured from the front rank, so getting the
   arithmetic wrong pushes the back rank through the carcass, where at most
   camera angles it simply disappears. */

const shelf = { kind: 'shelf' };

test('a back rank is offered only where the shelf can hold one', () => {
  assert.ok(depthRankStep({ surface: shelf, shelfDepth: 16, itemDepth: 4, unitCount: 3 }) > 0);

  // A shelf barely deeper than the item has nowhere to put a second rank.
  assert.equal(depthRankStep({ surface: shelf, shelfDepth: 5, itemDepth: 4, unitCount: 3 }), 0);
  // One unit is not a row.
  assert.equal(depthRankStep({ surface: shelf, shelfDepth: 16, itemDepth: 4, unitCount: 1 }), 0);
  // A rod hangs its contents in one plane and a pegboard has no depth at all.
  assert.equal(depthRankStep({ surface: { kind: 'rod' }, shelfDepth: 16, itemDepth: 4, unitCount: 3 }), 0);
  assert.equal(depthRankStep({ surface: { kind: 'pegboard' }, shelfDepth: 16, itemDepth: 4, unitCount: 3 }), 0);
  // Inside an organizer the bin decides the arrangement, not this.
  assert.equal(depthRankStep({
    surface: shelf, shelfDepth: 16, itemDepth: 4, unitCount: 3, inOrganizer: true,
  }), 0);
  // Nonsense in, one row out — never NaN into a position.
  assert.equal(depthRankStep({ surface: shelf, shelfDepth: 0, itemDepth: 4, unitCount: 3 }), 0);
  assert.equal(depthRankStep({}), 0);
});

test('the back rank always keeps the whole item on the shelf', () => {
  /* Swept rather than sampled: the containment has to hold for every shape of
     shelf, not for the one case that was in mind when it was written. */
  for (let shelfDepth = 3; shelfDepth <= 40; shelfDepth += 0.5) {
    for (let itemDepth = 1; itemDepth <= 14; itemDepth += 0.5) {
      const step = depthRankStep({ surface: shelf, shelfDepth, itemDepth, unitCount: 3 });
      if (!step) continue;
      const backFace = ITEM_NORMAL_OFFSET - step - itemDepth / 2;
      assert.ok(
        backFace >= -shelfDepth / 2 - 1e-9,
        `shelf ${shelfDepth} item ${itemDepth}: back face ${backFace} is behind the shelf`,
      );
      assert.ok(step > 0 && Number.isFinite(step));
    }
  }
});

test('display jitter repeats exactly and stays inside its range', () => {
  /* The whole reason this is a hash and not Math.random: a screenshot of one
     plan has to be the same screenshot every time, or it is not evidence. */
  assert.deepEqual(displayJitter('crate', 1), displayJitter('crate', 1));
  assert.notDeepEqual(displayJitter('crate', 1), displayJitter('crate', 2));
  assert.notDeepEqual(displayJitter('crate', 1), displayJitter('tin', 1));

  for (const key of ['crate', 'tin', '', 'a very long item name indeed', '123']) {
    for (let i = 0; i < 8; i += 1) {
      const { yaw, depth } = displayJitter(key, i);
      assert.ok(yaw >= -1 && yaw <= 1, `yaw ${yaw} out of range`);
      assert.ok(depth >= -1 && depth <= 1, `depth ${depth} out of range`);
    }
  }
  // A missing name must not collapse every item onto one wobble.
  assert.notDeepEqual(displayJitter(null, 1), displayJitter(null, 2));
});

test('hashString is stable and spreads the names this repo actually uses', () => {
  assert.equal(hashString('rice'), hashString('rice'));
  assert.notEqual(hashString('rice'), hashString('Rice'));
  const names = ['rice', 'pasta', 'canned beans', 'storage bin', 'linen box', 'cereal', 'flour', 'tins'];
  assert.equal(new Set(names.map(hashString)).size, names.length);
});

