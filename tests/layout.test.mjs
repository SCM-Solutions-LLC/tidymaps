import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHETYPES, SURFACES, PLACES, ARCHETYPE_LABELS,
  SETUP_ARCHETYPE, SCENARIO_ARCHETYPE,
  surfaceFromIcon, surfaceFromLevelText, normalizeLayout,
  resolveLayout, chipArchetypesFor,
} from '../js/layout.js';
import { SETUP_TYPES } from '../js/wizard-data.js';
import { getDemoScenario } from '../js/demo-scenarios.js';

const ARCHETYPE_SET = new Set(ARCHETYPES);
const SURFACE_SET = new Set(SURFACES);

// Enum coverage

test('every archetype has a label', () => {
  for (const a of ARCHETYPES) {
    assert.ok(ARCHETYPE_LABELS[a], `${a}: missing label`);
  }
});

// Setup mapping completeness

test('every setup id has a valid SETUP_ARCHETYPE entry', () => {
  const allSetups = Object.values(SETUP_TYPES).flat().map(t => t.id);
  for (const id of allSetups) {
    const arch = SETUP_ARCHETYPE[id];
    assert.ok(arch, `${id}: missing SETUP_ARCHETYPE entry`);
    assert.ok(ARCHETYPE_SET.has(arch), `${id}: archetype "${arch}" is not a valid archetype`);
  }
});

test('SETUP_ARCHETYPE contains no extra entries beyond SETUP_TYPES', () => {
  const allSetups = new Set(Object.values(SETUP_TYPES).flat().map(t => t.id));
  for (const id of Object.keys(SETUP_ARCHETYPE)) {
    assert.ok(allSetups.has(id), `SETUP_ARCHETYPE has extra key "${id}" not in SETUP_TYPES`);
  }
});

// Scenario mapping completeness

test('every scenario key has a valid SCENARIO_ARCHETYPE entry', () => {
  const scenarioKeys = ['pantry','cabinet','closet','walkin','garage','laundry',
    'kids','attic','other','drawers','junk','bathroom','linen','fridge','dresser','workbench'];
  for (const key of scenarioKeys) {
    const arch = SCENARIO_ARCHETYPE[key];
    assert.ok(arch, `${key}: missing SCENARIO_ARCHETYPE entry`);
    assert.ok(ARCHETYPE_SET.has(arch), `${key}: archetype "${arch}" is not valid`);
  }
});

// surfaceFromIcon

test('surfaceFromIcon derives surface from icon keywords', () => {
  assert.equal(surfaceFromIcon('rod'), 'rod');
  assert.equal(surfaceFromIcon('hook'), 'rod');
  assert.equal(surfaceFromIcon('drawer'), 'drawer');
  assert.equal(surfaceFromIcon('door'), 'door');
  assert.equal(surfaceFromIcon('eye'), null);
  assert.equal(surfaceFromIcon('up'), null);
  assert.equal(surfaceFromIcon('middle'), null);
  assert.equal(surfaceFromIcon(null), null);
  assert.equal(surfaceFromIcon(''), null);
});

// surfaceFromLevelText

test('surfaceFromLevelText derives surface from level names', () => {
  assert.equal(surfaceFromLevelText('Hanging rod: left'), 'rod');
  assert.equal(surfaceFromLevelText('Top drawer'), 'drawer');
  assert.equal(surfaceFromLevelText('Floor / hooks'), 'floor');
  assert.equal(surfaceFromLevelText('Door / side'), 'door');
  assert.equal(surfaceFromLevelText('Pegboard wall'), 'pegboard');
  assert.equal(surfaceFromLevelText('Bench surface'), 'worktop');
  assert.equal(surfaceFromLevelText('Top shelf'), null);
  assert.equal(surfaceFromLevelText('Eye level'), null);
  assert.equal(surfaceFromLevelText(null), null);
});

// normalizeLayout

test('normalizeLayout accepts valid layout and rejects invalid', () => {
  const valid = normalizeLayout({ type: 'shelves' }, 5);
  assert.equal(valid.type, 'shelves');

  const withSections = normalizeLayout({
    type: 'walkin-u',
    sections: [
      { id: 'left', label: 'Left wall', place: 'left', rows: [0, 1] },
      { id: 'back', label: 'Back wall', place: 'back', rows: [2, 3] },
    ],
  }, 5);
  assert.equal(withSections.type, 'walkin-u');
  assert.equal(withSections.sections.length, 2);
  assert.deepEqual(withSections.sections[0].rows, [0, 1]);

  assert.equal(normalizeLayout(null, 5), null);
  assert.equal(normalizeLayout({}, 5), null);
  assert.equal(normalizeLayout({ type: 'invalid-type' }, 5), null);
});

test('normalizeLayout deduplicates rows across sections', () => {
  const layout = normalizeLayout({
    type: 'walkin-u',
    sections: [
      { id: 'a', label: 'A', rows: [0, 1, 2] },
      { id: 'b', label: 'B', rows: [1, 2, 3] },
    ],
  }, 5);
  assert.deepEqual(layout.sections[0].rows, [0, 1, 2]);
  assert.deepEqual(layout.sections[1].rows, [3]);
});

