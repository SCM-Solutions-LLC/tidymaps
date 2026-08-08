import test from 'node:test';
import assert from 'node:assert/strict';
import { getDemoScenario } from '../js/demo-scenarios.js';

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

  // "Other", or more than one animal, has no noun to use: stay generic.
  const vague = getDemoScenario('garage', 'find',
    { ...NO_KIDS_PETS, pets: { present: 'yes', types: ['Other'] } });
  assert.match(visibleText(vague), /away from pets|pet reach|out of reach of pets/i);
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
