/* ============================================================
   Layout data model: archetype taxonomy, surface kinds, and
   the resolution function that picks the right 3D layout.

   Pure data and logic — no DOM, no Three.js, node-testable.
   ============================================================ */
import { SETUP_TYPES } from './wizard-data.js';

/* ---------- Enums (must match supabase/functions/_shared/planSchema.js) ---------- */
export const ARCHETYPES = [
  'shelves','cabinet','l-run','walkin-u','closet-rod','drawer-bank',
  'closet-system','under-bed','under-sink','counter','garage-rack',
  'overhead-rack','workbench','fridge',
];
export const SURFACES = ['shelf','rod','drawer','floor','door','pegboard','worktop'];
export const PLACES = ['left','back','right','upper','lower','run-a','run-b','floor','bench','wall'];

const ARCHETYPE_SET = new Set(ARCHETYPES);
const SURFACE_SET = new Set(SURFACES);
const PLACE_SET = new Set(PLACES);

export const ARCHETYPE_LABELS = {
  'shelves':       'Shelves',
  'cabinet':       'Cabinet',
  'l-run':         'L-shaped',
  'walkin-u':      'Walk-in',
  'closet-rod':    'Closet with rod',
  'closet-system': 'Built-in closet',
  'under-bed':     'Under-bed drawers',
  'drawer-bank':   'Drawers',
  'under-sink':    'Under-sink',
  'counter':       'Counter + uppers',
  'garage-rack':   'Garage rack',
  'overhead-rack': 'Overhead rack',
  'workbench':     'Workbench',
  'fridge':        'Fridge',
};

/* ---------- Setup → archetype (33 entries, one per SETUP_TYPES id) ---------- */
export const SETUP_ARCHETYPE = {
  cabinet:    'cabinet',
  reachin:    'shelves',
  walkin:     'walkin-u',
  lshape:     'l-run',
  butler:     'counter',
  counterup:  'counter',
  lshapeK:    'l-run',
  tallcabK:   'cabinet',
  openshelf:  'shelves',
  incounter:  'drawer-bank',
  tower:      'drawer-bank',
  sideboard:  'drawer-bank',
  wardrobe:   'closet-rod',
  reachinC:   'closet-rod',
  walkinC:    'walkin-u',
  lshapeC:    'l-run',
  builtin:    'closet-system',
  dresser:    'drawer-bank',
  chest:      'drawer-bank',
  underbed:   'under-bed',
  undersink:  'under-sink',
  vanitydr:   'under-sink',
  wallshelf:  'shelves',
  cabinetL:   'cabinet',
  reachinL:   'shelves',
  walkinL:    'walkin-u',
  lshapeL:    'l-run',
  utility:    'garage-rack',
  wallcab:    'cabinet',
  overhead:   'overhead-rack',
  bench:      'workbench',
  toolchest:  'drawer-bank',
  wallcabW:   'cabinet',
};

/* ---------- Scenario key → archetype (16 entries) ---------- */
export const SCENARIO_ARCHETYPE = {
  pantry:    'shelves',
  cabinet:   'cabinet',
  closet:    'closet-rod',
  walkin:    'walkin-u',
  garage:    'garage-rack',
  laundry:   'shelves',
  kids:      'shelves',
  attic:     'shelves',
  other:     'shelves',
  drawers:   'drawer-bank',
  junk:      'drawer-bank',
  bathroom:  'under-sink',
  linen:     'shelves',
  fridge:    'fridge',
  dresser:   'drawer-bank',
  workbench: 'workbench',
};

/* ---------- Surface derivation from raw icon keywords ---------- */

const ICON_TO_SURFACE = {
  rod: 'rod', hook: 'rod', hanger: 'rod', hooks: 'rod',
  drawer: 'drawer',
  door: 'door',
};

export function surfaceFromIcon(iconKeyword) {
  if (!iconKeyword) return null;
  const k = String(iconKeyword).toLowerCase().replace(/[^a-z]/g, '');
  return ICON_TO_SURFACE[k] || null;
}

/* ---------- Surface derivation from level text (old-plan heuristic) ---------- */

const LEVEL_SURFACE_RULES = [
  [/\brod\b|\bhang/i,                           'rod'],
  [/\bdrawer\b/i,                               'drawer'],
  [/\bfloor\b|\bground\b|\brafter/i,            'floor'],
  [/\bdoor\b/i,                                 'door'],
  [/\bpegboard\b|\bpeg\s*board\b/i,             'pegboard'],
  [/\bbench\b|\bcounter\b|\btop surface\b|\bworktop\b/i, 'worktop'],
];

export function surfaceFromLevelText(lv) {
  if (!lv) return null;
  for (const [re, surface] of LEVEL_SURFACE_RULES) {
    if (re.test(lv)) return surface;
  }
  return null;
}

/* ---------- Archetype positional defaults ---------- */

const ARCHETYPE_DEFAULTS = {
  'shelves':       () => 'shelf',
  'cabinet':       () => 'shelf',
  'l-run':         () => 'shelf',
  'walkin-u':      () => 'shelf',
  'closet-rod':    (i, n) => (i === 0 ? 'shelf' : i >= n - 1 ? 'floor' : 'rod'),
  'closet-system': (i, n) => (i === 0 ? 'shelf' : i < n - 1 ? 'rod' : 'floor'),
  'under-bed':     () => 'drawer',
  'drawer-bank':   (i, n) => (i === 0 && n > 1 ? 'worktop' : 'drawer'),
  'under-sink':    (i, n) => (i < 2 && n >= 4 ? 'drawer' : i >= n - 1 ? 'floor' : 'shelf'),
  'counter':       () => 'shelf',
  'garage-rack':   (i, n) => (i >= n - 1 ? 'floor' : 'shelf'),
  'overhead-rack': () => 'shelf',
  'workbench':     (i, n) => {
    if (i === 0) return 'pegboard';
    if (i === Math.floor(n / 2)) return 'worktop';
    return 'shelf';
  },
  'fridge':        (i, n) => (i >= n - 2 ? 'drawer' : 'shelf'),
};

