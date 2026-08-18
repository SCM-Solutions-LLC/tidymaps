import test from 'node:test';
import assert from 'node:assert/strict';
import { getDemoScenario } from '../js/demo-scenarios.js';
import { SETUP_TYPES } from '../js/wizard-data.js';

// Safety content must fire ONLY when the household actually has kids.
// Regression coverage for two real bugs the E2E matrix surfaced: base
// scenarios shipped kid-phrased safety notes unconditionally, and the
// wizard's 'no' (a string) was read as truthy "kids present".

const KID_WORDS = /kid|child|little hands|small hands/i;

function kidTraces(plan) {
  const notes = (plan.safetyNotes || []).filter(n => KID_WORDS.test(n));
  const flags = (plan.map || []).filter(m => m.safety && (m.safety.flag === 'kid-safe' || KID_WORDS.test(m.safety.why || '')));
  const whys = (plan.map || []).filter(m => KID_WORDS.test(m.why || ''));
  return { notes, flags, whys };
}

test("household kids:'no' (wizard string) produces no kid safety content", () => {
  const plan = getDemoScenario('pantry', 'find', { kids: { present: 'no', ages: [] }, pets: { present: null, types: [] }, mobility: [], notes: '' });
  const { notes, flags, whys } = kidTraces(plan);
  assert.deepEqual(notes, [], `kid-referencing notes leaked: ${notes.join(' | ')}`);
  assert.deepEqual(flags.map(f => f.level), [], 'kid-safe flags leaked');
  assert.deepEqual(whys.map(m => m.why), [], 'kid-referencing zone rationales leaked');
});

test('null household (skipped step) produces no kid safety content', () => {
  const plan = getDemoScenario('garage', 'find', null);
  const { notes, flags } = kidTraces(plan);
  assert.deepEqual(notes, []);
  assert.deepEqual(flags.map(f => f.level), []);
});

test("household kids:'yes' keeps and augments kid safety content", () => {
  const plan = getDemoScenario('pantry', 'find', { kids: { present: 'yes', ages: ['3-5'] }, pets: { present: null, types: [] }, mobility: [], notes: '' });
  const { notes } = kidTraces(plan);
  assert.ok(notes.length > 0, 'expected kid safety notes for a kid household');
  assert.ok((plan.map || []).some(m => m.safety && m.safety.flag === 'kid-safe'), 'expected a kid-safe zone');
});

test('boolean true (API-shaped household) also reads as kids present', () => {
  const plan = getDemoScenario('pantry', 'find', { kids: { present: true, ages: [] } });
  assert.ok(kidTraces(plan).notes.length > 0);
});

test("Kids' storage space keeps its kid language even without household answers", () => {
  const plan = getDemoScenario('kids', 'find', null);
  // The space is about kids by definition; stripping would gut the plan.
  assert.ok(KID_WORDS.test(JSON.stringify(plan.safetyNotes || []) + JSON.stringify(plan.map || [])));
});

