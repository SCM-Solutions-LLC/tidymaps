import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WALLS, WALL_LABEL, wallFromPlace, wallFromLevel, placementFor, placementFromSections,
  levelLabel, whereFor, wallGroups, wallsPlaced,
} from '../js/placement.js';
import { ARCHETYPE_LEVELS, ARCHETYPE_LEVELS_FOR_SOURCE } from '../js/setupStructure.js';

/* placementFor() is the one place that decides which wall a plan row sits on
   and how high up that wall it is. The report's per-wall chapters and the 3D
   builders both read from it, so the tests below pin the priority order of
   the evidence (the row's own field, then the AI's sections, then the level
   text, then the surface) rather than any one caller's reading of it. */

const row = (level, extra = {}) => ({ level, icon: 'middle', zone: 'z', why: 'w', surface: 'shelf', items: [], ...extra });

const WALKIN_ROWS = [
  row('Left wall: high shelf'),
  row('Left wall: eye level', { eye: true }),
  row('Back wall: eye level'),
  row('Back wall: lower shelves'),
  row('Right wall: full run'),
  row('Floor: full run', { surface: 'floor' }),
];

const CABINET_ROWS = [
  row('Top shelf'),
  row('Eye level', { eye: true }),
  row('Middle shelf'),
  row('Lower shelf'),
  row('Door rack', { surface: 'door' }),
];

// Vocabulary

test('WALLS and WALL_LABEL agree, and front is labelled plainly by default', () => {
  assert.deepEqual(WALLS, ['left', 'back', 'right', 'front', 'floor']);
  for (const w of WALLS) assert.ok(WALL_LABEL[w], `${w}: no label`);
  assert.equal(WALL_LABEL.front, 'Front wall');
});

// wallFromPlace

test('wallFromPlace passes walls through and folds the L-run places onto back and right', () => {
  for (const w of ['left', 'back', 'right', 'floor', 'front']) assert.equal(wallFromPlace(w), w);
  assert.equal(wallFromPlace('run-a'), 'back');
  assert.equal(wallFromPlace('run-b'), 'right');
  for (const p of ['upper', 'lower', 'bench', 'wall', 'main', null, undefined, '']) {
    assert.equal(wallFromPlace(p), null, `${p}: should not be a wall`);
  }
});

// wallFromLevel

test('wallFromLevel reads the wall from the head of the level text', () => {
  assert.equal(wallFromLevel('Left wall: high shelf'), 'left');
  assert.equal(wallFromLevel('Back wall: lower shelves'), 'back');
  assert.equal(wallFromLevel('Right wall: full run'), 'right');
  assert.equal(wallFromLevel('Long run: eye level'), 'back');
  assert.equal(wallFromLevel('Short run: upper shelf'), 'right');
  assert.equal(wallFromLevel('Corner: deep shelf'), 'back');
  assert.equal(wallFromLevel('Floor: full run'), 'floor');
  assert.equal(wallFromLevel('Floor / door'), 'floor');
  assert.equal(wallFromLevel('Floor level'), 'floor');
  assert.equal(wallFromLevel('Floor zone'), 'floor');
  assert.equal(wallFromLevel('Door rack'), 'front');
  assert.equal(wallFromLevel('Door shelves'), 'front');
  // The walk-in's door rack is renamed "Front shelf" by SURFACE_PHRASES.
  assert.equal(wallFromLevel('Front shelf'), 'front');
  assert.equal(wallFromLevel('LEFT WALL: HIGH'), 'left');
});

test('wallFromLevel only reads the part before the first colon', () => {
  // "Hanging rod: left" is a rod on the left of a reach-in, not a left wall.
  assert.equal(wallFromLevel('Hanging rod: left'), null);
  assert.equal(wallFromLevel('Cabinet: floor'), null);
  assert.equal(wallFromLevel('Upper cabinet: top shelf'), null);
  assert.equal(wallFromLevel('Rack deck: front half'), null);
});

test('wallFromLevel returns null for plain shelf names and non-wall surfaces', () => {
  for (const t of ['Top shelf', 'Eye level', 'Middle shelf', 'Pegboard wall', 'Bench surface', 'Below the bench', 'Top drawer', '', null, undefined]) {
    assert.equal(wallFromLevel(t), null, `${t}: should not be a wall`);
  }
});

