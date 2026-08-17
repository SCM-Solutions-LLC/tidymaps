import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAi } from '../js/plan.js';

/* normalizeAi's numeric helper rejected zero — `Number.isFinite(n) && n > 0` —
   and that helper was reused for shelfIndex, where 0 is the top shelf and the
   most ordinary value a plan can carry. An explicit 0 failed the test and fell
   back to the row's position in the array.

   That is not merely a misplaced row. The substituted index can land on one
   another row already holds, and the 3D view keys its shelves by index, so one
   of the pair is dropped from the drawing entirely — and it recreates the
   duplicate-shelfIndex condition the server validator rejects by name. It also
   breaks the idempotency contract normalizeAi documents, which the share-link
   path depends on: re-normalizing a saved plan must not move its zones.

   Latent until now only because a plan whose rows arrive top-down already has
   shelfIndex === i, which is the common case and the one every fixture used. */

const planWith = (map) => ({
  spaceType: 'Pantry',
  summary: 'x',
  categories: ['Canned goods'],
  map,
  geometry: { unit: 'in', width: 36, height: 72, depth: 16, shelfCount: 3, shelfYFracs: [0.1, 0.5, 0.9], estimated: false },
  steps: [{ task: 'Empty the shelf', time: '10 min', why: 'Easier to plan.' }],
  productNeeds: [],
  safetyNotes: [],
});

const row = (zone, shelfIndex) => ({
  level: 'Shelf', icon: 'up', zone, why: 'because', shelfIndex,
  safety: { flag: null, why: null }, items: [],
});

test('a zone that names shelf 0 keeps it, wherever it sits in the list', () => {
  // Bottom-up ordering: the row claiming shelf 0 is NOT at array position 0.
  const out = normalizeAi(planWith([
    row('Low shelf', 2),
    row('Middle', 1),
    row('Top — backstock', 0),
  ]));

  assert.deepEqual(out.map.map((m) => m.shelfIndex), [2, 1, 0],
    'shelf 0 fell back to the row\'s array position');
  assert.equal(out.map[2].zone, 'Top — backstock');
});

test('normalizing twice does not move a zone', () => {
  // Saved rows and share payloads store the already-normalized plan, and the
  // share path runs it through here again.
  const once = normalizeAi(planWith([row('Low', 2), row('Middle', 1), row('Top', 0)]));
  const twice = normalizeAi({ ...once, map: once.map, steps: once.steps });
  assert.deepEqual(twice.map.map((m) => m.shelfIndex), once.map.map((m) => m.shelfIndex));
});

test('two rows do not collapse onto one shelf', () => {
  const out = normalizeAi(planWith([row('Low', 2), row('Top', 0)]));
  const indices = out.map.map((m) => m.shelfIndex);
  assert.equal(new Set(indices).size, indices.length,
    'a substituted index collided with a real one, and the 3D view drops the duplicate');
});

test('a missing or unusable shelfIndex still falls back to the row position', () => {
  const out = normalizeAi(planWith([
    row('First', undefined),
    row('Second', 'not a number'),
    row('Third', null),
  ]));
  assert.deepEqual(out.map.map((m) => m.shelfIndex), [0, 1, 2]);
});

test('a shelfIndex beyond the shelf count is clamped, not wrapped', () => {
  const out = normalizeAi(planWith([row('Way past the end', 99), row('Middle', 1)]));
  assert.deepEqual(out.map.map((m) => m.shelfIndex), [2, 1]);
});

test('a negative shelfIndex is unusable, so it falls back like any other garbage', () => {
  // Not clamped to 0: that would be a claim about the top shelf that the plan
  // never made, and shelf 0 is exactly the value this change made meaningful.
  const out = normalizeAi(planWith([row('First', 0), row('Negative', -3)]));
  assert.deepEqual(out.map.map((m) => m.shelfIndex), [0, 1]);
});

/* The same helper still guards the measurements, where zero is not a
   measurement but a missing one — so splitting the two must not let a 0 width
   through as a real dimension. */
test('a zero dimension is still treated as absent', () => {
  const out = normalizeAi({
    ...planWith([row('Top', 0)]),
    geometry: { unit: 'in', width: 0, height: 0, depth: 0, shelfCount: 3, shelfYFracs: [0.1, 0.5, 0.9], estimated: true },
  });
  assert.equal(out.geometry.width, 30);
  assert.equal(out.geometry.height, 60);
  assert.equal(out.geometry.depth, 14);
});
