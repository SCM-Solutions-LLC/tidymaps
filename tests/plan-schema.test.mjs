import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePlan, EFFORT_STEP_RANGES, ARCHETYPES, SURFACES, PLACES, usableShelfDepth } from '../supabase/functions/_shared/planSchema.js';
import {
  ARCHETYPES as CLIENT_ARCHETYPES,
  SURFACES as CLIENT_SURFACES,
  PLACES as CLIENT_PLACES,
} from '../js/layout.js';

/* Minimal, schema-valid plan skeleton. Each test overrides only what it's
   exercising, so a failure always points at the field the test is actually
   about instead of an unrelated typo elsewhere in the fixture. */
function basePlan({ map, steps, productNeeds, shelfCount } = {}) {
  const defaultMap = [
    { level: 'Top shelf', icon: 'up', zone: 'Bulk overflow', why: 'Rarely used.', shelfIndex: 0, safety: { flag: null, why: null } },
    { level: 'Eye level', icon: 'eye', zone: 'Daily use', why: 'Easy to reach.', shelfIndex: 1, safety: { flag: null, why: null } },
  ];
  const defaultSteps = [
    { task: 'Empty the shelves', time: '10 min', why: 'Start from a clean slate.' },
    { task: 'Group like items', time: '10 min', why: 'Makes the system easy to keep.' },
    { task: 'Wipe down surfaces', time: '5 min', why: 'Removes dust before restocking.' },
    { task: 'Put items back by zone', time: '15 min', why: 'Every item gets a home.' },
    { task: 'Add labels', time: '10 min', why: 'Keeps the system maintainable.' },
    { task: 'Take a final photo', time: '2 min', why: 'Tracks progress.' },
    { task: 'Do a last safety check', time: '5 min', why: 'Confirms placements are safe.' },
  ];
  return {
    spaceType: 'Garage shelving',
    summary: 'Utility shelving with mixed tools and supplies.',
    map: map || defaultMap,
    geometry: {
      unit: 'in', width: 36, height: 72, depth: 18,
      shelfCount: shelfCount || (map ? map.length : defaultMap.length),
      shelfYFracs: (map || defaultMap).map((_, i, arr) => arr.length === 1 ? 0 : i / (arr.length - 1)),
      estimated: true,
    },
    steps: steps || defaultSteps,
    productNeeds: productNeeds || [],
  };
}

const noKidsContext = { effort: 'Weekend project', household: { kids: { present: false, ages: [] } } };
const kidsContext = { effort: 'Weekend project', household: { kids: { present: true, ages: [4] } } };

test('garage/utility-shelving with 2 kids: safety flags allowed, valid plan passes', () => {
  const plan = basePlan({
    map: [
      { level: 'Top shelf', icon: 'up', zone: 'Chemicals', why: 'Out of reach.', shelfIndex: 0, safety: { flag: 'keep-high', why: 'Cleaning sprays stay away from a 4-year-old.' } },
      { level: 'Low shelf', icon: 'down', zone: 'Kid sports gear', why: 'Reachable without climbing.', shelfIndex: 1, safety: { flag: 'kid-safe', why: 'Kids can grab their own gear safely.' } },
    ],
  });
  const result = validatePlan(plan, kidsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
});

test('a safety flag with nobody in the house to protect is rejected', () => {
  const plan = basePlan({
    map: [
      { level: 'Under sink', icon: 'down', zone: 'Cleaning supplies', why: 'Out of the way.', shelfIndex: 0, safety: { flag: 'lock-or-latch', why: 'Kept locked.' } },
    ],
  });
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /no kids and no pets/);
});

/* The prompt tells the model that a cat reaches ANY height, so "a closed door
   or latch is the barrier and height is not" — and the validator rejected
   every flag without kids, which made that instruction impossible to follow.
   A pet household's correctly latched cabinet was thrown away for being
   latched. */
test('a pet household may latch a cabinet, which is the only barrier that works', () => {
  const plan = basePlan({
    map: [
      { level: 'Floor level', icon: 'down', zone: 'Cleaning supplies', why: 'Out of the way.', shelfIndex: 0,
        safety: { flag: 'lock-or-latch', why: 'Latched, because the cat can reach any shelf.' } },
    ],
  });
  const petsContext = { effort: 'Weekend project', household: { kids: { present: false }, pets: { present: true, types: ['Cat'] } } };
  const result = validatePlan(plan, petsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));

  // kid-safe still means what it says: that one needs kids.
  plan.map[0].safety = { flag: 'kid-safe', why: 'Reachable.' };
  assert.match(validatePlan(plan, petsContext).errors.join('\n'), /"kid-safe" is set but no kids/);
});

test('vanity without kids present: no safety flags at all is valid', () => {
  const plan = basePlan({
    map: [
      { level: 'Under sink', icon: 'down', zone: 'Cleaning supplies', why: 'Grouped together.', shelfIndex: 0, safety: { flag: null, why: null } },
    ],
  });
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
});

