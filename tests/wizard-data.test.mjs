import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOMS, AREAS, SPACE_CFG, STYLESETS, SETUP_TYPES, SETUP_DIMS, ROOMY,
  SETUP_GEOM, GEOM_TO_V3D_LAYOUT, SETUP_SCENARIO, scenarioKeyFor,
  roomFor, areaFor, goalIdFor, prefsForStyles, fmtFt, measureSummary,
} from '../js/wizard-data.js';
import { PREFS } from '../js/data.js';
import { getDemoScenario } from '../js/demo-scenarios.js';
import { EFFORT_STEPS } from '../js/personalize.js';
import { EFFORT_STEP_RANGES } from '../supabase/functions/_shared/planSchema.js';

// Design-contract integrity: every area the wizard can reach must carry a
// complete question set, setup list, and defaults — a hole here is a broken
// step at runtime, so it fails the build instead.

const allAreas = Object.values(AREAS).flat();

test('every room has areas and every area id is unique', () => {
  assert.equal(ROOMS.length, 4);
  for (const room of ROOMS) {
    assert.ok((AREAS[room.id] || []).length >= 2, `room ${room.id} has too few areas`);
  }
  const ids = allAreas.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate area ids');
  assert.equal(ids.length, 9, 'design contract: 9 areas across 4 rooms');
});

test('every area has categories, goals, detection, styles, and setup types', () => {
  for (const a of allAreas) {
    const cfg = SPACE_CFG[a.id];
    assert.ok(cfg, `${a.id}: missing SPACE_CFG`);
    assert.ok(cfg.categories.length >= 6, `${a.id}: too few categories`);
    assert.ok(cfg.goals.length >= 5, `${a.id}: too few goals`);
    assert.ok(cfg.detect.length >= 2 && cfg.detectCats.length >= 2, `${a.id}: detection lists missing`);
    for (const c of cfg.detectCats) {
      assert.ok(cfg.categories.includes(c), `${a.id}: detectCat "${c}" is not one of its categories`);
    }
    assert.equal((STYLESETS[a.id] || []).length, 4, `${a.id}: styles must offer 4 options`);
    assert.ok((SETUP_TYPES[a.id] || []).length >= 3, `${a.id}: needs at least 3 setup types`);
  }
});

test('every setup id is globally unique with default dims and a 3D geometry', () => {
  const ids = Object.values(SETUP_TYPES).flat().map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate setup ids');
  for (const id of ids) {
    const dd = SETUP_DIMS[id];
    assert.ok(dd && dd.w > 0 && dd.h > 0 && dd.d > 0, `${id}: missing default dims`);
    const geom = SETUP_GEOM[id];
    assert.ok(geom, `${id}: missing geometry family`);
    assert.ok(GEOM_TO_V3D_LAYOUT[geom], `${id}: geometry "${geom}" has no 3D layout chip`);
  }
  for (const roomy of ROOMY) assert.ok(ids.includes(roomy), `ROOMY lists unknown setup ${roomy}`);
});

test('room/area lookups resolve for every area id', () => {
  for (const a of allAreas) {
    assert.ok(roomFor(a.id).id, `roomFor(${a.id}) failed`);
    assert.equal(areaFor(a.id).id, a.id);
  }
});

test('setup scenario overrides point at real scenarios', () => {
  for (const [setup, key] of Object.entries(SETUP_SCENARIO)) {
    const plan = getDemoScenario(key, null, null, null);
    assert.ok(plan.map.length, `override ${setup} → ${key} resolves to an empty scenario`);
  }
  assert.equal(scenarioKeyFor('closet', 'walkinC'), 'walkin');
  assert.equal(scenarioKeyFor('closet', 'reachinC'), 'closet');
});

test('the design effort labels size plans on both the client and server rules', () => {
  for (const label of ['Quick refresh', 'Weekend reset', 'Full overhaul']) {
    assert.ok(EFFORT_STEPS[label], `client EFFORT_STEPS missing "${label}"`);
    assert.ok(EFFORT_STEP_RANGES[label], `server EFFORT_STEP_RANGES missing "${label}"`);
    assert.ok(EFFORT_STEPS[label] <= EFFORT_STEP_RANGES[label][1], `${label}: client target above server max`);
  }
});

test('per-space goals map onto plan-engine goal ids', () => {
  assert.equal(goalIdFor("Can't find anything"), 'find');
  assert.equal(goalIdFor("Kids can't reach their things"), 'kid');
  assert.equal(goalIdFor('Always running out of room'), 'capacity');
  assert.equal(goalIdFor('Looks cluttered'), 'clutter');
  assert.equal(goalIdFor('Hard to keep tidy'), 'unsure');
  assert.equal(goalIdFor(null), null);
});

test('styles resolve to real preference strings the personalizer can cite', () => {
  const known = new Set(PREFS);
  for (const styles of Object.values(STYLESETS)) {
    const prefs = prefsForStyles(styles.map(s => s.label));
    for (const p of prefs) assert.ok(known.has(p), `style-derived pref "${p}" is not a known preference`);
  }
  const labeled = prefsForStyles(['Labeled everything']);
  assert.ok(labeled.has('Labels and categories'));
  const clear = prefsForStyles(['Clear containers']);
  assert.ok(clear.has('Use clear containers'));
});

test('feet formatting matches the design (3′6″ style)', () => {
  assert.equal(fmtFt(3), '3′');
  assert.equal(fmtFt(6.5), '6′6″');
  assert.equal(fmtFt(0.75), '9″');
  assert.ok(measureSummary('walkin', { w: 6, h: 8, d: 6 }).includes('room'));
  assert.ok(measureSummary('cabinet', { w: 3, h: 6.5, d: 1.5 }).includes('deep'));
});

// The two areas new to production need full scenarios of their own.

test('dresser scenario: complete, drawer-shaped, and kid-note free by default', () => {
  const plan = getDemoScenario('dresser', 'find', { kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' });
  assert.equal(plan.spaceType, 'Dresser');
  assert.ok(plan.map.length >= 4 && plan.steps.length >= 8);
  assert.ok(plan.map.some(m => /drawer/i.test(m.level)), 'no drawer zone in a dresser plan');
  for (const n of plan.safetyNotes) assert.doesNotMatch(n, /kid|child|small hands/i);
});

test('workbench scenario: chemicals stay high; kids add a latch', () => {
  const noKids = getDemoScenario('workbench', 'find', { kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' });
  assert.equal(noKids.spaceType, 'Workbench');
  const high = noKids.map.find(m => m.safety && m.safety.flag === 'keep-high');
  assert.ok(high, 'workbench must keep chemicals in a keep-high zone');
  for (const n of noKids.safetyNotes) assert.doesNotMatch(n, /kid|child|small hands/i);

  const withKids = getDemoScenario('workbench', 'find', { kids: { present: 'yes', ages: ['Big kid'] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' });
  assert.ok(withKids.safetyNotes.some(n => /kid|child|small hands/i.test(n)), 'kid household must surface a kid safety note');
  assert.ok(withKids.productNeeds.some(p => p.type === 'safety-latch'), 'chemical space with kids should recommend a latch');
});
