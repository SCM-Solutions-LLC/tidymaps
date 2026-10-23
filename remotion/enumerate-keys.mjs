/* Which clips to produce. Two sources, unioned:

   1. Every key the demo-scenario pipeline can actually request, found by
      running getDemoScenario across the full wizard matrix (area × setup ×
      goal × household variants) and classifying each step exactly the way
      the runtime does.
   2. All 14 actions for every space's default (motif, glyph) pair, plus the
      hang/fold keys their glyph rules force (hang→hanger, fold→
      foldedclothes) in the spaces that keep clothes. Outside them a hang or
      fold step is drawn as `stock` and no hanger or shirt is ever drawn
      (stepMedia's allowedAction / glyphAllowed), so those keys would be
      clips nothing can request. Live plans are AI-written free text, so
      their step wording is open-ended — but the action set is closed and an
      unmatched step falls back to the space default glyph, which makes these
      the keys real plans land on. Anything rarer keeps its SVG fallback by
      design.
   3. Every step of the real AI plans the repo keeps as fixtures. The first
      real fridge plan named leftovers and meat in steps no demo plan
      phrases that way, and three of its twelve steps had no clip.

   Run directly for a human-readable report, or import enumerateKeys() (the
   render script does). */
import { getDemoScenario } from '../js/demo-scenarios.js';
import { ACTIONS, mediaKeyFor, motifForSpace, glyphForStep, allowedAction, glyphAllowed } from '../js/stepMedia.js';
import * as wizard from '../js/wizard-data.js';
import { PLAN as FRIDGE_1023 } from '../tests/fixtures/fridge-1023.mjs';

const REAL_PLANS = [['fridge', FRIDGE_1023]];

// The ten wizard areas plus the extra space ids stepMedia knows defaults for.
const AREAS = ['pantry','cabinet','drawers','fridge','closet','dresser','bathroom','linen','garage','workbench'];
const ALL_SPACES = [...AREAS, 'junk', 'walkin', 'attic', 'laundry', 'kids'];

const HOUSEHOLDS = [
  { adults: 2, kids: 0, pets: 0 },
  { adults: 2, kids: 1, pets: 0 },
  { adults: 2, kids: 0, pets: 1 },
  { adults: 1, kids: 2, pets: 1, mobility: ['seated'] },
];

function wizardGoals() {
  for (const [k, v] of Object.entries(wizard)) {
    if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && 'id' in v[0] && /goal/i.test(k)) {
      return v.map((g) => g.id);
    }
  }
  return ['find', 'space', 'look', 'maintain'];
}

function setupsByArea() {
  const out = {};
  const st = wizard.SETUP_TYPES;
  if (st && typeof st === 'object') {
    for (const [area, list] of Object.entries(st)) {
      if (Array.isArray(list)) out[area] = list.map((s) => s.id);
    }
  }
  return out;
}

export function enumerateKeys() {
  const keys = new Map(); // key -> {count, example}

  const add = (key, example) => {
    if (!keys.has(key)) keys.set(key, { count: 0, example });
    keys.get(key).count++;
  };

  // 1. the demo matrix
  const goals = wizardGoals();
  const setups = setupsByArea();
  for (const area of AREAS) {
    for (const setupId of [undefined, ...(setups[area] || [])]) {
      for (const goal of goals) {
        for (const hh of HOUSEHOLDS) {
          const plan = getDemoScenario(area, goal, hh, null, setupId);
          for (const raw of plan.steps || []) {
            const s = raw && raw.t !== undefined ? raw
              : { t: (raw && raw.task) || '', w: (raw && raw.why) || '' };
            if (s.t) add(mediaKeyFor(s, area), s.t);
          }
        }
      }
    }
  }

  // 2. default pairs × all actions, + forced hang/fold glyphs per motif
  for (const space of ALL_SPACES) {
    const motif = motifForSpace(space);
    const glyph = glyphForStep({ t: '', w: '' }, space);
    for (const action of ACTIONS) add(`${allowedAction(action, space)}-${motif}-${glyph}`, `(default pair for ${space})`);
    if (glyphAllowed('hanger', space)) add(`hang-${motif}-hanger`, `(forced by /hang/ glyph rule on ${motif})`);
    if (glyphAllowed('foldedclothes', space)) add(`fold-${motif}-foldedclothes`, `(forced by /fold/ glyph rule on ${motif})`);
  }

  // 3. real plans
  for (const [space, plan] of REAL_PLANS) {
    for (const s of plan.steps) add(mediaKeyFor({ t: s.task, w: s.why }, space), s.task);
  }

  return [...keys.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, meta]) => ({ key, ...meta }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const list = enumerateKeys();
  for (const { key, count, example } of list) {
    console.log(`${String(count).padStart(6)}  ${key.padEnd(34)} ${example}`);
  }
  console.log(`\n${list.length} keys`);
}
