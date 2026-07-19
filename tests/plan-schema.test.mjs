import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, EFFORT_STEP_RANGES } from '../supabase/functions/_shared/planSchema.js';

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

test('vanity without kids present: a safety flag on any row is rejected', () => {
  const plan = basePlan({
    map: [
      { level: 'Under sink', icon: 'down', zone: 'Cleaning supplies', why: 'Out of the way.', shelfIndex: 0, safety: { flag: 'lock-or-latch', why: 'Kept locked.' } },
    ],
  });
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /safety flag "lock-or-latch" is set but no kids are present/);
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

test('shelfIndex out of range for the reported shelfCount is rejected', () => {
  const plan = basePlan({ map: [{ level: 'Ghost shelf', icon: 'up', zone: 'Nothing', why: 'n/a', shelfIndex: 5, safety: { flag: null, why: null } }], shelfCount: 2 });
  const result = validatePlan(plan, noKidsContext);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /out of range for shelfCount 2/);
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
  assert.match(result.errors.join('\n'), /does not fit the measured 14in depth/);
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
