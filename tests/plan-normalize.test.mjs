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

/* ---------- Where a row sits, and what a step works on ----------

   A plan's map is a flat list, which reads fine for a cabinet and as one
   impossibly tall unit for a walk-in: six "shelves", the first on the left
   wall and the fourth on the back wall. The model can now say which wall a
   row is on (`wall`) and how far down that wall it sits (`tier`, 0 = top),
   a step can name the rows it works on (`rows`) and the goal it answers
   (`goal`), and the plan can list things the model saw that the user's
   contents list left out (`spotted`).

   normalizeAi is a whitelist: a field it does not copy does not exist past
   this point, which is how `observed` and `cite` were lost before. These pin
   each new field through it, drop the garbage a model can send, and keep the
   idempotency contract the share path depends on. */

const wallRow = (zone, shelfIndex, extra) => ({ ...row(zone, shelfIndex), ...extra });

test('a row keeps its wall only when it names one of the five', () => {
  const out = normalizeAi(planWith([
    wallRow('Left high', 0, { wall: 'left' }),
    wallRow('Floor', 1, { wall: 'floor' }),
    wallRow('Garbage', 2, { wall: 'ceiling' }),
  ]));
  assert.equal(out.map[0].wall, 'left');
  assert.equal(out.map[1].wall, 'floor');
  assert.equal('wall' in out.map[2], false, 'an unknown wall must be dropped, not passed through');
});

test('a row with no wall stays without one, rather than carrying wall:null', () => {
  // The report keys its per-wall chapters on the field being present; a null
  // would read as a sixth wall called "null".
  const out = normalizeAi(planWith([wallRow('Top', 0, { wall: null }), row('Middle', 1)]));
  assert.equal('wall' in out.map[0], false);
  assert.equal('wall' in out.map[1], false);
});

test('tier is kept as a non-negative integer and dropped otherwise', () => {
  const out = normalizeAi(planWith([
    wallRow('Top of the wall', 0, { wall: 'back', tier: 0 }),
    wallRow('Two down', 1, { wall: 'back', tier: 2 }),
    wallRow('Negative', 2, { wall: 'back', tier: -1 }),
  ]));
  // 0 is the top shelf of that wall, the most ordinary value, and the same
  // trap shelfIndex fell into: it must survive as 0, not fall away as falsy.
  assert.equal(out.map[0].tier, 0);
  assert.equal(out.map[1].tier, 2);
  assert.equal('tier' in out.map[2], false);

  for (const bad of ['x', 1.5, true, null, undefined, '']) {
    const one = normalizeAi(planWith([wallRow('Bad', 0, { tier: bad })]));
    assert.equal('tier' in one.map[0], false, `tier ${JSON.stringify(bad)} should be dropped`);
  }
});

const planWithSteps = (steps, map = [row('Top', 0), row('Middle', 1), row('Low', 2)]) =>
  ({ ...planWith(map), steps });

test('a step keeps the rows it works on, within the shelf count, each once', () => {
  const out = normalizeAi(planWithSteps([
    { task: 'Clear the top two', time: '10 min', why: 'w', rows: [0, 1, 1, 99, -1, 'x', 1.5, 2] },
  ]));
  assert.deepEqual(out.steps[0].rows, [0, 1, 2],
    'out-of-range, negative, non-integer and duplicate rows must all go');
});

test('a step with no usable rows carries no rows field at all', () => {
  // Absent means "the whole space"; an empty array would read the same to a
  // careful caller and differently to a careless one, so it is not emitted.
  const out = normalizeAi(planWithSteps([
    { task: 'A', time: '5 min', why: 'w' },
    { task: 'B', time: '5 min', why: 'w', rows: [] },
    { task: 'C', time: '5 min', why: 'w', rows: [99] },
    { task: 'D', time: '5 min', why: 'w', rows: 'not an array' },
  ]));
  for (const st of out.steps) assert.equal('rows' in st, false, `${st.t} should not carry rows`);
});

test('a step keeps the goal it answers only when it is a non-empty string', () => {
  const out = normalizeAi(planWithSteps([
    { task: 'A', time: '5 min', why: 'w', goal: "Can't find anything" },
    { task: 'B', time: '5 min', why: 'w', goal: '' },
    { task: 'C', time: '5 min', why: 'w', goal: null },
    { task: 'D', time: '5 min', why: 'w', goal: 42 },
    { task: 'E', time: '5 min', why: 'w' },
  ]));
  assert.equal(out.steps[0].goal, "Can't find anything");
  for (const st of out.steps.slice(1)) assert.equal('goal' in st, false, `${st.t} should not carry a goal`);
});

test('spotted keeps what the model saw: a name, a row or null, a source, included', () => {
  const out = normalizeAi({
    ...planWith([row('Top', 0), row('Middle', 1), row('Low', 2)]),
    spotted: [
      { name: 'Slow cooker', row: 2, source: 'photo', included: false },
      { name: 'Dog food', row: 99, source: 'scope', included: true },
      { name: 'Unknown row', row: null },
      { name: 'Odd source', row: 0, source: 'guess', included: 'yes' },
    ],
  });
  assert.deepEqual(out.spotted, [
    { name: 'Slow cooker', row: 2, source: 'photo', included: false },
    { name: 'Dog food', row: null, source: 'scope', included: true },
    { name: 'Unknown row', row: null, source: 'photo', included: false },
    { name: 'Odd source', row: 0, source: 'photo', included: false },
  ]);
});

test('spotted drops nameless entries, caps at eight, and is absent when empty', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ name: `Thing ${i}` }));
  const capped = normalizeAi({ ...planWith([row('Top', 0)]), spotted: many });
  assert.equal(capped.spotted.length, 8);
  assert.equal(capped.spotted[7].name, 'Thing 7');

  const junk = normalizeAi({ ...planWith([row('Top', 0)]), spotted: [{ row: 0 }, { name: '' }, { name: 7 }, null, 'x'] });
  assert.equal('spotted' in junk, false, 'nothing usable means no field, not an empty list');

  const none = normalizeAi(planWith([row('Top', 0)]));
  assert.equal('spotted' in none, false);
});

test('normalizing twice is a no-op with every new field present', () => {
  // Saved rows and share payloads store the normalized plan and the share
  // path runs it through here again; a field that only reads its raw name
  // vanishes for every visitor, which is how the step titles went blank once.
  const once = normalizeAi({
    ...planWith([
      wallRow('Left high', 0, { wall: 'left', tier: 0 }),
      wallRow('Left low', 1, { wall: 'left', tier: 1 }),
      wallRow('Floor', 2, { wall: 'floor', tier: 0 }),
    ]),
    steps: [
      { task: 'Clear the left wall', time: '10 min', why: 'w', rows: [0, 1], goal: 'Looks cluttered' },
      { task: 'Everything else', time: '10 min', why: 'w' },
    ],
    spotted: [{ name: 'Slow cooker', row: 2, source: 'scope', included: true }, { name: 'Vase' }],
  });
  const twice = normalizeAi(once);
  assert.deepEqual(twice, once);
  // and the precondition: the fields were actually there to lose
  assert.equal(once.map[0].wall, 'left');
  assert.equal(once.map[1].tier, 1);
  assert.deepEqual(once.steps[0].rows, [0, 1]);
  assert.equal(once.steps[0].goal, 'Looks cluttered');
  assert.equal(once.spotted.length, 2);
});
