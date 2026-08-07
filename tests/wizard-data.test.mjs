import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROOMS, AREAS, SPACE_CFG, STYLESETS, SETUP_TYPES, SETUP_DIMS, ROOMY,
  SETUP_GEOM, GEOM_TO_V3D_LAYOUT, SETUP_SCENARIO, scenarioKeyFor,
  roomFor, areaFor, goalIdFor, prefsForStyles, fmtFt, measureSummary, art,
  isKidOption, householdHasKids, optionsForHousehold, MOBILITY_NEEDS, PET_TYPES,
} from '../js/wizard-data.js';
import { PREFS, AFTER_MODES, CUSTOMIZE } from '../js/data.js';
import { getDemoScenario } from '../js/demo-scenarios.js';
import { EFFORT_STEPS } from '../js/personalize.js';
import { EFFORT_STEP_RANGES } from '../supabase/functions/_shared/planSchema.js';

// Design-contract integrity: every area the wizard can reach must carry a
// complete question set, setup list, and defaults — a hole here is a broken
// step at runtime, so it fails the build instead.

const allAreas = Object.values(AREAS).flat();

test('every wizard card uses the shared illustration system, never a photo swap', () => {
  const cards = [...ROOMS, ...allAreas, ...Object.values(SETUP_TYPES).flat()];
  for (const card of cards) {
    assert.ok(card.artKey, `${card.id}: missing artKey`);
    assert.equal('imgKey' in card, false, `${card.id}: still declares a photo imgKey`);
    assert.match(art(card.artKey), /class="card-art-svg/);
    assert.match(art(card.artKey), /class="art-motion/);
  }
});

test('illustration motion explains the storage type instead of reusing ambiguous symbols', () => {
  const setupArt = (space, id) => art(SETUP_TYPES[space].find(option => option.id === id).artKey);

  for (const id of ['reachin', 'walkin', 'lshape']) {
    assert.match(setupArt('pantry', id), /motion-bin-pull/, `${id} pantry should move a pantry bin`);
    assert.doesNotMatch(setupArt('pantry', id), /motion-shirt/, `${id} pantry must not contain clothing motion`);
  }

  for (const id of ['reachinC', 'walkinC', 'lshapeC']) {
    assert.match(setupArt('closet', id), /motion-shirt/, `${id} closet should move a recognizable shirt`);
  }

  assert.match(art('roomBath'), /motion-water/, 'bathroom room card should show a water stream');
  assert.doesNotMatch(art('roomBath'), /motion-bubbles/, 'bathroom room card must not emit abstract bubbles');
  assert.match(art('artVanity'), /motion-under-sink-interior/);
  assert.match(art('artVanity'), /motion-cabinet-door/);
  assert.match(art('artTallCab'), /motion-cabinet-interior/);
  assert.doesNotMatch(art('artTallCab'), /motion-drawer/, 'cabinet door must reveal shelves, not a drawer');
  assert.match(setupArt('linen', 'reachinL'), /motion-towel-pull/);

  for (const card of [...ROOMS, ...allAreas, ...Object.values(SETUP_TYPES).flat()]) {
    assert.doesNotMatch(art(card.artKey), /motion-(bubbles|pillow)/, `${card.artKey}: ambiguous legacy motion remains`);
  }
});

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

/* household.mobility was declared in state, reset on restart, forwarded to the
   model by buildAnalysisContext, honoured by a hard prompt safety rule, and
   acted on by the demo scenarios — but no control ever wrote it, so the whole
   path was dead. The wizard now asks; these are the labels the other two ends
   match on, so they have to stay in step. */
test('every mobility answer the wizard offers reaches the plan and the prompt', () => {
  assert.ok(MOBILITY_NEEDS.length >= 2, 'the reach question needs real options');

  const promptRules = readFileSync(
    new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');
  for (const need of MOBILITY_NEEDS) {
    assert.ok(promptRules.includes(`"${need}"`),
      `the analysis prompt never names the "${need}" answer, so the model cannot act on it`);

    const plan = getDemoScenario('pantry', 'find', {
      kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] },
      mobility: [need], notes: '',
    });
    assert.ok(plan.safetyNotes.some(n => /easier reach|seated reach/i.test(n)),
      `"${need}" produced no reach guidance in the offline plan`);
  }

  // No mobility answer must not invent a reach note.
  const none = getDemoScenario('pantry', 'find', {
    kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] },
    mobility: [], notes: '',
  });
  assert.ok(!none.safetyNotes.some(n => /mid-height/i.test(n)));
});

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

/* The household step is step 6 of 12, and every list after it was still
   offering kid-only options: "Kids' snacks" in the contents chips, "Kids can't
   reach their things" in the goals, "Kid-friendly setup" in the after-preview
   tabs. Answering "no kids" and then being asked about them anyway reads as
   the app ignoring the answer, and a stale selection also contradicts the
   analysis context, where the model is told there are no children and the
   validator rejects any kid-safety flag. */
