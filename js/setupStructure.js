/* ============================================================
   Setup structure — what the chosen setup actually HAS.

   The wizard's step 3 asks which of 33 setups looks like the user's space,
   and every one of them maps to an archetype in js/layout.js
   (SETUP_ARCHETYPE). The 3D viewer and the analyze-space prompt both honour
   that archetype already. The deterministic scenarios did not: they are
   written one-per-space, so the plan's own zone list came from the AREA
   (pantry, garage, workbench) and ignored the shape entirely.

   That produced plans describing furniture the user does not own — an
   18-inch ceiling rack with an "Eye level" and a "Floor level" zone, a
   rolling tool chest with a pegboard wall and a bench surface, open wall
   shelves with "Top drawer" and "Cabinet: floor", under-bed drawers with a
   "Top surface". 18 of the 33 setups were structurally wrong.

   The split this module draws:
     - the SCENARIO supplies the CONTENT  (what a pantry holds, what a
       workbench holds, why it goes there, what to buy)
     - the SETUP supplies the STRUCTURE   (which levels exist, what surface
       each one is, how many there are)

   projectOntoArchetype() re-projects one onto the other, so an L-shaped
   pantry keeps pantry content on an L-run's levels, and an L-shaped closet
   keeps closet content on the same levels. That is why this is a transform
   and not 33 hand-written scenarios: shape and contents are independent, and
   33 = 9 contents x their shapes.
   ============================================================ */

/* ---------- Level templates, in top-to-bottom (or front-to-back) order ----------
   `surface` uses the plan contract's vocabulary (see SURFACES in layout.js
   and the analyze-space schema): shelf | rod | drawer | floor | door |
   pegboard | worktop. `icon` is a raw keyword; iconFor() resolves it. */
/* `role` is what the level is FOR. When two scenario rows merge into one
   slot their rationales cannot simply be concatenated — the sentences argue
   from the height they used to sit at, so a ceiling rack ended up explaining
   that "heavy power tools are safer on lower shelves" and "bulky gear stores
   best on the floor". The role supplies one true sentence instead. */
export const ROLE_WHY = {
  high:    'Up out of the daily path, where long-cycle and bulk storage belongs.',
  reach:   'The easiest zone to reach, so the things used most often live here.',
  mid:     'Mid-height keeps these visible and grouped together.',
  low:     'Low and stable, so weight is easy to lift and nothing can fall far.',
  floor:   'Floor level takes the bulky things you slide rather than lift.',
  door:    'Shallow door storage suits small, single-depth items you want in view.',
  surface: 'A clear working surface — only the active job belongs on top.',
  deck:    'Overhead storage is for light, bulky things needed a few times a year.',
  bay:     'A shallow rolling bay — flat, foldable things that stay clean and out of sight.',
  rod:     'Hanging keeps these wrinkle-free and visible at a glance.',
  drawer:  'A closed drawer keeps small things sorted and out of sight.',
};

