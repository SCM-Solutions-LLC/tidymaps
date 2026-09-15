import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planFromPhotos, planIsSample, answeredAnything, dimsTyped } from '../js/planProvenance.js';

/* The 3D view told every visitor who opened the sample pantry that its
   dimensions were "estimated from your photos" and that the model matched
   their space. It read geometry.estimated, which is true of every demo
   scenario. Whose plan it is, and whether a photo was ever read, is decided
   here now, once, for the report and the viewer alike. */

const NOBODY = { adults: 0, kidCount: 0, petCount: 0, kids: { present: null, ages: [] }, pets: { present: null, types: [] }, mobility: [], notes: '' };
const TWO_ADULTS = { adults: 2, kidCount: 0, petCount: 0, kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };

/* The landing page's sample, as prepareDemoPlanState leaves it. */
const sample = (over = {}) => ({
  ai: { spaceType: 'Pantry' }, planMeta: { model: 'demo', source: 'demo', analyzedAt: 0 },
  space: 'pantry', spaceTouched: false, setup: 'cabinet', setupTouched: false,
  catsTouched: false, shoppingTouched: false, effortTouched: false, householdTouched: false,
  household: NOBODY, dimsFt: null, goals: [], styles: [], uploadedFiles: [],
  ...over,
});

test('the landing sample is a sample, and did not come from photos', () => {
  const s = sample();
  assert.equal(planIsSample(s), true);
  assert.equal(planFromPhotos(s), false);
  assert.equal(answeredAnything(s), false);
});

test('only a real analysis counts as photos: a failed one keeps the files and read none', () => {
  const failed = sample({
    planMeta: { model: 'demo', source: 'demo-fallback', analyzedAt: 0 },
    uploadedFiles: [{ type: 'image/jpeg' }], household: TWO_ADULTS,
  });
  assert.equal(planFromPhotos(failed), false, 'a photo on file is not a photo that was read');
  assert.equal(planIsSample(failed), false, 'and a plan with a photo behind it is not the sample');

  // A saved analysis reopened later has no files in memory and was still read from them.
  const reopened = sample({ planMeta: { model: 'claude-sonnet-4-6', source: 'ai', analyzedAt: 0 } });
  assert.equal(planFromPhotos(reopened), true);
  assert.equal(planIsSample(reopened), false);

  assert.equal(planFromPhotos(sample({ ai: null, planMeta: { model: 'x', source: 'ai', analyzedAt: 0 } })), false, 'no plan, no photos');
});

test('a demo plan built at the end of the wizard is theirs, not the sample', () => {
  for (const [why, over] of [
    ['picked the space', { spaceTouched: true }],
    ['picked a setup', { setupTouched: true }],
    ['typed a measurement', { dimsFt: { w: 4, h: 6.5, d: 1.5 } }],
    ['named a goal', { goals: ['find'] }],
    ['answered the household step', { household: TWO_ADULTS, householdTouched: true }],
    ['added a photo', { uploadedFiles: [{ type: 'image/jpeg' }] }],
  ]) {
    const s = sample(over);
    assert.equal(answeredAnything(s), true, why);
    assert.equal(planIsSample(s), false, `${why}: still called a sample`);
  }
});

test('the setup defaults on the measure step are not a typed measurement', () => {
  /* syncDims writes dims from SETUP_DIMS whether or not anyone typed, so "has
     dims" is true of every wizard run; only a difference means an answer. */
  assert.equal(dimsTyped(sample({ dimsFt: { w: 3, h: 6.5, d: 1.5 } })), false);
  assert.equal(dimsTyped(sample({ dimsFt: { w: 3, h: 7, d: 1.5 } })), true);
  assert.equal(dimsTyped(sample({ setup: 'nosuch', dimsFt: { w: 3, h: 7, d: 1.5 } })), false,
    'an unknown setup has no default to differ from');
});

test('the report and the 3D view read the same rule', () => {
  /* The two used to work it out separately, and the viewer's copy was the one
     that called the sample "your photos". A second rule is a second thing to
     drift, so neither screen may read planMeta.source for itself. */
  for (const file of ['js/screens/results.js', 'js/screens/viewer3d.js']) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(src, /from '\.\.\/planProvenance\.js'/, `${file} does not import the shared rule`);
    assert.doesNotMatch(src, /planMeta\.source\s*===\s*'(ai|demo)'/, `${file} re-reads planMeta.source on its own`);
  }
});