test('"Floor / corner" is a floor row, not a back-wall row', () => {
  // The L-run closet variant ends on "Floor / corner". An unanchored
  // /corner/ rule checked first would put the floor on the back wall.
  assert.equal(wallFromLevel('Floor / corner'), 'floor');
});

test('every walk-in and L-run template level resolves to the wall its slot names', () => {
  const expected = {
    'Left wall': 'left', 'Back wall': 'back', 'Right wall': 'right',
    'Long run': 'back', 'Short run': 'right', 'Corner': 'back', 'Floor': 'floor',
  };
  const slots = [
    ...ARCHETYPE_LEVELS['walkin-u'],
    ...ARCHETYPE_LEVELS['l-run'],
    ...ARCHETYPE_LEVELS_FOR_SOURCE['l-run']['closet-rod'],
  ];
  for (const slot of slots) {
    const head = slot.level.split(/[:/]/)[0].trim();
    assert.equal(wallFromLevel(slot.level), expected[head], `${slot.level}: wrong wall`);
    // Once the template carries `wall` per slot, the parser must agree with it.
    if (slot.wall) assert.equal(wallFromLevel(slot.level), slot.wall, `${slot.level}: parser disagrees with template`);
  }
});

// Priority of evidence

test('row.wall beats a section that says otherwise', () => {
  const rows = [row('Top shelf', { wall: 'left' })];
  const layout = { type: 'walkin-u', sections: [{ id: 'back', place: 'back', rows: [0] }] };
  const p = placementFor(rows, { layout });
  assert.equal(p.byRow.get(0).wall, 'left');
  assert.equal(p.byRow.get(0).source, 'row');
});

test('a section beats the level text', () => {
  const rows = [row('Back wall: eye level')];
  const layout = { type: 'walkin-u', sections: [{ id: 'right', place: 'right', rows: [0] }] };
  const p = placementFor(rows, { layout });
  assert.equal(p.byRow.get(0).wall, 'right');
  assert.equal(p.byRow.get(0).source, 'section');
});

test('level text beats the surface', () => {
  const rows = [row('Left wall: full run', { surface: 'floor' })];
  const p = placementFor(rows);
  assert.equal(p.byRow.get(0).wall, 'left');
  assert.equal(p.byRow.get(0).source, 'level');
});

test('the surface places a row when nothing else does', () => {
  const rows = [row('Bottom', { surface: 'floor' }), row('Rack', { surface: 'door' }), row('Shelf')];
  const p = placementFor(rows);
  assert.equal(p.byRow.get(0).wall, 'floor');
  assert.equal(p.byRow.get(0).source, 'surface');
  assert.equal(p.byRow.get(1).wall, 'front');
  assert.equal(p.byRow.get(1).source, 'surface');
  assert.equal(p.byRow.get(2).wall, null);
  assert.equal(p.byRow.get(2).source, null);
});

test('a row.wall outside the vocabulary is ignored, not trusted', () => {
  const rows = [row('Back wall: eye level', { wall: 'ceiling' })];
  const p = placementFor(rows);
  assert.equal(p.byRow.get(0).wall, 'back');
  assert.equal(p.byRow.get(0).source, 'level');
});

// Sections

test('a section place wins over its id: {id:"corner", place:"right"} puts the row on the right', () => {
  const rows = [row('A'), row('B'), row('C'), row('D')];
  const layout = { type: 'l-run', sections: [{ id: 'corner', place: 'right', rows: [3] }] };
  const p = placementFor(rows, { layout });
  assert.equal(p.byRow.get(3).wall, 'right');
  assert.equal(p.byRow.get(3).source, 'section');
});

test('a section id is read when it has no place: "corner" means the back wall', () => {
  const rows = [row('A'), row('B')];
  const layout = { type: 'l-run', sections: [{ id: 'corner', rows: [1] }] };
  const p = placementFor(rows, { layout });
  assert.equal(p.byRow.get(1).wall, 'back');
  assert.equal(p.byRow.get(1).source, 'section');
});