export const ARCHETYPE_LEVELS = {
  'shelves': [
    { level: 'Top shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Eye level', icon: 'eye', surface: 'shelf', eye: true, role: 'reach' },
    { level: 'Middle shelf', icon: 'middle', surface: 'shelf', role: 'mid' },
    { level: 'Lower shelf', icon: 'down', surface: 'shelf', role: 'low' },
    { level: 'Bottom shelf', icon: 'down', surface: 'shelf', role: 'low' },
  ],
  'cabinet': [
    { level: 'Top shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Eye level', icon: 'eye', surface: 'shelf', eye: true, role: 'reach' },
    { level: 'Middle shelf', icon: 'middle', surface: 'shelf', role: 'mid' },
    { level: 'Lower shelf', icon: 'down', surface: 'shelf', role: 'low' },
    { level: 'Door rack', icon: 'door', surface: 'door', role: 'door' },
  ],
  'l-run': [
    { level: 'Long run: upper shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Long run: eye level', icon: 'eye', surface: 'shelf', eye: true, role: 'reach' },
    { level: 'Long run: lower shelf', icon: 'down', surface: 'shelf', role: 'low' },
    { level: 'Corner: deep shelf', icon: 'middle', surface: 'shelf', role: 'mid' },
    { level: 'Short run: upper shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Short run: lower shelf', icon: 'down', surface: 'shelf', role: 'low' },
  ],
  'walkin-u': [
    { level: 'Left wall: high shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Left wall: eye level', icon: 'eye', surface: 'shelf', eye: true, role: 'reach' },
    { level: 'Back wall: eye level', icon: 'middle', surface: 'shelf', role: 'mid' },
    { level: 'Back wall: lower shelves', icon: 'down', surface: 'shelf', role: 'low' },
    { level: 'Right wall: full run', icon: 'side', surface: 'shelf', role: 'mid' },
    { level: 'Floor: full run', icon: 'down', surface: 'floor', role: 'floor' },
  ],
  'closet-rod': [
    { level: 'Top shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Hanging rod: left', icon: 'rod', surface: 'rod', eye: true, role: 'rod' },
    { level: 'Hanging rod: right', icon: 'rod', surface: 'rod', role: 'rod' },
    { level: 'Floor / door', icon: 'down', surface: 'floor', role: 'floor' },
  ],
  'closet-system': [
    { level: 'Top shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Hanging rod', icon: 'rod', surface: 'rod', eye: true, role: 'rod' },
    { level: 'Open shelves', icon: 'middle', surface: 'shelf', role: 'mid' },
    { level: 'Drawer bank', icon: 'drawer', surface: 'drawer', role: 'drawer' },
    { level: 'Floor', icon: 'down', surface: 'floor', role: 'floor' },
  ],
  'drawer-bank': [
    { level: 'Top drawer', icon: 'drawer', surface: 'drawer', eye: true, role: 'reach' },
    { level: 'Second drawer', icon: 'drawer', surface: 'drawer', role: 'drawer' },
    { level: 'Third drawer', icon: 'drawer', surface: 'drawer', role: 'drawer' },
    { level: 'Deep bottom drawer', icon: 'drawer', surface: 'drawer', role: 'low' },
  ],
  'under-bed': [
    { level: 'Front bay', icon: 'drawer', surface: 'drawer', eye: true, role: 'bay' },
    { level: 'Back bay', icon: 'drawer', surface: 'drawer', role: 'bay' },
  ],
  'under-sink': [
    { level: 'Top drawer', icon: 'drawer', surface: 'drawer', eye: true, role: 'reach' },
    { level: 'Second drawer', icon: 'drawer', surface: 'drawer', role: 'drawer' },
    { level: 'Cabinet: upper zone', icon: 'middle', surface: 'shelf', role: 'mid' },
    { level: 'Cabinet: floor', icon: 'down', surface: 'floor', role: 'floor' },
  ],
  'counter': [
    { level: 'Upper cabinet: top shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Upper cabinet: eye level', icon: 'eye', surface: 'shelf', eye: true, role: 'reach' },
    { level: 'Counter surface', icon: 'middle', surface: 'worktop', role: 'surface' },
    { level: 'Drawers', icon: 'drawer', surface: 'drawer', role: 'drawer' },
    { level: 'Lower cabinet', icon: 'down', surface: 'shelf', role: 'low' },
  ],
  'garage-rack': [
    { level: 'Top shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Upper shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Eye level', icon: 'eye', surface: 'shelf', eye: true, role: 'reach' },
    { level: 'Lower shelf', icon: 'down', surface: 'shelf', role: 'low' },
    { level: 'Floor level', icon: 'down', surface: 'floor', role: 'floor' },
  ],
  /* A platform hung from the ceiling. It has no eye level, no floor, and no
     doors — the whole point is that it is overhead and out of the way, which
     is also why only long-cycle storage belongs on it. */
  'overhead-rack': [
    { level: 'Rack deck: front half', icon: 'up', surface: 'shelf', eye: true, role: 'deck' },
    { level: 'Rack deck: back half', icon: 'up', surface: 'shelf', role: 'deck' },
  ],
  'workbench': [
    { level: 'Pegboard wall', icon: 'hook', surface: 'pegboard', role: 'reach' },
    { level: 'Upper shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Bench surface', icon: 'middle', surface: 'worktop', eye: true, role: 'surface' },
    { level: 'Bench drawers', icon: 'drawer', surface: 'drawer', role: 'drawer' },
    { level: 'Below the bench', icon: 'down', surface: 'floor', role: 'floor' },
  ],
  'fridge': [
    { level: 'Top shelf', icon: 'up', surface: 'shelf', role: 'high' },
    { level: 'Eye-level shelf', icon: 'eye', surface: 'shelf', eye: true, role: 'reach' },
    { level: 'Lower shelf', icon: 'middle', surface: 'shelf', role: 'mid' },
    { level: 'Crisper drawers', icon: 'drawer', surface: 'drawer', role: 'drawer' },
    { level: 'Door shelves', icon: 'door', surface: 'door', role: 'door' },
  ],
};

