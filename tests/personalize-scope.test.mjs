import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCategoryEdits, includeSpotted, citeGoals, sizeToEffort,
  EFFORT_STEPS, EFFORT_STEP_RANGES,
} from '../js/personalize.js';
import { getDemoScenario } from '../js/demo-scenarios.js';
import { SPACE_CFG } from '../js/wizard-data.js';

/* The contents step is a list of chips, and an unticked chip is an answer:
   "I do not have that here." The plan engine used to read only the chips the
   PLAN listed, so a category the model wrote into a step but never into its
   own list was invisible to the edit. "Move all appliances to the floor zone"
   survived a pantry whose owner never ticked Appliances, with the appliances
   sitting on the shelf map as something the photo had shown. These tests run
   the edit with the chip list the wizard actually showed. */

const NO_KIDS = { kids: { present: 'no', ages: [] }, pets: { present: null, types: [] }, mobility: [], notes: '' };
// What a household without kids was shown for a pantry.
const OFFERED = SPACE_CFG.pantry.categories.filter(c => !/kids/i.test(c));
const WANTED = ['Dry goods & grains', 'Canned goods', 'Snacks'];

const stepText = (plan) => plan.steps.map(s => (s.t ?? s.task) + ' ' + (s.w ?? s.why ?? '')).join(' | ');

/* A normalized plan whose model listed three categories and then talked about
   a fourth it had seen but never listed. */
function scopedFixture() {
  return {
    cats: WANTED.slice(),
    map: [
      { lv: 'Top shelf', shelfIndex: 0, zone: 'Bulk & backup', why: '', eye: false, items: [{ name: 'Dry goods & grains', size: 'm', flags: [] }] },
      { lv: 'Eye level', shelfIndex: 1, zone: 'Daily snacks', why: '', eye: true, items: [{ name: 'Snacks', size: 'm', flags: [] }] },
      { lv: 'Floor', shelfIndex: 2, zone: 'Appliances', why: 'Appliances are heavy.', eye: false,
        items: [{ name: 'Small appliances', size: 'l', flags: ['heavy'] }, { name: 'Canned goods', size: 'm', flags: [] }] },
    ],
    steps: [
      { t: 'Move all appliances to the floor zone', m: '10 min', w: 'Heavy things live low.' },
      { t: 'Face every can label-out', m: '5 min', w: 'Canned goods read at a glance.' },
      { t: 'Decant dry goods into one row', m: '10 min', w: '' },
      { t: 'Group snacks beside the appliances', m: '5 min', w: '' },
      { t: 'Take a final photo', m: '2 min', w: '' },
    ],
    productNeeds: [
      { type: 'basket', qty: 1, purpose: 'Corral the small appliances', targetZone: 'Floor', priority: 'nice' },
      { type: 'clear-bin', qty: 2, purpose: 'Keep snacks visible', targetZone: 'Eye level', priority: 'high' },
    ],
    problems: ['Appliances crowd the floor', 'Cans are stacked three deep'],
    opportunities: ['An appliance garage would free the floor', 'Risers for the cans'],
  };
}

test('a category the wizard offered and the user never ticked is removed from the whole plan', () => {
  // The plan's own list alone cannot see it: this is the bug, kept as the baseline.
  const blind = applyCategoryEdits(scopedFixture(), WANTED);
  assert.match(stepText(blind), /Move all appliances/, 'precondition: without the offered list the step survives');

  const plan = applyCategoryEdits(scopedFixture(), WANTED, { offered: OFFERED });
  assert.doesNotMatch(stepText(plan), /Move all appliances/, 'a step about only an unticked category must go');
  assert.match(stepText(plan), /Group snacks beside the appliances/,
    'a step that also works on a wanted category stays: it is about the snacks too');
  assert.equal(plan.steps.length, 4);
  assert.deepEqual(plan.productNeeds.map(p => p.type), ['clear-bin'], 'a product bought for the unticked category goes');
  assert.deepEqual(plan.problems, ['Cans are stacked three deep']);
  assert.deepEqual(plan.opportunities, ['Risers for the cans']);
  const floor = plan.map.find(m => m.shelfIndex === 2);
  assert.deepEqual(floor.items.map(i => i.name), ['Canned goods']);
  assert.doesNotMatch(floor.zone, /appliance/i);
  // and the item is not lost: it is offered back as something the photo showed
  assert.deepEqual(plan.spotted, [{ name: 'Small appliances', row: 2, source: 'scope', included: false }]);
  assert.deepEqual(plan.cats, WANTED);
});