test('run-a and run-b sections land on the back and right walls', () => {
  const rows = [row('A'), row('B'), row('C'), row('D')];
  const layout = { type: 'l-run', sections: [
    { id: 'run-a', place: 'run-a', rows: [0, 1] },
    { id: 'run-b', place: 'run-b', rows: [2, 3] },
  ] };
  const p = placementFor(rows, { layout });
  assert.deepEqual([0, 1, 2, 3].map(i => p.byRow.get(i).wall), ['back', 'back', 'right', 'right']);
  assert.deepEqual(p.walls.map(w => w.id), ['back', 'right']);
});

test('a "main" section neither places a row nor blocks the level text', () => {
  const rows = [row('Left wall: eye level'), row('Top shelf')];
  const layout = { type: 'walkin-u', sections: [{ id: 'main', place: null, rows: [0, 1] }] };
  const p = placementFor(rows, { layout });
  assert.equal(p.byRow.get(0).wall, 'left');
  assert.equal(p.byRow.get(0).source, 'level');
  assert.equal(p.byRow.get(1).wall, null);
});

test('placementFromSections maps shelf indices to walls and ignores indices past the row count', () => {
  const m = placementFromSections([
    { id: 'left', place: 'left', rows: [0, 1] },
    { id: 'run-b', rows: [2, 9] },
    { id: 'main', rows: [3] },
  ], 4);
  assert.equal(m.get(0), 'left');
  assert.equal(m.get(1), 'left');
  assert.equal(m.get(2), 'right');
  assert.equal(m.has(3), false);
  assert.equal(m.has(9), false);
  assert.deepEqual(placementFromSections(null, 3), new Map());
});

// Tiers

test('explicit unique row.tier values are used as given', () => {
  const rows = [
    row('Back wall: lower', { wall: 'back', tier: 2 }),
    row('Back wall: top', { wall: 'back', tier: 0 }),
    row('Back wall: middle', { wall: 'back', tier: 1 }),
  ];
  const p = placementFor(rows);
  assert.equal(p.byRow.get(0).tier, 2);
  assert.equal(p.byRow.get(1).tier, 0);
  assert.equal(p.byRow.get(2).tier, 1);
  assert.equal(p.byRow.get(0).tiers, 3);
  // The wall lists its rows top to bottom.
  assert.deepEqual(p.walls[0].rows, [1, 2, 0]);
});

test('without explicit tiers the wall is numbered by shelfIndex order', () => {
  const rows = [
    row('Left wall: a', { shelfIndex: 4 }),
    row('Left wall: b', { shelfIndex: 1 }),
    row('Left wall: c', { shelfIndex: 2 }),
  ];
  const p = placementFor(rows);
  assert.equal(p.byRow.get(1).tier, 0);
  assert.equal(p.byRow.get(2).tier, 1);
  assert.equal(p.byRow.get(4).tier, 2);
  assert.deepEqual(p.walls[0].rows, [1, 2, 4]);
  for (const i of [1, 2, 4]) assert.equal(p.byRow.get(i).tiers, 3);
});

test('tiers that are missing on one row or repeated fall back to shelfIndex order', () => {
  const partial = placementFor([row('Back wall: a', { tier: 0 }), row('Back wall: b')]);
  assert.equal(partial.byRow.get(0).tier, 0);
  assert.equal(partial.byRow.get(1).tier, 1);
  const repeated = placementFor([row('Back wall: a', { tier: 1 }), row('Back wall: b', { tier: 1 })]);
  assert.equal(repeated.byRow.get(0).tier, 0);
  assert.equal(repeated.byRow.get(1).tier, 1);
});

