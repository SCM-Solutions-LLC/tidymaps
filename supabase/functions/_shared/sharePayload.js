// Sanitizer for publicly shared plans. A share link is read-only and holds
// only what a housemate needs to see the plan: the space, the zones, the
// steps, the summary. Everything personal stays out — household composition,
// progress, shopping selections, and any media paths (photos require signed
// URLs and consent; a share link must never leak them). Shared between the
// Deno edge function and the Node test suite so the allowlist is verified.
//
// The allowlist alone did not deliver what the app promises. It strips the
// household COLUMN, and the UI reads that as "not your photos or details" —
// but the plan itself is written from the household, on purpose. The analysis
// prompt asks the model to name a child's age in safety.why ("out of reach of
// your 3-year-old"), to name the pet type the user gave rather than saying
// "pets", to place daily items for a stated reach limitation, and to answer
// the household's free-text note somewhere the user will see it. Offline is
// worse than the model: applyNote() in js/personalize.js quotes the note back
// verbatim into `opportunities`, so a shared plan carried the sentence itself.
// Every one of those fields was on the allowlist, so "household details never
// travel" was true of one column and false of the plan.
//
// So a shared plan is built rather than filtered, in two passes that fail
// differently:
//
//   1. Structural. The fields whose PURPOSE is to carry household context come
//      off the allowlist and out of the rows: safetyNotes (the schema calls
//      them "household-specific placement notes"), map[].safety (flag and why
//      both — the flag alone says a child lives here), steps[].cite (the
//      owner's own answers, quoted at them), and the kid-frequent item flag.
//      The PLACEMENTS stay: the plan still puts the bleach up high, it just
//      no longer says who it is being kept away from.
//
//   2. Verified. Everything that survives is checked against THIS household's
//      own stored values — the ages and pet types they picked, the reach needs
//      they ticked, the words of the note they typed — and any sentence that
//      still matches is dropped. This is a closed-set check, not a guess at
//      what personal data looks like: the row tells us exactly what to look
//      for. It is what catches the offline note leak, and it is the backstop
//      for a model that mentions the toddler somewhere the prompt told it not
//      to.
//
// Pass 2 runs at READ time rather than when the link is minted, so every link
// already out in the world is covered by it from the moment this ships.

// Field allowlist for the plan JSON itself. The stored plan can carry extra
// keys over time; an allowlist means new private fields default to EXCLUDED.
const PLAN_FIELDS = [
  'spaceType', 'summary', 'problems', 'opportunities',
  'map', 'geometry', 'layout', 'features', 'steps', 'cats',
  'existingLede', 'existing', 'dontBuy', 'cost', 'time',
  /* Whether anything actually looked at the space. Left off the allowlist, it
     defaulted to true on the way in (normalizeAi reads `observed !== false`),
     so a plan the owner sees headed "What usually goes wrong in a space like
     this" reached the visitor as "Main organization problems" — the scoping
     stripped by the act of sharing, and the guesses presented as findings. */
  'observed',
  /* Deliberately NOT here: `safetyNotes`. They are the plan's household
     section — "based on what you told us about kids, pets, and reach", as the
     report's own heading puts it — and the visitor is told, in a line that
     does not depend on whether this plan had any, that shared plans leave
     them out. */
];

/* Per-row and per-step fields that are household context by construction. The
   values are not inspected; the keys never reach a visitor. */
const ROW_PRIVATE = ['safety'];
const STEP_PRIVATE = ['cite'];
// Item flags describe the OBJECT (heavy, chemical, sharp, fragile) — except
// this one, which describes who uses it.
const PRIVATE_ITEM_FLAG = 'kid-frequent';

/* ---------- what a shared plan may not say ----------

   The terms below are built from the household the row actually stores, so a
   plan for a household with no pets has no pet pattern to match and loses
   nothing. Two consequences worth naming:

   - A household that listed a cat loses any sentence that says "cat", even
     one describing cat food seen on a shelf. That is the safe direction to
     err in, it only affects the shared copy, and the owner's own report is
     untouched.
   - A model that paraphrases the note instead of quoting it can still get
     something through. Nothing here can catch that, which is exactly why the
     containers built to hold household context are dropped whole rather than
     scanned.  */

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w) => new RegExp(`\\b${escapeRe(w)}(?:'s|s|es)?\\b`, 'i');
const phraseRe = (p) => new RegExp(`\\b${escapeRe(String(p).trim()).replace(/\s+/g, '\\s+')}\\b`, 'i');

