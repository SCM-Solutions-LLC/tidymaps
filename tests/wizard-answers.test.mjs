import test from 'node:test';
import assert from 'node:assert/strict';

// state.js touches localStorage inside its helpers; provide a shim.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  state, ANSWERS_VERSION, wizardAnswers, applyWizardAnswers, resetWizardAnswers,
  persistGuestDraft, restoreGuestDraft,
} = await import('../js/state.js');
const { rowFromState, applyLoadedSpace } = await import('../js/db.js');

/* ============================================================
   The wizard answers are ONE contract with two storage backends.

   They used to be four hand-maintained halves — a writer and a reader for the
   guest draft, and a different writer and reader for the signed-in row — and
   they had already drifted: goals, styles, cats, catsTouched, detected, room
   and afterMode were saved for signed-OUT visitors and silently dropped for
   signed-in ones. Because applyLoadedSpace() hydrated without resetting first,
   the dropped fields did not come back empty; they came back holding whatever
   the PREVIOUSLY opened space had left in memory. The report showed one saved
   plan while buildAnalysisContext() fed the next analysis another one's goals
   and categories.

   These tests drive the real round trip through both backends, because the
   bug was never visible in either half alone.
   ============================================================ */

// Every answer, with a value that is distinctive AND not the default, so a
// field that fails to survive the trip cannot pass by coincidence.
const FILLED = {
  room: 'garage',
  space: 'workbench',
  goal: 'find',
  capture: 'photos',
  setup: 'bench',
  setupLabel: 'Workbench',
  setupTouched: true,
  goals: ['I can never find the drill', 'the bench is a dumping ground'],
  styles: ['label everything', 'open bins'],
  cats: ['Power tools', 'Fasteners'],
  catsTouched: true,
  detected: ['drill', 'jar of screws'],
  features: ['pegboard'],
  budget: '$100–250',
  effort: 'Full overhaul',
  effortTouched: true,
  shoppingPref: 'Open to a few ideas',
  shoppingTouched: true,
  upgrades: true,
  afterMode: 'Show suggested products',
  dims: { w_in: 144, h_in: 78, d_in: 24, shelves: 4 },
};
const FILLED_PREFS = ['reachable', 'labelled'];
const FILLED_HOUSEHOLD = {
  adults: 3, kidCount: 1, petCount: 2,
  kids: { present: 'yes', ages: ['Big kid'] },
  pets: { present: 'yes', types: ['dog'] },
  mobility: ['no step stool'], notes: 'left-handed',
};
const FILLED_TOGGLES = { pegboard: true, lazySusan: false };

function fillEveryAnswer(target = state) {
  resetWizardAnswers(target);
  Object.entries(FILLED).forEach(([k, v]) => { target[k] = v; });
  target.prefs = new Set(FILLED_PREFS);
  target.household = FILLED_HOUSEHOLD;
  Object.entries(FILLED_TOGGLES).forEach(([k, v]) => { target['detail_' + k] = v; });
  target.dimsFt = { w: 12, h: 6.5, d: 2 };
  return target;
}

/* The fixture is the test's own idea of "every answer". If an answer is added
   to the serializer and not to the fixture, the round-trip tests below would
   quietly stop covering it — so the two lists are checked against each other. */
test('the fixture covers every answer the serializer knows about', () => {
  const serialized = wizardAnswers(fillEveryAnswer());
  const covered = new Set([...Object.keys(FILLED), 'prefs', 'household', 'toggles', 'v']);
  const missing = Object.keys(serialized).filter((k) => !covered.has(k));
  assert.deepEqual(missing, [],
    'a new wizard answer was added without extending this test\'s fixture');
});

test('a guest draft round-trips every answer', () => {
  fillEveryAnswer();
  const before = wizardAnswers(state);
  persistGuestDraft();

  // Whatever is in memory must not be what we read back.
  resetWizardAnswers(state);
  assert.notDeepEqual(wizardAnswers(state), before, 'the reset must actually clear');

  assert.ok(restoreGuestDraft(), 'draft should restore');
  assert.deepEqual(wizardAnswers(state), before);
  assert.deepEqual(state.dimsFt, { w: 12, h: 6.5, d: 2 },
    'the measure screen renders from dimsFt, so it must be rehydrated too');
});

test('a signed-in saved space round-trips every answer', () => {
  fillEveryAnswer();
  const before = wizardAnswers(state);
  // Through JSON, because that is what actually goes to and comes from Postgres.
  const row = JSON.parse(JSON.stringify(rowFromState('my workbench')));

  resetWizardAnswers(state);
  applyLoadedSpace({ data: { ...row, id: 'space-a' }, beforePhotoUrl: null, afterRenderUrl: null });

  assert.deepEqual(wizardAnswers(state), before);
  assert.equal(state.activeSpaceId, 'space-a');
  assert.deepEqual(state.dimsFt, { w: 12, h: 6.5, d: 2 });
});