test('the scope edit never drops the checklist below half its length', () => {
  const plan = scopedFixture();
  plan.steps = [
    { t: 'Move all appliances to the floor zone', m: '10 min', w: '' },
    { t: 'Unplug the appliances before moving them', m: '2 min', w: '' },
    { t: 'Wipe under the appliances', m: '5 min', w: '' },
    { t: 'Face every can label-out', m: '5 min', w: '' },
  ];
  applyCategoryEdits(plan, WANTED, { offered: OFFERED });
  /* Three of four steps are about the unticked category. Dropping them leaves
     one step, which is not a plan; the same all-or-nothing guard as the
     archetype scrub keeps the list whole instead. The item still leaves the map. */
  assert.equal(plan.steps.length, 4, 'a drop that would halve the checklist is refused');
  assert.equal(plan.spotted.length, 1);
});

test('spotted entries dedupe by name, keep what was there, and stop at eight', () => {
  const plan = scopedFixture();
  plan.spotted = Array.from({ length: 7 }, (_, i) => ({ name: `Seen ${i}`, row: null, source: 'photo', included: false }));
  plan.spotted.push({ name: 'small appliances', row: null, source: 'photo', included: true });
  applyCategoryEdits(plan, WANTED, { offered: OFFERED });
  assert.equal(plan.spotted.length, 8, 'the existing eight stay; nothing is appended past the cap');
  assert.equal(plan.spotted.filter(s => /appliances/i.test(s.name)).length, 1, 'same name, one entry');
  assert.equal(plan.spotted[7].included, false, 'an item that just left the map is not included');

  const full = scopedFixture();
  full.spotted = Array.from({ length: 8 }, (_, i) => ({ name: `Seen ${i}`, row: null, source: 'photo', included: false }));
  applyCategoryEdits(full, WANTED, { offered: OFFERED });
  assert.equal(full.spotted.length, 8);
  assert.ok(full.spotted.every(s => /^Seen/.test(s.name)), 'the cap keeps the entries that were already there');
});

/* ---------- includeSpotted: "Also in your photo", the Add button ---------- */

test('includeSpotted puts the item back on its row, in the category list, with one step, and is idempotent', () => {
  const plan = applyCategoryEdits(scopedFixture(), WANTED, { offered: OFFERED });
  includeSpotted(plan, 0, OFFERED);
  assert.equal(plan.spotted[0].included, true);
  const floor = plan.map.find(m => m.shelfIndex === 2);
  const item = floor.items.find(i => i.name === 'Small appliances');
  assert.deepEqual(item, { name: 'Small appliances', size: 'm', flags: [], added: true }, 'placed on the row it was removed from');
  assert.ok(plan.cats.includes('Appliances'), 'the matching wizard chip joins the category list');
  const found = plan.steps.filter(s => /Small appliances/.test(s.t + ' ' + s.w));
  assert.equal(found.length, 1);
  assert.deepEqual({ ...found[0] }, { t: 'Find a spot for Small appliances', m: '5 min', w: 'You added it from your photo.', rows: [2], _p: true });

  const once = JSON.stringify(plan);
  includeSpotted(plan, 0, OFFERED);
  assert.equal(JSON.stringify(plan), once, 'a second click changes nothing');
});

test('includeSpotted falls back to a keyword fit, then to the eye row', () => {
  const plan = scopedFixture();
  plan.spotted = [
    { name: 'Canned soup', row: null, source: 'photo', included: false },
    { name: 'Pet food', row: null, source: 'photo', included: false },
  ];
  includeSpotted(plan, 0);
  assert.ok(plan.map.find(m => m.shelfIndex === 2).items.some(i => i.name === 'Canned soup'),
    'no row recorded, so it goes where the zone text fits ("Canned goods")');
  includeSpotted(plan, 1);
  assert.ok(plan.map.find(m => m.eye).items.some(i => i.name === 'Pet food'), 'nothing fits, so the eye row');
  assert.deepEqual(plan.cats, WANTED, 'no offered list, so no chip is invented for them');
  assert.equal(plan.steps.filter(s => /Canned soup|Pet food/.test(s.t)).length, 2, 'one step each');
  assert.ok(plan.steps.every(s => !/Find a spot/.test(s.t) || s._p), 'the added steps are protected from effort trimming');
});