test("pets:'no' (wizard string) adds no pet content", () => {
  const plan = getDemoScenario('pantry', 'find', { kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' });
  assert.ok(!(plan.safetyNotes || []).some(n => /pet/i.test(n)), 'pet note leaked for a no-pet household');
});

/* ---------- the no-kid scrub covers every user-visible field ----------
   Two regression classes from the QA matrix: (1) kid text leaked through
   zone labels, item lists, category chips, problems, opportunities, and step
   rationales — the scrub only cleaned notes/flags/whys; (2) the scrub
   over-deleted — the garage's chemical warning names children AND pets in
   one sentence, so dropping the sentence removed the hazard guidance and
   the keep-high flag for every household without kids. */

const REACHABLE_SPACES = ['pantry', 'cabinet', 'drawers', 'closet', 'walkin', 'dresser', 'bathroom', 'linen', 'garage', 'workbench'];
const NO_KIDS_NO_PETS = { kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };
const NO_KIDS_PETS = { kids: { present: 'no', ages: [] }, pets: { present: 'yes', types: ['Dog'] }, mobility: [], notes: '' };

function visibleText(plan) {
  return [
    plan.summary, plan.existingLede, plan.dontBuy,
    ...(plan.categories || []),
    ...(plan.problems || []), ...(plan.opportunities || []),
    ...(plan.safetyNotes || []),
    ...(plan.existing || []).flatMap(e => [e.title, e.detail]),
    ...(plan.steps || []).flatMap(s => [s.task, s.why]),
    ...(plan.map || []).flatMap(m => [m.level, m.zone, m.why, m.safety && m.safety.why,
      ...(m.items || []).map(i => i.name)]),
    ...(plan.productNeeds || []).map(p => p.purpose),
  ].filter(Boolean).join(' | ');
}

test('no kid language survives anywhere in a plan for a kid-free household', () => {
  for (const space of REACHABLE_SPACES) {
    for (const household of [NO_KIDS_NO_PETS, NO_KIDS_PETS, null]) {
      const text = visibleText(getDemoScenario(space, 'find', household));
      const leak = text.split(' | ').find(part => KID_WORDS.test(part));
      assert.equal(leak, undefined, `${space}: kid language leaked: "${leak}"`);
    }
  }
});

test('hazard flags survive the kid scrub — the garage chemical shelf stays keep-high', () => {
  for (const household of [NO_KIDS_NO_PETS, NO_KIDS_PETS, null]) {
    const plan = getDemoScenario('garage', 'find', household);
    const chem = plan.map.find(m => /chemical/i.test(m.zone));
    assert.ok(chem, 'chemical zone missing');
    assert.equal(chem.safety.flag, 'keep-high', 'chemical shelf lost its hazard flag');
    assert.match(chem.why, /high/i, `hazard rationale gutted: "${chem.why}"`);
    assert.ok(plan.safetyNotes.some(n => /chemicals.*top shelf/i.test(n)),
      `chemical safety note deleted: ${JSON.stringify(plan.safetyNotes)}`);
  }
});

test('with pets and no kids, the chemical guidance names the pets', () => {
  // NO_KIDS_PETS is a dog household, so the guidance names the dog. Asking
  // only for the word "pets" passed against the version that never read
  // household.pets.types at all.
  const plan = getDemoScenario('garage', 'find', NO_KIDS_PETS);
  assert.match(visibleText(plan), /\bdogs?\b/i);
  assert.doesNotMatch(visibleText(plan), /\bpets?\b/i,
    'the household named its animal, so the plan should not fall back to "pets"');

  /* "Other", or more than one animal, has no noun to use, so the wording stays
     generic — that part was always right. What was wrong is that it stopped
     there: the plan came out byte-identical to naming no type at all, so a chip
     the user ticked was worth nothing. The wording is still generic AND the
     answer now changes the plan. */
  const vague = getDemoScenario('garage', 'find',
    { ...NO_KIDS_PETS, pets: { present: 'yes', types: ['Other'] } });
  assert.match(visibleText(vague), /away from pets|pet reach|out of reach of pets|another kind of pet/i);
});

test('naming the animal changes the plan, whichever animal it is', () => {
  /* Every pet-type chip is offered, and two of them used to produce a plan
     identical to answering nothing: "Other" (no noun to swap in) and any
     mixed household (no single noun to swap in). Different routes, same
     defect — an answer that looks alive and is discarded. */
  const shape = (p) => JSON.stringify([p.steps.map(s => s.task), p.safetyNotes, p.summary,
    p.map.map(m => [m.why, (m.safety || {}).why])]);
  const unnamed = shape(getDemoScenario('pantry', 'find',
    { ...NO_KIDS_PETS, pets: { present: 'yes', types: [] } }));
  for (const types of [['Dog'], ['Cat'], ['Other'], ['Dog', 'Cat'], ['Cat', 'Other']]) {
    const p = getDemoScenario('pantry', 'find', { ...NO_KIDS_PETS, pets: { present: 'yes', types } });
    assert.notEqual(shape(p), unnamed,
      `types ${JSON.stringify(types)}: identical to naming no type at all`);
  }
});

test('an unidentifiable animal gets the answer that holds either way', () => {
  /* We genuinely do not know how high it can get. Height only works on an
     animal that cannot climb, so an unknown one gets the barrier that does not
     depend on knowing — and the plan says which answer it gave and why. */
  const p = getDemoScenario('pantry', 'find',
    { ...NO_KIDS_PETS, pets: { present: 'yes', types: ['Other'] } });
  const note = (p.safetyNotes || []).find(n => /another kind of pet/i.test(n));
  assert.ok(note, `no note about the unnamed animal: ${JSON.stringify(p.safetyNotes)}`);
  assert.match(note, /door or a latch/i, 'says height, not the barrier that actually holds');
});

test('a cat household is never told height keeps the chemicals safe', () => {
  /* Every hazard rationale in this app is a height argument. That is a
     control for a dog and none at all for a cat, which will be on the top
     shelf by dinnertime — the same class of mistake as claiming a safety
     property the arrangement does not have. */
  for (const types of [['Cat'], ['Dog', 'Cat']]) {
    const plan = getDemoScenario('garage', 'find',
      { ...NO_KIDS_PETS, pets: { present: 'yes', types } });
    const text = visibleText(plan);
    assert.doesNotMatch(text, /(?:above|out of) (?:cat|pet)s? reach|out of reach (?:of|for) (?:cat|pet)s\b/i,
      `types ${JSON.stringify(types)}: still claims height puts it out of the cat's reach`);
    assert.match(text, /door or latch/i,
      `types ${JSON.stringify(types)}: never says what actually contains a cat`);
  }
});

test('kid households keep the full kid content the scrub would otherwise touch', () => {
  const KIDS = { kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };
  const plan = getDemoScenario('pantry', 'find', KIDS);
  assert.ok(KID_WORDS.test(visibleText(plan)), 'kid content should stay for a kid household');
  assert.ok(plan.categories.some(c => KID_WORDS.test(c)), 'kid category chip should stay');
});

/* ---------- hazard flags are never repurposed as kid-safe ----------
   applyHousehold's kids branch used to overwrite map[len-2] unconditionally.
   In the bathroom scenario that row is the latched chemicals caddy, so a
   household WITH kids got a green "kid safe" badge on the cleaning sprays —
   the inverse of the warning that household needs. */
const KIDS_HH = { kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };
const HAZARD_FLAGS = ['keep-high', 'lock-or-latch'];

test('a kids household never converts a hazard zone into a kid-safe zone', () => {
  for (const space of REACHABLE_SPACES) {
    const base = getDemoScenario(space, null, null);
    const hazards = new Set((base.map || [])
      .filter(m => m.safety && HAZARD_FLAGS.includes(m.safety.flag))
      .map(m => m.level));
    const withKids = getDemoScenario(space, null, KIDS_HH);
    for (const m of withKids.map || []) {
      if (hazards.has(m.level)) {
        assert.ok(HAZARD_FLAGS.includes(m.safety.flag),
          `${space}: hazard zone "${m.level}" was relabelled "${m.safety.flag}" for a kid household`);
      }
    }
    assert.ok((withKids.map || []).some(m => m.safety && m.safety.flag === 'kid-safe'),
      `${space}: a kid household still needs a kid-safe zone somewhere`);
  }
});

test('a pet household keeps the latch it is told about', () => {
  const petsOnly = { kids: { present: 'no', ages: [] }, pets: { present: 'yes', types: ['Dog'] }, mobility: [], notes: '' };
  const plan = getDemoScenario('bathroom', null, petsOnly);
  const latchText = (plan.map || []).some(m => m.safety && /latch/i.test(m.safety.why || ''));
  if (latchText) {
    assert.ok((plan.productNeeds || []).some(p => p.type === 'safety-latch'),
      'the plan says a zone stays latched but recommends nothing that latches it');
  }
});

test('no-kid plans carry no kid-frequent item flags', () => {
  for (const space of REACHABLE_SPACES) {
    const plan = getDemoScenario(space, 'find', NO_KIDS_NO_PETS);
    const leaked = (plan.map || []).flatMap(m => (m.items || []))
      .filter(it => (it.flags || []).includes('kid-frequent'));
    assert.deepEqual(leaked, [], `${space}: kid-frequent flags survived the scrub`);
  }
});

test('the kid scrub never leaves mangled prose or empties a field back to kid text', () => {
  for (const space of REACHABLE_SPACES) {
    for (const goal of [null, 'find', 'kid', 'capacity', 'clutter']) {
      const plan = getDemoScenario(space, goal, NO_KIDS_NO_PETS);
      const text = visibleText(plan);
      assert.ok(!KID_WORDS.test(text), `${space}/${goal}: kid text returned via a || fallback`);
      // "placed up high or behind latched containers" is the REPAIRED form;
      // "placed or behind latched containers" is the mangled one.
      for (const bad of ['placed or ', 'are placed or', '  ', ' .', ' ,', 'and contained and']) {
        assert.ok(!text.includes(bad), `${space}/${goal}: mangled prose "${bad}" in: ${text.slice(0, 200)}`);
      }
    }
  }
});

test('the clutter goal never doubles a word when rewriting bin purposes', () => {
  for (const space of REACHABLE_SPACES) {
    for (const p of getDemoScenario(space, 'clutter', NO_KIDS_NO_PETS).productNeeds || []) {
      assert.ok(!/\b(\w+)\s+and\s+\1\b/i.test(p.purpose), `${space}: "${p.purpose}"`);
    }
  }
});

/* ---------- kid ages ----------
   The wizard asks how old the children are and offers four bands. Nothing read
   the answer: applyHousehold branched on kids.present and no further, so a
   household with a baby and one with a teenager got byte-identical plans while
   the Review screen echoed the age back at them. */

const withAges = (ages) => ({
  adults: 2, kidCount: 1, petCount: 0,
  kids: { present: 'yes', ages }, pets: { present: 'no', types: [] },
  mobility: [], notes: '',
});
const planShape = (p) => JSON.stringify([p.steps.map(s => s.task), p.safetyNotes]);

test('each kid age band produces a different plan', () => {
  const noAge = planShape(getDemoScenario('pantry', 'find', withAges([])));
  const byBand = new Map();
  for (const band of ['Baby', 'Toddler', 'Big kid', 'Teen']) {
    const shape = planShape(getDemoScenario('pantry', 'find', withAges([band])));
    assert.notEqual(shape, noAge, `"${band}" produces the same plan as giving no age`);
    for (const [other, seen] of byBand) {
      assert.notEqual(shape, seen, `"${band}" produces the same plan as "${other}"`);
    }
    byBand.set(band, shape);
  }
});

test('the age advice argues from height, and says whose age it is answering', () => {
  const toddler = getDemoScenario('pantry', 'find', withAges(['Toddler']));
  const step = toddler.steps.find(s => /48 inches/.test(s.task));
  assert.ok(step, `no toddler-specific placement step: ${toddler.steps.map(s => s.task).join(' | ')}`);
  assert.match(step.why, /toddler/i, 'the step does not say which answer it came from');
  assert.equal(step.cite, 'You told us there is a toddler at home');

  // and a teenager gets the opposite advice, because it is the opposite problem
  const teen = getDemoScenario('pantry', 'find', withAges(['Teen']));
  assert.ok(teen.steps.some(s => /own\b.*zone they control|labelled zone/i.test(s.task)),
    `no teen-specific step: ${teen.steps.map(s => s.task).join(' | ')}`);
});

test('three children do not get three copies of the same advice', () => {
  const p = getDemoScenario('pantry', 'find', withAges(['Toddler', 'Toddler', 'Toddler']));
  const matches = p.steps.filter(s => /48 inches/.test(s.task));
  assert.equal(matches.length, 1, 'the rule fired once per selected age rather than once per band');
});

test('ages reach the model as numbers, because its safety rules are written in numbers', async () => {
  /* The prompt's hard rule is "kids ages 0-9", and the wizard collects the word
     "Big kid". The model was being asked to guess the mapping before it could
     apply a rule that decides where the bleach goes. */
  const [{ state }, { buildAnalysisContext }] = await Promise.all([
    import('../js/state.js'), import('../js/plan.js'),
  ]);
  state.household = withAges(['Toddler', 'Teen']);
  const kids = buildAnalysisContext().household.kids;
  assert.deepEqual(kids.ages, ['Toddler', 'Teen'], 'the words the user picked still travel');
  assert.deepEqual(kids.ageYears, { min: 1, max: 17 }, 'and the years the prompt reasons in');

  state.household = withAges([]);
  assert.equal(buildAnalysisContext().household.kids.ageYears, null, 'no age given, nothing claimed');
});

/* ---------- metric ----------
   A units choice is only worth having if it reaches every measurement. Half a
   translation — centimetres in the summary, inches on the shopping list — is
   worse than none, because the reader cannot tell which number to trust. */

test('a metric plan quotes no imperial measurement, in any setup', () => {
  const household = {
    adults: 2, kidCount: 0, petCount: 0,
    kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] },
    mobility: [], notes: '',
  };
  const answers = {
    prefs: [], budget: null, effort: 'Full overhaul', toggles: {},
    dims: { w_in: 22, h_in: 78, d_in: 18, shelves: null }, metric: true,
  };
  const leaks = [];
  for (const [space, types] of Object.entries(SETUP_TYPES)) {
    for (const t of types) {
      const plan = getDemoScenario(space, 'find', household, answers, t.id);
      const hits = visibleText(plan).match(/[0-9]\s*(?:″|′|-inch| inch| inches| foot| feet)/g);
      if (hits) leaks.push(`${space}/${t.id}: ${[...new Set(hits)].join(', ')}`);
    }
  }
  assert.deepEqual(leaks, [], `imperial measurements survived in a metric plan:\n${leaks.join('\n')}`);
});

