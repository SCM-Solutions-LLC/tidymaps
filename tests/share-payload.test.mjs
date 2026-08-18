import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSharedPlan, sharedSpacePayload, householdPatterns } from '../supabase/functions/_shared/sharePayload.js';

/* A share link is read-only and must never leak anything personal.

   The allowlist tests below came first and they were passing while the promise
   was false. They checked that the household COLUMN does not travel — and it
   never did — but the plan is written FROM the household: analyze-space asks
   the model to name a child's age in safety.why, to name the pet type rather
   than saying "pets", and to answer the household's free-text note; offline,
   applyNote() quotes that note back verbatim into `opportunities`. All of it
   sat on the allowlist. "Not your photos or details" was a claim about a
   SELECT statement.

   So these now pin both halves: the fields that carry household context by
   construction are gone, and anything left that names this household's own
   answers is removed with them. */

const FULL_ROW = {
  id: 'row-id',
  user_id: 'user-123',
  name: 'Hall closet',
  space_type: 'closet',
  goal: 'find',
  dims: { w_in: 36, h_in: 72, d_in: 16 },
  household: { kids: { present: 'yes', ages: ['3-5'] }, notes: 'meds on top shelf' },
  prefs: { budget: '$50', effort: 'Weekend' },
  plan: {
    spaceType: 'Closet',
    summary: 'A tidy closet plan.',
    map: [{ level: 'Eye level', zone: 'Daily wear' }],
    geometry: { width: 36, height: 72, depth: 16, estimated: false },
    steps: [{ t: 'Empty the shelves', m: '10 min', w: 'Fresh start.' }],
    safetyNotes: ['Heavy items low.'],
    cats: ['Clothes'],
    existingLede: 'You already own a few useful pieces.',
    existing: ['shelf dividers', 'small bins'],
    dontBuy: ['extra hangers'],
    cost: { low: 25, high: 60, currency: 'USD' },
    time: { hours: 3, label: 'One afternoon' },
    productNeeds: [{ type: 'bin', purpose: 'corral' }],
    somePrivateFutureField: 'must not leak',
  },
  plan_meta: { source: 'ai' },
  shopping: [{ productId: 'b1', checked: true }],
  progress: { stepsDone: [true, false] },
  arrangement: { version: 1 },
  after_render_path: 'user-123/space/render.jpg',
  share_id: 'ab5f0000-0000-4000-8000-000000000000',
  updated_at: '2026-07-19T00:00:00Z',
};

test('payload includes only the plan-viewing fields', () => {
  const p = sharedSpacePayload(FULL_ROW);
  assert.deepEqual(Object.keys(p).sort(),
    ['dims', 'goal', 'name', 'plan', 'planMeta', 'sharedAt', 'spaceType'].sort());
});

test('household, progress, shopping, media paths, and ids never leak', () => {
  const flat = JSON.stringify(sharedSpacePayload(FULL_ROW));
  for (const secret of ['meds on top shelf', 'user-123', 'stepsDone', 'render.jpg', 'share_id', '"checked"']) {
    assert.ok(!flat.includes(secret), `leaked: ${secret}`);
  }
});

test('plan sanitizer is an allowlist: unknown/product fields are dropped', () => {
  const plan = sanitizeSharedPlan(FULL_ROW.plan, FULL_ROW.household);
  assert.equal(plan.somePrivateFutureField, undefined);
  assert.equal(plan.productNeeds, undefined, 'product needs are not part of a shared view');
  assert.equal(plan.summary, 'A tidy closet plan.');
  assert.equal(plan.map.length, 1);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.existingLede, 'You already own a few useful pieces.');
  assert.deepEqual(plan.existing, ['shelf dividers', 'small bins']);
  assert.deepEqual(plan.dontBuy, ['extra hangers']);
  assert.deepEqual(plan.cost, { low: 25, high: 60, currency: 'USD' });
  assert.deepEqual(plan.time, { hours: 3, label: 'One afternoon' });
});

test('malformed rows and plans degrade to null instead of throwing', () => {
  assert.equal(sharedSpacePayload(null), null);
  assert.equal(sanitizeSharedPlan(null), null);
  assert.equal(sanitizeSharedPlan('not-an-object'), null);
  const p = sharedSpacePayload({ name: '', plan: null });
  assert.equal(p.name, 'A TidyMap plan');
  assert.equal(p.plan, null);
});

/* ---------- the household section of the plan ---------- */