test('pantry quick-refresh: step count within the Quick range (3-6) is valid', () => {
  const plan = basePlan({
    steps: [
      { task: 'Toss expired items', time: '5 min', why: 'Frees up space.' },
      { task: 'Group snacks together', time: '10 min', why: 'Easier to find.' },
      { task: 'Wipe the top shelf', time: '5 min', why: 'Quick refresh.' },
      { task: 'Straighten cans', time: '5 min', why: 'Looks tidy fast.' },
    ],
  });
  const result = validatePlan(plan, { effort: 'Quick 30-minute reset', household: { kids: { present: false, ages: [] } } });
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
});

test('step count outside the effort-scaled range is rejected, not silently truncated', () => {
  const manySteps = Array.from({ length: 12 }, (_, i) => ({ task: `Step ${i}`, time: '5 min', why: 'Because reasons.' }));
  const plan = basePlan({ steps: manySteps });
  const result = validatePlan(plan, { effort: 'Quick 30-minute reset', household: { kids: { present: false, ages: [] } } });
  assert.equal(result.ok, false);
  const [min, max] = EFFORT_STEP_RANGES['Quick 30-minute reset'];
  assert.match(result.errors.join('\n'), new RegExp(`expected ${min}-${max} steps`));
});

test('two map rows claiming the same shelfIndex are rejected instead of double-counted', () => {
  const plan = basePlan({
    map: [
      { level: 'Top shelf', icon: 'up', zone: 'Bulk overflow', why: 'Rarely used.', shelfIndex: 0, safety: { flag: null, why: null } },
      { level: 'Top shelf (safety pass)', icon: 'up', zone: 'Chemicals', why: 'Also up here.', shelfIndex: 0, safety: { flag: null, why: null } },
    ],
  });
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicates shelfIndex 0/);
});

test('a shelfIndex pointing at a row the map does not have is rejected', () => {
  // shelfCount is aligned to the map before this runs, so the range a row has
  // to fall inside is the map's own length — here, two rows.
  const plan = basePlan({
    map: [
      { level: 'Top shelf', icon: 'up', zone: 'Bulk', why: 'Rarely used.', shelfIndex: 0, safety: { flag: null, why: null } },
      { level: 'Ghost shelf', icon: 'up', zone: 'Nothing', why: 'n/a', shelfIndex: 5, safety: { flag: null, why: null } },
    ],
  });
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /out of range for shelfCount 2/);
});

test('fractional shelfIndex is rejected structurally', () => {
  const plan = basePlan();
  plan.map[0].shelfIndex = 0.5;
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /shelfIndex/);
});

