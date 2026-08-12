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

function planFor({ space, id }, { household = NO_KIDS, dimsFt = null, shopping = 'Open to a few ideas', effort = 'Weekend reset', styles = null } = {}) {
  const d = dimsFt || SETUP_DIMS[id];
  state.room = 'x'; state.space = space; state.setup = id;
  state.setupLabel = (SETUP_TYPES[space].find(t => t.id === id) || {}).label || id;
  state.dims = { w_in: Math.round(d.w * 12), h_in: Math.round(d.h * 12), d_in: Math.round(d.d * 12), shelves: null };
  state.goals = []; state.goal = null; state.styles = styles || []; state.cats = []; state.detected = [];
  state.shoppingPref = shopping;
  state.prefs = new Set([
    ...(shopping === 'Use what I have' ? ['Use only what I already own'] : ['Open to buying storage']),
    ...prefsForStyles(styles || []),
  ]);
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

import { planMinuteRange, EFFORT_STEPS, EFFORT_STEP_RANGES, sizeToEffort } from '../js/personalize.js';
import { EFFORT_STEP_RANGES as SERVER_RANGES } from '../supabase/functions/_shared/planSchema.js';
import { mentionsMissingSurface } from '../js/setupStructure.js';
import { SPACE_CFG, goalIdFor, STYLESETS, prefsForStyles } from '../js/wizard-data.js';

test('the headline time always contains the checklist under it', () => {
  /* The effort label used to set the time on its own, so a two-level rack
     announced "Full overhaul · 4–8 hours" over an hour of work. Deriving it
     from the steps fixed that direction and left the other: the label came
     from a table of bands, and one band covered up to 100 minutes under the
     name "45–90 min", so a checklist adding up to 92–97 was announced as
     45–90 in the tile directly above it.

     So this asserts containment rather than a string. A printed range that
     does not cover the times printed below it is wrong however it was chosen,
     and no future table of bands can pass this by accident.

     EVERY label in EFFORT_STEPS, not just the three the wizard offers today.
     The legacy names are kept deliberately so saved drafts stay personalized,
     and two of them once went uncorrected because their canned strings are not
     band names. Iterating the real key list is what catches that. */
  for (const s of ALL_SETUPS) {
    for (const effort of Object.keys(EFFORT_STEPS)) {
      const p = planFor(s, { effort });
      const { lo, hi } = planMinuteRange(p.steps);
      if (!hi) continue;
      const m = String(p.time).match(/(\d+(?:\.\d+)?)\s*(?:[–-]\s*(\d+(?:\.\d+)?))?/);
      assert.ok(m, `${s.space}/${s.id} (${effort}): "${p.time}" carries no number`);
      const unit = /hour/i.test(p.time) ? 60 : 1;
      const low = Number(m[1]) * unit, high = Number(m[2] || m[1]) * unit;
      // rounding to 5 minutes / half hours may move each end a little
      assert.ok(low <= lo + 15 && high >= hi - 15,
        `${s.space}/${s.id} (${effort}): says "${p.time}" over ${lo}–${hi} min of steps`);
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

/* ---------- mobility ----------
   All three answers used to collapse into one branch that pushed a single
   note ("Daily-use items are kept at mid-height") and changed nothing on the
   map — a claim the plan had not acted on, while still telling an
   Avoid-bending user to put heavy items on the lowest shelf. */

const MOBILITY = ['Limited reach', 'Avoid bending', 'Wheelchair user'];
const withMobility = (need) => ({ ...NO_KIDS, mobility: need ? [need] : [] });
const LONG_CYCLE = /bulk|overflow|backup|rarely|seasonal|holiday|out-of-rotation|archive|spare|luggage|off-season/i;

test('each mobility answer produces a different plan', () => {
  const seen = new Map();
  for (const need of MOBILITY) {
    const p = planFor({ space: 'closet', id: 'reachinC' }, { household: withMobility(need) });
    const fingerprint = JSON.stringify([p.map.map(m => m.zone), p.safetyNotes, p.steps.map(s => s.t)]);
    for (const [other, fp] of seen) {
      assert.notEqual(fingerprint, fp, `"${need}" and "${other}" produce identical plans`);
    }
    seen.set(need, fingerprint);
  }
});

test('an Avoid-bending plan never tells the user to reach the lowest shelf', () => {
  for (const s of [{ space: 'pantry', id: 'reachin' }, { space: 'garage', id: 'utility' }, { space: 'closet', id: 'reachinC' }]) {
    const p = planFor(s, { household: withMobility('Avoid bending') });
    const text = [...p.steps.map(x => x.t + ' ' + x.w), ...p.map.map(m => m.why)].join(' | ');
    assert.ok(!/\b(?:on|to) the (?:lowest|bottom) shelf\b/i.test(text),
      `${s.space}/${s.id}: still directs the user to the lowest shelf — "${text.match(/[^|]*(?:lowest|bottom) shelf[^|]*/i)}"`);
  }
});

test('a mobility note is never a claim the plan did not act on', () => {
  for (const s of ALL_SETUPS) {
    for (const need of MOBILITY) {
      const p = planFor(s, { household: withMobility(need) });
      // The strong claims name a specific band; they may only appear when
      // every zone in that band really does hold long-cycle storage.
      for (const note of p.safetyNotes) {
        // Only the STRONG claims — the ones naming a specific band as clear.
        // The general notes describe the rule the plan is built on and
        // mention the same words without asserting a zone is empty.
        if (/Nothing you use regularly is on the top level/i.test(note)) {
          assert.ok(LONG_CYCLE.test(p.map[0].zone || ''),
            `${s.space}/${s.id} (${need}): claims the top level is long-cycle, but it holds "${p.map[0].zone}"`);
        }
        if (/Nothing you use regularly is at floor level/i.test(note)) {
          const floors = p.map.filter(m => m.surface === 'floor' || /floor|bottom|lowest/i.test(m.lv));
          for (const f of floors) {
            assert.ok(LONG_CYCLE.test(f.zone || ''),
              `${s.space}/${s.id} (${need}): claims nothing regular at floor level, but "${f.lv}" holds "${f.zone}"`);
          }
        }
      }
    }
  }
});

test('every mobility answer leaves guidance, whatever the shape of the space', () => {
  for (const s of ALL_SETUPS) {
    for (const need of MOBILITY) {
      const p = planFor(s, { household: withMobility(need) });
      const guidance = [...p.safetyNotes, ...p.steps.map(x => x.t + ' ' + x.w)];
      assert.ok(guidance.some(n => /reach|bending|seated/i.test(n)),
        `${s.space}/${s.id}: "${need}" produced no reach guidance`);
    }
  }
});

/* ---------- what the first review of the mobility layer found ----------
   The swap moved a row's contents but not its `safety`, so a garage's
   solvents went DOWN toward child height and the holiday decorations that
   replaced them inherited "keep well above kid and pet reach". And it
   answered "bending is difficult" by putting the heavy luggage on the
   floor. Convenience is not the only axis. */

const HAZARD = ['heavy', 'chemical', 'sharp'];
const hazardOf = (m) => new Set((m.items || []).flatMap(it => it.flags || []).filter(f => HAZARD.includes(f)));

test('a mobility answer never rearranges the shelf map', () => {
  /* The engine has zone labels and item flags; it does not know which of a
     user's belongings they touch daily, how heavy a "large container" is, or
     how high off the ground this unit sits. Two rounds of review found every
     serious defect in this feature came from it moving things on that
     guesswork — solvents down toward child height, heavy luggage onto the
     floor, first-aid overflow chosen as the thing to put underfoot. It
     advises now; it does not rearrange. */
  for (const s of ALL_SETUPS) {
    for (const household of [NO_KIDS, KIDS]) {
      const base = planFor(s, { household }).map.map(m => `${m.lv}=${m.zone}|${(m.safety || {}).flag}|${(m.safety || {}).why}`);
      for (const need of MOBILITY) {
        const after = planFor(s, { household: { ...household, mobility: [need] } })
          .map.map(m => `${m.lv}=${m.zone}|${(m.safety || {}).flag}|${(m.safety || {}).why}`);
        assert.deepEqual(after, base,
          `${s.space}/${s.id} (${need}): the shelf map was rearranged`);
      }
    }
  }
});

test('a mobility answer never claims a zone is clear', () => {
  // Every claim of that shape was false somewhere: "nothing you use
  // regularly is at floor level" on a unit whose every level is the floor,
  // "everything is already within reach" on a ceiling rack.
  const CLAIMS = /nothing you use regularly|already within reach|holds long-cycle storage only|no better level/i;
  for (const s of ALL_SETUPS) {
    for (const need of MOBILITY) {
      for (const note of planFor(s, { household: { ...KIDS, mobility: [need] } }).safetyNotes) {
        assert.ok(!CLAIMS.test(note), `${s.space}/${s.id} (${need}): asserts zone state — "${note}"`);
      }
    }
  }
});

test('no plan tells a bending or seated user to use the lowest shelf', () => {
  for (const s of ALL_SETUPS) {
    for (const need of ['Avoid bending', 'Wheelchair user']) {
      for (const prefs of [[], ['Make heavy items safer']]) {
        state.goals = [];
        const p = normalizeAi(getDemoScenario(scenarioKeyFor(s.space, s.id), null,
          { ...NO_KIDS, mobility: [need] },
          { ...buildAnalysisContext(), prefs, toggles: { heavy: 'yes' }, effort: 'Weekend reset' }, s.id));
        const text = p.steps.map(x => x.t + ' ' + x.w).join(' | ');
        assert.ok(!/\b(?:on|to) the (?:lowest|bottom) shelf\b/i.test(text),
          `${s.space}/${s.id} (${need}, prefs ${JSON.stringify(prefs)}): "${text.match(/[^|]*(?:lowest|bottom) shelf[^|]*/i)}"`);
      }
    }
  }
});

test('no plan tells a bending or seated user a level is easy to get to', () => {
  /* The map is not rearranged for a mobility answer, so a low level stays a
     low level — but a garage map went on telling a wheelchair user that bulky
     gear "stores best on the lowest level where it is easy to grab and
     return". The placement is right; the claim about ease is not. */
  for (const s of ALL_SETUPS) {
    for (const need of ['Avoid bending', 'Wheelchair user']) {
      const p = planFor(s, { household: { ...NO_KIDS, mobility: [need] } });
      const text = [...p.map.map(m => m.why), ...p.steps.map(x => x.t + ' ' + x.w)].join(' | ');
      assert.ok(!/(?:lowest|bottom|floor)[^|]*\beasy to (?:grab|get|reach)\b/i.test(text),
        `${s.space}/${s.id} (${need}): "${text.match(/[^|]*easy to (?:grab|get|reach)[^|]*/i)}"`);
    }
  }
});

test('goal advice never evicts the whole space-specific checklist', () => {
  for (const s of ALL_SETUPS) {
    const goals = SPACE_CFG[s.space].goals;
    const bare = planFor(s, { effort: 'Quick refresh' });
    const bareTasks = new Set(bare.steps.map(x => x.t));
    state.goals = goals;
    const loaded = normalizeAi(getDemoScenario(scenarioKeyFor(s.space, s.id), 'find', NO_KIDS,
      { ...buildAnalysisContext(), goals, effort: 'Quick refresh' }, s.id));
    state.goals = [];
    const kept = loaded.steps.filter(x => bareTasks.has(x.t)).length;
    assert.ok(kept >= 2,
      `${s.space}/${s.id}: ${goals.length} goals left only ${kept} of ${bareTasks.size} space-specific steps`);
  }
});

test('a $0 plan never gets goal advice that requires buying something', () => {
  for (const s of ALL_SETUPS) {
    const goals = SPACE_CFG[s.space].goals;
    state.goals = goals;
    const p = normalizeAi(getDemoScenario(scenarioKeyFor(s.space, s.id), 'find', NO_KIDS,
      { ...buildAnalysisContext(), goals, effort: 'Full overhaul', budget: '$0', prefs: ['Use only what I already own'] }, s.id));
    state.goals = [];
    /* This used to name the three sentences that had been fixed, so it could
       only ever catch those three coming back. A $0 plan promises "every step
       below works with what is already in the space" — so scan for the thing
       being promised against, which caught seven more: "Bin the backstock and
       label the bins", "Put all chemicals in one caddy", "Stand baking sheets
       upright using vertical dividers". Zone names are exempt: they name a
       place on the map, not something to buy. */
    const zones = new Set(p.map.map(m => m.zone));
    for (const step of p.steps) {
      if ([...zones].some(z => step.t.includes(z))) continue;
      assert.ok(!/\bbins?\b|\bcadd(?:y|ies)\b|\bshelf dividers\b|\bvertical dividers\b|\bcompartment box\b|\badd a riser\b/i.test(step.t),
        `${s.space}/${s.id}: $0 plan says "${step.t}"`);
    }
  }
});

test('every answer the user picks is either planned or named as unplanned', () => {
  /* The cap was silent: a pantry on "Quick refresh" acted on two of seven
     answers and read as though it had acted on all seven. Dropping an answer
     is allowed — a short session cannot fit everything — but hiding that it
     was dropped is not. */
  for (const s of ALL_SETUPS) {
    for (const effort of ['Quick refresh', 'Weekend reset', 'Full overhaul']) {
      const goals = SPACE_CFG[s.space].goals;
      state.goals = goals;
      const p = normalizeAi(getDemoScenario(scenarioKeyFor(s.space, s.id), 'find', NO_KIDS,
        { ...buildAnalysisContext(), goals, effort }, s.id));
      state.goals = [];
      const said = p.steps.map(x => x.w || '').join(' | ');
      const unplanned = p.opportunities.filter(o => /not in this checklist/.test(o)).join(' ');
      for (const goal of goals) {
        assert.ok(said.includes(`“${goal}”`) || unplanned.includes(`“${goal}”`),
          `${s.space}/${s.id} (${effort}): "${goal}" was neither acted on nor named as unplanned`);
      }
    }
  }
});

test('the goal cap is spent on new advice, not on repeating itself', () => {
  /* Two answers that share one rule produce one step and two citations. That
     cost the whole budget once — a garage given "Always running out of room"
     and "No room for the car" had nothing left for a third answer, though
     only one step had been added. */
  const s = ALL_SETUPS.find(x => x.space === 'pantry' && x.id === 'reachin');
  /* The pantry already says "Add labels if available", so "Can't find
     anything" lands on a step the plan has and adds nothing to it. On a Quick
     refresh (cap 2) the two answers around it must both still get advice. */
  const goals = ['Expired food hides in back', "Can't find anything", 'No system for restocking', 'Hard to keep tidy'];
  state.goals = goals;
  const p = normalizeAi(getDemoScenario(scenarioKeyFor(s.space, s.id), goalIdFor(goals[0]), NO_KIDS,
    { ...buildAnalysisContext(), goals, effort: 'Quick refresh' }, s.id));
  state.goals = [];
  const said = p.steps.map(x => x.w || '').join(' | ');
  assert.ok(said.includes('“Can’t find anything”'.replace('’', "'")) || said.includes('“Can\'t find anything”'),
    'the answer that merged onto an existing step lost its citation');
  assert.ok(said.includes('“No system for restocking”'),
    'the cap was spent on an answer that added no step, so a fresh one was dropped');
});

test('an answer with no other route into the plan outranks one that has', () => {
  /* Click order alone dropped exactly the wrong answers: every space lists
     "Can't find anything" first, and that is the one answer that also moves
     the summary, the opportunities and the product priorities through
     applyGoal. The answers with nothing but their own step went last. */
  const s = ALL_SETUPS.find(x => x.space === 'pantry');
  /* All three need a step the plan does not have, and a Quick refresh fits
     two. The first answer is the one the wizard turns into state.goal, so it
     also reaches the summary, the opportunities and the product priorities —
     it is the one that can afford to lose its step. */
  const goals = ['Always running out of room', 'Expired food hides in back', 'No system for restocking'];
  state.goals = goals;
  const p = normalizeAi(getDemoScenario(scenarioKeyFor(s.space, s.id), goalIdFor(goals[0]), NO_KIDS,
    { ...buildAnalysisContext(), goals, effort: 'Quick refresh' }, s.id));
  state.goals = [];
  const said = p.steps.map(x => x.w || '').join(' | ');
  assert.ok(said.includes('“No system for restocking”'),
    'an answer whose only route is its own step was dropped for one that has another');
});

test('goal advice never repeats a behavior the checklist already has', () => {
  /* Deduping on the advice's own first three words never matched the
     scenario's phrasing of the same idea, so a dresser plan carried both
     "Label each drawer by category" and "Label the front edge of every
     zone", and both "File-fold tops so they stand upright" and "File-fold so
     every item stands upright". */
  const BEHAVIORS = [[/\blabell?(?:s|ed|ing)?\b/i, 'labelling'], [/file[- ]?fold/i, 'file-folding'],
    [/coil (?:each cable|cords)/i, 'coiling cords'], [/\briser\b/i, 'adding a riser']];
  /* A past participle before a noun names the props, not the work: "Box holiday
     decorations into labeled bins" is a boxing step that happens to mention
     labels. Counting it as a labelling step made this test demand that a plan
     which boxes things into labeled bins must never also instruct labelling —
     which is how the garage's "Can't find anything" goal ended up with no
     labelling step at all. The behaviour under test is instructing something
     twice, so the detector reads instructions only. */
  const instructionText = (task) => String(task)
    .replace(/\b\w+ed\s+(?:\w+\s+)?(?:bins?|containers?|boxes|totes?|jars?|baskets?|sections?|drawers?|shelves|shelf)\b/gi, ' ');
  for (const s of ALL_SETUPS) {
    for (const goal of SPACE_CFG[s.space].goals) {
      state.goals = [goal];
      const p = normalizeAi(getDemoScenario(scenarioKeyFor(s.space, s.id), null, NO_KIDS,
        { ...buildAnalysisContext(), goals: [goal], effort: 'Full overhaul' }, s.id));
      state.goals = [];
      for (const [re, name] of BEHAVIORS) {
        const hits = p.steps.filter(x => re.test(instructionText(x.t)));
        // small parts get their own compartment step; that is not a label step
        const real = name === 'labelling' ? hits.filter(x => !/small parts into/i.test(x.t)) : hits;
        assert.ok(real.length <= 1,
          `${s.space}/${s.id} ("${goal}"): ${name} twice — ${real.map(x => `"${x.t}"`).join(' and ')}`);
      }
    }
  }
});

test('a plan never asks for clear containers and an opaque front at once', () => {
  // Both are reachable from the wizard's own style step.
  for (const s of ALL_SETUPS) {
    const goals = SPACE_CFG[s.space].goals.filter(g => /looks cluttered/i.test(g));
    if (!goals.length) continue;
    state.goals = goals;
    const p = normalizeAi(getDemoScenario(scenarioKeyFor(s.space, s.id), 'clutter', NO_KIDS,
      { ...buildAnalysisContext(), goals, effort: 'Full overhaul', prefs: ['Use clear containers'] }, s.id));
    state.goals = [];
    const text = p.steps.map(x => x.t).join(' | ');
    assert.ok(!(/opaque/i.test(text) && /clear containers/i.test(text)),
      `${s.space}/${s.id}: asks for both — ${text}`);
  }
});

test('every style the wizard offers changes the plan and cites itself', () => {
  /* The style step reads as a taste question. It only earns that if picking
     one changes something: seven of the 27 cards resolved to no preference,
     and a wizard that asks and then ignores is worse than one that never
     asked. Compares the whole plan, not just the checklist — "Minimal look"
     trims what each zone shows and adds a line to the summary without
     touching a single step. */
  const shape = (p) => JSON.stringify([p.steps.map(s => s.t + '|' + s.w), p.summary,
    p.map.map(m => [m.items, m.why, (m.safety || {}).why])]);
  for (const s of ALL_SETUPS) {
    const styles = STYLESETS[s.space] || [];
    assert.ok(styles.length, `${s.space}: no styles to check`);
    const bare = shape(planFor(s, { household: NO_KIDS }));
    for (const style of styles) {
      const p = planFor(s, { household: NO_KIDS, styles: [style.label] });
      assert.notEqual(shape(p), bare,
        `${s.space}/${s.id}: picking "${style.label}" leaves the plan byte-identical`);
      const cited = [p.summary, ...p.steps.map(x => x.w || ''), ...p.opportunities]
        .some(t => /You asked (?:for|to)/i.test(t));
      assert.ok(cited, `${s.space}/${s.id}: "${style.label}" changed the plan without saying why`);
    }
  }
});

test('every style leaves a trace a reader can see without opening anything', () => {
  /* The test above hashes `s.t + '|' + s.w` and accepts a citation in any `w`,
     so it passes on exactly the case that shipped: 26 of the 36 cards funnel
     into 5 preferences, most of which a scenario already satisfies, so the
     handler annotated an existing step's `why` and changed nothing else. `why`
     renders inside a disclosure that starts closed. The answer was honoured
     where nobody could read it, which reads the same as being ignored.

     So this measures what the report shows on arrival: the summary, the two
     lists in the open Summary chapter, the step TASKS, the new step-face
     citation, the shelf map and the product tags. Never `why`. */
  const seen = (p) => JSON.stringify([p.summary, p.opportunities, p.problems,
    p.steps.map(x => `${x.t}|${x.cite || ''}`),
    p.map.map(m => [m.zone, m.why, (m.safety || {}).flag, (m.safety || {}).why, m.items]),
    (p.productNeeds || []).map(n => [n.type, n.priority])]);
  for (const s of ALL_SETUPS) {
    const bare = seen(planFor(s, { household: NO_KIDS }));
    for (const style of STYLESETS[s.space] || []) {
      const p = planFor(s, { household: NO_KIDS, styles: [style.label] });
      assert.notEqual(seen(p), bare,
        `${s.space}/${s.id}: "${style.label}" changes nothing a reader sees without opening a disclosure`);
    }
  }
});

test('a style the plan already satisfies says so in the user\'s own words', () => {
  /* When a scenario already does what the style asked for, the honest answer is
     not silence and not a duplicate step — it is naming the answer and pointing
     at the step that serves it. The card they clicked, not the preference we
     bridged it to. */
  /* "Use what I have" is the case that makes the style genuinely silent: with
     no products in the plan, promoting a label set has nothing to promote, so
     the handler's whole effect is the annotation. With products on, the same
     style moves a priority — visible — and correctly gets no line, which is the
     discrimination this mechanism is for. */
  const p = planFor({ space: 'pantry', id: 'cabinet' },
    { household: NO_KIDS, styles: ['Labeled everything'], shopping: 'Use what I have' });
  const line = (p.opportunities || []).find(o => /Labeled everything/.test(o));
  assert.ok(line, `no visible line naming the answer: ${JSON.stringify(p.opportunities)}`);
  const cited = p.steps.filter(x => x.cite);
  assert.ok(cited.length, 'the line promises marked steps, so there must be marked steps');
  assert.match(cited.map(x => x.cite).join(' '), /You asked for labels/i);
  // the face is a label, not the whole sentence with its rationale
  for (const step of cited) assert.ok(step.cite.length <= 60, `citation too long for a step face: "${step.cite}"`);
});

test('a style that visibly changes the plan gets no "already covered" line', () => {
  /* The line is for answers the plan silently already satisfied. Printing it
     for an answer that did move something would be its own small lie, and
     would put a line on every style in the app. */
  const p = planFor({ space: 'pantry', id: 'cabinet' },
    { household: NO_KIDS, styles: ['Labeled everything'], shopping: 'Open to a few ideas' });
  assert.equal((p.opportunities || []).some(o => /already how this plan works/.test(o)), false,
    'promoting the label set is a visible change, so there is nothing to explain');
});

/* ---------- effort has to buy something ----------

   The only growth test in the suite ran on pantry, which is the one space where
   this never showed: its zone words happen not to collide with its own step
   text, and its archetype loses nothing to the surface scrub. Everywhere else,
   "Full overhaul" (13) and "Weekend reset" (10) collapsed to the same plan —
   garage/utility 9 and 9, kitchen counter-up 9 and 9, a two-deck overhead rack
   6 and 6. The biggest commitment bought nothing.

   So these sweep every setup, and assert the property rather than a number. */

const REAL_EFFORTS = ['Quick refresh', 'Weekend reset', 'Full overhaul'];
const shortfallNote = (p) => (p.opportunities || []).some(o => /comes to \d+ steps/.test(o));

test('a bigger effort answer buys more plan, or says why it cannot', () => {
  for (const s of ALL_SETUPS) {
    const counts = REAL_EFFORTS.map(effort => {
      const p = planFor(s, { effort });
      return { effort, n: p.steps.length, explained: shortfallNote(p) };
    });
    for (let i = 1; i < counts.length; i++) {
      const prev = counts[i - 1], cur = counts[i];
      if (cur.n > prev.n) continue;
      assert.ok(cur.explained,
        `${s.space}/${s.id}: "${cur.effort}" gives ${cur.n} steps, same as or fewer than "${prev.effort}" (${prev.n}), and says nothing about it`);
    }
  }
});

test('sizing saw the list the reader will see', () => {
  /* The guard on the call order. The scrub removes steps, so a plan sized
     before it ran came out one short of its own aim: garage/utility trimmed to
     six and then lost its pegboard step, leaving five, with the headline time
     still computed over the six.

     Counting alone cannot catch that, and it is worth saying why. "Within the
     range the server accepts" passes on five (Quick refresh is [3,6]
     server-side). "Exactly the target" fails on setups whose zones genuinely
     run out one step early, which is not a bug. What separates the two is
     WHEN sizing ran — so this asserts the invariant directly: run sizing again
     over the finished plan and nothing may move. It is a no-op when sizing
     already saw the final list, and it grows the plan back when it did not. */
  for (const s of ALL_SETUPS) {
    for (const effort of Object.keys(EFFORT_STEPS)) {
      const p = planFor(s, { effort });          // leaves `state` set for this plan
      const [, hi] = EFFORT_STEP_RANGES[effort];
      assert.ok(p.steps.length <= hi,
        `${s.space}/${s.id} (${effort}): ${p.steps.length} steps, over the server maximum of ${hi}`);
      const before = p.steps.length;
      sizeToEffort(p, buildAnalysisContext());
      assert.equal(p.steps.length, before,
        `${s.space}/${s.id} (${effort}): sizing was run before something else changed the step list — re-running it moves ${before} to ${p.steps.length}`);
    }
  }
});

test('nothing sizing adds escapes the surface scrub', () => {
  /* Sizing runs after the scrub now, which is the whole fix — so its own output
     has to be scrubbed too, or the ordering that fixed one leak opens another.
     This is the guard that would have caught the pegboard step. */
  for (const s of ALL_SETUPS) {
    const archetype = SETUP_ARCHETYPE[s.id];
    for (const effort of REAL_EFFORTS) {
      const p = planFor(s, { effort });
      for (const st of p.steps) {
        assert.equal(mentionsMissingSurface(st.t, archetype), false,
          `${s.space}/${s.id} (${effort}): "${st.t}" names a surface a ${archetype} does not have`);
      }
      for (const opp of p.opportunities || []) {
        assert.equal(mentionsMissingSurface(opp, archetype), false,
          `${s.space}/${s.id} (${effort}): "${opp}" names a surface a ${archetype} does not have`);
      }
    }
  }
});

test('a deeper plan does not restate itself', () => {
  /* The old growth step was "Set up the {zone} zone ({level})" — which told the
     reader nothing the shelf map above it had not already said. That is what
     made it read as padding, more than the count did. */
  for (const s of ALL_SETUPS) {
    const p = planFor(s, { effort: 'Full overhaul' });
    const tasks = p.steps.map(x => x.t);
    assert.equal(new Set(tasks).size, tasks.length, `${s.space}/${s.id}: a step is repeated verbatim`);
    for (const a of tasks) {
      for (const b of tasks) {
        if (a === b) continue;
        assert.ok(!b.includes(a), `${s.space}/${s.id}: "${a}" is contained in "${b}"`);
      }
    }
  }
});

test('every step carries a time the headline can add up', () => {
  /* planMinuteRange silently contributes zero for an unparseable time, so a
     step with none would let the bracket test above pass over a plan whose
     printed total is short by that step. */
  for (const s of ALL_SETUPS) {
    for (const st of planFor(s, { effort: 'Full overhaul' }).steps) {
      assert.match(String(st.m || ''), /\d/, `${s.space}/${s.id}: "${st.t}" has no time`);
    }
  }
});

test('the client and the server agree on what a plan may run to', () => {
  assert.deepEqual(EFFORT_STEP_RANGES, SERVER_RANGES,
    'the client copy of the step ranges has drifted from the one the server validates against');
});