test('explicit tiers with a gap keep their order but are renumbered from 0', () => {
  /* Tiers 0 and 2 on a two-row wall are distinct, non-negative and
     ascending, and used to pass through as given. A consumer reads tier
     against tiers, so it was handed tier 2 of 2: the report drew a gap and
     the 3D builder reached for a third shelf the wall does not have. */
  const rows = [
    row('Back wall: lower', { wall: 'back', tier: 2 }),
    row('Back wall: top', { wall: 'back', tier: 0 }),
  ];
  const p = placementFor(rows);
  assert.equal(p.byRow.get(1).tier, 0);
  assert.equal(p.byRow.get(0).tier, 1);
  assert.equal(p.byRow.get(0).tiers, 2);
  assert.equal(p.byRow.get(1).tiers, 2);
  // The explicit order still decides which row is on top.
  assert.deepEqual(p.walls[0].rows, [1, 0]);
  // Starting above 0 is a gap too.
  const offset = placementFor([row('Left wall: a', { tier: 1 }), row('Left wall: b', { tier: 2 })]);
  assert.equal(offset.byRow.get(0).tier, 0);
  assert.equal(offset.byRow.get(1).tier, 1);
  for (const pl of [p, offset]) {
    for (const [, r] of pl.byRow) assert.ok(r.tier < r.tiers, `tier ${r.tier} is out of range for ${r.tiers} tiers`);
  }
});

test('tiers are counted per wall, not per plan', () => {
  const p = placementFor(WALKIN_ROWS, { archetype: 'walkin-u' });
  assert.equal(p.byRow.get(0).tiers, 2);   // left wall: two rows
  assert.equal(p.byRow.get(4).tiers, 1);   // right wall: one row
  assert.equal(p.byRow.get(4).tier, 0);
  assert.equal(p.byRow.get(5).tiers, 1);   // floor
});

test('a floor row on a wall is always that wall\'s last tier', () => {
  const rows = [
    row('Left wall: floor', { wall: 'left', surface: 'floor', shelfIndex: 0 }),
    row('Left wall: shelf', { wall: 'left', shelfIndex: 1 }),
  ];
  const p = placementFor(rows);
  assert.equal(p.byRow.get(1).tier, 0);
  assert.equal(p.byRow.get(0).tier, 1);
  assert.deepEqual(p.walls[0].rows, [1, 0]);
});

test('explicit tiers that put a floor row above a shelf are renumbered', () => {
  const rows = [
    row('Left wall: floor', { wall: 'left', surface: 'floor', tier: 0 }),
    row('Left wall: shelf', { wall: 'left', tier: 1 }),
  ];
  const p = placementFor(rows);
  assert.equal(p.byRow.get(1).tier, 0);
  assert.equal(p.byRow.get(0).tier, 1);
});

// Groups

test('unknown rows go in an "other" group with wall null, after every wall', () => {
  const rows = [row('Top shelf'), row('Back wall: eye level'), row('Mystery')];
  const p = placementFor(rows);
  const other = p.walls.find(w => w.id === 'other');
  assert.ok(other);
  assert.equal(other.label, 'Other');
  assert.deepEqual(other.rows, [0, 2]);
  assert.equal(p.walls[p.walls.length - 1].id, 'other');
  assert.equal(p.byRow.get(0).wall, null);
  assert.equal(p.byRow.get(2).wall, null);
  assert.equal(p.byRow.get(2).tier, 1);
});

test('groups come back in wall order and only when non-empty', () => {
  const p = placementFor(WALKIN_ROWS, { archetype: 'walkin-u' });
  assert.deepEqual(p.walls.map(w => w.id), ['left', 'back', 'right', 'floor']);
  assert.deepEqual(p.walls.map(w => w.label), ['Left wall', 'Back wall', 'Right wall', 'Floor']);
  assert.deepEqual(p.walls.map(w => w.rows), [[0, 1], [2, 3], [4], [5]]);
  const scrambled = [row('Floor: a', { surface: 'floor' }), row('Right wall: a'), row('Left wall: a')];
  assert.deepEqual(placementFor(scrambled).walls.map(w => w.id), ['left', 'right', 'floor']);
});

test('the front group is labelled "Door" when every row on it is a door surface', () => {
  const doors = placementFor(CABINET_ROWS);
  assert.equal(doors.walls.find(w => w.id === 'front').label, 'Door');
  const mixed = placementFor([row('Door rack', { surface: 'door' }), row('Front shelf')]);
  assert.equal(mixed.walls.find(w => w.id === 'front').label, 'Front wall');
  assert.deepEqual(mixed.walls.find(w => w.id === 'front').rows, [0, 1]);
});

// kind

test('a cabinet with plain level names is a unit', () => {
  const p = placementFor(CABINET_ROWS, { archetype: 'cabinet' });
  assert.equal(p.kind, 'unit');
  // Only the door rack found a wall; the shelves are "other".
  assert.deepEqual(p.walls.map(w => w.id), ['front', 'other']);
});

