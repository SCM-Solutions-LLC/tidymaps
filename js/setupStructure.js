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

/* Two archetypes serve both shelved spaces and clothes closets, and the
   right level list differs: an L-shaped pantry is six shelves, an L-shaped
   closet is two runs of hanging with a shelf over each. Keyed by the SOURCE
   scenario's archetype so the content decides, not the space id. */
export const ARCHETYPE_LEVELS_FOR_SOURCE = {
  'l-run': {
    'closet-rod': [
      { level: 'Long run: top shelf', icon: 'up', surface: 'shelf', role: 'high' },
      { level: 'Long run: hanging rod', icon: 'rod', surface: 'rod', eye: true, role: 'rod' },
      { level: 'Corner: deep shelf', icon: 'middle', surface: 'shelf', role: 'mid' },
      { level: 'Short run: hanging rod', icon: 'rod', surface: 'rod', role: 'rod' },
      { level: 'Floor / corner', icon: 'down', surface: 'floor', role: 'floor' },
    ],
  },
};

/* Some setups are a smaller instance of their archetype: a tall narrow
   drawer tower is a drawer-bank, but so is a wide dresser, and a rolling
   tool chest has more, shallower drawers than either. Capping the level
   count here keeps the plan honest about how many zones actually exist.

   Only the entries that actually bite are listed: a cap at or above its
   archetype's template length is a no-op, and leaving those in reads as a
   constraint that is doing something. */
export const SETUP_LEVEL_CAP = {
  wallcab: 3, wallcabW: 3, wallshelf: 3, sideboard: 2, openshelf: 4,
};

/* The surfaces each archetype genuinely offers. Prose that names a surface
   the setup does not have is the other half of the bug — a tool chest plan
   telling the user to "hang hand tools on the pegboard", an open-shelving
   plan opening with "Empty the cabinet completely". */
