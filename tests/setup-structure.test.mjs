import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../js/state.js';
import { normalizeAi, buildAnalysisContext } from '../js/plan.js';
import { getDemoScenario } from '../js/demo-scenarios.js';
import { scenarioKeyFor, SETUP_TYPES, SETUP_DIMS } from '../js/wizard-data.js';
import { SETUP_ARCHETYPE, SCENARIO_ARCHETYPE } from '../js/layout.js';
import { ARCHETYPE_LEVELS, ARCHETYPE_LEVELS_FOR_SOURCE, ARCHETYPE_SURFACES, SETUP_NOUN } from '../js/setupStructure.js';

/* Two archetypes serve both shelved spaces and clothes closets and pick
   their level list from the source scenario, so a valid level for a setup is
   any level in either template. */
function validLevels(archetype, sourceArchetype) {
  const bySource = ARCHETYPE_LEVELS_FOR_SOURCE[archetype];
  const variant = (bySource && bySource[sourceArchetype]) || [];
  return new Set([...ARCHETYPE_LEVELS[archetype], ...variant].map(l => l.level));
}

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

function planFor({ space, id }, { household = NO_KIDS, dimsFt = null, shopping = 'Open to a few ideas', effort = 'Weekend reset' } = {}) {
  const d = dimsFt || SETUP_DIMS[id];
  state.room = 'x'; state.space = space; state.setup = id;
  state.setupLabel = (SETUP_TYPES[space].find(t => t.id === id) || {}).label || id;
  state.dims = { w_in: Math.round(d.w * 12), h_in: Math.round(d.h * 12), d_in: Math.round(d.d * 12), shelves: null };
  state.goals = []; state.goal = null; state.styles = []; state.cats = []; state.detected = [];
  state.shoppingPref = shopping;
  state.prefs = new Set(shopping === 'Use what I have' ? ['Use only what I already own'] : ['Open to buying storage']);
  state.budget = shopping === 'Use what I have' ? '$0' : null;
  state.upgrades = shopping !== 'Use what I have';
  // Takes the effort from the caller. Hardcoding it here silently defeated
  // the sweep below, which set state.effort and then had it overwritten —
  // "33 setups x 3 efforts" was really one label run three times.
  state.effort = effort; state.household = household;
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
    const templateLevels = validLevels(archetype, SCENARIO_ARCHETYPE[scenarioKeyFor(s.space, s.id)]);
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

test('a hazard flag survives a merge when the hazard does', () => {
  // The garage projects 5 shelves onto a 3-level wall cabinet; the chemicals
  // row must not lose keep-high on the way.
  const p = planFor({ space: 'garage', id: 'wallcab' });
  assert.ok(p.map.some(m => m.safety && m.safety.flag === 'keep-high'),
    'garage/wallcab: the chemical shelf lost its hazard flag in the merge');
});

test('a hazard flag does not outlive the items that earned it', () => {
  // The overhead rack excludes chemicals entirely, so a "keep high" badge
  // there would be pinned to holiday decorations.
  const p = planFor({ space: 'garage', id: 'overhead' });
  for (const m of p.map) {
    if (!m.safety || !m.safety.flag) continue;
    assert.ok((m.items || []).some(it => (it.flags || []).some(f => ['heavy', 'chemical', 'sharp'].includes(f))),
      `"${m.lv}" is flagged ${m.safety.flag} but holds nothing hazardous: ${(m.items || []).map(i => i.name).join(', ')}`);
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

/* ---------- regressions the first review of this layer found ----------
   All eight were live on main before being caught: the projection shipped
   with an adversarial review still running against it. */

import { rewriteForSurfaces, rewriteOpening, describeSetup, SETUP_LEVEL_CAP } from '../js/setupStructure.js';

test('L-shaped closets keep their hanging rods', () => {
  // l-run serves pantries AND clothes closets. Listing only 'shelf' for the
  // archetype stripped every rod from lshapeC while the steps went on
  // telling the user to hang their work clothes.
  const p = planFor({ space: 'closet', id: 'lshapeC' });
  assert.ok(p.map.some(m => m.surface === 'rod'), `no rod: ${p.map.map(m => m.lv + ':' + m.surface).join(', ')}`);
  const hanging = p.map.find(m => m.surface === 'rod');
  assert.match(hanging.zone, /clothes|shirts|blazers|wear/i,
    `the rod holds "${hanging.zone}" while clothes sit on a shelf`);
});

test('surface rewrites keep sentence capitalization and stay grammatical', () => {
  // The replacement is the archetype's own surface noun, so it can never
  // name a fitting the setup lacks — and never a specific LEVEL either,
  // which "top drawer" was.
  assert.equal(rewriteForSurfaces('The counter is cluttered.', 'drawer-bank'), 'The drawer is cluttered.');
  assert.equal(rewriteForSurfaces('A pegboard area sits empty.', 'cabinet'), 'A shelf area sits empty.');
  assert.equal(rewriteForSurfaces('Hang hooks on the door back for bags.', 'drawer-bank'),
    'Hang hooks on the wall beside it for bags.');
  assert.ok(!/the front edge back/i.test(rewriteForSurfaces('Hooks on the door back.', 'shelves')));
  // "the cabinet floor" never matched the bare "the floor" rule
  assert.ok(!/cabinet floor/i.test(rewriteForSurfaces('Items sit on the cabinet floor.', 'shelves')));
});

test('a setup with more levels than its scenario has rows fills them all', () => {
  // "Counter + uppers" took three rows from the cabinet scenario and lost
  // both its drawers and its lower cabinet.
  const p = planFor({ space: 'cabinet', id: 'counterup' });
  assert.equal(p.map.length, 5, `levels: ${p.map.map(m => m.lv).join(', ')}`);
  assert.ok(p.map.some(m => m.surface === 'drawer'), 'no drawers on a counter run');
  assert.ok(p.map.some(m => m.surface === 'worktop'), 'no counter surface on a counter run');
});

test('a two-level plan does not mark every zone kid-reachable', () => {
  // applyGoal('kid') tags shelfIndex >= shelfCount - 2, which on a 2-level
  // plan is every zone.
  const p = planFor({ space: 'garage', id: 'overhead' }, { household: KIDS });
  const tagged = p.map.filter(m => (m.items || []).some(it => (it.flags || []).includes('kid-frequent')));
  assert.ok(tagged.length < p.map.length, 'every zone on a 2-level plan was marked kid-reachable');
});

test('the opening sentence replaces a size claim but never a diagnosis', () => {
  assert.equal(rewriteOpening('A 30-inch-wide cabinet with three shelves. Plates are stacked too high.', 'NEW.'),
    'NEW. Plates are stacked too high.');
  // no size claim in the first sentence: prepend rather than overwrite
  assert.equal(rewriteOpening('Plates are stacked too high.', 'NEW.'), 'NEW. Plates are stacked too high.');
});

test('describeSetup degrades cleanly without measurements and reads right at one level', () => {
  assert.match(describeSetup({ archetype: 'drawer-bank', setupId: 'toolchest', dims: null, levelCount: 4 }),
    /^Your rolling tool chest has four drawers/);
  assert.match(describeSetup({ archetype: 'shelves', setupId: 'cabinet', dims: { w_in: 36, h_in: 78, d_in: 18 }, levelCount: 1 }),
    /has one shelf to work with/);
});

test('every level cap actually constrains its archetype', () => {
  for (const [id, cap] of Object.entries(SETUP_LEVEL_CAP)) {
    const template = ARCHETYPE_LEVELS[SETUP_ARCHETYPE[id]];
    assert.ok(cap < template.length,
      `${id}: cap ${cap} >= ${SETUP_ARCHETYPE[id]} template length ${template.length}, so it does nothing`);
  }
});

/* ---------- second-round review findings ---------- */

import { planMinutes, EFFORT_STEPS } from '../js/personalize.js';

test('the headline time always matches the checklist under it', () => {
  // The effort label used to set the time on its own, so a two-level rack
  // announced "Full overhaul · 4–8 hours" over an hour of work, and every
  // "Quick refresh" promised ~30 min over an hour-long checklist.
  const BANDS = [[45, '~30 min'], [100, '45–90 min'], [200, '2–3 hours'], [330, '3–5 hours'], [Infinity, '4–8 hours']];
  /* EVERY label in EFFORT_STEPS, not just the three the wizard offers today.
     The legacy names are kept deliberately so saved drafts stay personalized,
     and two of them ("1-hour cleanup", "Weekend project") went uncorrected
     because their canned strings are not band names — a saved plan announced
     "2–4 hours" over 42 minutes of steps. Iterating the real key list is what
     catches that; a hardcoded trio never can. */
  for (const s of ALL_SETUPS) {
    for (const effort of Object.keys(EFFORT_STEPS)) {
      const p = planFor(s, { effort });
      const mins = planMinutes(p.steps);
      const expected = BANDS.find(([max]) => mins < max)[1];
      assert.equal(p.time, expected,
        `${s.space}/${s.id} (${effort}): says "${p.time}" over ${Math.round(mins)} min of steps`);
    }
  }
});

test('the room\'s own floor is not rewritten as a storage level', () => {
  assert.equal(rewriteForSurfaces('Sweep the floor before you start.', 'drawer-bank'),
    'Sweep the floor before you start.');
  // ...but a storage claim still is
  assert.equal(rewriteForSurfaces('Boxes sit on the floor.', 'drawer-bank'),
    'Boxes sit on the lowest level.');
});

test('surface swaps keep singular and plural agreement', () => {
  assert.equal(rewriteForSurfaces('The drawers are jammed shut.', 'shelves'), 'The shelves are jammed shut.');
  assert.equal(rewriteForSurfaces('Empty the drawer first.', 'shelves'), 'Empty the shelf first.');
});

test('a merged level advertises exactly what it holds', () => {
  for (const s of ALL_SETUPS) {
    for (const m of planFor(s).map) {
      const segs = String(m.zone).split(' · ').filter(Boolean).length;
      assert.ok(segs <= 6, `${s.space}/${s.id}: "${m.lv}" lists ${segs} categories`);
      assert.ok((m.items || []).length <= 6, `${s.space}/${s.id}: "${m.lv}" holds ${(m.items || []).length} items`);
    }
  }
});

/* The FORBIDDEN probe above only looked for pegboard / door rack / hanging
   rod, and the rewrite DELETES those words — so it passed on exactly the
   strings it had corrupted into naming a drawer or a bench instead. This
   checks the whole visible plan for any storage noun the setup lacks, and
   includes existingLede and dontBuy, which the earlier probe never read. */
test('no projected plan names a fitting its setup does not have', () => {
  const NOUN_FOR = { shelf: 'shelf', drawer: 'drawer', bench: 'bench', pegboard: 'pegboard', rod: 'rod' };
  for (const s of ALL_SETUPS) {
    const archetype = SETUP_ARCHETYPE[s.id];
    if (archetype === SCENARIO_ARCHETYPE[scenarioKeyFor(s.space, s.id)]) continue;
    const have = new Set(ARCHETYPE_SURFACES[archetype]);
    for (const household of [NO_KIDS, KIDS]) {
      const p = planFor(s, { household });
      const text = [p.summary, p.existingLede, p.dontBuy, ...p.problems, ...p.opportunities,
        ...p.safetyNotes, ...p.steps.flatMap(x => [x.t, x.w]),
        ...p.map.flatMap(m => [m.zone, m.why]), ...p.existing.flatMap(e => [e.ft, e.fd]),
      ].filter(Boolean).join(' | ');
      for (const [surface, noun] of Object.entries(NOUN_FOR)) {
        if (have.has(surface)) continue;
        // "junk drawer" is an idiom, not a claim about the furniture.
        const re = new RegExp(`\\b(?:the|a|an|every|each|upper|top|lower|middle|your)\\s+${noun}s?\\b`, 'i');
        const hit = text.match(re);
        assert.ok(!hit, `${s.space}/${s.id} (${archetype}) names a ${noun}: "${hit && hit[0]}" in ${text.slice(Math.max(0, text.indexOf(hit ? hit[0] : '') - 50), 140)}`);
      }
    }
  }
});

test('a replacement never introduces a surface the archetype also lacks', () => {
  const SAMPLES = ['Hang tools on the pegboard.', 'Clear the bench surface.', 'Empty it onto the counter.',
    'The drawers are stuck.', 'Use the hanging rod.'];
  for (const archetype of Object.keys(ARCHETYPE_SURFACES)) {
    const have = new Set(ARCHETYPE_SURFACES[archetype]);
    for (const sample of SAMPLES) {
      const out = rewriteForSurfaces(sample, archetype);
      for (const [surface, word] of Object.entries({ pegboard: 'pegboard', worktop: 'bench surface', rod: 'hanging rod' })) {
        if (have.has(surface)) continue;
        assert.ok(!new RegExp(word, 'i').test(out), `${archetype}: "${sample}" -> "${out}" still names ${word}`);
      }
    }
  }
});