/* Any stated age is a fact about a person, whatever this household answered,
   so this one is unconditional. The prompt asks for it in those words. */
const AGE_MENTION = /\b\d{1,3}\s*[-–]?\s*(?:year|yr|month|mo)s?\s*[-–]?\s*old\b/i;

// Words for a child young enough that naming one describes the household.
const CHILD_WORDS = ['baby', 'infant', 'newborn', 'toddler', 'preschooler', 'teenager'];
// A pet "type" that names no animal: matching it would redact ordinary prose.
const UNNAMED_PET = new Set(['other', 'others', 'none', '']);
/* Note words common enough to appear in a plan about anything. A note is
   mostly ordinary words plus one or two that identify it; those are what this
   leaves behind.

   Two lists in one, and the second is the one that needs care. Ordinary
   English is easy. Domain vocabulary is the trap: "keep the top shelf clear
   for the vacuum" is identified by "vacuum", and treating "clear" as
   identifying redacts "Clear the top shelf" out of every plan this household
   shares. A word this app writes in its own plans cannot identify a person.

   The list is calibrated to fail toward removing too much rather than too
   little: everything here only affects the SHARED copy, and the owner's own
   report is never touched, so a lost sentence costs a housemate a detail
   while a kept one costs the owner a promise. */
const NOTE_COMMON = new Set([
  'about', 'above', 'after', 'again', 'also', 'always', 'another', 'around', 'because', 'been',
  'before', 'being', 'below', 'both', 'came', 'come', 'could', 'daily', 'does', 'done', 'down',
  'each', 'else', 'even', 'ever', 'every', 'from', 'gets', 'give', 'goes', 'going', 'have',
  'here', 'into', 'just', 'know', 'like', 'little', 'lots', 'made', 'make', 'many', 'more',
  'most', 'much', 'must', 'need', 'needs', 'never', 'often', 'once', 'only', 'onto', 'over',
  'please', 'really', 'same', 'says', 'some', 'sometimes', 'soon', 'such', 'take', 'than',
  'that', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'time', 'under', 'until',
  'used', 'uses', 'using', 'very', 'want', 'well', 'were', 'what', 'when', 'where', 'which',
  'while', 'will', 'with', 'within', 'without', 'would', 'your',
  /* The app's own subject matter. Everything below appears in plans this app
     writes, so none of it can single out the household that typed it. */
  'area', 'back', 'basket', 'baskets', 'bins', 'bottle', 'bottles', 'bottom', 'boxes', 'bulk',
  'cabinet', 'cabinets', 'clean', 'cleaning', 'clear', 'closet', 'clutter', 'container',
  'containers', 'corner', 'deep', 'door', 'doors', 'drawer', 'drawers', 'easy', 'empty', 'extra',
  'floor', 'food', 'front', 'full', 'garage', 'group', 'hang', 'hanging', 'hard', 'high', 'hold',
  'holds', 'home', 'hook', 'hooks', 'house', 'item', 'items', 'jars', 'keep', 'kept', 'kitchen',
  'label', 'labels', 'large', 'laundry', 'left', 'level', 'levels', 'lower', 'middle', 'move',
  'moved', 'near', 'next', 'open', 'pantry', 'pile', 'piles', 'place', 'rack', 'racks', 'reach',
  'reachable', 'right', 'room', 'shelf', 'shelves', 'side', 'sides', 'small', 'sort', 'space',
  'spare', 'spot', 'stack', 'stacked', 'storage', 'store', 'stored', 'stuff', 'tall', 'thing',
  'things', 'tidy', 'wall', 'walls', 'wide', 'zone', 'zones',
]);