/* Some setups are a smaller instance of their archetype: a tall narrow
   drawer tower is a drawer-bank, but so is a wide dresser, and a rolling
   tool chest has more, shallower drawers than either. Capping the level
   count here keeps the plan honest about how many zones actually exist. */
export const SETUP_LEVEL_CAP = {
  underbed: 2, overhead: 2, wallcab: 3, wallcabW: 3, wallshelf: 3,
  tower: 4, chest: 4, toolchest: 5, sideboard: 2, incounter: 4,
  openshelf: 4, undersink: 4, vanitydr: 4, cabinetL: 5, reachinL: 5,
};

/* The surfaces each archetype genuinely offers. Prose that names a surface
   the setup does not have is the other half of the bug — a tool chest plan
   telling the user to "hang hand tools on the pegboard", an open-shelving
   plan opening with "Empty the cabinet completely". */
export const ARCHETYPE_SURFACES = {
  'shelves':       ['shelf'],
  'cabinet':       ['shelf', 'door'],
  'l-run':         ['shelf'],
  // walk-in covers pantries and closets alike, and a walk-in closet does
  // hang clothes — the surface list gates prose scrubbing, so it has to be
  // permissive enough for every space the archetype serves.
  'walkin-u':      ['shelf', 'rod', 'floor'],
  'closet-rod':    ['shelf', 'rod', 'floor'],
  'closet-system': ['shelf', 'rod', 'drawer', 'floor'],
  'drawer-bank':   ['drawer'],
  'under-bed':     ['drawer'],
  'under-sink':    ['drawer', 'shelf', 'floor'],
  'counter':       ['shelf', 'worktop', 'drawer'],
  'garage-rack':   ['shelf', 'floor'],
  'overhead-rack': ['shelf'],
  'workbench':     ['pegboard', 'shelf', 'worktop', 'drawer', 'floor'],
  'fridge':        ['shelf', 'drawer', 'door'],
};

/* Phrases that only make sense when a surface exists, and what to say when
   it does not. A null replacement means the whole sentence goes. */
const SURFACE_PHRASES = [
  ['pegboard', [
    [/\bon the pegboard\b/gi, 'in the top drawer'],
    [/\bpegboard wall\b/gi, 'drawer bank'],
    [/\bpegboard\b/gi, 'drawer'],
  ]],
  ['worktop', [
    [/\bthe bench surface\b/gi, 'the top drawer'],
    [/\bbench surface\b/gi, 'top drawer'],
    [/\bon the bench\b/gi, 'in the chest'],
    [/\bthe counter\b/gi, 'the top drawer'],
  ]],
  ['door', [
    [/\bthe (?:inside of the )?door\b/gi, 'the front edge'],
    [/\bdoor rack\b/gi, 'front shelf'],
    [/\bdoor-mounted\b/gi, 'front-facing'],
  ]],
  ['floor', [
    [/\bthe floor\b/gi, 'the lowest level'],
    [/\bfloor level\b/gi, 'lowest level'],
  ]],
  ['rod', [
    [/\bthe (?:hanging )?rod\b/gi, 'the shelf'],
    [/\bhanging rod\b/gi, 'shelf'],
  ]],
  ['drawer', [
    [/\bthe drawers?\b/gi, 'the shelf'],
  ]],
];

