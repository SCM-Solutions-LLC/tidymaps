import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSharedPlan, sharedSpacePayload } from '../supabase/functions/_shared/sharePayload.js';

// A share link is read-only and must never leak anything personal. These
// tests pin the allowlist: household, progress, shopping, media paths, and
// user ids stay out of the shared payload no matter what the row contains.

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
  const plan = sanitizeSharedPlan(FULL_ROW.plan);
  assert.equal(plan.somePrivateFutureField, undefined);
  assert.equal(plan.productNeeds, undefined, 'product needs are not part of a shared view');
  assert.equal(plan.summary, 'A tidy closet plan.');
  assert.equal(plan.map.length, 1);
  assert.equal(plan.steps.length, 1);
  assert.deepEqual(plan.safetyNotes, ['Heavy items low.']);
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