/* `upgrades` was the answer that exposed the stale-prefs problem: the report's
   products switch and the Adjust screen change it long after the last full
   save, and only a full save wrote the prefs column, so the stored value was
   older than the plan. Now that every incremental write carries the answers, a
   v2 row's copy is current and is read back as given — in both directions,
   which is the half a shopping-list derivation could never express. */
test('a v2 row is trusted about the products section, either way', () => {
  fillEveryAnswer();
  state.upgrades = false;
  const off = JSON.parse(JSON.stringify(rowFromState('x')));
  off.shopping = [{ name: 'Turntable', checked: true }];   // ticked, then switched off

  resetWizardAnswers(state);
  applyLoadedSpace({ data: { ...off, id: 'x' }, beforePhotoUrl: null, afterRenderUrl: null });
  assert.equal(state.upgrades, false,
    'switching the section off has to survive, even with products still ticked');

  fillEveryAnswer();
  state.upgrades = true;
  const on = JSON.parse(JSON.stringify(rowFromState('x')));
  on.shopping = null;                                       // on, nothing ticked yet

  resetWizardAnswers(state);
  applyLoadedSpace({ data: { ...on, id: 'x' }, beforePhotoUrl: null, afterRenderUrl: null });
  assert.equal(state.upgrades, true,
    'turning the section on without ticking anything is still an answer');
});

/* Rows written before the answers were kept fresh keep the old reading, since
   for them a stored `upgrades` really can be older than the plan and the
   shopping list really is the better evidence. */
test('a v1 row still derives the products section from its shopping list', () => {
  fillEveryAnswer();
  state.upgrades = false;
  const row = JSON.parse(JSON.stringify(rowFromState('x')));
  row.prefs.answers.v = 1;                                  // as an older build wrote it
  row.shopping = [{ name: 'Turntable', checked: true }];

  resetWizardAnswers(state);
  applyLoadedSpace({ data: { ...row, id: 'x' }, beforePhotoUrl: null, afterRenderUrl: null });
  assert.equal(state.upgrades, true,
    'an old row with products in it must not come back with the section hidden');
});

/* The gap that made this worth fixing: whichever backend you used decided
   which of your answers survived. */
test('both backends carry the same answers', () => {
  fillEveryAnswer();
  const viaDraft = (() => {
    persistGuestDraft();
    resetWizardAnswers(state);
    restoreGuestDraft();
    return wizardAnswers(state);
  })();

  fillEveryAnswer();
  const viaRow = (() => {
    const row = JSON.parse(JSON.stringify(rowFromState('x')));
    resetWizardAnswers(state);
    applyLoadedSpace({ data: { ...row, id: 'x' }, beforePhotoUrl: null, afterRenderUrl: null });
    return wizardAnswers(state);
  })();

  assert.deepEqual(viaRow, viaDraft,
    'the signed-in row and the guest draft must preserve the same answer set');
});

/* A stored null is an answer somebody gave; an absent field is a payload that
   predates it. Treating the two the same put a "Weekend reset" chip on the
   demo plan, which deliberately leaves effort unset — a claim about an answer
   nobody made, which is the exact class of bug the touched flags exist for. */
test('a stored null survives, an absent field falls back to the default', () => {
  fillEveryAnswer();
  applyWizardAnswers({ ...wizardAnswers(state), effort: null, budget: null }, state);
  assert.equal(state.effort, null, 'a deliberately unset answer must stay unset');
  assert.equal(state.budget, null);

  fillEveryAnswer();
  const partial = wizardAnswers(state);
  delete partial.effort;
  applyWizardAnswers(partial, state);
  assert.equal(state.effort, 'Weekend reset', 'an absent field takes the default');
});

test('a null in a list or flag field still normalizes', () => {
  fillEveryAnswer();
  applyWizardAnswers({ ...wizardAnswers(state), goals: null, catsTouched: null }, state);
  assert.deepEqual(state.goals, [], 'list readers must never see null');
  assert.equal(state.catsTouched, false);
});

/* The wizard heading reads "Where in the <room>?", so a room that does not
   match the area is a self-contradiction on one screen: a garage workbench
   asked which part of the kitchen it was, over a list that does not contain
   it. No row written before this change carries a room, so it is derived. */
