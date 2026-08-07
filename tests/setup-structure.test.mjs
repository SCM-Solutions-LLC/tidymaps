import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../js/state.js';
import { normalizeAi, buildAnalysisContext } from '../js/plan.js';
import { getDemoScenario } from '../js/demo-scenarios.js';
import { scenarioKeyFor, SETUP_TYPES, SETUP_DIMS } from '../js/wizard-data.js';
import { SETUP_ARCHETYPE, SCENARIO_ARCHETYPE } from '../js/layout.js';
import { ARCHETYPE_LEVELS, ARCHETYPE_SURFACES, SETUP_NOUN } from '../js/setupStructure.js';

/* The wizard spends a whole step (3 of 12) asking which of 33 setups looks
   like the user's space, and the plan then ignored it: 18 of the 33 got a
   scenario built for a different piece of furniture. An 18-inch ceiling rack
   was described with an "Eye level" and a "Floor level"; a rolling tool chest
   got a pegboard wall and a bench surface; open wall shelves got "Top drawer"
   and "Cabinet: floor".

   The scenario supplies the CONTENT, the setup supplies the STRUCTURE. These
   tests pin that split for every setup the wizard can produce. */

const NO_KIDS = { adults: 2, kidCount: 0, petCount: 0, kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };
const KIDS = { adults: 2, kidCount: 2, petCount: 0, kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' };

const ALL_SETUPS = Object.entries(SETUP_TYPES).flatMap(([space, list]) =>
  list.map(t => ({ space, id: t.id, label: t.label })));

function planFor({ space, id }, { household = NO_KIDS, dimsFt = null, shopping = 'Open to a few ideas' } = {}) {
  const d = dimsFt || SETUP_DIMS[id];
  state.room = 'x'; state.space = space; state.setup = id;
  state.setupLabel = (SETUP_TYPES[space].find(t => t.id === id) || {}).label || id;
  state.dims = { w_in: Math.round(d.w * 12), h_in: Math.round(d.h * 12), d_in: Math.round(d.d * 12), shelves: null };
  state.goals = []; state.goal = null; state.styles = []; state.cats = []; state.detected = [];
  state.shoppingPref = shopping;
  state.prefs = new Set(shopping === 'Use what I have' ? ['Use only what I already own'] : ['Open to buying storage']);
  state.budget = shopping === 'Use what I have' ? '$0' : null;
  state.upgrades = shopping !== 'Use what I have';
  state.effort = 'Weekend reset'; state.household = household;
  return normalizeAi(getDemoScenario(scenarioKeyFor(space, id), null, household, buildAnalysisContext(), id));
}

test('all 33 setups are covered by the archetype and noun tables', () => {
  for (const s of ALL_SETUPS) {
    assert.ok(SETUP_ARCHETYPE[s.id], `${s.id}: no archetype`);
    assert.ok(ARCHETYPE_LEVELS[SETUP_ARCHETYPE[s.id]], `${s.id}: archetype has no level template`);
    assert.ok(ARCHETYPE_SURFACES[SETUP_ARCHETYPE[s.id]], `${s.id}: archetype has no surface list`);
    assert.ok(SETUP_NOUN[s.id], `${s.id}: no noun phrase for the summary`);
  }
  assert.equal(ALL_SETUPS.length, 33);
});

test('every zone sits on a surface the chosen setup actually has', () => {
  for (const s of ALL_SETUPS) {
    const archetype = SETUP_ARCHETYPE[s.id];
    // Setups whose scenario is already the right shape keep their own
    // hand-written zones; only the mismatched ones are re-projected.
    if (archetype === SCENARIO_ARCHETYPE[scenarioKeyFor(s.space, s.id)]) continue;
    const surfaces = new Set(ARCHETYPE_SURFACES[archetype]);
    const templateLevels = new Set(ARCHETYPE_LEVELS[archetype].map(l => l.level));
    for (const m of planFor(s).map) {
      assert.ok(surfaces.has(m.surface), `${s.space}/${s.id}: zone "${m.lv}" is a ${m.surface}, which a ${archetype} does not have`);
      assert.ok(templateLevels.has(m.lv), `${s.space}/${s.id}: zone "${m.lv}" is not a ${archetype} level`);
    }
  }
});

test('the plan never describes a structure the setup does not have', () => {
  const FORBIDDEN = {
    pegboard: /pegboard/i,
    door: /door rack|inside the door/i,
    rod: /hanging rod/i,
  };
  for (const s of ALL_SETUPS) {
    const archetype = SETUP_ARCHETYPE[s.id];
    if (archetype === SCENARIO_ARCHETYPE[scenarioKeyFor(s.space, s.id)]) continue;
    const surfaces = new Set(ARCHETYPE_SURFACES[archetype]);
    for (const household of [NO_KIDS, KIDS]) {
      const p = planFor(s, { household });
      const text = [p.summary, ...p.problems, ...p.opportunities, ...p.safetyNotes,
        ...p.steps.flatMap(x => [x.t, x.w]), ...p.map.flatMap(m => [m.lv, m.zone, m.why]),
        ...p.productNeeds.map(x => x.purpose)].filter(Boolean).join(' | ');
      for (const [surface, re] of Object.entries(FORBIDDEN)) {
        if (surfaces.has(surface)) continue;
        assert.ok(!re.test(text), `${s.space}/${s.id} (${archetype}) mentions ${surface}: ${text.match(re)}`);
      }
    }
  }
});

test('an overhead rack is not described as a floor-to-ceiling shelf unit', () => {
  const p = planFor({ space: 'garage', id: 'overhead' });
  assert.ok(p.map.length <= 2, `a ceiling platform got ${p.map.length} levels`);
  const levels = p.map.map(m => m.lv).join(' | ');
  assert.ok(!/floor|eye level/i.test(levels), `overhead rack still has: ${levels}`);
  assert.ok(p.map.every(m => m.surface === 'shelf'));
});

test('a rolling tool chest is drawers, not a bench with a pegboard', () => {
  const p = planFor({ space: 'workbench', id: 'toolchest' });
  assert.ok(p.map.every(m => m.surface === 'drawer'), `zones: ${p.map.map(m => m.lv + ':' + m.surface).join(', ')}`);
  assert.ok(!/pegboard|bench/i.test(p.map.map(m => m.lv).join(' ')));
});

test('bathroom wall shelves have no drawers and no cabinet floor', () => {
  const p = planFor({ space: 'bathroom', id: 'wallshelf' });
  assert.ok(p.map.every(m => m.surface === 'shelf'), `zones: ${p.map.map(m => m.lv + ':' + m.surface).join(', ')}`);
  assert.ok(!/drawer|cabinet/i.test(p.map.map(m => m.lv).join(' ')));
});

test('a built-in closet keeps the drawer bank its own card advertises', () => {
  const p = planFor({ space: 'closet', id: 'builtin' });
  assert.ok(p.map.some(m => m.surface === 'drawer'), `"Built-in + drawers" has no drawer zone: ${p.map.map(m => m.lv).join(', ')}`);
});

test('under-bed drawers get bays, not a top surface and three stacked drawers', () => {
  const p = planFor({ space: 'dresser', id: 'underbed' });
  assert.ok(p.map.length <= 2);
  assert.ok(!/top surface/i.test(p.map.map(m => m.lv).join(' ')));
});

test('the setups whose scenario already fits are left alone', () => {
  // The walk-in closet is the one setup that always had a matching scenario,
  // and its wall-by-wall zones are better than any template. Re-projecting
  // would have traded specific content for generic content.
  const p = planFor({ space: 'closet', id: 'walkinC' });
  assert.ok(p.map.some(m => /left wall/i.test(m.lv)), `lost its wall zones: ${p.map.map(m => m.lv).join(', ')}`);
  assert.ok(p.map.some(m => m.surface === 'rod'), 'a walk-in closet still hangs clothes');
});

test('plan invariants hold for every setup: shelfCount, one eye zone, real targetZones', () => {
  for (const s of ALL_SETUPS) {
    for (const shopping of ['Use what I have', 'Open to a few ideas']) {
      for (const household of [NO_KIDS, KIDS]) {
        const p = planFor(s, { household, shopping });
        const at = `${s.space}/${s.id}|${shopping}`;
        assert.equal(p.geometry.shelfCount, p.map.length, `${at}: shelfCount disagrees with the zone list`);
        assert.equal(p.map.filter(m => m.eye).length, 1, `${at}: expected exactly one eye-level zone`);
        assert.deepEqual([...new Set(p.map.map(m => m.shelfIndex))].length, p.map.length, `${at}: duplicate shelfIndex`);
        const levels = new Set(p.map.map(m => m.lv));
        for (const need of p.productNeeds) {
          assert.ok(!need.targetZone || /^every\b/i.test(need.targetZone) || levels.has(need.targetZone),
            `${at}: product targets "${need.targetZone}", which is not a zone on this plan`);
        }
      }
    }
  }
});

test('the summary opens with the measurements the user actually entered', () => {
  for (const s of ALL_SETUPS) {
    const p = planFor(s, { dimsFt: { w: 9, h: 7, d: 2 } });
    const opening = p.summary.split(/(?<=[.!?])\s+/)[0];
    assert.match(opening, /9′/, `${s.space}/${s.id}: opening ignores the measured width — "${opening}"`);
    assert.ok(!/\b\d+-inch-wide\b/.test(p.summary),
      `${s.space}/${s.id}: hardcoded width survived — "${opening}"`);
  }
});

test('no zone is left empty and no category is dropped when levels are merged', () => {
  for (const s of ALL_SETUPS) {
    const archetype = SETUP_ARCHETYPE[s.id];
    if (archetype === SCENARIO_ARCHETYPE[scenarioKeyFor(s.space, s.id)]) continue;
    const p = planFor(s);
    for (const m of p.map) {
      assert.ok(m.zone && m.zone.trim(), `${s.space}/${s.id}: zone "${m.lv}" has no contents`);
      assert.ok(m.why && m.why.trim(), `${s.space}/${s.id}: zone "${m.lv}" has no rationale`);
    }
  }
});

test('a hazard flag survives being merged into a shared level', () => {
  // The garage projects 5 shelves onto a 2-level overhead rack and a 3-level
  // wall cabinet; the chemicals row must not lose keep-high on the way.
  for (const id of ['overhead', 'wallcab']) {
    const p = planFor({ space: 'garage', id });
    assert.ok(p.map.some(m => m.safety && m.safety.flag === 'keep-high'),
      `garage/${id}: the chemical shelf lost its hazard flag in the merge`);
  }
});

/* ---------- content the shape cannot safely hold ----------
   Structure is not the only thing the setup decides. The garage scenario is
   written for a floor-standing rack, where "keep chemicals on the top shelf"
   is right. Projected onto a ceiling rack that reasoning inverts: everything
   on it is lifted overhead, so solvents and heavy power tools must not be
   sent up there — and merging rows must not concatenate rationales that
   argue from the height each row used to sit at. */

test('a ceiling rack is never handed heavy, sharp, or chemical items', () => {
  const p = planFor({ space: 'garage', id: 'overhead' });
  const items = p.map.flatMap(m => m.items || []);
  for (const it of items) {
    for (const flag of ['heavy', 'chemical', 'sharp']) {
      assert.ok(!(it.flags || []).includes(flag),
        `"${it.name}" (${flag}) was placed on an overhead rack`);
    }
  }
  const zones = p.map.map(m => m.zone).join(' | ');
  assert.ok(!/chemical|solvent|paint|power tool/i.test(zones), `overhead zones: ${zones}`);
  assert.ok(p.safetyNotes.some(n => /overhead rack/i.test(n)),
    'the plan drops those categories but never tells the user where they belong');
});

test('merged levels do not inherit a rationale about a height they no longer sit at', () => {
  const HEIGHT = /\b(?:top|upper|lower|lowest|bottom|middle)\s+shelf\b|\bwaist height\b|\bon the floor\b|\bfall from (?:height|above)\b/i;
  for (const id of ['overhead', 'underbed']) {
    const space = id === 'overhead' ? 'garage' : 'dresser';
    const p = planFor({ space, id });
    for (const m of p.map) {
      assert.ok(!HEIGHT.test(m.why), `${space}/${id} zone "${m.lv}" argues about height: "${m.why}"`);
      assert.ok(!(m.safety && HEIGHT.test(m.safety.why || '')), `${space}/${id}: safety note argues about height`);
    }
    for (const n of p.safetyNotes) {
      // The rule's own note names a height deliberately; everything else must not.
      if (/overhead rack|sleeping room/i.test(n)) continue;
      assert.ok(!HEIGHT.test(n), `${space}/${id}: stale height claim survived: "${n}"`);
    }
  }
});

test('no level is emptied by the content rules', () => {
  for (const id of ['overhead', 'underbed']) {
    const space = id === 'overhead' ? 'garage' : 'dresser';
    for (const m of planFor({ space, id }).map) {
      assert.ok(m.zone && m.zone.trim(), `${space}/${id}: "${m.lv}" was emptied`);
      assert.ok((m.items || []).length, `${space}/${id}: "${m.lv}" has no items left`);
    }
  }
});
