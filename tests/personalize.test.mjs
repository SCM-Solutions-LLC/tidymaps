import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAnswers, applyCategoryEdits, EFFORT_STEPS, REVISIONS, applyRevision, planMinutes } from '../js/personalize.js';
import { getDemoScenario } from '../js/demo-scenarios.js';

// Every wizard answer must leave a visible, attributable trace in the plan —
// otherwise the plan reads as a template. These tests run the deterministic
// personalization layer against real scenarios for real spaces.

const NO_KIDS = { kids: { present: 'no', ages: [] }, pets: { present: null, types: [] }, mobility: [], notes: '' };

function freshPlan(space = 'pantry', goal = 'find', answers = null) {
  return getDemoScenario(space, goal, NO_KIDS, answers);
}

function stepText(plan) {
  return plan.steps.map(s => s.task + ' ' + (s.why || '')).join(' | ');
}

/* The band the plan's own step times fall into — the headline time must
   always be this, whichever effort was chosen. */
const TIME_BANDS = [[45, '~30 min'], [100, '45–90 min'], [200, '2–3 hours'], [330, '3–5 hours'], [Infinity, '4–8 hours']];
function bandFor(plan) {
  return TIME_BANDS.find(([max]) => planMinutes(plan.steps) < max)[1];
}

/* ---------- prefs: all 13 leave a trace ---------- */

const PREF_TRACES = {
  'Use only what I already own': p => p.productNeeds.length === 0 && /already own/i.test(stepText(p) + p.dontBuy),
  'Open to buying storage': p => (p.opportunities || []).some(o => /open to buying/i.test(o)),
  'Keep frequent items easy to reach': p => /easy to reach/i.test(stepText(p) + p.map.map(m => m.why).join(' ')),
  'Hide visual clutter': p => /hide visual clutter|opaque/i.test(stepText(p)),
  'Kid-friendly access': p => p.map.some(m => m.safety && m.safety.flag === 'kid-safe' && /kid-friendly/i.test(m.safety.why || '')),
  'No drilling or permanent installation': p => (p.opportunities || []).some(o => /no drilling/i.test(o)) && !p.productNeeds.some(n => ['door-rack', 'hook-rack'].includes(n.type)),
  'Minimal look': p => /minimal look/i.test(p.summary) && p.map.every(m => (m.items || []).length <= 2),
  'Labels and categories': p => /labels and categories/i.test(stepText(p)),
  'Maximize vertical space': p => /vertical space/i.test(stepText(p)),
  'Make heavy items safer': p => /heavy items safer|heavy/i.test(stepText(p)),
  'Use clear containers': p => /clear containers/i.test(stepText(p)),
  'Use baskets / hidden storage': p => /baskets/i.test(stepText(p)),
  'Easy to maintain': p => /easy to maintain|weekly reset/i.test(stepText(p)),
};

for (const [pref, check] of Object.entries(PREF_TRACES)) {
  test(`pref "${pref}" leaves a cited trace in the plan`, () => {
    const plan = freshPlan('pantry', 'find', { prefs: [pref] });
    assert.ok(check(plan), `no trace of "${pref}" — steps: ${stepText(plan)}`);
  });
}

test('prefs leave traces across different spaces, not just pantry', () => {
  for (const space of ['garage', 'closet', 'drawers', 'bathroom']) {
    const plan = freshPlan(space, 'find', { prefs: ['Labels and categories', 'Easy to maintain'] });
    assert.ok(/labels and categories/i.test(stepText(plan)), `labels trace missing in ${space}`);
    assert.ok(/easy to maintain|weekly reset/i.test(stepText(plan)), `maintain trace missing in ${space}`);
  }
});

/* ---------- toggles: all 7 leave a trace; dedupe against prefs ---------- */

const TOGGLE_TRACES = {
  rental: [{ rental: 'yes' }, p => (p.opportunities || []).some(o => /rental/i.test(o))],
  drill: [{ drill: 'no' }, p => (p.opportunities || []).some(o => /drilling isn/i.test(o))],
  heavy: [{ heavy: 'yes' }, p => /heavy/i.test(stepText(p))],
  hidden: [{ hidden: 'yes' }, p => /hidden|opaque/i.test(stepText(p))],
  daily: [{ daily: 'yes' }, p => /daily|easiest-to-reach/i.test(stepText(p))],
  rarely: [{ rarely: 'yes' }, p => /rarely used/i.test(stepText(p))],
  kids: [{ kids: 'yes' }, p => p.map.some(m => m.safety && m.safety.flag === 'kid-safe' && /kids will access/i.test(m.safety.why || ''))],
};

