import test from 'node:test';
import assert from 'node:assert/strict';
import { fitFor } from '../js/catalog.js';
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
