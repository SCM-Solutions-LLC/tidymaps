import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSurfaceOffset,
  pointOnSurface,
  surfaceRotationY,
  itemYForSurface,
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