for (const [name, [toggles, check]] of Object.entries(TOGGLE_TRACES)) {
  test(`toggle "${name}" leaves a cited trace`, () => {
    const plan = freshPlan('pantry', 'find', { toggles });
    assert.ok(check(plan), `no trace of toggle ${name} — steps: ${stepText(plan)}`);
  });
}

test('equivalent pref + toggle produce ONE cited step, not two (dedupe)', () => {
  const plan = freshPlan('pantry', 'find', {
    prefs: ['Make heavy items safer'],
    toggles: { heavy: 'yes' },
  });
  const heavySteps = plan.steps.filter(s => /heavy items.*(lowest|bottom) shelf/i.test(s.task));
  assert.equal(heavySteps.length, 1, `expected exactly one heavy step, got ${heavySteps.length}`);
  assert.match(heavySteps[0].why, /You asked to make heavy items safer/, 'the existing step must carry the citation');
});

/* ---------- budget ---------- */

test('$0 budget: zero purchases, cited, with a shop-your-home step', () => {
  const plan = freshPlan('pantry', 'find', { budget: '$0' });
  assert.equal(plan.productNeeds.length, 0);
  assert.match(plan.dontBuy, /\$0 budget/);
  assert.match(stepText(plan), /shop your own home/i);
});

test('"Use only what I already own" also zeroes purchases even with a budget set', () => {
  const plan = freshPlan('garage', 'find', { budget: 'Under $100', prefs: ['Use only what I already own'] });
  assert.equal(plan.productNeeds.length, 0);
  assert.match(plan.dontBuy, /already own/i);
});

test('Under $50 keeps at most 3 high-priority needs', () => {
  const plan = freshPlan('pantry', 'find', { budget: 'Under $50' });
  assert.ok(plan.productNeeds.length <= 3);
  assert.ok(plan.productNeeds.every(p => p.priority === 'high'));
});

/* ---------- effort ---------- */

test('Quick reset trims to its band; safety and personalized steps survive', () => {
  const answers = {
    effort: 'Quick 30-minute reset',
    prefs: ['Labels and categories'],
    toggles: { heavy: 'yes' },
  };
  const plan = freshPlan('pantry', 'find', answers);
  assert.ok(plan.steps.length <= EFFORT_STEPS['Quick 30-minute reset'],
    `expected <=${EFFORT_STEPS['Quick 30-minute reset']} steps, got ${plan.steps.length}`);
  assert.match(stepText(plan), /labels and categories/i, 'personalized label step was trimmed');
  assert.match(stepText(plan), /heavy/i, 'safety-relevant heavy step was trimmed');
  /* This used to assert '~30 min' flat, which is the defect rather than the
     contract: the six surviving steps add up to about an hour, and the
     report printed half that. The effort answer sizes the plan; the time is
     a fact about the steps that ended up on it. */
  assert.equal(plan.time, bandFor(plan), `"${plan.time}" does not match ${Math.round(planMinutes(plan.steps))} min of steps`);
});

test('Full reorganization grows to its band with cited per-zone steps', () => {
  const plan = freshPlan('pantry', 'find', { effort: 'Full reorganization' });
  assert.ok(plan.steps.length >= 12, `expected a deep plan, got ${plan.steps.length} steps`);
  assert.match(stepText(plan), /Full reorganization/, 'added steps must cite the chosen effort');
});

/* ---------- dims ---------- */

test('deep and narrow measurements produce cited advice', () => {
  const deep = freshPlan('pantry', 'find', { dims: { w_in: 36, h_in: 72, d_in: 18 } });
  // The pantry scenario already recommends a turntable, so the measurement is
  // cited on the recommendation; spaces without one get an opportunity line.
  const deepTrace = (deep.opportunities || []).some(o => /18″ deep/.test(o))
    || (deep.productNeeds || []).some(p => /18″ deep/.test(p.purpose));
  assert.ok(deepTrace, 'deep-shelf advice missing');
  const narrow = freshPlan('closet', 'find', { dims: { w_in: 20, h_in: 72, d_in: 12 } });
  assert.ok((narrow.opportunities || []).some(o => /20″ wide/.test(o)), 'narrow-space advice missing');
});