test('safety notes do not travel, whatever they say', () => {
  /* They used to, and the reasoning was that they are placement advice about
     the space. The schema calls them "household-specific placement notes",
     the report heads them "Safety notes for your household", and the prompt
     writes them from the ages and pets the user gave. They are the household
     section, and a share link is exactly where that section stops. */
  const plan = sanitizeSharedPlan({
    ...FULL_ROW.plan,
    safetyNotes: ['Keep the bleach above 48in', 'Snacks stay low'],
  }, {});
  assert.equal(plan.safetyNotes, undefined);
});

test('per-row safety comes off, placement and everything else stays', () => {
  const plan = sanitizeSharedPlan({
    map: [{
      lv: 'Bottom shelf', zone: 'Cleaning supplies', why: 'Heavy bottles belong low.',
      eye: false, shelfIndex: 3, surface: 'shelf',
      safety: { flag: 'lock-or-latch', why: 'Latched so your 3-year-old cannot open it.' },
      items: [{ name: 'Bleach', size: 'm', flags: ['chemical', 'kid-frequent'] }],
    }],
  }, { kids: { present: 'yes' } });

  const row = plan.map[0];
  assert.equal(row.safety, undefined, 'the why names a child, and the flag says one lives here');
  // The plan itself is untouched: same shelf, same zone, same reason.
  assert.equal(row.lv, 'Bottom shelf');
  assert.equal(row.zone, 'Cleaning supplies');
  assert.equal(row.why, 'Heavy bottles belong low.');
  assert.equal(row.shelfIndex, 3);
  // Flags describe the object, except the one that describes who uses it.
  assert.deepEqual(row.items[0].flags, ['chemical']);
});

test('a step keeps its instruction and loses the answer it quotes back', () => {
  const plan = sanitizeSharedPlan({
    steps: [{ t: 'Label the front of every bin', m: '10 min', w: 'Everyone can refile.',
      cite: 'You asked for labels and categories' }],
  }, {});
  assert.equal(plan.steps[0].cite, undefined);
  assert.equal(plan.steps[0].t, 'Label the front of every bin');
  assert.equal(plan.steps[0].w, 'Everyone can refile.');
});

/* ---------- what the household itself said ---------- */

test('the free-text note does not survive being quoted into the plan', () => {
  /* The offline path does exactly this, deliberately and verbatim:
     applyNote() pushes `You told us: "<note>"...` into opportunities so the
     user knows their sentence went nowhere. On a share link it is the note,
     republished. */
  const household = { notes: 'my son has a peanut allergy so snacks stay separate' };
  const plan = sanitizeSharedPlan({
    summary: 'A tidy pantry plan.',
    opportunities: [
      'Group all spices onto one shelf',
      'You told us: “my son has a peanut allergy so snacks stay separate”. This plan was built offline from your other answers, so nothing here accounts for it yet.',
    ],
  }, household);

  assert.deepEqual(plan.opportunities, ['Group all spices onto one shelf']);
  assert.equal(plan.summary, 'A tidy pantry plan.', 'unrelated prose is untouched');
});

test('an age named anywhere in the plan is removed, sentence by sentence', () => {
  const plan = sanitizeSharedPlan({
    summary: 'This pantry has five shelves. Snacks sit low so your 3-year-old can reach them. Bulk goes up top.',
    steps: [{ t: 'Move the snacks down', w: 'Your 4 year old can then reach them without climbing.' }],
  }, { kids: { present: 'yes', ages: ['Toddler'] } });

  assert.equal(plan.summary, 'This pantry has five shelves. Bulk goes up top.',
    'only the sentence about the child goes');
  assert.equal(plan.steps[0].t, 'Move the snacks down', 'the instruction survives');
  assert.equal(plan.steps[0].w, '', 'the reason was entirely about the child');
});

test('the words this household used for its own kids and pets are removed', () => {
  const plan = sanitizeSharedPlan({
    problems: ['Snacks are out of reach', 'The toddler climbs the shelves to get them'],
    map: [{ lv: 'Floor', zone: 'Dog food · Boots · Umbrellas', why: 'Bulky things live at floor level.' }],
  }, { kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: 'yes', types: ['Dog'] } });

  assert.deepEqual(plan.problems, ['Snacks are out of reach']);
  assert.equal(plan.map[0].zone, 'Boots · Umbrellas', 'the zone loses one entry, not the label');
  assert.equal(plan.map[0].why, 'Bulky things live at floor level.');
});