test('normalizeLayout clamps out-of-range rows', () => {
  const layout = normalizeLayout({
    type: 'shelves',
    sections: [{ id: 'a', label: 'A', rows: [0, 5, 99, -1] }],
  }, 3);
  for (const r of layout.sections[0].rows) {
    assert.ok(r >= 0 && r < 3, `row ${r} out of range for shelfCount=3`);
  }
});

// resolveLayout priority chain

test('resolveLayout priority: override > ai > setup > scenario > default', () => {
  const map = [{lv:'Top', surface:'shelf'}, {lv:'Bottom', surface:'shelf'}];
  const ai = { layout: { type: 'fridge' }, map };

  const r1 = resolveLayout({ ai, setup: 'cabinet', scenarioKey: 'pantry', override: 'workbench', map });
  assert.equal(r1.type, 'workbench');
  assert.equal(r1.source, 'override');

  const r2 = resolveLayout({ ai, setup: 'cabinet', scenarioKey: 'pantry', map });
  assert.equal(r2.type, 'fridge');
  assert.equal(r2.source, 'ai');

  const r3 = resolveLayout({ ai: { map }, setup: 'cabinet', scenarioKey: 'pantry', map });
  assert.equal(r3.type, 'cabinet');
  assert.equal(r3.source, 'setup');

  const r4 = resolveLayout({ ai: { map }, scenarioKey: 'bathroom', map });
  assert.equal(r4.type, 'under-sink');
  assert.equal(r4.source, 'scenario');

  const r5 = resolveLayout({ ai: { map }, map });
  assert.equal(r5.type, 'shelves');
  assert.equal(r5.source, 'default');
});

test('resolveLayout assigns every row to exactly one section', () => {
  const map = Array.from({ length: 6 }, (_, i) => ({ lv: `Row ${i}`, surface: 'shelf' }));
  const ai = {
    layout: {
      type: 'walkin-u',
      sections: [
        { id: 'left', label: 'Left', rows: [0, 1] },
        { id: 'back', label: 'Back', rows: [2, 3] },
      ],
    },
    map,
  };
  const result = resolveLayout({ ai, map });
  const allRows = result.sections.flatMap(s => s.rows).sort();
  assert.deepEqual(allRows, [0, 1, 2, 3, 4, 5]);
});

test('resolveLayout surfaceFor uses explicit > level-text > archetype default', () => {
  const map = [
    { lv: 'Top shelf', surface: 'rod' },
    { lv: 'Hanging rod: left' },
    { lv: 'Middle shelf' },
    { lv: 'Floor' },
  ];
  const result = resolveLayout({ ai: { map }, scenarioKey: 'closet', map });
  assert.equal(result.surfaceFor(0), 'rod');
  assert.equal(result.surfaceFor(1), 'rod');
  assert.equal(result.surfaceFor(2), 'rod');
  assert.equal(result.surfaceFor(3), 'floor');
});

// Demo scenario layout metadata

test('every demo scenario emits valid layout metadata', () => {
  const keys = Object.keys(SCENARIO_ARCHETYPE);
  for (const key of keys) {
    const plan = getDemoScenario(key, null, null, null);
    assert.ok(plan.layout, `${key}: scenario missing layout`);
    assert.ok(ARCHETYPE_SET.has(plan.layout.type), `${key}: invalid layout type "${plan.layout.type}"`);
    assert.equal(plan.layout.type, SCENARIO_ARCHETYPE[key],
      `${key}: scenario layout.type "${plan.layout.type}" does not match SCENARIO_ARCHETYPE "${SCENARIO_ARCHETYPE[key]}"`);

    for (let i = 0; i < plan.map.length; i++) {
      const row = plan.map[i];
      assert.ok(row.surface == null || SURFACE_SET.has(row.surface),
        `${key} row ${i}: invalid surface "${row.surface}"`);
    }

    if (plan.layout.sections) {
      const allRows = plan.layout.sections.flatMap(s => s.rows);
      const unique = new Set(allRows);
      assert.equal(allRows.length, unique.size, `${key}: duplicate rows across sections`);
      for (const r of allRows) {
        assert.ok(r >= 0 && r < plan.map.length, `${key}: section row ${r} out of range`);
      }
    }
  }
});

// chipArchetypesFor

test('chipArchetypesFor returns unique archetypes for known spaces', () => {
  const pantryChips = chipArchetypesFor('pantry');
  assert.ok(pantryChips.length >= 3);
  assert.equal(new Set(pantryChips).size, pantryChips.length);
  for (const a of pantryChips) assert.ok(ARCHETYPE_SET.has(a));
});

test('chipArchetypesFor returns all archetypes for unknown spaces', () => {
  const chips = chipArchetypesFor('nonexistent');
  assert.deepEqual(chips, ARCHETYPES);
});