test('kid-only options disappear once the household says there are no kids', () => {
  const noKids = { kidCount: 0, kids: { present: 'no', ages: [] } };
  const withKids = { kidCount: 2, kids: { present: 'yes', ages: ['Toddler'] } };

  assert.equal(householdHasKids(noKids), false);
  assert.equal(householdHasKids(withKids), true);

  // Every space config the wizard can land on must come out kid-free.
  for (const [spaceId, cfg] of Object.entries(SPACE_CFG)) {
    for (const list of [cfg.categories, cfg.goals]) {
      if (!Array.isArray(list)) continue;
      const kept = optionsForHousehold(list, noKids);
      assert.ok(kept.every((o) => !isKidOption(o)),
        `${spaceId}: kid options survived a no-kids household`);
      assert.deepEqual(optionsForHousehold(list, withKids), list,
        `${spaceId}: nothing may be dropped when kids are present`);
    }
  }

  // The after-preview tabs are rendered on the results screen, well past the
  // household step, and were the most visible instance of this.
  assert.ok(AFTER_MODES.some(isKidOption), 'fixture check: a kid tab exists to filter');
  assert.ok(optionsForHousehold(AFTER_MODES, noKids).every((m) => !isKidOption(m)));

  /* The Adjust screen was the last list still offering a kid option to a
     household with none — and its options are [id, title, desc] tuples, a
     third shape isKidOption had to learn before the shared filter did
     anything here at all. */
  assert.ok(CUSTOMIZE.some(isKidOption), 'fixture check: a kid option exists to filter');
  assert.ok(optionsForHousehold(CUSTOMIZE, noKids).every((o) => !isKidOption(o)));
  assert.deepEqual(optionsForHousehold(CUSTOMIZE, withKids), CUSTOMIZE);
  assert.equal(isKidOption(['kid', 'Make it more kid-friendly', 'Moves snacks lower.']), true);
  assert.equal(isKidOption(['capacity', 'Maximize storage capacity', 'Adds risers.']), false);

  // Detection is on the option text, so it holds for labelled objects too.
  assert.equal(isKidOption("Kids' snacks"), true);
  assert.equal(isKidOption('Kid-friendly setup'), true);
  assert.equal(isKidOption({ label: "Kids can't reach their things" }), true);
  assert.equal(isKidOption('Clear containers'), false);
  assert.equal(isKidOption('Maximize vertical space'), false);
});

/* household.pets.types and household.notes were the last two inputs declared
   in state, reset on restart, and forwarded to the model by
   buildAnalysisContext — with nothing anywhere to write them. pets.types was
   worse than dormant: the prompt had no pet rule at all, so even a populated
   value would have been ignored. */
test('the pet and notes answers reach the wizard, the state, and the prompt', () => {
  assert.ok(PET_TYPES.length >= 2, 'pet types need real options');

  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const wizard = readFileSync(new URL('../js/screens/wizard.js', import.meta.url), 'utf8');
  const plan = readFileSync(new URL('../js/plan.js', import.meta.url), 'utf8');
  const prompt = readFileSync(new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');

  // A control exists for each, and something writes it.
  for (const id of ['pet-type-chips', 'household-notes']) {
    assert.ok(html.includes(`id="${id}"`), `${id} has no control in the wizard`);
    assert.ok(wizard.includes(id), `nothing renders or reads ${id}`);
  }
  assert.match(wizard, /state\.household\.notes\s*=/, 'the notes field never writes to state');
  assert.match(wizard, /h\.pets\.types/, 'the pet chips never write to state');

  // Answering zero pets must not leave a stale pet type behind, the same way
  // zero kids prunes the ages.
  assert.match(wizard, /pets\.present === 'no'\) h\.pets\.types = \[\]/);

  // Both still travel to the model, and the model is now told what to do with
  // a pet: an unread input is the bug being closed here.
  assert.match(plan, /types:h\.pets\.types\.slice\(\)/);
  assert.match(plan, /notes,/);
  assert.match(prompt, /pets/i, 'the prompt has no pet rule, so pets.types would be ignored');
});

/* Re-confirming the setup card that is already selected (Back, or Review's
   Edit) must not wipe the measurements typed on the next step. */
test('setSetup keeps user measurements when the same card is re-clicked', async () => {
  const { state } = await import('../js/state.js');
  const { setArea, setSetup } = await import('../js/screens/wizard.js');
  setArea('garage', 'garage');            // preselects 'utility' with defaults
  setSetup('utility');                    // the user actually picks it
  state.dimsFt = { w: 12, h: 6.5, d: 1.5 };
  state.dims = { w_in: 144, h_in: 78, d_in: 18, shelves: null };
  setSetup('utility');                    // re-confirm the same card
  assert.equal(state.dims.w_in, 144, 're-clicking the selected setup reset the width');
  setSetup('wallcab');                    // a REAL change re-applies defaults
  assert.notEqual(state.dims.w_in, 144);
});
