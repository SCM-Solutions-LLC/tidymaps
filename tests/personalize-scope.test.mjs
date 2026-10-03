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

/* The half-length guard, at its boundary. Five steps, three of them about an
   unticked category: dropping those leaves two, under ceil(5/2) = 3, so the
   drop is refused and all five stay. Two such steps leave three, which is
   exactly the line, and the drop goes through. */
function fiveSteps(aboutAppliances) {
  const plan = scopedFixture();
  const about = ['Move all appliances to the floor zone', 'Unplug the appliances before moving them', 'Wipe under the appliances'];
  const neutral = ['Face every can label-out', 'Decant dry goods into one row', 'Take a final photo'];
  plan.steps = [...about.slice(0, aboutAppliances), ...neutral.slice(0, 5 - aboutAppliances)]
    .map(t => ({ t, m: '5 min', w: '' }));
  return plan;
}

test('the half-length guard rounds up: five steps keep all five at three removed, and go to three at two', () => {
  const three = applyCategoryEdits(fiveSteps(3), WANTED, { offered: OFFERED });
  assert.equal(three.steps.length, 5, 'kept 2 < ceil(5/2) = 3, so the drop is refused');
  const two = applyCategoryEdits(fiveSteps(2), WANTED, { offered: OFFERED });
  assert.equal(two.steps.length, 3, 'kept 3 >= ceil(5/2) = 3, so the drop goes through');
});

/* The wizard joins two things in one chip and the model writes about one of
   them at a time. "Dry goods & grains" matched only as the whole phrase, so a
   step about "the dry goods" counted as mentioning nothing the user wanted and
   went out with the unticked chip it also named, and the map's "Dry goods"
   item left the row while its chip was ticked. */
test('a ticked chip is matched by its parts, so "Dry goods & grains" covers the dry goods', () => {
  const plan = scopedFixture();
  plan.cats = ['Dry goods', 'Canned goods', 'Snacks', 'Baking'];   // the model's own spelling
  plan.map[0].items = [{ name: 'Dry goods', size: 'm', flags: [] }];
  plan.steps.push({ t: 'Decant the dry goods and baking supplies into bins', m: '10 min', w: '' });
  assert.ok(OFFERED.includes('Baking'), 'precondition: Baking is a chip the user left unticked');
  applyCategoryEdits(plan, WANTED, { offered: OFFERED });
  assert.ok(plan.map[0].items.some(i => i.name === 'Dry goods'), 'the dry goods are what "Dry goods & grains" means');
  assert.match(stepText(plan), /Decant the dry goods and baking supplies/, 'a step about the dry goods is about a ticked chip');
  assert.doesNotMatch(stepText(plan), /Move all appliances/, 'the removal itself still happens');
});

/* The removed side keeps matching whole phrases. "Kids' snacks" and "Snacks"
   share a word, and the one the user ticked decides what that word means. */
function snackFixture() {
  return {
    cats: ['Snacks', "Kids' snacks"],
    map: [
      { lv: 'Eye level', shelfIndex: 0, zone: 'Snacks', why: '', eye: true, items: [{ name: 'Snack packets', size: 'm', flags: [] }] },
      { lv: 'Low shelf', shelfIndex: 1, zone: "Kids' snacks", why: '', eye: false, items: [{ name: "Kids' snacks", size: 'm', flags: [] }] },
    ],
    steps: [
      { t: "Keep the kids' snacks low", m: '5 min', w: '' },
      { t: 'Bin the snacks', m: '5 min', w: '' },
      { t: 'Wipe the shelves', m: '5 min', w: '' },
      { t: 'Take a final photo', m: '2 min', w: '' },
    ],
  };
}
const PANTRY_CHIPS = SPACE_CFG.pantry.categories;