test('walkin-u and l-run are rooms even before any wall is known', () => {
  assert.equal(placementFor(CABINET_ROWS, { archetype: 'walkin-u' }).kind, 'room');
  assert.equal(placementFor(CABINET_ROWS, { archetype: 'l-run' }).kind, 'room');
});

test('two known walls make a room whatever the archetype says', () => {
  const two = [row('Left wall: a'), row('Back wall: b')];
  assert.equal(placementFor(two).kind, 'room');
  assert.equal(placementFor(two, { archetype: 'shelves' }).kind, 'room');
  // Floor plus one wall is not two walls: a garage rack has a floor level.
  const rack = [row('Top shelf'), row('Eye level', { eye: true }), row('Floor level', { surface: 'floor' })];
  assert.equal(placementFor(rack, { archetype: 'garage-rack' }).kind, 'unit');
  const oneWall = [row('Back wall: a'), row('Back wall: b'), row('Floor', { surface: 'floor' })];
  assert.equal(placementFor(oneWall).kind, 'unit');
});

// Row shapes

test('normalized rows (lv) read the same as raw rows (level)', () => {
  const raw = placementFor(WALKIN_ROWS, { archetype: 'walkin-u' });
  const normalized = placementFor(WALKIN_ROWS.map((r, i) => {
    const { level, icon, ...rest } = r;
    return { lv: level, ic: icon, shelfIndex: i, ...rest };
  }), { archetype: 'walkin-u' });
  assert.deepEqual([...normalized.byRow.entries()], [...raw.byRow.entries()]);
  assert.deepEqual(normalized.walls, raw.walls);
});

test('byRow carries eye and the row\'s own shelfIndex', () => {
  const rows = [row('Back wall: a', { shelfIndex: 7, eye: true }), row('Back wall: b', { shelfIndex: 3 })];
  const p = placementFor(rows);
  assert.deepEqual([...p.byRow.keys()].sort(), [3, 7]);
  assert.equal(p.byRow.get(7).eye, true);
  assert.equal(p.byRow.get(3).eye, false);
});

test('an empty or missing map gives an empty placement', () => {
  for (const m of [[], null, undefined]) {
    const p = placementFor(m);
    assert.deepEqual(p.walls, []);
    assert.equal(p.byRow.size, 0);
    assert.equal(p.kind, 'unit');
  }
  assert.equal(placementFor([], { archetype: 'walkin-u' }).kind, 'room');
});

test('placementFor never mutates its input', () => {
  const rows = WALKIN_ROWS.map(r => ({ ...r, tier: undefined }));
  const layout = { type: 'walkin-u', sections: [{ id: 'left', place: 'left', rows: [4] }] };
  const before = JSON.stringify({ rows, layout });
  Object.freeze(layout.sections[0].rows); Object.freeze(layout.sections[0]); Object.freeze(layout.sections); Object.freeze(layout);
  rows.forEach(r => Object.freeze(r)); Object.freeze(rows);
  placementFor(rows, { layout, archetype: 'walkin-u' });
  assert.equal(JSON.stringify({ rows, layout }), before);
});

// levelLabel

test('levelLabel drops a wall head and keeps everything that is not one', () => {
  assert.equal(levelLabel('Back wall: eye level'), 'Eye level');
  assert.equal(levelLabel('Left wall: hanging rod'), 'Hanging rod');
  assert.equal(levelLabel('Floor: full run'), 'Full run');
  // No colon, nothing to strip, even when the head names a wall.
  assert.equal(levelLabel('Floor'), 'Floor');
  assert.equal(levelLabel('Door rack'), 'Door rack');
  // A head that is not a wall stays, colon and all.
  assert.equal(levelLabel('Hanging rod: left'), 'Hanging rod: left');
  assert.equal(levelLabel('Unit 2: middle shelf'), 'Unit 2: middle shelf');
  assert.equal(levelLabel('Back wall:'), 'Back wall:');
  assert.equal(levelLabel(null), '');
});

// whereFor