test('the same plan in the other system differs only in its measurements', () => {
  /* state.dims stays in inches — it is the plan and 3D contract. Units are a
     display choice applied last, so the two readers are looking at one plan
     rendered two ways, not at two different plans. */
  const household = {
    adults: 2, kidCount: 0, petCount: 0,
    kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] },
    mobility: [], notes: '',
  };
  const answers = (metric) => ({
    prefs: [], budget: null, effort: 'Weekend reset', toggles: {},
    dims: { w_in: 22, h_in: 78, d_in: 18, shelves: null }, metric,
  });
  const imperial = getDemoScenario('pantry', 'find', household, answers(false), 'cabinet');
  const metric = getDemoScenario('pantry', 'find', household, answers(true), 'cabinet');

  assert.deepEqual(metric.steps.map(s => s.task), imperial.steps.map(s => s.task),
    'the plan itself changed, not just how it is written');
  assert.equal(metric.map.length, imperial.map.length);
  assert.deepEqual(metric.productNeeds.map(p => p.type), imperial.productNeeds.map(p => p.type));

  // and the measurements really did change
  assert.match(metric.summary, /56 cm wide and 198 cm tall/);
  assert.match(imperial.summary, /1′10″ wide and 6′6″ tall/);
});

/* ---------- hazards, in the plans we write ourselves ----------

   The analysis path has this contract enforced against the model. These
   scenarios are our own data, so nothing checked them, and five of the
   sixteen put chemical or sharp items within a toddler's reach with the plan
   saying nothing about it — cleaning sprays at ankle height in the laundry,
   garden tools on the garage floor, sharp tools in the junk drawer.

   Three said something worse than nothing: a green "kid safe" badge on the
   laundry shelf holding cleaning sprays and a hot iron, on the garage shelf
   holding power tools and automotive chemicals, and — in the kids' room — on
   the shelf whose own reason reads "choking hazards for children under 3".

   These plans are what a visitor sees offline, on an AI failure, and behind
   "View a sample plan", so they are read by exactly the households the rule
   protects. */