export const ARCHETYPE_SURFACES = {
  'shelves':       ['shelf'],
  'cabinet':       ['shelf', 'door'],
  'l-run':         ['shelf', 'rod', 'floor'],
  // walk-in and L-run each cover pantries AND clothes closets, and a closet
  // hangs things — the surface list gates prose scrubbing, so it has to be
  // permissive enough for every space the archetype serves. Listing only
  // 'shelf' for l-run stripped every rod from L-shaped closets while the
  // steps went on telling the user to hang their work clothes.
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
/* `{n}` / `{ns}` expand to the archetype's OWN primary surface noun. That
   matters twice over: a replacement must never name a surface the setup
   also lacks (pegboard -> "drawer" on a wall cabinet said the user had
   drawers), and because the substituted noun is always a surface the
   archetype HAS, no later rule — which only fire for surfaces it LACKS —
   can match it. That is what stopped the rules cascading into each other
   and turning "The pegboard, shelf, and drawers already cover every zone"
   into "The shelf, shelf, and drawers…". */
const PRIMARY_NOUN = {
  'shelves': 'shelf', 'cabinet': 'shelf', 'l-run': 'shelf', 'walkin-u': 'shelf',
  'closet-rod': 'shelf', 'closet-system': 'shelf', 'drawer-bank': 'drawer',
  'under-bed': 'drawer', 'under-sink': 'drawer', 'counter': 'shelf',
  'garage-rack': 'shelf', 'overhead-rack': 'rack deck', 'workbench': 'bench',
  'fridge': 'shelf',
};

const PLURAL_NOUN = { shelf: 'shelves', drawer: 'drawers', bench: 'benches', 'rack deck': 'rack decks' };

const SURFACE_PHRASES = [
  ['pegboard', [
    [/\bon the pegboard\b/gi, 'on the {n}'],
    [/\bpegboard wall\b/gi, '{n}'],
    [/\bpegboard\b/gi, '{n}'],
  ]],
  ['worktop', [
    [/\bthe bench surface\b/gi, 'the {n}'],
    [/\bbench surface\b/gi, '{n}'],
    [/\bon the bench\b/gi, 'on the {n}'],
    [/\bthe counter\b/gi, 'the {n}'],
  ]],
  ['door', [
    // Longest first: "the door back" must not become "the front edge back".
    [/\bthe (?:back of the door|door back)\b/gi, 'the wall beside it'],
    [/\bon the (?:back of the )?door\b/gi, 'on the wall beside it'],
    [/\bthe (?:inside of the )?door\b/gi, 'the front edge'],
    [/\bdoor rack\b/gi, 'front {n}'],
    [/\bdoor-mounted\b/gi, 'front-facing'],
  ]],
  ['floor', [
    // Qualified forms first — "the cabinet floor" never matched "the floor",
    // so a wall shelf kept advising items "sit stable on the cabinet floor".
    [/\bthe (?:cabinet|closet|pantry|unit) floor\b/gi, 'the lowest level'],
    /* Only where the floor is being used as a STORAGE level. "Sweep the
       floor before you start" and "art happens at the table, not on the
       floor" are about the room, are true whatever the setup is, and became
       "sweep the lowest level" under a blanket rule. */
    [/\b(\w+)(\s+(?:up |out )?(?:on|onto|to) the floor)\b/gi,
      (m, verb, tail) => (/^(?:sweep|sweeps|vacuum|mop|clean|cleans|happens|happen|play|plays|spill|spills|fall|falls|drop|drops)$/i.test(verb)
        ? m : `${verb}${tail.replace(/the floor$/, 'the lowest level')}`)],
    [/\bfloor level\b/gi, 'lowest level'],
  ]],
  ['rod', [
    [/\bthe hanging rods\b/gi, 'the {ns}'],
    [/\bthe (?:hanging )?rod\b/gi, 'the {n}'],
    [/\bhanging rod\b/gi, '{n}'],
  ]],
  ['drawer', [
    // Number has to survive the swap: "the drawers are jammed shut" became
    // "the shelf are jammed shut".
    [/\bthe drawers\b/gi, 'the {ns}'],
    [/\bthe drawer\b/gi, 'the {n}'],
  ]],
];

/* A step or line that is ABOUT a surface the setup lacks cannot be reworded
   into something true — it has to go. */
const SURFACE_ONLY_LINES = {
  pegboard: /pegboard/i,
  worktop: /\bbench\b|\bcountertop\b/i,
  door: /\bdoor (?:rack|shelf|storage)\b|over-the-door/i,
  rod: /\bhanging rod\b|\bhang(?:ing)? (?:clothes|shirts|items) on\b/i,
  // "Label every drawer" on a wall cabinet, "an under-sink cabinet" on open
  // wall shelves — the sentence is about a fitting the setup does not have,
  // and no wording makes it true. "Junk drawer" is idiomatic, so the
  // patterns are anchored to determiners rather than the bare noun.
  drawer: /\bdrawer (?:divider|organizer|liner)s?\b|\b(?:every|each) drawer\b|\bunder-sink\b/i,
  floor: /\bfloor (?:bin|zone|space|pile)\b/i,
  shelf: /\b(?:upper|top|lower|middle) shelf\b/i,
};

export function rewriteForSurfaces(text, archetype) {
  if (!text) return text;
  const have = new Set(ARCHETYPE_SURFACES[archetype] || []);
  let out = String(text);
  for (const [surface, rules] of SURFACE_PHRASES) {
    if (have.has(surface)) continue;
    for (const [re, to] of rules) {
      // Every replacement is written lowercase, so a match that opened a
      // sentence used to lowercase it: "The counter is cluttered." became
      // "the counter…". Carry the matched text's own capitalization across.
      // A rule may also supply a function when it needs to inspect context.
      out = out.replace(re, (...args) => {
        const match = args[0];
        const raw = typeof to === 'function' ? to(...args) : to;
        if (raw === match) return match;
        const noun = PRIMARY_NOUN[archetype] || 'shelf';
        const plural = PLURAL_NOUN[noun] || noun + 's';
        const replacement = raw.replace(/\{ns\}/g, plural).replace(/\{n\}/g, noun);
        return /^[A-Z]/.test(match) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
      });
    }
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

/* Every prose field on a plan, reworded or dropped so nothing describes a
   fitting this setup does not have.

   This used to live inline inside projectOntoArchetype, which meant it ran in
   the middle of building a plan — and everything added afterwards (applyGoal,
   applyHousehold, applyAnswers, applyDims, the preference handlers) sailed
   straight past it. That is how a rolling tool chest with no wall behind it
   was told to "outline each tool on the pegboard", and how drawer setups were
   told "your shelves are 18″ deep". It also never ran at all for the setups
   whose archetype already matches their scenario's, since the projection is
   skipped there entirely.

   As a named pass it can run last, over the finished plan, where nothing can
   get added behind it. Patching the four known injection sites would have held
   only until someone added a fifth. */
export function scrubSurfaceProse(plan, archetype) {
  if (!plan || !archetype) return plan;
  const fix = (t) => rewriteForSurfaces(t, archetype);
  const drop = (t) => mentionsMissingSurface(t, archetype);

  /* The summary is a paragraph, so it gets sentence-level treatment: the whole
     thing can't be dropped for one bad clause, and rewording alone was not
     enough. Its opening is already rebuilt honestly by rewriteOpening, but the
     sentences after it come from the scenario and can describe another setup
     entirely — bathroom wall shelves were introduced correctly and then
     described as "an under-sink vanity cabinet plus two shallow drawers". */
  if (plan.summary) {
    const kept = String(plan.summary)
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => !drop(sentence))
      .map(fix);
    plan.summary = kept.join(' ').replace(/\s{2,}/g, ' ').trim();
  }
  plan.problems = (plan.problems || []).filter(p => !drop(p)).map(fix);
  plan.opportunities = (plan.opportunities || []).filter(o => !drop(o)).map(fix);
  plan.safetyNotes = (plan.safetyNotes || []).filter(n => !drop(n)).map(fix);
  plan.steps = (plan.steps || []).filter(s => !drop(s.task))
    .map(s => ({ ...s, task: fix(s.task), why: fix(s.why) }));
  // Titles need the rewrite too, not just the bodies: "Cabinet height" on a
  // wall shelf and "5 metal shelves" on a two-deck rack are both title text.
  plan.features = (plan.features || []).filter(f => !drop(f.title + ' ' + f.sub))
    .map(f => ({ ...f, title: fix(f.title), sub: fix(f.sub) }));
  plan.existing = (plan.existing || []).filter(e => !drop(e.title + ' ' + e.detail))
    .map(e => ({ ...e, title: fix(e.title), detail: fix(e.detail) }));
  /* A sentence that ENUMERATES surfaces cannot be reworded into a true one —
     "The pegboard, shelf, and drawers already cover every zone" rewrites to
     "The shelf, shelf, and drawers…" whatever the replacement noun is. Gate
     these the same way steps and safety notes already are; the report shows a
     space-neutral line when the lede is empty and hides the callout when the
     don't-buy note is. */
  plan.existingLede = drop(plan.existingLede) ? '' : fix(plan.existingLede);
  plan.dontBuy = drop(plan.dontBuy) ? '' : fix(plan.dontBuy);
  // Product purposes name surfaces too ("sort screws into the drawer").
  plan.productNeeds = (plan.productNeeds || []).map(n => ({ ...n, purpose: fix(n.purpose) }));
  return plan;
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
/* "has one shelves" — a level count of 1 is reachable once the content rules
   drop an emptied level, so the noun needs a singular. */
const LEVEL_NOUN_ONE = {
  shelves: 'shelf', drawers: 'drawer', bays: 'bay', zones: 'zone',
  'deck halves': 'deck half',
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
  if (!entry) return '';
  const [name, plural] = entry;
  /* No measurements (a restored space that never had them, the landing
     sample). The hardcoded "A 48-inch-wide unit…" must still go — it is a
     claim about someone else's furniture either way — so describe the setup
     without a size rather than leaving the false sentence in place. */
  if (!dims || !dims.w_in || !dims.h_in) {
    const many = LEVEL_NOUN[archetype] || 'shelves';
    const n = levelCount === 1 ? (LEVEL_NOUN_ONE[many] || many) : many;
    return `Your ${name} ${plural ? 'have' : 'has'} ${COUNT_WORDS[levelCount] || levelCount} ${n} to work with.`;
  }
  const many = LEVEL_NOUN[archetype] || 'shelves';
  const noun = levelCount === 1 ? (LEVEL_NOUN_ONE[many] || many) : many;
  const count = COUNT_WORDS[levelCount] || String(levelCount);
  const size = ROOMY_ARCHETYPES.has(archetype) && dims.d_in
    ? `${ft(dims.w_in)} × ${ft(dims.d_in)} and ${ft(dims.h_in)} tall`
    : `${ft(dims.w_in)} wide and ${ft(dims.h_in)} tall`;
  return `Your ${name}, measured at ${size}, ${plural ? 'have' : 'has'} ${count} ${noun} to work with.`;
}

/* Swap the scenario's leading furniture claim for the measured one, keeping
   every sentence after it. */
/* Replace the leading sentence only when it is in fact a claim about the
   furniture's size or shelf count — that is the sentence the measurements
   contradict. Anything else is diagnosis the user needs, so the measured
   sentence goes in front of it instead of over it. */
const FURNITURE_CLAIM_RE = /\b\d+[- ]?inch|\bfoot\b|\bfeet\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)[- ](?:shelf|shelves|drawer|drawers|level|levels|tier)\b|\b\d+\s*(?:shelves|shelf|drawers|drawer|levels)\b/i;

export function rewriteOpening(summary, opening) {
  if (!opening) return summary;
  const sentences = String(summary || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) return opening;
  const replaceable = FURNITURE_CLAIM_RE.test(sentences[0]);
  const rest = (replaceable ? sentences.slice(1) : sentences).join(' ').trim();
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

const HAZARD_FLAGS = ['heavy', 'chemical', 'sharp'];

function applyContentRules(plan, archetype) {
  const rule = ARCHETYPE_CONTENT_RULES[archetype];
  if (!rule) return;
  const flags = new Set(rule.excludeFlags || []);
  let removed = false;
  plan.map.forEach(m => {
    const before = (m.items || []).length;
    const keptItems = (m.items || []).filter(it => !(it.flags || []).some(f => flags.has(f)));
    const segs = String(m.zone || '').split(' · ').filter(Boolean);
    const keptZone = segs.filter(seg => !rule.excludeZone.test(seg));
    if (keptItems.length !== before || keptZone.length !== segs.length) removed = true;
    /* Never re-admit what the rule just excluded. The old fallback restored
       the original list whenever a level came out empty, so a rack whose
       every item was hazardous got all of them back — under a note saying
       they do not belong there. An empty level is dropped instead. */
    m.items = keptItems;
    m.zone = keptZone.length ? keptZone.join(' · ')
      : keptItems.map(i => i.name).slice(0, 3).join(' · ');
    /* The flag existed because of the items that just left. Leaving it puts
       a "keep high" badge on holiday decorations. */
    if (m.safety && m.safety.flag && !keptItems.some(it => (it.flags || []).some(f => HAZARD_FLAGS.includes(f)))) {
      m.safety = { flag: null, why: null };
    }
  });
  // A level with nothing left in it is not a level.
  plan.map = plan.map.filter(m => m.zone && m.zone.trim() && (m.items || []).length);
  plan.map.forEach((m, i) => { m.shelfIndex = i; });
  if (!plan.map.some(m => m.eye) && plan.map.length) plan.map[0].eye = true;
  plan.geometry = { ...(plan.geometry || {}), shelfCount: plan.map.length };
  // The category chips render from plan.categories, so leaving the excluded
  // ones there put "Chemicals & paint" back on a ceiling-rack plan — and
  // applyCategoryEdits would have re-seeded them into a zone.
  plan.categories = (plan.categories || []).filter(c => !rule.excludeZone.test(c));
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
    /* Rewrite the reason, never drop the flag. Nulling safety here threw
       away the hazard marker the bucket merge had gone out of its way to
       carry across — the sentence was stale, the hazard was not. */
    if (m.safety && m.safety.why && HEIGHT_ARGUMENT_RE.test(m.safety.why)) {
      const kept = keep(m.safety.why);
      m.safety = { ...m.safety, why: kept || 'Keep this zone out of easy reach.' };
    }
  });
}

/* ---------- The projection ---------- */

function levelsFor(archetype, setupId, sourceArchetype) {
  const bySource = ARCHETYPE_LEVELS_FOR_SOURCE[archetype];
  const template = (bySource && bySource[sourceArchetype])
    || ARCHETYPE_LEVELS[archetype] || ARCHETYPE_LEVELS.shelves;
  const cap = SETUP_LEVEL_CAP[setupId] || template.length;
  // NOT clamped by the scenario's row count. Clipping to it deleted the
  // levels that define the setup: a "Counter + uppers" run took its three
  // rows from the cabinet scenario and lost both its drawers and its lower
  // cabinet, on a card that says "Cabinets above and below a counter".
  const n = Math.max(1, Math.min(template.length, cap));
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
/* Returns [{ slot, rows }] for the slots that ended up with content, so the
   slot a bucket belongs to can never drift from its index. */
function bucketRows(rows, slots) {
  const n = slots.length;
  const pair = (buckets) => buckets
    .map((b, i) => ({ slot: slots[i], rows: b }))
    .filter(x => x.rows && x.rows.length);
  /* When the source rows carry more than one kind of surface, WHICH slot a
     row lands on matters more than its position: an L-shaped closet's rod
     slots must get the rows that were hanging, or the plan files work shirts
     on a corner shelf and out-of-season coats on the rail. */
  const sourceSurfaces = new Set(rows.map(r => r.surface).filter(Boolean));
  const targetSurfaces = new Set(slots.map(s => s.surface));
  if (sourceSurfaces.size > 1 && targetSurfaces.size > 1) return pair(alignBySurface(rows, slots));

  if (rows.length === n) return pair(rows.map(r => [r]));
  if (rows.length > n) {
    const buckets = Array.from({ length: n }, () => []);
    rows.forEach((row, i) => buckets[Math.floor(i * n / rows.length)].push(row));
    return pair(buckets);
  }
  return pair(splitRows(rows, n).map(r => [r]));
}

/* Greedy surface-first assignment, preserving source order within a surface. */
function alignBySurface(rows, slots) {
  const pool = rows.map((r, i) => ({ r, i, used: false }));
  const buckets = slots.map(() => []);
  const takeFirst = (pred) => {
    const e = pool.find(x => !x.used && pred(x));
    if (e) { e.used = true; return e.r; }
    return null;
  };
  // 1. exact surface match, in order
  slots.forEach((slot, s) => {
    const row = takeFirst(x => x.r.surface === slot.surface);
    if (row) buckets[s].push(row);
  });
  // 2. anything still unplaced fills the still-empty slots, in order
  slots.forEach((slot, s) => {
    if (buckets[s].length) return;
    const row = takeFirst(() => true);
    if (row) buckets[s].push(row);
  });
  // 3. leftovers merge into the nearest slot that already shares their surface
  pool.filter(x => !x.used).forEach(x => {
    let target = buckets.findIndex((b, s) => b.length && slots[s].surface === x.r.surface);
    if (target < 0) target = buckets.findIndex(b => b.length);
    if (target < 0) target = 0;
    buckets[target].push(x.r);
    x.used = true;
  });
  /* 4. An empty slot borrows from whichever bucket can spare content —
     same surface first, then any splittable one. Restricting donors to a
     matching surface starved the slots that define the setup: a "Built-in +
     drawers" closet has no drawer row to inherit from, so its drawer bank
     came out empty on the one card that advertises it. */
  const splittable = (c) => c.length === 1 && (c[0].items || []).length > 1
    && String(c[0].zone || '').split(' · ').length > 1;
  buckets.forEach((b, s) => {
    if (b.length) return;
    let donor = buckets.findIndex((c, j) => splittable(c) && slots[j].surface === slots[s].surface);
    if (donor < 0) {
      // the fullest splittable bucket, so the busiest level sheds first
      donor = buckets.reduce((best, c, j) => (splittable(c)
        && (best < 0 || (c[0].items || []).length > (buckets[best][0].items || []).length)) ? j : best, -1);
    }
    if (donor < 0) return;
    const [head, tail] = splitRows(buckets[donor], 2);
    if (!head || !tail) return;
    buckets[donor] = [head];
    buckets[s] = [tail];
  });
  return buckets;
}

/* Fewer scenario rows than the setup has levels. Rather than leave the
   defining levels empty (a counter run with no drawers and no lower
   cabinet), split the fullest rows until every level has something. A row
   with one item cannot be split, so this stops when nothing is divisible —
   fewer, honest levels beat invented ones. */
function splitRows(rows, n) {
  const out = rows.map(r => ({ ...r, items: [...(r.items || [])] }));
  const segsOf = (r) => String(r.zone || '').split(' · ').filter(Boolean);
  while (out.length < n) {
    let best = -1, bestScore = 1;
    out.forEach((r, i) => {
      const score = Math.min(segsOf(r).length, (r.items || []).length);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    if (best < 0) break;
    const row = out[best];
    const segs = segsOf(row), items = row.items || [];
    const sMid = Math.ceil(segs.length / 2), iMid = Math.ceil(items.length / 2);
    const head = { ...row, zone: segs.slice(0, sMid).join(' · '), items: items.slice(0, iMid) };
    const tail = { ...row, zone: segs.slice(sMid).join(' · '), items: items.slice(iMid),
      // A hazard flag belongs with the items that earned it; keep it on the
      // half that still holds a flagged item.
      safety: items.slice(iMid).some(it => (it.flags || []).some(f => ['heavy', 'chemical', 'sharp'].includes(f)))
        ? row.safety : { flag: null, why: null } };
    if (!head.zone || !tail.zone || !head.items.length || !tail.items.length) break;
    out.splice(best, 1, head, tail);
  }
  return out;
}

/* How much a single merged level may advertise. Beyond this a zone reads as
   a dumping list rather than a plan, and the shelf drawing runs out of room. */
const MERGED_MAX = 6;

function joinUnique(parts, sep) {
  return [...new Set(parts.filter(Boolean))].join(sep);
}

/* Re-project a raw scenario plan onto the structure of the chosen setup.
   Mutates and returns the plan. Safe to call with an unknown archetype. */
export function projectOntoArchetype(plan, archetype, setupId, opts = {}) {
  if (!plan || !Array.isArray(plan.map) || !ARCHETYPE_LEVELS[archetype]) return plan;
  const rewrite = (t) => rewriteForSurfaces(t, archetype);
  const slots = levelsFor(archetype, setupId, opts.sourceArchetype);
  const buckets = bucketRows(plan.map, slots);

  plan.map = buckets.map(({ slot, rows }, i) => {
    const base = rows[0];
    const merged = rows.length === 1 ? base : {
      ...base,
      // Label and item list are capped together. Capping only `items` left
      // the zone advertising nine categories over six things, so the shelf
      // map and the 3D view disagreed about what is on the level.
      zone: joinUnique(rows.flatMap(r => String(r.zone || '').split(' · ')), ' · ')
        .split(' · ').slice(0, MERGED_MAX).join(' · '),
      // NOT a concatenation of the originals: each was written for the height
      // its row used to sit at, so joining them made a ceiling rack argue
      // that "heavy power tools are safer on lower shelves". One true
      // sentence for the level they have all landed on instead.
      why: ROLE_WHY[slot.role] || base.why,
      items: rows.flatMap(r => r.items || []).slice(0, MERGED_MAX),
      // A hazard flag anywhere in the bucket has to survive the merge.
      safety: rows.map(r => r.safety).find(s => s && s.flag) || base.safety,
    };
    return {
      ...merged,
      // Rows that pass through 1:1 need the surface scrub too — they were the
      // one field it never reached, so a wall shelf kept a rationale about
      // items sitting "on the cabinet floor".
      zone: rewrite(merged.zone),
      /* A rationale ABOUT a fitting the setup lacks cannot be reworded into
         a true one — "The bench is a work area, not storage" on a rolling
         tool chest. Merged rows already fall back to the level's own reason;
         unmerged ones need the same escape hatch. */
      why: mentionsMissingSurface(merged.why, archetype)
        ? (ROLE_WHY[slot.role] || rewrite(merged.why))
        : rewrite(merged.why),
      safety: merged.safety && merged.safety.why
        ? { ...merged.safety, why: rewrite(merged.safety.why) } : merged.safety,
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
  plan.summary = rewriteForSurfaces(rewriteOpening(plan.summary, describeSetup({
    archetype, setupId, dims: opts.dims, levelCount: plan.map.length,
  })), archetype);
  scrubSurfaceProse(plan, archetype);

  // Order matters: the height-argument sweep would otherwise delete the very
  // note applyContentRules adds, since that note names a height on purpose.
  dropHeightArguments(plan, archetype);
  applyContentRules(plan, archetype);

  plan.productNeeds = (plan.productNeeds || [])
    .filter(p => !mentionsMissingSurface(p.purpose, archetype))
    .filter(p => !(p.type === 'door-rack' && !(ARCHETYPE_SURFACES[archetype] || []).includes('door')))
    .filter(p => !(p.type === 'hook-rack' && !(ARCHETYPE_SURFACES[archetype] || []).includes('pegboard')))
    .map(p => ({ ...p, purpose: rewriteForSurfaces(p.purpose, archetype) }));
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
  const eye = (plan.map.find(m => m.eye) || plan.map[0]).level;
  /* Prefer a level that shares a word with the old target ("Top shelf" ->
     "Rack deck: front half" is a worse answer than "Top drawer" when one
     exists). Pointing every unmatched need at the eye zone piled them all
     onto one level, which the 3D view then renders as a single stack. */
  const relocate = (want) => {
    const words = String(want).toLowerCase().match(/[a-z]+/g) || [];
    const scored = plan.map.map(m => {
      const have = String(m.level).toLowerCase();
      return { level: m.level, score: words.filter(w => w.length >= 3 && have.includes(w)).length };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    return scored.length ? scored[0].level : eye;
  };
  plan.productNeeds = (plan.productNeeds || []).map(p => ({
    ...p,
    targetZone: (!p.targetZone || /^every\b/i.test(p.targetZone) || levels.has(p.targetZone))
      ? p.targetZone : relocate(p.targetZone),
  }));
  return plan;
}