test("ticking only Kids' snacks keeps the kids' snacks and removes the snacks", () => {
  assert.ok(PANTRY_CHIPS.includes('Snacks') && PANTRY_CHIPS.includes("Kids' snacks"), 'precondition: both chips are offered');
  const plan = applyCategoryEdits(snackFixture(), ["Kids' snacks"], { offered: PANTRY_CHIPS });
  assert.ok(plan.map[1].items.some(i => i.name === "Kids' snacks"), 'the ticked chip keeps its item');
  assert.match(stepText(plan), /Keep the kids' snacks low/);
  assert.equal(plan.map[0].items.some(i => i.name === 'Snack packets'), false, 'the unticked chip loses its item');
  assert.doesNotMatch(stepText(plan), /Bin the snacks/);
  assert.deepEqual(plan.spotted.map(s => s.name), ['Snack packets'], 'and the item is offered back');
});

test("ticking Snacks with Kids' snacks unticked removes nothing, which is a decision", () => {
  /* "Kids' snacks" mentions a removed chip and a wanted one, and a thing that
     mentions a wanted chip is never scoped out. The word they share makes the
     kids' snacks a kind of snack, and the conservative side of the rule keeps
     them. Pinned so a tightening of the rule has to be argued here. */
  const plan = applyCategoryEdits(snackFixture(), ['Snacks'], { offered: PANTRY_CHIPS });
  assert.ok(plan.map[0].items.some(i => i.name === 'Snack packets'));
  assert.ok(plan.map[1].items.some(i => i.name === "Kids' snacks"), 'the kids\' snacks stay: they are snacks too');
  assert.equal(plan.steps.length, 4, 'no step leaves');
  assert.equal('spotted' in plan, false, 'nothing was removed, so nothing is offered back');
});

/* normalizeAi writes `spotted` only when there is something in it, and an
   edited plan is saved back. An unconditional assignment gave every edited
   plan an empty list the model never wrote. */
test('a plan the edit removes nothing from gains no spotted list', () => {
  const plan = scopedFixture();
  applyCategoryEdits(plan, [...WANTED, 'Appliances'], { offered: OFFERED });
  assert.equal(plan.map.flatMap(m => m.items).length >= 4, true, 'precondition: every item is still there');
  assert.equal('spotted' in plan, false, 'absent rather than empty, as normalizeAi leaves it');
});

test('spotted entries dedupe by name, keep what was there, and stop at eight', () => {
  const plan = scopedFixture();
  plan.spotted = Array.from({ length: 7 }, (_, i) => ({ name: `Seen ${i}`, row: null, source: 'photo', included: false }));
  /* The model offered the same thing by a different spelling, and the user has
     not taken it. (An entry they did take is a wanted thing, so its item never
     leaves the map; that is pinned further down.) */
  plan.spotted.push({ name: 'small appliances', row: null, source: 'photo', included: false });
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
  const found = plan.steps.filter(s => /small appliances/i.test(s.t + ' ' + s.w));
  assert.equal(found.length, 1);
  // A 'scope' entry can come from a plan that never saw a photo, so the step
  // does not claim one; mid-sentence the item's capital goes.
  assert.deepEqual({ ...found[0] }, { t: 'Find a spot for small appliances', m: '5 min', w: 'You added it back to the plan.', rows: [2], _p: true });

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
  assert.equal(plan.steps.filter(s => /canned soup|pet food/i.test(s.t)).length, 2, 'one step each');
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

/* The Add button put the chip into the PLAN's list, and the next category
   edit built its wanted set from the wizard's list, which never got it. So
   apply, include, apply took the item off its row, flipped the entry back to
   not included and dropped the step, with nobody having touched a chip. The
   entry's included flag is what survives normalizeAi, so it is what the edit
   now reads. */
test('an included spotted item survives the next category edit', () => {
  const plan = applyCategoryEdits(scopedFixture(), WANTED, { offered: OFFERED });
  includeSpotted(plan, 0, OFFERED);
  applyCategoryEdits(plan, WANTED, { offered: OFFERED });   // state.cats still has no Appliances chip
  const floor = plan.map.find(m => m.shelfIndex === 2);
  assert.ok(floor.items.some(i => i.name === 'Small appliances'), 'the item the user added back stays on its row');
  assert.equal(plan.spotted[0].included, true, 'and is still marked as taken');
  assert.equal(plan.steps.filter(s => s.t === 'Find a spot for small appliances').length, 1, 'its step is kept');
  assert.deepEqual(plan.cats, WANTED, 'the wizard list stays authoritative for the chips themselves');
});

test('includeSpotted picks the chip that is the thing, not the first chip whose word it contains', () => {
  const plan = scopedFixture();
  plan.spotted = [
    { name: "Kids' snacks", row: null, source: 'photo', included: false },
    { name: "Kids' snack bars", row: null, source: 'photo', included: false },
  ];
  includeSpotted(plan, 0, ['Snacks', "Kids' snacks"]);
  assert.deepEqual(plan.cats, [...WANTED, "Kids' snacks"], 'the same stem wins over the first match in list order');
  const again = scopedFixture();
  again.spotted = plan.spotted.map(e => ({ ...e, included: false }));
  includeSpotted(again, 1, ['Snacks', "Kids' snacks"]);
  assert.deepEqual(again.cats, [...WANTED, "Kids' snacks"], 'with no exact chip, the longest phrase the name carries');
});

test('includeSpotted is idempotent for a name the word boundary cannot close', () => {
  const plan = scopedFixture();
  plan.spotted = [{ name: 'Jars (misc.)', row: null, source: 'photo', included: false }];
  includeSpotted(plan, 0, OFFERED);
  includeSpotted(plan, 0, OFFERED);
  assert.equal(plan.steps.filter(s => s.t === 'Find a spot for jars (misc.)').length, 1, 'one step, however many taps');
  assert.equal(plan.map.flatMap(m => m.items).filter(i => i.name === 'Jars (misc.)').length, 1);
});

/* ---------- citeGoals: the model's own citation, checked against the user ---------- */

/* The engine's own goal cites go through citeFace, which broke at the colon
   of "You told us:" as if it ended a sentence, so every goal cite on a demo
   plan read as a bare "You told us". A colon that opens a quotation is not
   a break. */
test('a goal cite keeps the goal on the step\'s face', () => {
  const p = getDemoScenario('pantry', 'find', NO_KIDS, { goals: ["Can't find anything"] });
  const cites = p.steps.map(s => s.cite).filter(Boolean);
  assert.ok(cites.length > 0, 'precondition: the goal rule cited a step');
  assert.ok(cites.includes('You told us: “Can\'t find anything”'), `faces: ${cites.join(' | ')}`);
  assert.ok(!cites.includes('You told us'), 'a cite with nothing after the colon tells the reader nothing');
});

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
  assert.equal(raw.steps[0].cite, 'You told us: “Can\'t find anything”', 'the same face as the engine\'s own cites');
  assert.equal(raw.steps[1].cite, undefined, 'a goal the user did not give is not quoted back to them');
  assert.equal(raw.steps[1].goal, 'Always running out of room', 'left alone, not scrubbed');
  assert.equal(raw.steps[2].cite, undefined);

  const trimmed = { steps: [{ task: 'Hide the noisy things', goal: 'looks cluttered' }] };
  citeGoals(trimmed, [' Looks cluttered ']);
  assert.equal(trimmed.steps[0].cite, 'You told us: “Looks cluttered”', 'matching ignores case and surrounding space');

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
  const [floor] = EFFORT_STEP_RANGES['Weekend reset'];
  const untouched = sizeToEffort(fiveStepPantry(), { effort: 'Weekend reset', effortTouched: false });
  assert.equal(untouched.steps.length, floor, `expected the range floor (${floor}), got ${untouched.steps.length}`);
  assert.doesNotMatch(stepText(untouched), /You chose/, 'nothing was chosen, so no step may say so');
  assert.match(stepText(untouched), /Effort was left on our default, Weekend reset/, 'the grown steps say whose answer it was');
  assert.doesNotMatch(stepText(untouched), /session length|sized for/, 'effort is about scope, not time, and nothing was sized to the card');
  assert.equal((untouched.opportunities || []).some(o => /comes to \d+ steps/.test(o)), false,
    'the shortfall note is for a plan that could not reach what was asked, and nothing was asked');
});

test('a chosen effort under a stale untouched flag is sized to what was chosen', () => {
  /* A row saved before the flag existed, or a guest draft from then, restores
     effortTouched as false beside whatever effort the person chose at the
     time. The wizard only ever starts on "Weekend reset", so an untouched
     "Full overhaul" is a contradiction, and the flag is the half that is
     wrong: sizing it to the floor under a sentence about the wizard's
     preselection was two lies for one stale bit. */
  const stale = sizeToEffort(fiveStepPantry(), { effort: 'Full overhaul', effortTouched: false });
  const chosen = sizeToEffort(fiveStepPantry(), { effort: 'Full overhaul', effortTouched: true });
  assert.equal(stale.steps.length, chosen.steps.length, 'sized exactly as the chosen overhaul is');
  assert.ok(stale.steps.length > EFFORT_STEP_RANGES['Full overhaul'][0], 'past the floor an untouched effort stops at');
  assert.doesNotMatch(stepText(stale), /our default|preselected/, 'the wizard never preselected an overhaul');
  assert.match(stepText(stale), /You chose “Full overhaul”/);
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