test('a legacy row without a room derives it from the area', () => {
  const legacy = {
    id: 'legacy', name: 'old space', space_type: 'workbench', goal: null,
    dims: null, household: null, prefs: { prefs: [], toggles: {} },
    plan: null, plan_meta: null, shopping: null,
    progress: { stepsDone: [] }, arrangement: null,
  };
  fillEveryAnswer();
  state.room = 'bedroom';   // whatever the previously viewed space left behind
  applyLoadedSpace({ data: legacy, beforePhotoUrl: null, afterRenderUrl: null });
  assert.equal(state.space, 'workbench');
  assert.equal(state.room, 'garage', 'the room must match the area, not the default');
});

/* fbSent is what holds "one submission per plan". Reopening the space you are
   already on is the same plan, so clearing it there re-asks someone who has
   already answered and takes a second row for it. */
test('reopening the same space keeps its feedback answers', () => {
  resetWizardAnswers(state);
  const row = JSON.parse(JSON.stringify(rowFromState('mine')));
  applyLoadedSpace({ data: { ...row, id: 'same' }, beforePhotoUrl: null, afterRenderUrl: null });
  state.fbUseful = 'yes'; state.fbRated = true; state.fbSent = true;

  applyLoadedSpace({ data: { ...row, id: 'same' }, beforePhotoUrl: null, afterRenderUrl: null });
  assert.equal(state.fbSent, true, 'the same plan must not ask for feedback twice');
  assert.equal(state.fbRated, true);
  assert.equal(state.fbUseful, 'yes');

  applyLoadedSpace({ data: { ...row, id: 'other' }, beforePhotoUrl: null, afterRenderUrl: null });
  assert.equal(state.fbSent, false, 'a different plan gets a fresh ask');
  assert.equal(state.fbUseful, null);
});

/* The data-integrity half of the bug. Opening a second space kept the first
   one's answers in every field the second one's row did not mention, so the
   screen showed one plan while the next analysis was built from another's. */
test('opening a second space does not inherit the first space\'s answers', () => {
  fillEveryAnswer();
  const rowA = JSON.parse(JSON.stringify(rowFromState('space A')));

  // Space B: a different area, answered minimally — no goals, no styles, no
  // edited categories, none of A's detail toggles.
  resetWizardAnswers(state);
  state.room = 'kitchen';
  state.space = 'pantry';
  state.setup = 'cabinet';
  state.setupLabel = 'Cabinet';
  const rowB = JSON.parse(JSON.stringify(rowFromState('space B')));

  applyLoadedSpace({ data: { ...rowA, id: 'a' }, beforePhotoUrl: null, afterRenderUrl: null });
  assert.deepEqual(state.goals, FILLED.goals, 'space A should load its own answers');

  applyLoadedSpace({ data: { ...rowB, id: 'b' }, beforePhotoUrl: null, afterRenderUrl: null });
  assert.deepEqual(state.goals, [], 'space A\'s goals leaked into space B');
  assert.deepEqual(state.styles, [], 'space A\'s styles leaked into space B');
  assert.deepEqual(state.cats, [], 'space A\'s categories leaked into space B');
  assert.equal(state.catsTouched, false, 'space A\'s "user edited these" flag leaked');
  assert.deepEqual(state.detected, [], 'space A\'s detected items leaked');
  assert.equal(state.room, 'kitchen');
  assert.equal(state.setup, 'cabinet');
  assert.equal(state.afterMode, 'Use existing containers');
  assert.equal(state.upgrades, false);
  assert.equal(state.detail_pegboard, undefined, 'space A\'s detail toggles leaked');
  assert.equal(state.activeSpaceId, 'b');
});

/* shareView in particular: it blocks BOTH the signed-in saver and the guest
   draft writer, so a visitor who opened a share link and then opened their own
   saved space had a space they could not save. */
test('opening a saved space clears the read-only share flag', () => {
  resetWizardAnswers(state);
  const row = JSON.parse(JSON.stringify(rowFromState('mine')));
  state.shareView = true;
  state.sharedName = 'someone else\'s plan';

  applyLoadedSpace({ data: { ...row, id: 'mine' }, beforePhotoUrl: null, afterRenderUrl: null });
  assert.equal(state.shareView, false);
  assert.equal(state.sharedName, undefined);
});

/* ---------- Drafts and rows written by the previous build ---------- */