test('includeSpotted adds no step when one already names the item, and survives bad input', () => {
  const plan = scopedFixture();
  plan.spotted = [{ name: 'Canned goods', row: 2, source: 'photo', included: false }];
  const before = plan.steps.length;
  includeSpotted(plan, 0, OFFERED);
  assert.equal(plan.steps.length, before, '"Face every can label-out" mentions canned goods in its why already');
  assert.equal(plan.map.find(m => m.shelfIndex === 2).items.filter(i => i.name === 'Canned goods').length, 1,
    'an item already on the row is not doubled');
  assert.equal(includeSpotted(plan, 7), plan, 'an index with nothing behind it is a no-op');
  assert.equal(includeSpotted(null, 0), null);
});

/* ---------- citeGoals: the model's own citation, checked against the user ---------- */

test('citeGoals cites a step only for a goal the user actually gave', () => {
  const raw = {
    steps: [
      { task: 'Label the front edge of every zone', time: '10 min', why: '', goal: "can't find anything" },
      { task: 'Add a riser to the top shelf', time: '10 min', why: '', goal: 'Always running out of room' },
      { task: 'Wipe the shelves', time: '5 min', why: '' },
    ],
  };
  assert.equal(citeGoals(raw, ["Can't find anything", ' Looks cluttered ']), raw);
  // The user's own spelling, in straight quotes, whatever case the model used.
  assert.equal(raw.steps[0].cite, 'You told us: "Can\'t find anything"');
  assert.equal(raw.steps[1].cite, undefined, 'a goal the user did not give is not quoted back to them');
  assert.equal(raw.steps[1].goal, 'Always running out of room', 'left alone, not scrubbed');
  assert.equal(raw.steps[2].cite, undefined);

  const trimmed = { steps: [{ task: 'Hide the noisy things', goal: 'looks cluttered' }] };
  citeGoals(trimmed, [' Looks cluttered ']);
  assert.equal(trimmed.steps[0].cite, 'You told us: "Looks cluttered"', 'matching ignores case and surrounding space');

  assert.equal(citeGoals(null, ['x']), null);
  assert.deepEqual(citeGoals({}, ['x']), {});
  assert.doesNotThrow(() => citeGoals({ steps: [{ task: 'a', goal: 'b' }] }, null));
});

/* ---------- effort: a card nobody touched is not a choice ---------- */

/* The effort card arrives preselected on "Weekend reset". Growing an untouched
   plan to that card's full target wrote four extra steps and then cited
   "You chose Weekend reset" on each, when nobody had. An untouched effort now
   grows the plan only to the floor of its range: enough to be a legal plan,
   nothing claimed beyond that. */
function fiveStepPantry() {
  const p = getDemoScenario('pantry', 'find', NO_KIDS, null);
  p.steps = p.steps.slice(0, 5);
  return p;
}

test('an untouched effort grows only to the floor of its range', () => {
  const [floor] = EFFORT_STEP_RANGES['Full overhaul'];
  const untouched = sizeToEffort(fiveStepPantry(), { effort: 'Full overhaul', effortTouched: false });
  assert.equal(untouched.steps.length, floor, `expected the range floor (${floor}), got ${untouched.steps.length}`);
  assert.doesNotMatch(stepText(untouched), /You chose/, 'nothing was chosen, so no step may say so');
  assert.equal((untouched.opportunities || []).some(o => /comes to \d+ steps/.test(o)), false,
    'the shortfall note is for a plan that could not reach what was asked, and nothing was asked');
});

test('a touched or legacy effort answer keeps today\'s target', () => {
  const touched = sizeToEffort(fiveStepPantry(), { effort: 'Full overhaul', effortTouched: true });
  const legacy = sizeToEffort(fiveStepPantry(), { effort: 'Full overhaul' });
  assert.ok(touched.steps.length > EFFORT_STEP_RANGES['Full overhaul'][0], 'a chosen overhaul grows past the floor');
  assert.ok(touched.steps.length <= EFFORT_STEPS['Full overhaul']);
  assert.equal(legacy.steps.length, touched.steps.length, 'an answer without the flag (a saved plan) is treated as chosen');
  assert.match(stepText(touched), /You chose “Full overhaul”/);
});

test('an untouched effort still trims to the target', () => {
  const p = getDemoScenario('pantry', 'find', NO_KIDS, null);   // nine steps
  sizeToEffort(p, { effort: 'Quick refresh', effortTouched: false });
  assert.equal(p.steps.length, EFFORT_STEPS['Quick refresh'], 'trimming is about the ceiling, and the ceiling did not move');
});
