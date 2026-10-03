import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePrefs, prefsForStyles, HOME_CONSTRAINTS } from '../js/wizard-data.js';

/* state.prefs is written from two places: recomputePrefs rebuilds it from the
   style and shopping answers, and the household step's home-limit chips write
   straight into it. The rebuild used to start from an empty Set, so tapping a
   style card or a shopping card after the household step silently dropped
   "Nothing drilled or mounted". The chip still showed selected on the way
   back, the review screen still listed it under Home limits, and the plan
   named a pegboard zone anyway. */

const KEEP = HOME_CONSTRAINTS.map(([, pref]) => pref);
const NO_DRILL = 'No drilling or permanent installation';

test('the wizard offers the pref these tests pin, so the keep list is not empty', () => {
  assert.ok(KEEP.includes(NO_DRILL), `HOME_CONSTRAINTS no longer carries "${NO_DRILL}"`);
});

test('a home-limit pref survives a style change', () => {
  const previous = new Set([NO_DRILL]);
  const next = mergePrefs({
    styles: ['Labeled bins'], shoppingPref: 'Use what I have', shoppingTouched: false,
    previous, keep: KEEP,
  });
  assert.ok(next.has(NO_DRILL), 'the household answer was dropped by the style rebuild');
  assert.ok(next.has('Labels and categories'), 'the style answer still derives its pref');
  assert.notEqual(next, previous, 'a new Set, so the caller can swap it in without aliasing state');
});

test('the keep list defaults to the home-limit prefs', () => {
  const next = mergePrefs({
    styles: [], shoppingPref: 'Use what I have', shoppingTouched: false,
    previous: new Set([NO_DRILL]),
  });
  assert.ok(next.has(NO_DRILL));
});

test('a previous pref outside the keep list does not leak through', () => {
  /* "Minimal look" is derived from a style; once that style is unticked the
     pref has to go with it. Carrying everything forward would make style
     prefs sticky, which is the opposite bug. */
  const next = mergePrefs({
    styles: [], shoppingPref: 'Use what I have', shoppingTouched: false,
    previous: new Set(['Minimal look', 'Use clear containers', NO_DRILL]), keep: KEEP,
  });
  assert.equal(next.has('Minimal look'), false);
  assert.equal(next.has('Use clear containers'), false);
  assert.ok(next.has(NO_DRILL));
});

test('a previous pref that is also derived from a current style stays', () => {
  const next = mergePrefs({
    styles: ['Clear containers'], shoppingPref: 'Use what I have', shoppingTouched: false,
    previous: new Set(['Use clear containers']), keep: KEEP,
  });
  assert.ok(next.has('Use clear containers'));
  assert.deepEqual([...next].sort(), [...prefsForStyles(['Clear containers'])].sort());
});

test('previous may be an array or missing, as a restored draft can leave it', () => {
  assert.ok(mergePrefs({ styles: [], shoppingTouched: false, previous: [NO_DRILL], keep: KEEP }).has(NO_DRILL));
  assert.equal(mergePrefs({ styles: [], shoppingTouched: false, keep: KEEP }).size, 0);
});

test('the shopping rule adds the owned constraint only once it has been answered', () => {
  /* Untouched: neither constraint, because the preselected card is not an
     answer. That is the rule recomputePrefs already applied; the extraction
     must not change it. */
  const untouched = mergePrefs({ styles: [], shoppingPref: 'Use what I have', shoppingTouched: false, previous: new Set(), keep: KEEP });
  assert.equal(untouched.has('Use only what I already own'), false);
  assert.equal(untouched.has('Open to buying storage'), false);

  const own = mergePrefs({ styles: [], shoppingPref: 'Use what I have', shoppingTouched: true, previous: new Set(), keep: KEEP });
  assert.ok(own.has('Use only what I already own'));
  assert.equal(own.has('Open to buying storage'), false);

  const shop = mergePrefs({ styles: [], shoppingPref: 'Open to a few ideas', shoppingTouched: true, previous: new Set(), keep: KEEP });
  assert.ok(shop.has('Open to buying storage'));
  assert.equal(shop.has('Use only what I already own'), false);
});

test('a stale shopping constraint in previous does not survive a changed answer', () => {
  /* Switching from "Use what I have" to "Open to a few ideas" must replace the
     constraint, not accumulate both. The shopping prefs are rebuilt from the
     answer every time, so they are not in the keep list. */
  const next = mergePrefs({
    styles: [], shoppingPref: 'Open to a few ideas', shoppingTouched: true,
    previous: new Set(['Use only what I already own', NO_DRILL]), keep: KEEP,
  });
  assert.equal(next.has('Use only what I already own'), false);
  assert.ok(next.has('Open to buying storage'));
  assert.ok(next.has(NO_DRILL));
});

test('recomputePrefs itself carries the household chip through a style change', async () => {
  /* mergePrefs is the pure half, and the tests above pin it. The bug lived in
     its caller: recomputePrefs in js/screens/wizard.js rebuilt state.prefs
     from prefsForStyles alone, and this suite stayed green with that
     reverted, because nothing here ran the screen's function. So the real one
     runs here, against the real state object, with the household step's chip
     already in it. */
  const { recomputePrefs } = await import('../js/screens/wizard.js');
  const { state } = await import('../js/state.js');
  state.prefs = new Set([NO_DRILL]);
  state.styles = ['Labeled bins'];
  state.shoppingPref = 'Use what I have';
  state.shoppingTouched = false;
  recomputePrefs();
  assert.ok(state.prefs.has(NO_DRILL), 'the household answer was dropped by the screen\'s rebuild');
  assert.ok(state.prefs.has('Labels and categories'), 'the style answer still derives its pref');
});

test('HOME_CONSTRAINTS is still importable from the wizard screen module', async () => {
  /* post-plan-honesty.test.mjs and anything else that learned the old path
     keep working; the constant moved so the pure merge could read it. */
  const wizard = await import('../js/screens/wizard.js');
  assert.equal(wizard.HOME_CONSTRAINTS, HOME_CONSTRAINTS);
});