test('a reach need is removed even when the plan phrases it as advice', () => {
  const plan = sanitizeSharedPlan({
    summary: 'Everything daily sits between 30 and 60 inches. This suits the wheelchair user in the house.',
    steps: [{ t: 'Move daily items to the middle shelves', w: 'Limited reach means the top shelf is dead space.' }],
  }, { mobility: ['Limited reach', 'Wheelchair user'] });

  assert.equal(plan.summary, 'Everything daily sits between 30 and 60 inches.');
  assert.equal(plan.steps[0].w, '');
  assert.equal(plan.steps[0].t, 'Move daily items to the middle shelves');
});

test('a household that answered nothing loses nothing', () => {
  /* The redaction is built from what this row stores, so a plan for a
     household with no kids, pets, reach needs or note has no pattern to match
     and must come through whole. A sanitizer that quietly trimmed everyone's
     plan would be the same bug pointing the other way. */
  const plan = sanitizeSharedPlan({
    summary: 'Five shelves, mostly dry goods. The lowest shelf is empty.',
    problems: ['No category zones', 'Cans are hard to see'],
    opportunities: ['Group spices together'],
    cats: ['Dry goods', 'Canned goods'],
    steps: [{ t: 'Sort into piles', m: '20 min', w: 'You cannot plan what you cannot see.' }],
    map: [{ lv: 'Top shelf', zone: 'Backstock · Bulk', why: 'Out of the way.' }],
  }, { kids: { present: 'no' }, pets: { present: 'no' }, mobility: [], notes: '' });

  assert.equal(plan.summary, 'Five shelves, mostly dry goods. The lowest shelf is empty.');
  assert.deepEqual(plan.problems, ['No category zones', 'Cans are hard to see']);
  assert.deepEqual(plan.opportunities, ['Group spices together']);
  assert.deepEqual(plan.cats, ['Dry goods', 'Canned goods']);
  assert.equal(plan.steps[0].w, 'You cannot plan what you cannot see.');
  assert.equal(plan.map[0].zone, 'Backstock · Bulk');
});

test('common words in a note do not redact the plan they appear in', () => {
  /* A note is mostly ordinary words. If every one of them became a pattern,
     one note about a shelf would empty the plan — a "privacy" fix that hands
     the visitor a blank page and calls it protection. */
  const household = { notes: 'please keep the top shelf clear for the vacuum' };
  const plan = sanitizeSharedPlan({
    summary: 'The top shelf is the least reachable, so it holds backstock.',
    problems: ['Top shelf is overloaded'],
    steps: [{ t: 'Clear the top shelf', w: 'You need somewhere to stage the sort.' }],
  }, household);

  assert.equal(plan.problems.length, 1, 'ordinary words in a note are not identifying');
  assert.ok(plan.summary.includes('backstock'));
  assert.equal(plan.steps[0].t, 'Clear the top shelf');
  // 'vacuum' is the word that identifies this note, and it does not travel.
  assert.ok(!JSON.stringify(plan).toLowerCase().includes('vacuum'));
});

test('an older row written in the plan contract’s own field names is covered too', () => {
  /* Stored plans are normalized ({t,m,w} / {lv,zone}), but a row saved by an
     earlier build — or a fixture taken straight off the model — uses
     task/why/level. A sanitizer that knew only the normalized names would
     pass the other shape through untouched, which is the failure mode worth
     a test rather than a comment. */
  const plan = sanitizeSharedPlan({
    steps: [{ task: 'Move the litter box supplies', why: 'The cat gets into the low shelf.' }],
    map: [{ level: 'Low shelf', zone: 'Pet food', why: 'The cat can reach this one.' }],
  }, { pets: { present: 'yes', types: ['Cat'] } });

  assert.equal(plan.steps[0].why, '');
  assert.equal(plan.map[0].why, '');
  assert.equal(plan.map[0].level, 'Low shelf');
  assert.ok(!JSON.stringify(plan).toLowerCase().includes('cat'));
});

test('a space named after the household falls back to a generic name', () => {
  const p = sharedSpacePayload({
    name: 'Toddler’s snack cupboard',
    plan: { summary: 'Two shelves of snacks.' },
    household: { kids: { present: 'yes', ages: ['Toddler'] } },
  });
  assert.equal(p.name, 'A TidyMap plan');
  assert.equal(p.plan.summary, 'Two shelves of snacks.');
});

test('the pattern set is built from the row, and is empty-handed without one', () => {
  // Only the unconditional one: any stated age is a fact about a person.
  assert.equal(householdPatterns(null).length, 1);
  assert.equal(householdPatterns({}).length, 1);
  assert.ok(householdPatterns({ pets: { types: ['Other'] } }).length === 1,
    '"Other" names no animal, and matching it would redact ordinary prose');
  assert.ok(householdPatterns({ pets: { types: ['Dog'] } }).length > 1);
});