test('a guest draft in the pre-answers shape still restores', () => {
  // Exactly what the previous build wrote: flat keys on the draft itself, and
  // toggles keyed WITH the detail_ prefix (the DB half stripped it — the two
  // conventions disagreeing is part of what one serializer fixes).
  store.set('tidymap_draft_v2', JSON.stringify({
    v: 2, savedAt: 1, planReady: false,
    space: 'workbench', goal: 'find', capture: 'photos',
    room: 'garage', setup: 'bench', setupLabel: 'Workbench', setupTouched: true,
    goals: ['I can never find the drill'], styles: ['label everything'],
    shoppingPref: 'Open to a few ideas', catsTouched: true,
    effortTouched: true, shoppingTouched: true,
    prefs: ['reachable'], budget: '$100–250', effort: 'Full overhaul',
    upgrades: true, cats: ['Power tools'], afterMode: 'Show suggested products',
    dims: { w_in: 144, h_in: 78, d_in: 24, shelves: 4 },
    household: FILLED_HOUSEHOLD,
    toggles: { detail_pegboard: true },
    ai: null, planMeta: null, stepDone: [], shopping: null, arrangement: null,
  }));

  resetWizardAnswers(state);
  assert.ok(restoreGuestDraft(), 'an old draft must still restore');
  assert.equal(state.room, 'garage');
  assert.equal(state.space, 'workbench');
  assert.equal(state.setupLabel, 'Workbench');
  assert.deepEqual(state.goals, ['I can never find the drill']);
  assert.deepEqual(state.cats, ['Power tools']);
  assert.equal(state.catsTouched, true);
  assert.equal(state.shoppingPref, 'Open to a few ideas');
  assert.equal(state.shoppingTouched, true);
  assert.equal(state.afterMode, 'Show suggested products');
  assert.deepEqual(state.dimsFt, { w: 12, h: 6.5, d: 2 });
  assert.equal(state.detail_pegboard, true, 'prefixed toggle keys must still be read');
});

test('a saved space row in the pre-answers shape still restores', () => {
  // The previous build's row: no prefs.answers, toggles keys STRIPPED.
  const legacy = {
    id: 'legacy', name: 'old space',
    space_type: 'workbench', goal: 'find',
    dims: { w_in: 144, h_in: 78, d_in: 24, shelves: 4 },
    household: FILLED_HOUSEHOLD,
    prefs: {
      prefs: ['reachable'], budget: '$100–250', effort: 'Full overhaul',
      setup: 'bench', setupLabel: 'Workbench', setupTouched: true,
      shoppingPref: 'Open to a few ideas',
      effortTouched: true, shoppingTouched: true,
      toggles: { pegboard: true },
    },
    plan: null, plan_meta: null, shopping: null,
    progress: { stepsDone: [] }, arrangement: null,
  };

  fillEveryAnswer();   // prove it resets rather than inherits
  applyLoadedSpace({ data: legacy, beforePhotoUrl: null, afterRenderUrl: null });

  assert.equal(state.space, 'workbench');
  assert.equal(state.setup, 'bench');
  assert.equal(state.setupLabel, 'Workbench');
  assert.equal(state.setupTouched, true);
  assert.equal(state.effort, 'Full overhaul');
  assert.equal(state.effortTouched, true);
  assert.equal(state.shoppingPref, 'Open to a few ideas');
  assert.equal(state.shoppingTouched, true);
  assert.deepEqual([...state.prefs], ['reachable']);
  assert.equal(state.detail_pegboard, true, 'stripped toggle keys must still be read');
  assert.deepEqual(state.dimsFt, { w: 12, h: 6.5, d: 2 });
  // The answers the old row never carried come back EMPTY, not inherited.
  assert.deepEqual(state.goals, []);
  assert.deepEqual(state.cats, []);
  assert.equal(state.catsTouched, false);
});

/* A row this build writes must still be readable by the build currently in
   production, or a deploy strands anyone whose tab has not reloaded. */
test('a row this build writes keeps the fields the previous build reads', () => {
  fillEveryAnswer();
  const row = JSON.parse(JSON.stringify(rowFromState('x')));
  const p = row.prefs;
  assert.deepEqual(p.prefs, FILLED_PREFS);
  assert.equal(p.budget, FILLED.budget);
  assert.equal(p.effort, FILLED.effort);
  assert.equal(p.setup, FILLED.setup);
  assert.equal(p.setupLabel, FILLED.setupLabel);
  assert.equal(p.setupTouched, true);
  assert.equal(p.shoppingPref, FILLED.shoppingPref);
  assert.equal(p.effortTouched, true);
  assert.equal(p.shoppingTouched, true);
  assert.deepEqual(p.toggles, FILLED_TOGGLES,
    'the legacy mirror must keep the stripped toggle keys the old reader expects');
  assert.equal(p.answers.v, ANSWERS_VERSION);
});

test('applyWizardAnswers ignores a payload that is not an object', () => {
  fillEveryAnswer();
  [null, undefined, 'nope', 42, true].forEach((bad) => {
    fillEveryAnswer();
    applyWizardAnswers(bad, state);
    assert.equal(state.room, 'kitchen', `a ${typeof bad} payload must reset, not throw`);
    assert.deepEqual(state.goals, []);
  });
});