/* ---------- differentiation: no two profiles get the same plan ---------- */

test('two different answer sets for the same space produce materially different plans', () => {
  const a = freshPlan('pantry', 'find', {
    prefs: ['Minimal look', 'Use only what I already own'],
    budget: '$0', effort: 'Quick 30-minute reset', toggles: { rental: 'yes' },
  });
  const b = freshPlan('pantry', 'find', {
    prefs: ['Maximize vertical space', 'Use clear containers', 'Labels and categories'],
    budget: 'Under $250', effort: 'Full reorganization', toggles: { heavy: 'yes', rarely: 'yes' },
  });
  assert.notEqual(a.steps.length, b.steps.length, 'step counts should differ');
  assert.notDeepEqual(a.steps.map(s => s.task), b.steps.map(s => s.task));
  assert.equal(a.productNeeds.length, 0);
  assert.ok(b.productNeeds.length > 0);
});

/* ---------- review-screen category edits (normalized shape) ---------- */

function normalizedFixture() {
  return {
    cats: ['Cereal', 'Snacks', 'Cans'],
    map: [
      { lv: 'Top shelf', zone: 'Bulk & backup', why: '', eye: false, items: [{ name: 'Cereal', size: 'm', flags: [] }] },
      { lv: 'Eye level', zone: 'Daily snacks', why: '', eye: true, items: [{ name: 'Snacks', size: 'm', flags: [] }] },
      { lv: 'Middle', zone: 'Cans & jars', why: '', eye: false, items: [{ name: 'Cans', size: 'm', flags: [] }] },
    ],
  };
}

test('unticking a category removes it from every zone', () => {
  const plan = applyCategoryEdits(normalizedFixture(), ['Cereal', 'Cans']); // Snacks unticked
  const names = plan.map.flatMap(m => m.items.map(i => i.name));
  assert.ok(!names.includes('Snacks'));
  assert.deepEqual(plan.cats, ['Cereal', 'Cans']);
});

test('an added category lands in exactly one zone (keyword fit first)', () => {
  const plan = applyCategoryEdits(normalizedFixture(), ['Cereal', 'Snacks', 'Cans', 'Jars']);
  const zonesWithJars = plan.map.filter(m => m.items.some(i => i.name === 'Jars'));
  assert.equal(zonesWithJars.length, 1);
  assert.equal(zonesWithJars[0].zone, 'Cans & jars', 'should keyword-match the jars zone');
});

test('zone labels and rationales mentioning a removed category are scrubbed', () => {
  const plan = {
    cats: ['Cereal', 'Snacks'],
    map: [{
      lv: 'Eye level', zone: 'Snacks · Cereal', eye: true,
      why: 'Snacks stay at eye level for fast mornings. Cereal boxes line up beside them.',
      items: [{ name: 'Snack packets', size: 'm', flags: [] }, { name: 'Cereal', size: 'm', flags: [] }],
    }],
  };
  applyCategoryEdits(plan, ['Cereal']); // Snacks removed
  const m = plan.map[0];
  assert.equal(m.zone, 'Cereal', 'zone label should drop the removed segment');
  assert.doesNotMatch(m.why, /snack/i, 'rationale sentence mentioning the removed category should be dropped');
  assert.match(m.why, /Cereal boxes/, 'unrelated rationale sentences survive');
  assert.deepEqual(m.items.map(i => i.name), ['Cereal'], 'stem match should drop "Snack packets"');
});

test('an added category with no keyword fit falls back to the eye-level zone', () => {
  const plan = applyCategoryEdits(normalizedFixture(), ['Cereal', 'Snacks', 'Cans', 'Pet food']);
  const zone = plan.map.find(m => m.items.some(i => i.name === 'Pet food'));
  assert.ok(zone.eye, 'fallback placement should be the eye-level zone');
});