/* ---------- Section assignment from level text ---------- */

const SECTION_MATCHERS = [
  [/^left/i,     'left'],
  [/^back/i,     'back'],
  [/^right/i,    'right'],
  [/^floor/i,    'floor'],
  [/^upper/i,    'upper'],
  [/^lower/i,    'lower'],
  [/^bench/i,    'bench'],
  [/^wall/i,     'wall'],
  [/^run[\s-]?a/i, 'run-a'],
  [/^run[\s-]?b/i, 'run-b'],
];

function bestFitSectionId(lv) {
  if (!lv) return 'main';
  for (const [re, id] of SECTION_MATCHERS) {
    if (re.test(lv)) return id;
  }
  return 'main';
}

/* ---------- Layout normalization (used by normalizeAi) ---------- */

export function normalizeLayout(raw, shelfCount) {
  if (!raw || !raw.type || !ARCHETYPE_SET.has(raw.type)) return null;
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .slice(0, 8)
    .map(sec => ({
      id: String(sec.id || 'main'),
      label: String(sec.label || sec.id || ''),
      place: (sec.place && PLACE_SET.has(sec.place)) ? sec.place : null,
      rows: (Array.isArray(sec.rows) ? sec.rows : [])
        .map(r => Math.max(0, Math.min(shelfCount - 1, Math.round(Number(r)))))
        .filter(n => Number.isFinite(n)),
    }));

  const seen = new Set();
  for (const sec of sections) {
    sec.rows = sec.rows.filter(r => {
      if (seen.has(r)) return false;
      seen.add(r);
      return true;
    });
  }
  const cleaned = sections.filter(sec => sec.rows.length > 0);
  return { type: raw.type, sections: cleaned.length ? cleaned : undefined };
}

/* ---------- resolveLayout: the single resolution function ---------- */

export function resolveLayout({ ai, setup, scenarioKey, override, map }) {
  const rows = (map || (ai && ai.map) || []);
  const n = rows.length;

  let type, source;
  if (override && ARCHETYPE_SET.has(override)) {
    type = override;
    source = 'override';
  } else if (setup && SETUP_ARCHETYPE[setup]) {
    type = SETUP_ARCHETYPE[setup];
    source = 'setup';
  } else if (ai && ai.layout && ai.layout.type && ARCHETYPE_SET.has(ai.layout.type)) {
    type = ai.layout.type;
    source = 'ai';
  } else if (scenarioKey && SCENARIO_ARCHETYPE[scenarioKey]) {
    type = SCENARIO_ARCHETYPE[scenarioKey];
    source = 'scenario';
  } else {
    type = 'shelves';
    source = 'default';
  }

  const aiSections = ai && ai.layout && ai.layout.type === type
    ? (ai.layout.sections || []) : [];
  const assigned = new Set();
  const sections = [];

  for (const sec of aiSections) {
    const validRows = (sec.rows || []).filter(r => r >= 0 && r < n && !assigned.has(r));
    if (!validRows.length) continue;
    validRows.forEach(r => assigned.add(r));
    sections.push({
      id: sec.id || 'main',
      label: sec.label || sec.id || '',
      place: sec.place || null,
      rows: validRows,
    });
  }

  const unassigned = [];
  for (let i = 0; i < n; i++) {
    if (!assigned.has(i)) unassigned.push(i);
  }

  if (unassigned.length && sections.length) {
    for (const idx of unassigned) {
      const lv = rows[idx] && (rows[idx].lv || rows[idx].level || '');
      const fitId = bestFitSectionId(lv);
      const target = sections.find(s => s.id === fitId) || sections.find(s => s.id === 'main');
      if (target) {
        target.rows.push(idx);
      } else {
        let main = sections.find(s => s.id === 'main');
        if (!main) {
          main = { id: 'main', label: '', place: null, rows: [] };
          sections.push(main);
        }
        main.rows.push(idx);
      }
    }
  } else if (unassigned.length) {
    sections.push({ id: 'main', label: '', place: null, rows: unassigned });
  }

  const defaultFn = ARCHETYPE_DEFAULTS[type] || (() => 'shelf');

  function surfaceFor(shelfIndex) {
    const row = rows[shelfIndex];
    if (row && row.surface && SURFACE_SET.has(row.surface)) return row.surface;
    if (row) {
      const fromLv = surfaceFromLevelText(row.lv || row.level);
      if (fromLv) return fromLv;
    }
    return defaultFn(shelfIndex, n);
  }

  return { type, source, setup: setup || null, sections, surfaceFor };
}

/* ---------- Chip helpers ---------- */

export function chipArchetypesFor(spaceId) {
  const setups = SETUP_TYPES[spaceId];
  if (!setups) return ARCHETYPES.slice();
  const seen = new Set();
  const result = [];
  for (const s of setups) {
    const arch = SETUP_ARCHETYPE[s.id];
    if (arch && !seen.has(arch)) {
      seen.add(arch);
      result.push(arch);
    }
  }
  return result.length ? result : ARCHETYPES.slice();
}
