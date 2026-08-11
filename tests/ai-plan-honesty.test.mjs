import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceArchetypeHonesty, ARCHETYPE_SURFACES, mentionsMissingSurface } from '../js/setupStructure.js';
import { normalizeAi } from '../js/plan.js';

/* The surface-honesty machinery was only ever reachable from getDemoScenario,
   so it protected the offline path and nothing in production. A model that read
   the photos as a pegboard workbench, on a setup the viewer draws as a drawer
   bank, put a pegboard in the report next to a picture with no wall in it.

   What enforceArchetypeHonesty does NOT do is as load-bearing as what it does:
   it never re-projects the map. Those rows are levels somebody photographed,
   and replacing them with a template would delete what the user can see in
   their own picture. Only the language moves. */

// A model plan for a rolling tool chest, read as a workbench: pegboard, bench
// surface, and a hook rack, none of which a drawer bank has.
const workbenchPlan = () => ({
  spaceType: 'Workbench',
  summary: 'A cluttered workbench with a pegboard wall above it. Hand tools are piled on the bench surface with no home. Screws and fasteners are loose in coffee cans.',
  categories: ['Hand tools', 'Fasteners'],
  problems: ['The bench surface is covered, so there is nowhere to work.', 'Fasteners are unsorted.'],
  opportunities: ['Outline each tool on the pegboard so a gap shows what is missing.'],
  safetyNotes: ['Keep sharp chisels off the pegboard at child height.'],
  steps: [
    { task: 'Empty everything out and sort into keep, move, toss', time: '20 min', why: 'You cannot organize around a pile.' },
    { task: 'Hang hand tools on the pegboard', time: '20 min', why: 'The pegboard puts them in reach.' },
    { task: 'Sort fasteners by size', time: '20 min', why: 'Loose screws cost more time than they save.' },
    { task: 'Group the tools you reach for weekly', time: '15 min', why: 'Frequency decides what gets the easiest spot.' },
    { task: 'Label the fronts', time: '10 min', why: 'Everyone can put things back.' },
    { task: 'Give the offcuts one home', time: '10 min', why: 'Scrap spreads until it has a boundary.' },
  ],
  existingLede: 'The pegboard, bench, and drawers already cover every zone you need.',
  existing: [{ icon: 'hook', title: 'Pegboard wall', detail: 'Already mounted above the bench.' }],
  dontBuy: 'Skip a second pegboard.',
  productNeeds: [
    { type: 'hook-rack', qty: 1, purpose: 'Hang pliers on the pegboard.', targetZone: 'Pegboard wall', priority: 'high' },
    { type: 'drawer-organizer', qty: 2, purpose: 'Sort fasteners by size.', targetZone: 'Second drawer', priority: 'high' },
  ],
  map: [
    { level: 'Pegboard wall', icon: 'hook', surface: 'pegboard', zone: 'Hand tools', why: 'Hanging keeps them visible.', eye: true, shelfIndex: 0, items: [{ name: 'Pliers', size: 's', flags: [] }], safety: { flag: null, why: null } },
    { level: 'Bench surface', icon: 'middle', surface: 'worktop', zone: 'Active job', why: 'The bench surface is the work area, not storage.', eye: false, shelfIndex: 1, items: [{ name: 'Clamps', size: 'm', flags: [] }], safety: { flag: null, why: null } },
    { level: 'Bench drawers', icon: 'drawer', surface: 'drawer', zone: 'Fasteners', why: 'A closed drawer keeps small things sorted.', eye: false, shelfIndex: 2, items: [{ name: 'Screws', size: 's', flags: [] }], safety: { flag: null, why: null } },
  ],
  geometry: { unit: 'in', width: 27, height: 38, depth: 18, shelfCount: 3, estimated: false },
  layout: { type: 'workbench' },
  time: '60 min', cost: '$0 / $40',
});

test('a photo plan stops describing fittings the drawn shape does not have', () => {
  const plan = enforceArchetypeHonesty(workbenchPlan(), 'drawer-bank');
  const prose = [plan.summary, ...plan.problems, ...plan.opportunities, ...plan.safetyNotes,
    ...plan.steps.flatMap(s => [s.task, s.why]), plan.existingLede, plan.dontBuy,
    ...plan.existing.flatMap(e => [e.title, e.detail]),
    ...plan.productNeeds.map(p => p.purpose)].filter(Boolean).join(' ');
  assert.doesNotMatch(prose, /pegboard/i, 'a drawer bank has no pegboard');
  assert.doesNotMatch(prose, /\bbench\b/i, 'a drawer bank has no bench surface');
});