const WALKIN_NORMALIZED = WALKIN_ROWS.map((r, i) => {
  const { level, icon, ...rest } = r;
  return { lv: level, ic: icon, shelfIndex: i, ...rest };
});
const WALKIN_PLACEMENT = placementFor(WALKIN_NORMALIZED, { archetype: 'walkin-u' });
const CABINET_NORMALIZED = CABINET_ROWS.map((r, i) => {
  const { level, icon, ...rest } = r;
  return { lv: level, ic: icon, shelfIndex: i, ...rest };
});
const CABINET_PLACEMENT = placementFor(CABINET_NORMALIZED, { archetype: 'cabinet' });

test('whereFor names the wall and the level in a room', () => {
  assert.equal(whereFor([2], WALKIN_NORMALIZED, WALKIN_PLACEMENT), 'Back wall · Eye level');
  assert.equal(whereFor([0, 3], WALKIN_NORMALIZED, WALKIN_PLACEMENT), 'Left wall · High shelf, Back wall · Lower shelves');
  assert.equal(whereFor([5], WALKIN_NORMALIZED, WALKIN_PLACEMENT), 'Floor · Full run');
});

test('whereFor gives a unit its full level text', () => {
  assert.equal(CABINET_PLACEMENT.kind, 'unit');
  assert.equal(whereFor([1], CABINET_NORMALIZED, CABINET_PLACEMENT), 'Eye level');
  assert.equal(whereFor([4, 0], CABINET_NORMALIZED, CABINET_PLACEMENT), 'Door rack, Top shelf');
  // A unit keeps a colon head that is not a wall, and one that is.
  const unit = [{ lv: 'Unit 2: middle shelf', shelfIndex: 0 }, { lv: 'Back wall: a', shelfIndex: 1 }];
  assert.equal(whereFor([0, 1], unit, placementFor(unit)), 'Unit 2: middle shelf, Back wall: a');
});

test('whereFor leaves a room\'s Other row with its level alone', () => {
  const rows = [...WALKIN_NORMALIZED, { lv: 'Top shelf', ic: 'up', shelfIndex: 6, zone: 'z' }];
  const p = placementFor(rows, { archetype: 'walkin-u' });
  assert.ok(p.walls.some(w => w.id === 'other' && w.rows.includes(6)));
  assert.equal(whereFor([6], rows, p), 'Top shelf');
  assert.equal(whereFor([6, 2], rows, p), 'Top shelf, Back wall · Eye level');
});

test('whereFor spells out three places and counts the rest', () => {
  assert.equal(whereFor([0, 1, 2, 3], WALKIN_NORMALIZED, WALKIN_PLACEMENT),
    'Left wall · High shelf, Left wall · Eye level, Back wall · Eye level and 1 more');
  assert.equal(whereFor([0, 1, 2, 3, 4, 5], WALKIN_NORMALIZED, WALKIN_PLACEMENT),
    'Left wall · High shelf, Left wall · Eye level, Back wall · Eye level and 3 more');
  // Exactly three is spelled out in full.
  assert.equal(whereFor([0, 1, 2], WALKIN_NORMALIZED, WALKIN_PLACEMENT),
    'Left wall · High shelf, Left wall · Eye level, Back wall · Eye level');
});

test('whereFor deduplicates identical places and keeps the step\'s order', () => {
  assert.equal(whereFor([3, 2, 3], WALKIN_NORMALIZED, WALKIN_PLACEMENT), 'Back wall · Lower shelves, Back wall · Eye level');
  // Two rows that read the same are one place, so they do not push a third into "more".
  const twins = [{ lv: 'Back wall: shelf', shelfIndex: 0 }, { lv: 'Back wall: shelf', shelfIndex: 1 }, { lv: 'Left wall: shelf', shelfIndex: 2 }, { lv: 'Right wall: shelf', shelfIndex: 3 }];
  assert.equal(whereFor([0, 1, 2, 3], twins, placementFor(twins)), 'Back wall · Shelf, Left wall · Shelf, Right wall · Shelf');
});