function noteTerms(notes) {
  const words = String(notes || '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
  const out = [];
  for (const w of words) {
    if (NOTE_COMMON.has(w) || out.includes(w)) continue;
    out.push(w);
  }
  // A note long enough to be a paragraph would otherwise redact half a plan.
  return out.slice(0, 24);
}

/* The household as the row stores it, turned into the set of things a shared
   plan may not say. Exported so a test can read the rules directly rather
   than inferring them from redacted output. */
export function householdPatterns(household) {
  const h = (household && typeof household === 'object') ? household : {};
  const kids = (h.kids && typeof h.kids === 'object') ? h.kids : {};
  const pets = (h.pets && typeof h.pets === 'object') ? h.pets : {};
  const patterns = [AGE_MENTION];

  /* `present` is the canonical 'yes'/'no' string (see docs/HANDOFF.md), but a
     row can predate that and a count is just as good an answer. */
  const kidsPresent = kids.present === 'yes' || kids.present === true
    || Number(h.kidCount) > 0 || (Array.isArray(kids.ages) && kids.ages.length > 0);
  if (kidsPresent) {
    for (const w of CHILD_WORDS) patterns.push(wordRe(w));
    // 'Baby', 'Toddler', 'Big kid', 'Teen' — the wizard's own words, and
    // "Big kid" is a phrase rather than a word.
    for (const age of kids.ages || []) if (age) patterns.push(phraseRe(age));
  }

  for (const type of pets.types || []) {
    const t = String(type || '').trim();
    if (!t || UNNAMED_PET.has(t.toLowerCase())) continue;
    patterns.push(wordRe(t));
  }

  const mobility = (h.mobility || []).filter(Boolean);
  for (const need of mobility) patterns.push(phraseRe(need));
  if (mobility.length) {
    // The words a plan reaches for when it explains the accommodation.
    patterns.push(wordRe('wheelchair'), wordRe('mobility'));
  }

  for (const w of noteTerms(h.notes)) patterns.push(wordRe(w));
  return patterns;
}

const says = (patterns, text) => {
  const s = String(text || '');
  return !!s && patterns.some((re) => re.test(s));
};

/* Sentence-level, so one household aside does not take a whole summary with
   it. Returns '' when every sentence went, which the callers below treat as
   "this field has nothing left to say" rather than writing a placeholder. */
function redactText(patterns, text) {
  if (typeof text !== 'string' || !text) return text;
  if (!says(patterns, text)) return text;
  const kept = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !says(patterns, sentence))
    .join(' ')
    .trim();
  return kept;
}

// A zone is a list of things ("Snacks · Cat food · Spices"), so it loses the
// entry that named the household, not the whole label.
function redactList(patterns, value, separator) {
  if (typeof value !== 'string' || !value) return value;
  if (!says(patterns, value)) return value;
  return value.split(separator)
    .map((part) => part.trim())
    .filter((part) => part && !says(patterns, part))
    .join(' · ');
}

const redactStrings = (patterns, arr) => (Array.isArray(arr)
  ? arr.filter((entry) => !(typeof entry === 'string' && says(patterns, entry)))
  : arr);

/* Both plan shapes reach this. The stored plan is normalized (steps are
   {t,m,w}, rows are {lv,zone,why}), but a row written by an older build — or
   read straight off the model in a test — carries the contract's own names
   (task/why, level/zone), and a sanitizer that knew only one of them would
   pass the other through untouched. */
const TEXT_KEYS = {
  step: ['t', 'task', 'w', 'why', 'm', 'time'],
  row: ['lv', 'level', 'why'],
  feature: ['ttl', 'title', 'sub', 'ft', 'fd'],
};

// Rewrites a field only when it is there, so a plan without a summary does
// not come out of here carrying an explicit `summary: undefined`.
function inPlace(obj, key, fn) {
  if (obj[key] !== undefined) obj[key] = fn(obj[key]);
}

