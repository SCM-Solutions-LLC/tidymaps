import test from 'node:test';
import assert from 'node:assert/strict';
import { getDemoScenario } from '../js/demo-scenarios.js';
import { applyAnswers, planTimeLabel, planMinuteRange } from '../js/personalize.js';
import { sanitizeSharedPlan } from '../supabase/functions/_shared/sharePayload.js';
import { normalizeAi } from '../js/plan.js';

/* The report is where the app makes claims, and the sweep found it making
   several it could not support: a $0 plan recommending purchases, a time that
   understated its own checklist, an inventory of things nobody counted, and a
   shared copy that dropped the scoping the owner's copy carries. */

const NO_KIDS = { adults: 2, kidCount: 0, petCount: 0, kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };
const plan = (space, answers) => getDemoScenario(space, 'find', NO_KIDS, answers);

test('a $0 plan stops recommending products in its opportunities', () => {
  /* The steps were the half that got fixed. The opportunities went on selling:
     "A can riser would make every can visible", directly above a callout
     promising every step works with what is already in the space. */
  for (const space of ['pantry', 'bathroom', 'garage', 'closet']) {
    const p = plan(space, { budget: '$0', dims: { w_in: 36, h_in: 72, d_in: 18 } });
    const text = (p.opportunities || []).join(' | ');
    assert.doesNotMatch(text, /\briser\b|\bturntable\b|stacking bins|drawer organizer/i,
      `${space}: $0 plan still recommends a purchase — ${text}`);
    assert.equal(p.productNeeds.length, 0);
  }
});

test('the depth advice names the levels this plan actually has', () => {
  /* "Your shelves are 18″ deep" went to a drawer tower and to a hanging closet.
     The number tracked the measurement; the noun tracked nothing. */
  const deep = { dims: { w_in: 36, h_in: 72, d_in: 18 } };
  const drawers = applyAnswers(plan('drawers', null), deep);
  const drawerText = (drawers.opportunities || []).join(' ') + (drawers.productNeeds || []).map(n => n.purpose).join(' ');
  assert.match(drawerText, /\d+″ deep/, 'sanity: the depth advice fires for a drawer bank');
  assert.doesNotMatch(drawerText, /\bshelves are \d+″ deep/i, `a drawer bank has no shelves — ${drawerText}`);

  /* And where depth is not a reach problem at all, the advice does not fire:
     nothing sits behind anything on a hanging rail, so "a turntable stops
     things vanishing at the back" described furniture the plan does not have. */
  const closet = applyAnswers(plan('closet', null), deep);
  assert.doesNotMatch((closet.opportunities || []).join(' '), /turntable|pull-out tray/i);
  // and a shelved space still says shelves
  const pantry = applyAnswers(plan('pantry', null), deep);
  const pantryText = (pantry.opportunities || []).join(' ') + (pantry.productNeeds || []).map(n => n.purpose).join(' ');
  assert.match(pantryText, /shel(f|ves)/i);
});

test('the headline time contains the checklist it heads', () => {
  /* A table of bands had one covering up to 100 minutes under the name
     "45–90 min", so a checklist adding to 92–97 was announced as 45–90. */
  const steps = [{ time: '20 min' }, { time: '20 min' }, { time: '25–30 min' }, { time: '25 min' }];
  const { lo, hi } = planMinuteRange(steps);
  assert.equal(lo, 90);
  assert.equal(hi, 95);
  const label = planTimeLabel(steps);
  const m = label.match(/(\d+)–(\d+)/);
  assert.ok(m, label);
  assert.ok(Number(m[1]) <= lo && Number(m[2]) >= hi, `"${label}" does not cover ${lo}–${hi} min`);
});

test('the reuse cards stop counting things nobody counted', () => {
  /* A lede softened to "Spaces like this usually have…" over cards reading
     "Reuse: 2 baskets" is not softened. The number is the claim. */
  for (const space of ['pantry', 'garage', 'closet', 'bathroom']) {
    const p = plan(space, null);
    if (p.observed !== false) continue;
    for (const card of p.existing || []) {
      assert.doesNotMatch(String(card.title), /^(?:Reuse: )?(?:\d+|one|two|three|four|five|six)\s/i,
        `${space}: "${card.title}" counts inventory in a plan built from no photos`);
    }
  }
});