test('the levels the photos found survive the pass', () => {
  const before = workbenchPlan();
  const after = enforceArchetypeHonesty(workbenchPlan(), 'drawer-bank');
  assert.equal(after.map.length, before.map.length, 'no observed level is dropped');
  assert.deepEqual(after.map.map(m => m.items.map(i => i.name)), before.map.map(m => m.items.map(i => i.name)));
  // Every row still says something true about where its contents go.
  for (const row of after.map) {
    assert.ok(row.why && row.why.trim(), `${row.level} keeps a rationale`);
    assert.equal(mentionsMissingSurface(row.why, 'drawer-bank'), false, `${row.level}: ${row.why}`);
  }
});

test('a surface the shape cannot have stops steering how items are drawn', () => {
  const plan = enforceArchetypeHonesty(workbenchPlan(), 'drawer-bank');
  const allowed = new Set(ARCHETYPE_SURFACES['drawer-bank']);
  for (const row of plan.map) {
    assert.ok(!row.surface || allowed.has(row.surface), `${row.level} claims a ${row.surface}`);
  }
});

test('products that need a missing fitting are not recommended', () => {
  const plan = enforceArchetypeHonesty(workbenchPlan(), 'drawer-bank');
  assert.equal(plan.productNeeds.some(p => p.type === 'hook-rack'), false, 'no hook rack without a pegboard');
  // and what is left points at a level that exists in this plan
  const levels = new Set(plan.map.map(m => m.level));
  for (const need of plan.productNeeds) {
    if (!need.targetZone || /^every\b/i.test(need.targetZone)) continue;
    assert.ok(levels.has(need.targetZone), `${need.type} points at "${need.targetZone}"`);
  }
});

test('a plan that already matches the drawn shape is left alone', () => {
  /* When the photos win the layout decision, the archetype IS the model's own
     reading, and the pass has nothing to correct. A no-op here is the evidence
     that it corrects disagreements rather than rewriting on principle. */
  const before = workbenchPlan();
  const after = enforceArchetypeHonesty(workbenchPlan(), 'workbench');
  assert.deepEqual(after.map, before.map);
  assert.equal(after.summary, before.summary);
  assert.deepEqual(after.steps, before.steps);
  assert.equal(after.productNeeds.length, before.productNeeds.length);
});

test('it runs on the contract shape, before normalizeAi renames the fields', () => {
  /* normalizeAi turns task/why into t/w and title/detail into ft/fd. Running
     the pass on the renamed plan reads nothing and reports success, which is
     why the ordering in loading.js is not incidental. */
  const normalized = normalizeAi(workbenchPlan());
  const scrubbedAfter = enforceArchetypeHonesty(normalized, 'drawer-bank');
  const stepText = scrubbedAfter.steps.map(s => `${s.t} ${s.w}`).join(' ');
  assert.match(stepText, /pegboard/i, 'the renamed shape is invisible to the pass — hence the ordering');

  const scrubbedBefore = normalizeAi(enforceArchetypeHonesty(workbenchPlan(), 'drawer-bank'));
  assert.doesNotMatch(scrubbedBefore.steps.map(s => `${s.t} ${s.w}`).join(' '), /pegboard/i);
});

test('a wholesale disagreement is recorded, not resolved by deleting the plan', () => {
  /* The scrub is right when a plan mentions a fitting in passing. It is wrong
     when the plan is ABOUT that fitting: a report with two steps left in it
     helps nobody, whatever the picture beside it shows. So the guard keeps the
     model's reading whole and marks the conflict instead. */
  const conflicted = workbenchPlan();
  conflicted.steps = conflicted.steps.filter(s => /pegboard|bench/i.test(s.task) || /bench/i.test(s.why));
  conflicted.steps.push({ task: 'Wipe the bench down', time: '5 min', why: 'Sawdust travels.' });
  const out = enforceArchetypeHonesty(conflicted, 'drawer-bank');
  assert.equal(out.archetypeConflict, 'drawer-bank');
  assert.equal(out.steps.length, conflicted.steps.length, 'nothing is deleted when everything would be');
  assert.match(out.steps.map(s => s.task).join(' '), /pegboard/i);
});

test('a plan the scrub can survive clears any earlier conflict mark', () => {
  const plan = workbenchPlan();
  plan.archetypeConflict = 'stale';
  assert.equal(enforceArchetypeHonesty(plan, 'drawer-bank').archetypeConflict, undefined);
});

test('an unknown archetype is a no-op rather than an exception', () => {
  const before = workbenchPlan();
  assert.deepEqual(enforceArchetypeHonesty(workbenchPlan(), 'not-an-archetype'), before);
  assert.deepEqual(enforceArchetypeHonesty(workbenchPlan(), null), before);
  assert.equal(enforceArchetypeHonesty(null, 'shelves'), null);
});