function redactPlan(patterns, plan) {
  const out = { ...plan };

  inPlace(out, 'summary', (v) => redactText(patterns, v));
  inPlace(out, 'existingLede', (v) => redactText(patterns, v));
  inPlace(out, 'dontBuy', (v) => (Array.isArray(v) ? redactStrings(patterns, v) : redactText(patterns, v)));
  inPlace(out, 'problems', (v) => redactStrings(patterns, v));
  inPlace(out, 'opportunities', (v) => redactStrings(patterns, v));
  inPlace(out, 'cats', (v) => redactStrings(patterns, v));

  if (Array.isArray(out.steps)) {
    out.steps = out.steps.map((step) => {
      if (!step || typeof step !== 'object') return step;
      const s = { ...step };
      for (const k of TEXT_KEYS.step) if (typeof s[k] === 'string') s[k] = redactText(patterns, s[k]);
      return s;
      // A step whose instruction was entirely about the household keeps its
      // place in the sequence with nothing to say. Removing it instead would
      // renumber every step after it, and the plan the owner is following.
    });
  }

  if (Array.isArray(out.map)) {
    out.map = out.map.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const r = { ...row };
      for (const k of TEXT_KEYS.row) if (typeof r[k] === 'string') r[k] = redactText(patterns, r[k]);
      r.zone = redactList(patterns, r.zone, /[·•,;]|\s\/\s/);
      if (Array.isArray(r.items)) {
        r.items = r.items.filter((item) => !says(patterns, item && item.name));
      }
      return r;
    });
  }

  for (const key of ['features', 'existing']) {
    if (!Array.isArray(out[key])) continue;
    out[key] = out[key].map((entry) => {
      if (typeof entry === 'string') return redactText(patterns, entry);
      if (!entry || typeof entry !== 'object') return entry;
      const e = { ...entry };
      for (const k of TEXT_KEYS.feature) if (typeof e[k] === 'string') e[k] = redactText(patterns, e[k]);
      return e;
    }).filter((entry) => entry !== '');
  }

  // The only prose the layout carries is its section names ("Left wall"), and
  // they are the drawing's labels — but they are model-written text like the
  // rest, so they are checked like the rest rather than trusted for being short.
  if (out.layout && typeof out.layout === 'object' && Array.isArray(out.layout.sections)) {
    out.layout = {
      ...out.layout,
      sections: out.layout.sections.map((section) => (section && typeof section === 'object'
        && typeof section.label === 'string'
        ? { ...section, label: redactText(patterns, section.label) }
        : section)),
    };
  }

  return out;
}

/* The structural pass: allowlist the plan's fields, then drop the ones inside
   map rows and steps that exist to carry household context. */
function sharedPlanShape(plan) {
  const out = {};
  for (const k of PLAN_FIELDS) {
    if (plan[k] !== undefined) out[k] = plan[k];
  }
  if (Array.isArray(out.map)) {
    out.map = out.map.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const r = { ...row };
      for (const k of ROW_PRIVATE) delete r[k];
      if (Array.isArray(r.items)) {
        r.items = r.items.map((item) => (item && typeof item === 'object' && Array.isArray(item.flags)
          ? { ...item, flags: item.flags.filter((f) => f !== PRIVATE_ITEM_FLAG) }
          : item));
      }
      return r;
    });
  }
  if (Array.isArray(out.steps)) {
    out.steps = out.steps.map((step) => {
      if (!step || typeof step !== 'object') return step;
      const s = { ...step };
      for (const k of STEP_PRIVATE) delete s[k];
      return s;
    });
  }
  return out;
}

/* `household` is the row's own stored answers, and it is used ONLY to decide
   what to remove — nothing derived from it is ever written to the output.
   Passing it in is what makes the check a closed set instead of a guess. */
export function sanitizeSharedPlan(plan, household) {
  if (!plan || typeof plan !== 'object') return null;
  return redactPlan(householdPatterns(household), sharedPlanShape(plan));
}

// The full response body for get-shared-space. Top-level allowlist mirrors
// the plan one: name/space/goal/dims describe the space, plan is the plan.
// No user_id, no household, no progress, no shopping, no storage paths.
export function sharedSpacePayload(row) {
  if (!row || typeof row !== 'object') return null;
  const patterns = householdPatterns(row.household);
  /* The name is the owner's own words and they chose it knowing they would
     share it — but they typed it before the note, and a space called "Mum's
     meds cabinet" is the same disclosure as the note itself. Checked with
     everything else; a name that is entirely household falls back to the
     generic one rather than arriving blank. */
  const name = redactText(patterns, String(row.name || '')).trim();
  return {
    name: name || 'A TidyMap plan',
    spaceType: row.space_type || null,
    goal: row.goal || null,
    dims: row.dims || null,
    plan: sanitizeSharedPlan(row.plan, row.household),
    planMeta: row.plan_meta || null,
    sharedAt: row.updated_at || null,
  };
}
