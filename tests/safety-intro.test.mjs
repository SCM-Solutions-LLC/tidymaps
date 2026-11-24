import test from 'node:test';
import assert from 'node:assert/strict';
import { safetyIntro } from '../js/screens/results.js';

/* Audit 11-24: a two-adult household with only food-safety notes was told
   they were "based on what you told us about kids, pets, and reach". */
const none = { adults: 2, kidCount: 0, petCount: 0, kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [] };

test('the safety intro names only what the household told us', () => {
  assert.equal(safetyIntro(none, false), 'The notes below are placements chosen for safety. The plan already follows them.');
  assert.match(safetyIntro({ ...none, kidCount: 2, kids: { present: 'yes', ages: ['Toddler'] } }, false), /about kids\./);
  assert.match(safetyIntro({ ...none, kidCount: 1, kids: { present: 'yes' }, petCount: 1, pets: { present: 'yes' }, mobility: ['Limited reach'] }, false), /about kids, pets and reach\./);
  assert.match(safetyIntro({ ...none, petCount: 1, pets: { present: 'yes' } }, false), /about pets\./);
  assert.doesNotMatch(safetyIntro({ ...none, kidCount: 1, kids: { present: 'yes' } }, true), /kids/, 'a share view does not describe the viewer');
  for (const h of [none, { ...none, kidCount: 1, kids: { present: 'yes' } }]) assert.doesNotMatch(safetyIntro(h, false), /—/);
});