test('sharing a plan carries whether anything looked at the space', () => {
  /* `observed` was not on the allowlist, and normalizeAi reads a missing value
     as true — so the scoping the owner sees was stripped by the act of sharing
     and the guesses arrived at the visitor as findings. */
  const built = plan('pantry', null);
  assert.equal(built.observed, false, 'a demo plan saw nothing');
  const shared = sanitizeSharedPlan(built);
  assert.equal(shared.observed, false, 'the flag must survive sanitization');
  assert.equal(normalizeAi(shared).observed, false, 'and survive the visitor\'s normalize');

  // an observed plan still says so
  assert.equal(normalizeAi(sanitizeSharedPlan({ ...built, observed: true })).observed, true);
});

test('the sanitizer still refuses everything it refused before', () => {
  const shared = sanitizeSharedPlan({
    summary: 'ok', map: [], steps: [], observed: false,
    user_id: 'u_1', household: { kids: true }, progress: { stepsDone: [true] }, shopping: [{ id: 'x' }],
  });
  for (const leak of ['user_id', 'household', 'progress', 'shopping']) {
    assert.equal(leak in shared, false, `${leak} must not travel with a shared plan`);
  }
});

/* A renter walked all twelve steps looking for a way to say "nothing can be
   screwed to a wall" and found none — while the plan engine had handled exactly
   that for as long as the handler has existed. The questions that once set it
   were removed and no style derives it, so the behaviour was live and
   unreachable, and the plan she got named a pegboard zone. */
test('the no-drilling constraint is reachable from the wizard', async () => {
  const { HOME_CONSTRAINTS } = await import('../js/screens/wizard.js');
  const { PREF_HANDLER_KEYS } = await import('../js/personalize.js');
  assert.ok(HOME_CONSTRAINTS.length, 'the household step offers at least one home limit');
  for (const [label, pref] of HOME_CONSTRAINTS) {
    assert.ok(label && label.trim(), 'every constraint chip has a label');
    assert.ok(PREF_HANDLER_KEYS.includes(pref),
      `"${pref}" has no handler, so the chip would do nothing`);
  }
});

test('a no-drilling plan stops telling the user to make holes', () => {
  const HOLE = /\bdrill|wall[- ]mounted|\bhang(?:ing)? hooks?\b|\bbrackets?\b|\banchors?\b/i;
  for (const [space, setup] of [['workbench', 'bench'], ['closet', 'reachinC'], ['garage', 'utility']]) {
    const p = getDemoScenario(space, 'find', NO_KIDS,
      { prefs: ['No drilling or permanent installation'], effort: 'Full overhaul' }, setup);
    const said = [...p.steps.map(s => s.task), ...(p.opportunities || []).filter(o => !/freestanding/.test(o)), p.dontBuy || ''];
    for (const line of said) {
      assert.doesNotMatch(String(line), HOLE, `${space}: "${line}"`);
    }
    assert.equal(p.productNeeds.some(n => ['hook-rack', 'door-rack'].includes(n.type)), false,
      `${space}: recommends hardware that has to be fixed to something`);
    assert.ok((p.opportunities || []).some(o => /freestanding/i.test(o)), `${space}: the answer is not cited`);
  }
});

test('it does not delete the screws the user is trying to organize', () => {
  /* The filter used to look for "screw", which took out "Sort screws and
     fasteners into compartments by size" — a step about the contents of the
     space, not about attaching anything to it. */
  const p = getDemoScenario('workbench', 'find', NO_KIDS,
    { prefs: ['No drilling or permanent installation'], effort: 'Full overhaul' }, 'bench');
  assert.match(p.steps.map(s => s.task).join(' | '), /screws and fasteners/i);
});
