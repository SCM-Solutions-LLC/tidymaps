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