import { HAZARD_ITEM_FLAGS, YOUNG_KID_BANDS } from '../js/demo-scenarios.js';
import { HAZARD_ITEM_FLAGS as SERVER_HAZARD_FLAGS, YOUNG_KID_MAX_AGE } from '../supabase/functions/_shared/planSchema.js';
import { KID_AGE_YEARS } from '../js/wizard-data.js';

const SCENARIO_KEYS = ['pantry', 'cabinet', 'closet', 'walkin', 'garage', 'laundry', 'kids', 'attic',
  'drawers', 'junk', 'bathroom', 'linen', 'fridge', 'dresser', 'workbench', 'other'];
const toddlerHousehold = {
  adults: 2, kidCount: 1, petCount: 0,
  kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: 'no', types: [] }, mobility: [], notes: '',
};
const hazardRows = (plan) => (plan.map || []).filter(row =>
  (row.items || []).some(it => (it.flags || []).some(f => HAZARD_ITEM_FLAGS.includes(f))));

test('no scenario leaves a hazard zone unaddressed for a household with a toddler', () => {
  for (const key of SCENARIO_KEYS) {
    const plan = getDemoScenario(key, 'find', toddlerHousehold, { household: toddlerHousehold });
    for (const row of hazardRows(plan)) {
      const flag = row.safety && row.safety.flag;
      const names = (row.items || []).map(i => i.name).join(', ');
      assert.ok(flag, `${key} / "${row.level}" holds ${names} and the plan says nothing about it`);
      assert.notEqual(flag, 'kid-safe', `${key} / "${row.level}" holds ${names} under a kid-safe badge`);
      assert.ok(String(row.safety.why || '').trim(), `${key} / "${row.level}" is flagged ${flag} with no reason`);
    }
  }
});