test('shelfYFracs is repaired rather than fatal, so a good plan survives it', () => {
  /* A walk-in pantry analysis was thrown away for "positions must be strictly
     increasing". The prompt has the model walk multi-wall spaces wall by wall,
     so heights reset at every wall boundary and the list can never be globally
     increasing. normalizeViewerGeometry on the client already discards a bad
     array and substitutes even spacing, so rejecting the plan server-side cost
     the user 80 seconds of analysis over a value the renderer overwrites. */
  const wallByWall = basePlan();
  wallByWall.geometry.shelfYFracs = [0.8, 0.2];   // second wall restarts at the top
  let result = validatePlan(wallByWall, noKidsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
  assert.ok(
    result.value.geometry.shelfYFracs.every((v, i, all) => i === 0 || v > all[i - 1]),
    'the repaired array must be strictly increasing for the renderer',
  );

  const tooShort = basePlan();
  tooShort.geometry.shelfYFracs = [0.1];
  result = validatePlan(tooShort, noKidsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
  assert.equal(result.value.geometry.shelfYFracs.length, result.value.geometry.shelfCount);

  // A well-formed array is passed through untouched.
  const good = basePlan();
  good.geometry.shelfYFracs = [0.2, 0.7];
  result = validatePlan(good, noKidsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
  assert.deepEqual(result.value.geometry.shelfYFracs, [0.2, 0.7]);
});

test('productNeeds.maxDims must fit the measured shelf depth minus 0.5in clearance', () => {
  const plan = basePlan({
    productNeeds: [
      { type: 'clear-bin', qty: 2, purpose: 'Corral loose items', targetZone: 'Eye level', maxDims: { w_in: 10, h_in: 8, d_in: 14 }, priority: 'high' },
    ],
  });
  const tightContext = { ...noKidsContext, dims: { d_in: 14 } }; // 14in shelf, needs <=13.5in depth
  const result = validatePlan(plan, tightContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /does not fit the 14in usable shelf depth/);
});

/* For a walk-in the user measured a ROOM, so d_in is 72 inches of floor while
   the shelving along its walls is 8-18 inches deep. Checking product depth
   against the room made this rule toothless exactly where it mattered most:
   a 20in bin "fit" a shelf that could never hold it, and the same number drove
   the 3D view, which rendered organizers straight through the shelf. */
test('a walk-in checks product depth against its shelves, not the room', () => {
  const roomDims = { w_in: 72, h_in: 96, d_in: 72 };
  const shelf = usableShelfDepth('walkin-u', roomDims);
  assert.ok(shelf >= 8 && shelf <= 18, `walk-in shelving should be 8-18in, got ${shelf}`);

  const tooDeep = basePlan({
    productNeeds: [
      { type: 'clear-bin', qty: 2, purpose: 'Corral loose items', targetZone: 'Eye level', maxDims: { w_in: 10, h_in: 8, d_in: 20 }, priority: 'high' },
    ],
  });
  tooDeep.layout = { type: 'walkin-u', sections: [] };
  const result = validatePlan(tooDeep, { ...noKidsContext, dims: roomDims });
  assert.equal(result.ok, false, 'a 20in bin cannot fit a walk-in shelf');
  assert.match(result.errors.join('\n'), /usable shelf depth/);

  // A bin sized for the shelving is still fine.
  const fits = basePlan({
    productNeeds: [
      { type: 'clear-bin', qty: 2, purpose: 'Corral loose items', targetZone: 'Eye level', maxDims: { w_in: 10, h_in: 8, d_in: 12 }, priority: 'high' },
    ],
  });
  fits.layout = { type: 'walkin-u', sections: [] };
  const fitsResult = validatePlan(fits, { ...noKidsContext, dims: roomDims });
  assert.equal(fitsResult.ok, true, fitsResult.errors && fitsResult.errors.join('; '));

  // A cabinet's measured depth IS its shelf depth, so nothing changes there.
  assert.equal(usableShelfDepth('cabinet', { w_in: 36, d_in: 16 }), 16);
  assert.equal(usableShelfDepth(null, { w_in: 36, d_in: 16 }), 16);
});

/* Tightening a validator without telling the model is how the shelfCount and
   shelfYFracs rejections happened: the user waited out a full analysis and got
   a demo plan. The depth limit has to reach the prompt too, and because the
   model picks the archetype, it has to carry both numbers. */
test('the enforced-limits block states the depth rule the validator applies', () => {
  const fn = readFileSync(new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');
  assert.match(fn, /usableShelfDepth/, 'the prompt must derive its depth limit from the validator helper');
  assert.match(fn, /maxDims\.d_in/, 'the enforced-limits block never mentions the depth rule');
  assert.match(fn, /walkin-u or l-run/, 'the model is not told the room-shaped archetypes are different');
});

test('productNeeds.maxDims that fits within clearance is valid', () => {
  const plan = basePlan({
    productNeeds: [
      { type: 'clear-bin', qty: 2, purpose: 'Corral loose items', targetZone: 'Eye level', maxDims: { w_in: 10, h_in: 8, d_in: 13 }, priority: 'high' },
    ],
  });
  const okContext = { ...noKidsContext, dims: { d_in: 14 } };
  const result = validatePlan(plan, okContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
});

test('an unknown product type is rejected at the structural level', () => {
  const plan = basePlan({
    productNeeds: [
      { type: 'magic-shelf', qty: 1, purpose: 'Wishful thinking', targetZone: 'Eye level', maxDims: null, priority: 'nice' },
    ],
  });
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /productNeeds/);
});

test('an unknown safety flag value is rejected at the structural level', () => {
  const plan = basePlan({
    map: [{ level: 'Top shelf', icon: 'up', zone: 'Bulk', why: 'n/a', shelfIndex: 0, safety: { flag: 'do-not-touch', why: 'invalid enum' } }],
  });
  const result = validatePlan(plan, kidsContext);
  assert.equal(result.ok, false);
});

test('missing required top-level fields are rejected', () => {
  const result = validatePlan({ spaceType: 'Pantry' }, noKidsContext);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

// --- Layout validation ---

test('valid layout with sections is accepted', () => {
  const plan = basePlan({
    map: [
      { level: 'Left wall: top', icon: 'up', zone: 'Bulk', why: 'Rarely used.', shelfIndex: 0, safety: { flag: null, why: null }, surface: 'shelf' },
      { level: 'Left wall: bottom', icon: 'down', zone: 'Daily', why: 'Easy reach.', shelfIndex: 1, safety: { flag: null, why: null }, surface: 'shelf' },
      { level: 'Back wall: top', icon: 'up', zone: 'Overflow', why: 'Extra space.', shelfIndex: 2, safety: { flag: null, why: null }, surface: 'rod' },
    ],
    shelfCount: 3,
  });
  plan.layout = {
    type: 'walkin-u',
    sections: [
      { id: 'left', label: 'Left wall', place: 'left', rows: [0, 1] },
      { id: 'back', label: 'Back wall', place: 'back', rows: [2] },
    ],
  };
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
});

test('null layout is accepted (backward compat)', () => {
  const plan = basePlan();
  plan.layout = null;
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
});

test('absent layout is accepted (old plans)', () => {
  const plan = basePlan();
  delete plan.layout;
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
});

test('layout section row out of range is rejected', () => {
  const plan = basePlan();
  plan.layout = { type: 'shelves', sections: [{ id: 'main', rows: [0, 1, 10] }] };
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /row 10 >= shelfCount/);
});

test('layout section row in multiple sections is rejected', () => {
  const plan = basePlan({
    map: [
      { level: 'Top', icon: 'up', zone: 'Bulk', why: 'n/a', shelfIndex: 0, safety: { flag: null, why: null } },
      { level: 'Mid', icon: 'eye', zone: 'Daily', why: 'n/a', shelfIndex: 1, safety: { flag: null, why: null } },
      { level: 'Low', icon: 'down', zone: 'Kids', why: 'n/a', shelfIndex: 2, safety: { flag: null, why: null } },
    ],
    shelfCount: 3,
  });
  plan.layout = {
    type: 'l-run',
    sections: [
      { id: 'a', rows: [0, 1] },
      { id: 'b', rows: [1, 2] },
    ],
  };
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /row 1 appears in multiple sections/);
});

test('invalid layout type is rejected at the structural level', () => {
  const plan = basePlan();
  plan.layout = { type: 'igloo' };
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
});

test('invalid surface value on a map row is rejected', () => {
  const plan = basePlan({
    map: [
      { level: 'Top', icon: 'up', zone: 'Bulk', why: 'n/a', shelfIndex: 0, safety: { flag: null, why: null }, surface: 'conveyor-belt' },
    ],
  });
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
});

test('valid surface values on map rows are accepted', () => {
  const plan = basePlan({
    map: [
      { level: 'Shelf', icon: 'shelf', zone: 'Items', why: 'n/a', shelfIndex: 0, safety: { flag: null, why: null }, surface: 'shelf' },
      { level: 'Rod', icon: 'rod', zone: 'Clothes', why: 'n/a', shelfIndex: 1, safety: { flag: null, why: null }, surface: 'rod' },
    ],
  });
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
});

// --- Client/server enum parity ---

test('client ARCHETYPES match server ARCHETYPES exactly', () => {
  assert.deepEqual(CLIENT_ARCHETYPES, ARCHETYPES);
});

test('client SURFACES match server SURFACES exactly', () => {
  assert.deepEqual(CLIENT_SURFACES, SURFACES);
});

test('client PLACES match server PLACES exactly', () => {
  assert.deepEqual(CLIENT_PLACES, PLACES);
});

/* A walk-in pantry analysis came back with shelfCount 13 and the entire plan
   was discarded over that one field: 81 seconds of work, one validation error,
   nothing shown to the user. The cap has always been in the schema, but the
   prompt never mentioned it and instead told the model to count multi-wall
   spaces wall by wall, which is precisely how a 6x8 walk-in produces more than
   12 levels. These two have to move together. */
test('the analyze-space prompt states the shelfCount cap the schema enforces', () => {
  const schemaSrc = readFileSync(new URL('../supabase/functions/_shared/planSchema.js', import.meta.url), 'utf8');
  const capMatch = schemaSrc.match(/shelfCount: z\.number\(\)\.int\(\)\.min\(1\)\.max\((\d+)\)/);
  assert.ok(capMatch, 'planSchema must declare a shelfCount maximum');
  const cap = Number(capMatch[1]);

  // The schema really does reject one row past the cap.
  const overCap = basePlan({
    map: Array.from({ length: cap + 1 }, (_, i) => ({
      level: `Level ${i}`, icon: 'shelf', zone: 'Things', why: 'Because.',
      shelfIndex: i, safety: { flag: null, why: null },
    })),
  });
  assert.equal(validatePlan(overCap, {}).ok, false, `${cap + 1} rows must be rejected`);

  // ...and the prompt names that same number as a hard limit, so the model is
  // told the rule rather than discovering it by having its plan thrown away.
  const prompt = readFileSync(new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');
  assert.match(prompt, new RegExp(`NEVER more than ${cap}`),
    'the map schema comment must state the row cap');
  assert.match(prompt, new RegExp(`MUST be ${cap} or fewer`),
    'the shelfCount comment must state the cap');
  assert.match(prompt, new RegExp(`never exceed ${cap} rows`),
    'the layout rules must state the cap as a hard limit');
});

/* Three consecutive production failures came from the same defect: the prompt
   described a rule approximately while checkInvariants enforced it exactly.
   "6-9 ordered steps" against effort ranges of 7-10 and 9-14; safety rules that
   "apply when kids are present" against a validator that rejects any flag when
   they are not. Each mismatch cost a user an 80-second analysis and returned a
   demo plan. The enforced-limits block closes that gap by restating the
   context-dependent rules to the model, derived from the same constants the
   validator reads so the two cannot drift. */
test('the enforced-limits block is derived from the validator constants', () => {
  const fn = readFileSync(new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');

  // The step range is read from the validator's own table, not retyped.
  assert.match(fn, /EFFORT_STEP_RANGES\[ctx\.effort as string\] \?\? DEFAULT_STEP_RANGE/);
  assert.match(fn, /between \$\{minSteps\} and \$\{maxSteps\} steps/);
  assert.doesNotMatch(fn, /6-9 ordered steps/,
    'the old hardcoded range contradicted EFFORT_STEP_RANGES');

  // checkInvariants rejects any non-null flag with no kids, so the model has to
  // be told that outright rather than left to infer it from the safety section.
  assert.match(fn, /safety\.flag MUST be null on every single map row/);

  // Every effort label the wizard can send must resolve to a real range.
  for (const [label, range] of Object.entries(EFFORT_STEP_RANGES)) {
    assert.ok(Array.isArray(range) && range.length === 2 && range[0] <= range[1],
      `${label} must map to a [min, max] pair`);
  }
});

/* ---------- normalizeAi is idempotent ----------
   Saved rows and share payloads store the ALREADY-normalized plan (db.js
   writes state.ai), and the share-link path (js/main.js loadSharedPlan) runs
   it through normalizeAi again. Reading only the raw names blanked every
   step title, zone level and category for every visitor on a shared plan. */
import { normalizeAi as _normalizeAi, modelLabel } from '../js/plan.js';
import { getDemoScenario as _getDemoScenario } from '../js/demo-scenarios.js';
import { state as _state } from '../js/state.js';

test('normalizing an already-normalized plan is a no-op, not a wipe', () => {
  _state.dims = null;
  const once = _normalizeAi(_getDemoScenario('pantry', 'find',
    { kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' }));
  const twice = _normalizeAi(once);

  assert.ok(once.steps.length > 0 && once.map.length > 0 && once.cats.length > 0, 'precondition');
  assert.deepEqual(twice.steps, once.steps, 'steps lost their titles on re-normalize');
  assert.deepEqual(twice.cats, once.cats, 'categories were dropped on re-normalize');
  assert.deepEqual(twice.map.map(m => m.lv), once.map.map(m => m.lv), 'zone levels blanked');
  assert.deepEqual(twice.map.map(m => m.ic), once.map.map(m => m.ic), 'zone icons reset to the fallback');
  assert.deepEqual(twice.existing, once.existing, 'reuse list blanked');
  assert.deepEqual(twice.features, once.features, 'features blanked');
  for (const s of twice.steps) assert.ok(s.t && s.m !== '—' || s.m === once.steps[0].m, 'step time lost');
});

/* ---------- steps and the shopping list have to agree ----------
   A live plan instructed turntables, can risers and airtight containers across
   four steps and returned productNeeds: [], so the report showed an empty
   shopping list and a Cost tile reading "$0" over a checklist that cannot be
   done for $0. The user had said they were open to buying. They were told to
   buy, and handed no list. */

const coherencePlan = (tasks, productNeeds) => ({
  spaceType: 'Pantry',
  summary: 'A pantry.',
  map: [{ level: 'Top shelf', icon: 'up', zone: 'Baking', why: 'Rarely used', shelfIndex: 0, safety: { flag: null, why: null } }],
  geometry: { unit: 'in', width: 30, height: 60, depth: 14, shelfCount: 1, shelfYFracs: [0.1], estimated: true },
  steps: tasks.map(task => ({ task, time: '10 min', why: 'Because it helps.' })),
  productNeeds,
});
const OPEN_TO_BUYING = { shopping: 'Open to a few ideas', effort: 'Quick refresh' };

test('a plan that instructs a purchase and lists nothing to buy is rejected', () => {
  const r = validatePlan(coherencePlan([
    'Transfer dry goods into airtight containers',
    'Place turntables and load spices',
    'Set up can risers and stock canned goods',
  ], []), OPEN_TO_BUYING);
  assert.equal(r.ok, false);
  const err = r.errors.find(e => /productNeeds does not list/.test(e));
  assert.ok(err, `no coherence error raised: ${r.errors.join(' | ')}`);
  // The message has to name the step and the product, or the retry cannot act on it.
  assert.match(err, /turntable/);
  assert.match(err, /airtight-container/);
  assert.match(err, /Place turntables/);
});

test('the same plan passes once it says what to buy', () => {
  const r = validatePlan(coherencePlan([
    'Place turntables and load spices', 'Sort items by category', 'Label the shelf edges',
  ], [{ type: 'turntable', qty: 2, purpose: 'Rotate spices', targetZone: 'Top shelf', maxDims: null, priority: 'high' }]),
  OPEN_TO_BUYING);
  assert.equal(r.ok, true, r.errors.join(' | '));
});

test('the rule never fires on things a household already owns', () => {
  /* This is the half that decides whether the rule is safe to ship: it rejects
     a plan and costs a retry, so a false positive is expensive. Bins, baskets
     and labels are improvisable, and a step naming an item as already present
     is not a purchase. */
  for (const tasks of [
    ['Corral snacks into bins', 'Label every shelf edge', 'Sort by category'],
    ['Use your existing turntable for spices', 'Group cans by type', 'Wipe the shelves'],
    ['Reuse the baskets you already have', 'Pull the oldest forward', 'Check dates'],
  ]) {
    const r = validatePlan(coherencePlan(tasks, []), OPEN_TO_BUYING);
    assert.equal(r.ok, true, `rejected a plan needing no purchase: ${tasks[0]} — ${r.errors.join(' | ')}`);
  }
});

test('a $0 household is judged by the other rule, not this one', () => {
  /* "Use what I have" is handled by the prompt telling the model to name no
     product at all. Applying the coherence rule there too would demand a
     shopping list from the one user who asked not to have one. */
  const r = validatePlan(coherencePlan([
    'Place turntables and load spices', 'Sort items', 'Label bins',
  ], []), { shopping: 'Use what I have', effort: 'Quick refresh' });
  assert.equal(r.ok, true, r.errors.join(' | '));
});

/* ---------- the model byline ----------
   A live plan read "Analyzed by Claude · sonnet 4 6". The byline built that
   with .replace('claude-','').replace(/-/g,' '), which is lowercase and turns a
   version number's decimal point into a space. Hyphens do two jobs in a model
   id — separating words and standing in for the dot — and replacing both with
   the same character loses the difference. */
test('a model id reads the way a person would write it', () => {
  assert.equal(modelLabel('claude-sonnet-4-6'), 'Sonnet 4.6');
  assert.equal(modelLabel('claude-opus-5'), 'Opus 5');
  // a dated build is not something a reader needs in a byline
  assert.equal(modelLabel('claude-haiku-4-5-20251001'), 'Haiku 4.5');
  assert.equal(modelLabel('claude-sonnet-4-6-latest'), 'Sonnet 4.6');
  // the older order, where the version came first
  assert.equal(modelLabel('claude-3-5-sonnet-20241022'), '3.5 Sonnet');
});

test('an unfamiliar or missing id degrades quietly', () => {
  /* This is a byline, not a contract. An id shape nobody anticipated should
     read a little plainly rather than render nothing, throw, or print the word
     "undefined" on the finished plan. */
  assert.equal(modelLabel(''), '');
  assert.equal(modelLabel('   '), '');
  assert.equal(modelLabel(null), '');
  assert.equal(modelLabel(undefined), '');
  assert.equal(modelLabel('claude-'), '');
  assert.equal(modelLabel('sonnet-4-6'), 'Sonnet 4.6');   // no claude- prefix
  assert.equal(modelLabel('some_future_model'), 'Some_future_model');
  for (const weird of ['-', '--', 'claude-latest', 42, {}]) {
    assert.doesNotThrow(() => modelLabel(weird), `threw on ${JSON.stringify(weird)}`);
  }
});

/* ---------- the household safety contract, enforced ----------

   The prompt states five hard rules in the imperative ("must NEVER", "every
   safety-driven placement must") and checkInvariants used to check one of
   them: a flag set with no kids. The four it did not check are the ones about
   where the bleach goes, which is the wrong half to leave to model
   compliance. Each test below is one of those rules, with its counterpart
   showing the plan that should still pass — a safety check that rejects good
   plans gets turned off, and then none of them are checked. */

// height above the floor = geometry.height * (1 - shelfYFracs[shelfIndex]),
// the same arithmetic the 3D viewer draws with. 72in tall: frac 0.9 is ~7in
// off the floor, frac 0.1 is ~65in up.
const reachPlan = ({ frac, flag = null, why = null, flags = ['chemical'], itemName = 'Drain cleaner' }) => ({
  spaceType: 'Utility shelving',
  summary: 'Utility shelving in the garage.',
  map: [{
    level: 'A shelf', icon: 'down', zone: 'Cleaning supplies', why: 'Grouped together.',
    shelfIndex: 0, safety: { flag, why },
    items: [{ name: itemName, size: 'm', flags }],
  }],
  geometry: { unit: 'in', width: 36, height: 72, depth: 18, shelfCount: 1, shelfYFracs: [frac], estimated: true },
  steps: [
    { task: 'Empty the shelf', time: '10 min', why: 'Start clean.' },
    { task: 'Group like items', time: '10 min', why: 'Easy to keep.' },
    { task: 'Put items back by zone', time: '10 min', why: 'Every item has a home.' },
  ],
  productNeeds: [],
});
const toddlerContext = {
  effort: 'Quick refresh',
  household: { kids: { present: true, ages: ['Toddler'], ageYears: { min: 1, max: 4 } } },
};

test('a hazard within a small child’s reach is rejected, not just discouraged', () => {
  const r = validatePlan(reachPlan({ frac: 0.9 }), toddlerContext);
  assert.equal(r.ok, false);
  const err = r.errors.join('\n');
  // The message has to name the item, the height, and both ways out.
  assert.match(err, /Drain cleaner/);
  assert.match(err, /7in from the floor/);
  assert.match(err, /lock-or-latch/);
});

test('the same hazard is fine latched, or out of reach', () => {
  const latched = validatePlan(reachPlan({ frac: 0.9, flag: 'lock-or-latch', why: 'Latched, out of reach of a toddler.' }), toddlerContext);
  assert.equal(latched.ok, true, latched.errors.join('; '));

  const high = validatePlan(reachPlan({ frac: 0.1 }), toddlerContext);
  assert.equal(high.ok, true, high.errors.join('; '));

  // And a household of teenagers is not the household this rule protects.
  const teens = validatePlan(reachPlan({ frac: 0.9 }), {
    effort: 'Quick refresh',
    household: { kids: { present: true, ages: ['Teen'], ageYears: { min: 13, max: 17 } } },
  });
  assert.equal(teens.ok, true, teens.errors.join('; '));
});

test('kids present but no ages given still gets the height rule', () => {
  // An age nobody gave is not evidence of an older child.
  const r = validatePlan(reachPlan({ frac: 0.95 }), {
    effort: 'Quick refresh', household: { kids: { present: true } },
  });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /within reach of a child/);
});

test('an item that is merely low is not a hazard', () => {
  // The rule is about the four hazard flags, not about everything on the
  // bottom shelf. Over-rejecting here would cost a retry on every good plan.
  const r = validatePlan(reachPlan({ frac: 0.9, flags: [], itemName: 'Tea towels' }), toddlerContext);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('a safety flag with no reason is rejected', () => {
  for (const why of [null, '', '   ']) {
    const r = validatePlan(reachPlan({ frac: 0.1, flag: 'keep-high', why }), toddlerContext);
    assert.equal(r.ok, false, `safety.why ${JSON.stringify(why)} passed as an explanation`);
    assert.match(r.errors.join('\n'), /has no safety\.why/);
  }
});

test('a child’s daily things on a locked shelf is a plan nobody can follow', () => {
  const r = validatePlan(reachPlan({
    frac: 0.1, flag: 'keep-high', why: 'Out of reach.',
    flags: ['kid-frequent'], itemName: 'Their snack box',
  }), toddlerContext);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /"Their snack box" is flagged "kid-frequent" on a row flagged "keep-high"/);
});

/* ---------- geometry.shelfCount ---------- */

/* The prompt calls this a hard limit and nothing checked it: the row-index
   rules only require each shelfIndex to be INSIDE the count, so five rows with
   shelfCount 8 passed. The client then keeps the model's count and clamps
   every shelfIndex into it, so a count under the map stacks two zones onto one
   shelf in the 3D view, and a count over it draws shelves nothing describes. */
test('shelfCount is corrected to the map rather than costing a retry', () => {
  const plan = basePlan({ shelfCount: 8 });   // two map rows
  const r = validatePlan(plan, noKidsContext);
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.value.geometry.shelfCount, 2);
  assert.equal(r.value.geometry.shelfYFracs.length, 2, 'the fracs have to follow the count');

  // Under-counting is the damaging direction, and it is repaired the same way.
  const under = validatePlan(basePlan({ shelfCount: 1 }), noKidsContext);
  assert.equal(under.ok, true, under.errors.join('; '));
  assert.equal(under.value.geometry.shelfCount, 2);
});

/* ---------- productNeeds vs the plan it belongs to ---------- */

test('one listed product does not excuse every other purchase in the plan', () => {
  /* The coherence check ran only when productNeeds was ENTIRELY empty, so a
     plan that listed a label set and then instructed turntables and risers
     passed — the shopping list adds up the labels, and the checklist cannot be
     done without the rest. */
  const r = validatePlan(coherencePlan([
    'Place turntables and load spices',
    'Set up can risers for the soup',
    'Label the shelf edges',
  ], [{ type: 'label-set', qty: 1, purpose: 'Label zones', targetZone: 'Top shelf', maxDims: null, priority: 'nice' }]),
  OPEN_TO_BUYING);
  assert.equal(r.ok, false);
  const err = r.errors.find(e => /productNeeds does not list/.test(e));
  assert.ok(err, `no coherence error raised: ${r.errors.join(' | ')}`);
  assert.match(err, /turntable/);
  assert.match(err, /can-riser or shelf-riser/);
});

test('a plan may list one product and instruct only that one', () => {
  const r = validatePlan(coherencePlan([
    'Place turntables and load spices', 'Sort items by category', 'Label the shelf edges',
  ], [
    { type: 'turntable', qty: 2, purpose: 'Rotate spices', targetZone: 'Top shelf', maxDims: null, priority: 'high' },
    { type: 'label-set', qty: 1, purpose: 'Label zones', targetZone: 'Top shelf', maxDims: null, priority: 'nice' },
  ]), OPEN_TO_BUYING);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('a shopping list for someone who chose to buy nothing is rejected', () => {
  /* The other half of the same answer. The prompt requires an EMPTY
     productNeeds from someone who chose "Use what I have", and nothing checked
     it — so a shopping list could sit under a report promising every step
     works with what is already in the space. */
  const r = validatePlan(coherencePlan(['Sort items by category', 'Label the shelf edges', 'Group like with like'], [
    { type: 'clear-bin', qty: 4, purpose: 'Corral packets', targetZone: 'Top shelf', maxDims: null, priority: 'high' },
  ]), { shopping: 'Use what I have', shoppingTouched: true, effort: 'Quick refresh' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /chose to use only what they already have/);
});

test('the preselected "Use what I have" is not an answer, so it constrains nothing', () => {
  /* PR #84 stopped treating the untouched default as a choice, in the prompt
     and in the client. The validator still read the bare value, so it went on
     enforcing a rule the model was no longer being given — the two halves of
     one answer disagreeing, which is the failure this whole block exists to
     prevent. */
  const untouched = { shopping: 'Use what I have', shoppingTouched: false, effort: 'Quick refresh' };
  const r = validatePlan(coherencePlan(['Sort items by category', 'Label the shelf edges', 'Group like with like'], [
    { type: 'clear-bin', qty: 4, purpose: 'Corral packets', targetZone: 'Top shelf', maxDims: null, priority: 'high' },
  ]), untouched);
  assert.equal(r.ok, true, r.errors.join('; '));

  // ...and the coherence rule applies to them like anyone else who might buy.
  const incoherent = validatePlan(coherencePlan([
    'Place turntables and load spices', 'Sort items by category', 'Label the shelf edges',
  ], []), untouched);
  assert.equal(incoherent.ok, false);
  assert.match(incoherent.errors.join('\n'), /productNeeds does not list/);
});

/* The prompt has to state every rule the validator applies, or the user pays
   80 seconds to discover it. These are the new ones. */
test('the enforced-limits block states the safety rules the validator applies', () => {
  const fn = readFileSync(new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');
  // Derived from the validator's own constants, never retyped.
  assert.match(fn, /KID_REACH_IN, YOUNG_KID_MAX_AGE \} from '\.\.\/_shared\/planSchema\.js'/);
  assert.match(fn, /\$\{KID_REACH_IN\}in of the floor/);
  assert.match(fn, /aged \$\{YOUNG_KID_MAX_AGE\} or under/);
  // Every flagged row needs a reason, and kid-frequent items are not locked away.
  assert.match(fn, /EVERY flagged row must carry a plain-language safety\.why/);
  assert.match(fn, /must not sit on a row flagged "keep-high" or "lock-or-latch"/);
  // A pet household is told which flags it may use, rather than told none.
  assert.match(fn, /"lock-or-latch" and "keep-high" are available for the pets/);
  // The per-item coherence rule says it is per item.
  assert.match(fn, /checked per item, so listing one product does not cover the others/);
});

/* The height rule applies to two flags, and the two it leaves alone are the
   point of this test.

   The prompt used to name four — heavy, chemical, sharp, fragile — and
   enforcing that literally would have rejected 12 of the 16 deterministic
   scenarios, for placements those scenarios are RIGHT about: "Heavy bins go
   low so kids pull them out safely" is this app's own copy, and a rule that
   pushed heavy bins overhead to satisfy a child-safety check would have
   produced the plan that actually injures somebody. */
test('heavy and fragile items belong low with children in the house', () => {
  for (const flag of ['heavy', 'fragile']) {
    const r = validatePlan(reachPlan({ frac: 0.95, flags: [flag], itemName: 'Bin of blocks' }), toddlerContext);
    assert.equal(r.ok, true, `a ${flag} item placed low was rejected: ${r.errors.join('; ')}`);
  }
  // ...while the two that hurt a child who reaches them are still checked.
  for (const flag of ['chemical', 'sharp']) {
    const r = validatePlan(reachPlan({ frac: 0.95, flags: [flag], itemName: 'Drain cleaner' }), toddlerContext);
    assert.equal(r.ok, false, `a ${flag} item within reach passed`);
  }
});

test('the prompt gives the two height rules in opposite directions, on purpose', () => {
  const fn = readFileSync(new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');
  assert.match(fn, /Chemical or sharp items must NEVER be placed below 48 inches/);
  assert.match(fn, /Heavy items go LOW when there are children, and never overhead/);
  // The contradiction is explained where the model reads it, not left to be
  // resolved by whichever sentence it happened to weight more.
  assert.match(fn, /it is not a contradiction/);
});
