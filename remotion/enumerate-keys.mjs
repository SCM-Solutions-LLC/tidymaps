/* Which clips to produce. Two sources, unioned:

   1. Every key the demo-scenario pipeline can actually request, found by
      running getDemoScenario across the full wizard matrix (area × setup ×
      goal × household variants) and classifying each step exactly the way
      the runtime does.
   2. All 13 actions for every space's default (motif, glyph) pair, plus the
      hang/fold keys their glyph rules force (hang→hanger, fold→
      foldedclothes on any motif). Live plans are AI-written free text, so
      their step wording is open-ended — but the action set is closed and an
      unmatched step falls back to the space default glyph, which makes these
      the keys real plans land on. Anything rarer keeps its SVG fallback by
      design.

   Run directly for a human-readable report, or import enumerateKeys() (the
   render script does). */
import { getDemoScenario } from '../js/demo-scenarios.js';
import { ACTIONS, mediaKeyFor, motifForSpace, glyphForStep } from '../js/stepMedia.js';
import * as wizard from '../js/wizard-data.js';

// The nine wizard areas plus the extra space ids stepMedia knows defaults for.
const AREAS = ['pantry','cabinet','drawers','closet','dresser','bathroom','linen','garage','workbench'];
const ALL_SPACES = [...AREAS, 'junk', 'walkin', 'fridge', 'attic', 'laundry', 'kids'];

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
    for (const action of ACTIONS) add(`${action}-${motif}-${glyph}`, `(default pair for ${space})`);
    add(`hang-${motif}-hanger`, `(forced by /hang/ glyph rule on ${motif})`);
    add(`fold-${motif}-foldedclothes`, `(forced by /fold/ glyph rule on ${motif})`);
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