/* A step or line that is ABOUT a surface the setup lacks cannot be reworded
   into something true — it has to go. */
const SURFACE_ONLY_LINES = {
  pegboard: /pegboard/i,
  worktop: /\bbench (?:surface|top)\b|\bcountertop\b/i,
  door: /\bdoor (?:rack|shelf|storage)\b|over-the-door/i,
  rod: /\bhanging rod\b|\bhang(?:ing)? (?:clothes|shirts|items) on\b/i,
  drawer: /\bdrawer (?:divider|organizer|liner)s?\b/i,
  floor: /\bfloor (?:bin|zone|space|pile)\b/i,
};

export function rewriteForSurfaces(text, archetype) {
  if (!text) return text;
  const have = new Set(ARCHETYPE_SURFACES[archetype] || []);
  let out = String(text);
  for (const [surface, rules] of SURFACE_PHRASES) {
    if (have.has(surface)) continue;
    for (const [re, to] of rules) out = out.replace(re, to);
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

/* True when the line is unsalvageable for this archetype. */
export function mentionsMissingSurface(text, archetype) {
  if (!text) return false;
  const have = new Set(ARCHETYPE_SURFACES[archetype] || []);
  for (const [surface, re] of Object.entries(SURFACE_ONLY_LINES)) {
    if (!have.has(surface) && re.test(text)) return true;
  }
  return false;
}

/* ---------- Opening sentence ----------
   Every scenario opens by describing the unit, and every one of those
   descriptions is hardcoded: "A 48-inch-wide metal shelving unit with five
   shelves" led a report whose masthead chip, two lines above, read the 14′
   the user had just measured. The rest of the summary describes the mess
   (which is scenario content and stays); only the leading claim about the
   furniture is rebuilt from what the user actually told us. */

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/* Local, so this module stays free of wizard imports. */
function ft(inches) {
  const total = Math.round(inches);
  const f = Math.floor(total / 12), i = total % 12;
  if (!f) return i + '″';
  return i ? `${f}′${i}″` : `${f}′`;
}

const ROOMY_ARCHETYPES = new Set(['walkin-u', 'l-run']);

const LEVEL_NOUN = {
  'drawer-bank': 'drawers', 'under-bed': 'bays', 'under-sink': 'zones',
  'closet-rod': 'zones', 'closet-system': 'zones', 'workbench': 'zones',
  'counter': 'zones', 'walkin-u': 'zones', 'l-run': 'zones',
  'overhead-rack': 'deck halves', 'fridge': 'zones',
};

/* The wizard's setup labels are card captions, not noun phrases — "Butler's",
   "L-shaped", "Reach-in", "Counter + uppers". Dropping one into a sentence
   needs the full noun, and whether it takes has/have is not derivable from
   the spelling ("Vanity with drawers" is singular, "Wall shelves" is not).
   33 entries, one per SETUP_TYPES id. [noun, isPlural] */
export const SETUP_NOUN = {
  cabinet: ['pantry cabinet', false], reachin: ['reach-in pantry', false],
  walkin: ['walk-in pantry', false], lshape: ['L-shaped pantry', false],
  butler: ['butler’s pantry', false],
  counterup: ['counter and upper cabinets', true], lshapeK: ['L-shaped cabinet run', false],
  tallcabK: ['tall kitchen cabinet', false], openshelf: ['open kitchen shelving', false],
  incounter: ['in-counter drawers', true], tower: ['drawer tower', false],
  sideboard: ['sideboard', false],
  wardrobe: ['wardrobe', false], reachinC: ['reach-in closet', false],
  walkinC: ['walk-in closet', false], lshapeC: ['L-shaped closet', false],
  builtin: ['built-in closet', false],
  dresser: ['dresser', false], chest: ['tall chest of drawers', false],
  underbed: ['under-bed drawers', true],
  undersink: ['under-sink cabinet', false], vanitydr: ['vanity', false],
  wallshelf: ['bathroom wall shelves', true],
  cabinetL: ['linen cabinet', false], reachinL: ['reach-in linen closet', false],
  walkinL: ['walk-in linen closet', false], lshapeL: ['L-shaped linen closet', false],
  utility: ['utility shelving', false], wallcab: ['garage wall cabinets', true],
  overhead: ['overhead rack', false],
  bench: ['workbench', false], toolchest: ['rolling tool chest', false],
  wallcabW: ['workshop wall cabinets', true],
};

export function describeSetup({ archetype, setupId, dims, levelCount }) {
  const entry = SETUP_NOUN[setupId];
  if (!dims || !dims.w_in || !dims.h_in || !entry) return '';
  const [name, plural] = entry;
  const noun = LEVEL_NOUN[archetype] || 'shelves';
  const count = COUNT_WORDS[levelCount] || String(levelCount);
  const size = ROOMY_ARCHETYPES.has(archetype) && dims.d_in
    ? `${ft(dims.w_in)} × ${ft(dims.d_in)} and ${ft(dims.h_in)} tall`
    : `${ft(dims.w_in)} wide and ${ft(dims.h_in)} tall`;
  return `Your ${name}, measured at ${size}, ${plural ? 'have' : 'has'} ${count} ${noun} to work with.`;
}

/* Swap the scenario's leading furniture claim for the measured one, keeping
   every sentence after it. */
export function rewriteOpening(summary, opening) {
  if (!opening) return summary;
  const rest = String(summary || '').split(/(?<=[.!?])\s+/).slice(1).join(' ').trim();
  return rest ? `${opening} ${rest}` : opening;
}

/* ---------- Content the shape cannot physically hold ----------
   Structure is not the only thing a setup determines. A ceiling rack is
   reached overhead, usually off a ladder, so hoisting solvents and heavy
   power tools onto it is not a worse plan — it is a dangerous one. The
   scenario cannot know: it was written for a floor-standing garage rack
   where "keep chemicals high" is exactly right.

   Excluded categories are not silently dropped. The plan says where they
   belong instead, because "we left your solvents out of this plan" is the
   part the user needs to read. */
const ARCHETYPE_CONTENT_RULES = {
  'overhead-rack': {
    excludeFlags: ['heavy', 'chemical', 'sharp'],
    excludeZone: /chemical|paint|solvent|hazard|heavy|power tool|automotive|frequently used|daily/i,
    note: 'Nothing heavy, sharp, or chemical goes on the overhead rack — it is all lifted above your head. Keep those at waist height or lower, and give the rack the light, bulky things you need a few times a year.',
  },
  'under-bed': {
    excludeFlags: ['chemical'],
    excludeZone: /chemical|cleaning suppl/i,
    note: 'Under-bed bays stay for textiles and flat goods; cleaning chemicals do not belong in a sleeping room.',
  },
};

function applyContentRules(plan, archetype) {
  const rule = ARCHETYPE_CONTENT_RULES[archetype];
  if (!rule) return;
  const flags = new Set(rule.excludeFlags || []);
  let removed = false;
  plan.map.forEach(m => {
    const keptItems = (m.items || []).filter(it => !(it.flags || []).some(f => flags.has(f)));
    if (keptItems.length !== (m.items || []).length) removed = true;
    const keptZone = String(m.zone || '').split(' · ').filter(seg => !rule.excludeZone.test(seg));
    if (keptZone.length !== String(m.zone || '').split(' · ').length) removed = true;
    // Never empty a level: if the rule would clear it, keep what is left of
    // the label rather than rendering a blank zone.
    m.items = keptItems.length ? keptItems : (m.items || []);
    m.zone = keptZone.length ? keptZone.join(' · ')
      : (m.items.length ? m.items.map(i => i.name).slice(0, 3).join(' · ') : m.zone);
  });
  if (removed) {
    plan.safetyNotes = plan.safetyNotes || [];
    if (!plan.safetyNotes.includes(rule.note)) plan.safetyNotes.unshift(rule.note);
  }
}

/* A scenario's safety notes and rationales argue from a shelf hierarchy
   ("on the top shelf", "on a lower shelf", "at waist height"). Two archetypes
   have no hierarchy to argue from — a two-bay under-bed drawer and a ceiling
   rack — so those sentences are false there rather than merely imprecise. */
const HEIGHT_ARGUMENT_RE = /\b(?:top|upper|lower|lowest|bottom|middle|eye[- ]level)\s+shelf\b|\bwaist height\b|\bon the floor\b|\bfall from (?:height|above)\b/i;
const NO_HEIGHT_HIERARCHY = new Set(['overhead-rack', 'under-bed']);

function dropHeightArguments(plan, archetype) {
  if (!NO_HEIGHT_HIERARCHY.has(archetype)) return;
  const keep = (t) => String(t || '').split(/(?<=[.!])\s+/).filter(s => !HEIGHT_ARGUMENT_RE.test(s)).join(' ').trim();
  plan.safetyNotes = (plan.safetyNotes || []).filter(n => !HEIGHT_ARGUMENT_RE.test(n));
  plan.opportunities = (plan.opportunities || []).filter(o => !HEIGHT_ARGUMENT_RE.test(o));
  plan.problems = (plan.problems || []).filter(p => !HEIGHT_ARGUMENT_RE.test(p));
  plan.steps = (plan.steps || []).filter(s => !HEIGHT_ARGUMENT_RE.test(s.task))
    .map(s => ({ ...s, why: keep(s.why) || s.why }));
  plan.map.forEach(m => {
    const w = keep(m.why);
    if (w) m.why = w;
    if (m.safety && m.safety.why && HEIGHT_ARGUMENT_RE.test(m.safety.why)) {
      m.safety = { flag: null, why: null };
    }
  });
}

/* ---------- The projection ---------- */

function levelsFor(archetype, setupId, wanted) {
  const template = ARCHETYPE_LEVELS[archetype] || ARCHETYPE_LEVELS.shelves;
  const cap = SETUP_LEVEL_CAP[setupId] || template.length;
  const n = Math.max(1, Math.min(template.length, cap, wanted || template.length));
  // Take the first n slots. Templates run top-to-bottom with the incidental
  // slot last (a cabinet's door rack, a walk-in's floor), so truncating from
  // the end drops the optional level rather than a defining one — a
  // "Built-in + drawers" closet keeps its drawer bank, and a shallow wall
  // cabinet stops filing large items on a door rack it may not have.
  const slots = template.slice(0, n).map(l => ({ ...l }));
  // Exactly one eye-level row is a plan-contract invariant; if truncation
  // removed the template's, promote the most reachable remaining slot.
  if (!slots.some(s => s.eye)) slots[Math.min(1, slots.length - 1)].eye = true;
  return slots;
}

/* Merge the scenario's rows down to `n` buckets, preserving order and never
   leaving a slot empty: a 5-row scenario on a 4-drawer chest must fill all
   four. Every row lands somewhere, so a 5-shelf pantry projected onto a
   2-level overhead rack keeps every category rather than silently losing
   three shelves' worth of the user's things. */
function bucketRows(rows, n) {
  if (rows.length <= n) return rows.map(r => [r]);
  const buckets = Array.from({ length: n }, () => []);
  rows.forEach((row, i) => buckets[Math.floor(i * n / rows.length)].push(row));
  return buckets;
}

function joinUnique(parts, sep) {
  return [...new Set(parts.filter(Boolean))].join(sep);
}

/* Re-project a raw scenario plan onto the structure of the chosen setup.
   Mutates and returns the plan. Safe to call with an unknown archetype. */
export function projectOntoArchetype(plan, archetype, setupId, opts = {}) {
  if (!plan || !Array.isArray(plan.map) || !ARCHETYPE_LEVELS[archetype]) return plan;
  const slots = levelsFor(archetype, setupId, plan.map.length);
  const buckets = bucketRows(plan.map, slots.length);

  plan.map = buckets.map((rows, i) => {
    const slot = slots[i] || slots[slots.length - 1];
    const base = rows[0];
    const merged = rows.length === 1 ? base : {
      ...base,
      zone: joinUnique(rows.flatMap(r => String(r.zone || '').split(' · ')), ' · '),
      // NOT a concatenation of the originals: each was written for the height
      // its row used to sit at, so joining them made a ceiling rack argue
      // that "heavy power tools are safer on lower shelves". One true
      // sentence for the level they have all landed on instead.
      why: ROLE_WHY[slot.role] || base.why,
      items: rows.flatMap(r => r.items || []).slice(0, 6),
      // A hazard flag anywhere in the bucket has to survive the merge.
      safety: rows.map(r => r.safety).find(s => s && s.flag) || base.safety,
    };
    return {
      ...merged,
      level: slot.level,
      icon: slot.icon,
      surface: slot.surface,
      eye: !!slot.eye,
      shelfIndex: i,
    };
  });

  // geometry.shelfCount is the plan contract's "how many levels are there";
  // it must equal the row count or the 3D view and the schema disagree.
  plan.geometry = { ...(plan.geometry || {}), shelfCount: plan.map.length };
  if (Array.isArray(plan.geometry.shelfYFracs) && plan.geometry.shelfYFracs.length !== plan.map.length) {
    delete plan.geometry.shelfYFracs;   // normalizeGeometry regenerates evenly
  }
  plan.layout = { type: archetype };

  // Prose and product needs that name a surface this setup does not have.
  const fix = (t) => rewriteForSurfaces(t, archetype);
  plan.summary = fix(rewriteOpening(plan.summary, describeSetup({
    archetype, setupId, dims: opts.dims, levelCount: plan.map.length,
  })));
  plan.problems = (plan.problems || []).filter(p => !mentionsMissingSurface(p, archetype)).map(fix);
  plan.opportunities = (plan.opportunities || []).filter(o => !mentionsMissingSurface(o, archetype)).map(fix);
  plan.safetyNotes = (plan.safetyNotes || []).filter(n => !mentionsMissingSurface(n, archetype)).map(fix);
  plan.steps = (plan.steps || []).filter(s => !mentionsMissingSurface(s.task, archetype))
    .map(s => ({ ...s, task: fix(s.task), why: fix(s.why) }));
  plan.features = (plan.features || []).filter(f => !mentionsMissingSurface(f.title + ' ' + f.sub, archetype));
  plan.existing = (plan.existing || []).filter(e => !mentionsMissingSurface(e.title + ' ' + e.detail, archetype))
    .map(e => ({ ...e, detail: fix(e.detail) }));
  plan.existingLede = fix(plan.existingLede);
  plan.dontBuy = fix(plan.dontBuy);

  // Order matters: the height-argument sweep would otherwise delete the very
  // note applyContentRules adds, since that note names a height on purpose.
  dropHeightArguments(plan, archetype);
  applyContentRules(plan, archetype);

  plan.productNeeds = (plan.productNeeds || [])
    .filter(p => !mentionsMissingSurface(p.purpose, archetype))
    .filter(p => !(p.type === 'door-rack' && !(ARCHETYPE_SURFACES[archetype] || []).includes('door')))
    .filter(p => !(p.type === 'hook-rack' && !(ARCHETYPE_SURFACES[archetype] || []).includes('pegboard')))
    .map(p => ({ ...p, purpose: fix(p.purpose) }));
  alignTargetZones(plan);

  return plan;
}

/* Every recommended product is shown under "for: <zone>". Several scenarios
   name a zone their own map never had — the kitchen cabinet's door rack was
   filed against "Inside door" on a three-shelf map — so the shopping card
   sent people to a shelf that is not in their plan. Point anything unmatched
   at the eye-level zone. "Every zone" / "Every drawer" mean all of them and
   are left alone. */
export function alignTargetZones(plan) {
  if (!plan || !Array.isArray(plan.map) || !plan.map.length) return plan;
  const levels = new Set(plan.map.map(m => m.level));
  const fallback = (plan.map.find(m => m.eye) || plan.map[0]).level;
  plan.productNeeds = (plan.productNeeds || []).map(p => ({
    ...p,
    targetZone: (!p.targetZone || /^every\b/i.test(p.targetZone) || levels.has(p.targetZone))
      ? p.targetZone : fallback,
  }));
  return plan;
}