test('a hazard zone is never the kid-safe one, whatever the children’s ages', () => {
  // The badge is a positive claim — "your child may help themselves here" —
  // so unlike the placement rule it does not wait for a young age band.
  for (const ages of [['Toddler'], ['Big kid'], ['Teen'], []]) {
    const household = { ...toddlerHousehold, kids: { present: 'yes', ages } };
    for (const key of ['laundry', 'garage', 'kids']) {
      const plan = getDemoScenario(key, 'find', household, { household });
      for (const row of hazardRows(plan)) {
        assert.notEqual(row.safety && row.safety.flag, 'kid-safe',
          `${key} / "${row.level}" is kid-safe with ages ${JSON.stringify(ages)}`);
      }
    }
  }
});

test('the barrier is named for what the surface can actually do', () => {
  const junk = getDemoScenario('junk', 'find', toddlerHousehold, { household: toddlerHousehold });
  const drawer = junk.map.find(m => (m.items || []).some(it => (it.flags || []).includes('sharp')));
  assert.equal(drawer.safety.flag, 'lock-or-latch');
  assert.match(drawer.safety.why, /latch/i);
  // The reason names what is in there, so it reads as being about this space.
  assert.match(drawer.safety.why, /Small tools/);

  // An open shelf cannot hold a latch, so the wording carries the other way out.
  const laundry = getDemoScenario('laundry', 'find', toddlerHousehold, { household: toddlerHousehold });
  const openShelf = laundry.map.find(m => m.surface === 'shelf'
    && (m.items || []).some(it => (it.flags || []).includes('chemical'))
    && /move them above/.test((m.safety && m.safety.why) || ''));
  assert.ok(openShelf, 'an open shelf of chemicals should offer moving them up as the alternative');
});