/* The "Adjust this plan" screen offers eleven options. Six of them did
   something; the other five — minimal, kid, capacity, hide, labels — fell
   through to a re-render of the identical step list while still announcing
   "Plan revised: Maximize storage capacity" and a success toast. The
   checklist came back byte-for-byte the same. Each already had a preference
   handler doing exactly what its copy promises, so they route there now. */
test('every Adjust option that claims to revise the plan actually changes it', () => {
  const household = { kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };

  for (const id of Object.keys(REVISIONS)) {
    const plan = getDemoScenario('pantry', 'find', household);
    const before = JSON.stringify({ map: plan.map, steps: plan.steps, summary: plan.summary, productNeeds: plan.productNeeds });

    assert.equal(applyRevision(plan, id), true, `${id}: revision refused on a fresh plan`);
    const after = JSON.stringify({ map: plan.map, steps: plan.steps, summary: plan.summary, productNeeds: plan.productNeeds });
    assert.notEqual(after, before, `${id}: claimed to revise the plan but changed nothing`);

    // Applying the same revision twice is refused rather than compounding —
    // 'Minimal look' appends to the summary, so a second pass would repeat it.
    const repeated = JSON.parse(JSON.stringify(plan));
    assert.equal(applyRevision(plan, id), false, `${id}: applied twice`);
    assert.deepEqual(plan.map, repeated.map, `${id}: a refused revision still mutated the plan`);
    assert.equal(plan.summary, repeated.summary);
  }
});

