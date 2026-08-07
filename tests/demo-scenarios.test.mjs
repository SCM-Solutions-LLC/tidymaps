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
  const plan = getDemoScenario('garage', 'find', NO_KIDS_PETS);
  assert.match(visibleText(plan), /away from pets|pet reach|out of reach of pets/i);
});

test('kid households keep the full kid content the scrub would otherwise touch', () => {
  const KIDS = { kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };
  const plan = getDemoScenario('pantry', 'find', KIDS);
  assert.ok(KID_WORDS.test(visibleText(plan)), 'kid content should stay for a kid household');
  assert.ok(plan.categories.some(c => KID_WORDS.test(c)), 'kid category chip should stay');
});