test('whereFor ignores indexes the map does not have and reads shelfIndex, not position', () => {
  assert.equal(whereFor([9, 2, -1, 1.5, 'x'], WALKIN_NORMALIZED, WALKIN_PLACEMENT), 'Back wall · Eye level');
  const shuffled = [{ lv: 'Back wall: b', shelfIndex: 7 }, { lv: 'Back wall: a', shelfIndex: 3 }, { lv: 'Left wall: c', shelfIndex: 0 }];
  const p = placementFor(shuffled);
  assert.equal(whereFor([7], shuffled, p), 'Back wall · B');
  assert.equal(whereFor([0], shuffled, p), 'Left wall · C');
  assert.equal(whereFor([1], shuffled, p), '');
});

test('whereFor is empty when nothing resolves', () => {
  assert.equal(whereFor([], WALKIN_NORMALIZED, WALKIN_PLACEMENT), '');
  assert.equal(whereFor([9], WALKIN_NORMALIZED, WALKIN_PLACEMENT), '');
  assert.equal(whereFor(undefined, WALKIN_NORMALIZED, WALKIN_PLACEMENT), '');
  assert.equal(whereFor([0], null, WALKIN_PLACEMENT), '');
  assert.equal(whereFor([0], [], placementFor([])), '');
  // A row with no level text has no place to name.
  const blank = [{ shelfIndex: 0, zone: 'z' }];
  assert.equal(whereFor([0], blank, placementFor(blank)), '');
  // No placement at all reads as a unit rather than throwing.
  assert.equal(whereFor([1], CABINET_NORMALIZED, null), 'Eye level');
});

/* ---------- wallGroups: what a list may be headed by ----------
   The export and the after-drawing head a room's rows with its walls. A
   walk-in whose rows all came back "Top shelf" is still a room, but one
   "Other" heading over every row says nothing, so they get no groups. */
test('wallGroups gives a room its walls only when one of them is real', () => {
  const walkIn = placementFor([
    { lv: 'Left wall: high shelf', shelfIndex: 0 }, { lv: 'Back wall: eye level', shelfIndex: 1 }, { lv: 'Top shelf', shelfIndex: 2 },
  ], { archetype: 'walkin-u' });
  assert.equal(walkIn.kind, 'room');
  assert.deepEqual(wallGroups(walkIn).map((w) => w.id), ['left', 'back', 'other']);

  const nameless = placementFor([{ lv: 'Top shelf' }, { lv: 'Eye level' }, { lv: 'Lower shelf' }], { archetype: 'walkin-u' });
  assert.equal(nameless.kind, 'room', 'a walk-in is a room whatever its rows say');
  assert.equal(wallGroups(nameless), null, 'an "Other"-only room must not be headed "Other"');

  const unit = placementFor([{ lv: 'Top shelf' }, { lv: 'Eye level' }], { archetype: 'cabinet' });
  assert.equal(wallGroups(unit), null);
  assert.equal(wallGroups(null), null);
});

/* ---------- wallsPlaced: the count plan_created reports ----------
   The privacy page says the event carries "how many of its zones name a
   wall". Counted per row, keyed the way placementFor keys rows (shelfIndex
   first, position as the fallback), so a wrong keying would read as
   "walk-ins never resolve walls" in the dashboard. */
test('wallsPlaced counts the rows that resolved to a wall', () => {
  assert.equal(wallsPlaced({ map: [
    { lv: 'Left wall: high shelf', shelfIndex: 0 }, { lv: 'Left wall: hanging rod', shelfIndex: 1 },
    { lv: 'Back wall: eye level', shelfIndex: 2 }, { lv: 'Back wall: lower shelves', shelfIndex: 3 },
    { lv: 'Right wall: double rods', shelfIndex: 4 }, { lv: 'Floor: full run', shelfIndex: 5 },
  ] }), 6);
  assert.equal(wallsPlaced({ map: [{ lv: 'Top shelf' }, { lv: 'Eye level' }, { lv: 'Lower shelf' }] }), 0);
  assert.equal(wallsPlaced({ map: [{ lv: 'Top shelf' }, { lv: 'Door: hooks', shelfIndex: 7 }] }), 1, 'a row keyed by its own shelfIndex still counts');
  assert.equal(wallsPlaced({ map: [{ lv: 'Back wall: eye level', wall: 'back' }, null, 'not a row'] }), 1, 'junk rows neither count nor throw');
  assert.equal(wallsPlaced(null), 0);
});