test('a teenage household is not told to latch the cleaning cupboard', () => {
  /* The placement rule protects small children. A plan that latched every
     hazard for every household would be advice nobody follows, and the
     scenario's own decisions would stop meaning anything. */
  const teens = { ...toddlerHousehold, kids: { present: 'yes', ages: ['Teen'] } };
  const plan = getDemoScenario('workbench', 'find', teens, { household: teens });
  const benchDrawers = plan.map.find(m => /bench drawers/i.test(m.level || ''));
  assert.ok(benchDrawers, 'the workbench scenario should still have its bench drawers');
  assert.equal(benchDrawers.safety.flag, null, 'a teen household got the toddler treatment');
});

test('a household with no kids gets no kid-driven flags at all', () => {
  const none = { adults: 1, kidCount: 0, petCount: 0, kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };
  for (const key of ['laundry', 'junk', 'workbench']) {
    const plan = getDemoScenario(key, 'find', none, { household: none });
    for (const row of plan.map || []) {
      assert.notEqual(row.safety && row.safety.flag, 'kid-safe', `${key} kept a kid-safe flag with no kids`);
      assert.ok(!/children|small child/i.test((row.safety && row.safety.why) || ''),
        `${key} / "${row.level}" tells a childless household about children`);
    }
  }
});

/* The client cannot import planSchema (it pulls in zod, and it is shared with
   Deno), so the two halves of one rule are written twice. That is fine as
   long as they cannot drift apart quietly. */
test('the deterministic rule and the validator agree on what a hazard is', () => {
  assert.deepEqual([...HAZARD_ITEM_FLAGS].sort(), [...SERVER_HAZARD_FLAGS].sort());

  // ...and on which of the wizard's age bands count as young.
  for (const [band, [min]] of Object.entries(KID_AGE_YEARS)) {
    assert.equal(YOUNG_KID_BANDS.test(band), min <= YOUNG_KID_MAX_AGE,
      `"${band}" (from age ${min}) is classified differently by the two halves`);
  }
});

/* The kid-safe badge is chosen by walking up from the lowest row, and the
   test for "not this one" was "does it carry a flag". A row can hold garden
   tools and carry no flag at all, which is how the garage's floor level came
   to wear "Lower zones stay kid-accessible and free of hazards" over the
   garden tools — for a teenage household, where the placement rule above
   does not fire and nothing else was looking. */
test('the kid-safe badge never lands on a zone holding hazards', () => {
  for (const ages of [['Toddler'], ['Big kid'], ['Teen']]) {
    const household = { ...toddlerHousehold, kids: { present: 'yes', ages } };
    for (const key of SCENARIO_KEYS) {
      const plan = getDemoScenario(key, 'find', household, { household });
      const badged = (plan.map || []).filter(m => m.safety && m.safety.flag === 'kid-safe');
      for (const row of badged) {
        const hazards = (row.items || []).filter(it => (it.flags || []).some(f => HAZARD_ITEM_FLAGS.includes(f)));
        assert.deepEqual(hazards.map(h => h.name), [],
          `${key} / "${row.level}" is badged kid-safe with ages ${JSON.stringify(ages)}`);
      }
    }
  }
});