test('an unknown Adjust option revises nothing and says so', () => {
  const plan = getDemoScenario('pantry', 'find', { kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' });
  assert.equal(applyRevision(plan, 'fewer'), false, 'step-count options are handled separately, not as revisions');
  assert.equal(applyRevision(null, 'minimal'), false, 'a missing plan must not throw');
});

/* ---------- revisions run on the NORMALIZED plan ----------
   The Adjust screen calls applyRevision on state.ai, where steps are {t,m,w}
   — not the raw {task,time,why} the scenarios emit. The handlers used to
   assume raw and appended steps the renderer showed as "undefined". */

const { state } = await import('../js/state.js');
const { normalizeAi } = await import('../js/plan.js');

function normalizedPlan(space = 'pantry', goal = 'find', household = NO_KIDS) {
  state.dims = null; // normalizeGeometry reads the wizard's measurements
  return normalizeAi(getDemoScenario(space, goal, household));
}

test('every revision keeps the normalized step shape — no raw {task} steps, no "undefined"', () => {
  for (const id of Object.keys(REVISIONS)) {
    const plan = normalizedPlan();
    assert.equal(applyRevision(plan, id), true, `${id}: first application refused`);
    for (const st of plan.steps) {
      assert.equal(typeof st.t, 'string', `${id}: step lost its title: ${JSON.stringify(st)}`);
      assert.ok(st.t && st.t !== 'undefined', `${id}: step renders as undefined`);
      assert.ok(!('task' in st), `${id}: raw-shape step leaked into the normalized plan`);
      assert.ok((st.m ?? '') !== 'undefined' && (st.w ?? '') !== 'undefined', `${id}: time/why render as undefined`);
    }
    assert.equal(applyRevision(plan, id), false, `${id}: second application must refuse`);
  }
});

test('a revision that cites an existing step writes to the normalized field', () => {
  const plan = normalizedPlan(); // pantry has an "Add labels if available" step
  applyRevision(plan, 'labels');
  const labeled = plan.steps.find(s => /label/i.test(s.t + ' ' + s.w));
  assert.ok(labeled, 'label step missing');
  assert.match(labeled.w, /labels and categories/i, 'citation landed on the wrong field');
  assert.ok(!('why' in labeled), 'citation created a parallel raw field');
});

test('minimal look cites once, even after the style already asked for it', () => {
  state.dims = null;
  const plan = normalizeAi(getDemoScenario('closet', 'find', NO_KIDS, { prefs: ['Minimal look'] }));
  applyRevision(plan, 'minimal');
  assert.equal(plan.summary.split('You asked for a minimal look').length - 1, 1,
    `summary stacked the sentence: ${plan.summary}`);
});

test('kid-friendly revision leaves a visible trace even when a kid-safe zone already exists', () => {
  const KIDS = { kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: null, types: [] }, mobility: [], notes: '' };
  const plan = normalizedPlan('pantry', 'find', KIDS);
  assert.ok(plan.map.some(m => m.safety && m.safety.flag === 'kid-safe'), 'precondition: scenario already kid-safe');
  const before = JSON.stringify(plan.map);
  assert.equal(applyRevision(plan, 'kid'), true);
  assert.notEqual(JSON.stringify(plan.map), before, '"Plan revised" announced with nothing visibly changed');
});

/* The kid-friendly revision must cite the zone that IS kid-safe and must
   never weld "you asked for kid-friendly access" onto a keep-high or
   lock-or-latch hazard zone (the bathroom's chemicals caddy sits at
   map[len-2], which the old handler picked by position). */
test('the kid revision never touches a hazard zone', () => {
  for (const space of ['pantry', 'cabinet', 'closet', 'garage', 'bathroom', 'dresser', 'linen', 'drawers', 'workbench']) {
    state.dims = null;
    const plan = normalizeAi(getDemoScenario(space, null,
      { kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' }));
    const hazardsBefore = plan.map
      .filter(m => m.safety && ['keep-high', 'lock-or-latch'].includes(m.safety.flag))
      .map(m => ({ lv: m.lv, flag: m.safety.flag, why: m.safety.why }));
    applyRevision(plan, 'kid');
    for (const h of hazardsBefore) {
      const now = plan.map.find(m => m.lv === h.lv);
      assert.equal(now.safety.flag, h.flag, `${space}: hazard flag on "${h.lv}" was changed`);
      assert.equal(now.safety.why, h.why, `${space}: kid citation landed on hazard zone "${h.lv}"`);
    }
    assert.ok(plan.map.some(m => m.safety && m.safety.flag === 'kid-safe'),
      `${space}: the revision promised a kid-safe zone and produced none`);
  }
});

/* ---------- goals ----------
   The wizard takes as many answers to "What bugs you most?" as the user
   wants. Only the FIRST was read, through goalIdFor(), which collapses 30 of
   the 57 options to 'unsure' — a branch that does nothing. A third of a
   whole step, including every bathroom answer but one, changed nothing. */

import { SPACE_CFG, goalIdFor } from '../js/wizard-data.js';

const ALL_GOALS = Object.entries(SPACE_CFG).flatMap(([space, cfg]) => cfg.goals.map(g => ({ space, goal: g })));

test('every goal the wizard offers leaves a step citing the user\'s own words', () => {
  assert.ok(ALL_GOALS.length >= 50, `expected the full goal set, got ${ALL_GOALS.length}`);
  for (const { space, goal } of ALL_GOALS) {
    const plan = getDemoScenario(space, goalIdFor(goal), NO_KIDS, { goals: [goal], effort: 'Full overhaul' });
    assert.ok(stepText(plan).includes(goal),
      `${space}: "${goal}" (id ${goalIdFor(goal)}) produced no step quoting it`);
  }
});

test('every selected goal is read, not just the first', () => {
  const goals = ['Can\'t find anything', 'Hard to keep tidy', 'Expired food hides in back'];
  const plan = getDemoScenario('pantry', 'find', NO_KIDS, { goals, effort: 'Full overhaul' });
  for (const g of goals) {
    assert.ok(stepText(plan).includes(g), `"${g}" was dropped — only the first goal was read`);
  }
});

test('goal advice is not duplicated when the same goal is passed twice', () => {
  const plan = getDemoScenario('pantry', 'find', NO_KIDS,
    { goals: ['Hard to keep tidy', 'Hard to keep tidy'], effort: 'Full overhaul' });
  const cited = plan.steps.filter(s => (s.why || '').includes('Hard to keep tidy'));
  assert.equal(cited.length, 1, `expected one cited step, got ${cited.length}`);
});

test('a goal-cited step survives effort trimming', () => {
  // Goal steps are personalized, so the "Quick refresh" trim must not drop
  // the one thing the user said bothers them most.
  const plan = getDemoScenario('pantry', 'find', NO_KIDS,
    { goals: ['Expired food hides in back'], effort: 'Quick refresh' });
  assert.ok(stepText(plan).includes('Expired food hides in back'),
    'the trim removed the step that cites the user\'s stated problem');
});
