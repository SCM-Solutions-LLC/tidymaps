// Structural + business-invariant validation for the raw plan JSON returned
// by the analyze-space model call. Shared between the Deno edge function
// (via the "zod" alias in supabase/functions/import_map.json) and the Node
// test suite (via the "zod" npm package in package.json) so the exact same
// rules run in both places.
import { z } from 'zod';

export const PRODUCT_TYPES = ['clear-bin', 'basket', 'turntable', 'can-riser', 'shelf-riser', 'door-rack', 'airtight-container', 'drawer-organizer', 'hook-rack', 'label-set', 'safety-latch'];
export const SAFETY_FLAGS = ['kid-safe', 'keep-high', 'lock-or-latch'];
export const ITEM_SIZES = ['s', 'm', 'l'];
export const ARCHETYPES = ['shelves','cabinet','l-run','walkin-u','closet-rod','drawer-bank','closet-system','under-bed','under-sink','counter','garage-rack','overhead-rack','workbench','fridge'];
export const SURFACES = ['shelf','rod','drawer','floor','door','pegboard','worktop'];
export const PLACES = ['left','back','right','front','upper','lower','run-a','run-b','floor','bench','wall'];
/* Which wall a map row is on, for the report's wall tabs and the viewer's
   per-wall shelving. Mirrors WALLS in js/placement.js (a test holds them
   equal). "front" is the wall the door is in; "floor" is the floor itself. */
export const WALLS = ['left','back','right','front','floor'];
/* The optional fields the model may set and the client reads (js/plan.js
   normalizeAi): wall and tier on a map row, rows (shelfIndex values) and goal
   on a step, and a top-level spotted list of things seen in the photos that
   the user's own contents list leaves out. None of them is ever a reason to
   reject a plan: a bad value is dropped in validatePlan's repair pass, and
   these two caps are applied there too. Stated to the model in the
   enforced-limits block from these same constants. */
export const SPOTTED_MAX = 8;
export const STEP_ROWS_MAX = 4;

// From the analyze-space prompt: "steps": 6-9 by default, scaled by effort.
export const EFFORT_STEP_RANGES = {
  // design-contract effort labels (the wizard's three options)
  'Quick refresh': [3, 6],
  'Weekend reset': [7, 10],
  'Full overhaul': [9, 14],
  // legacy labels kept for saved profiles and older clients
  'Quick 30-minute reset': [3, 6],
  '1-hour cleanup': [5, 8],
  'Weekend project': [7, 10],
  'Full reorganization': [9, 14],
};
export const DEFAULT_STEP_RANGE = [4, 10];

/* The step range a request is held to, read by the prompt and by
   checkInvariants from this one place so the two cannot drift. An effort the
   user never touched (the wizard preselects "Weekend reset") is not an ask
   for seven steps: the general range applies and the prompt tells the model
   to use the count the work needs. A client from before the flag existed
   sends no `effortTouched`, and for it the effort's own range still applies,
   exactly as before. */
export function stepRangeFor(context) {
  if (effortUntouched(context)) return DEFAULT_STEP_RANGE;
  return knownEffort(context) ? EFFORT_STEP_RANGES[context.effort] : DEFAULT_STEP_RANGE;
}
/* The effort the wizard preselects (js/state.js ANSWER_DEFAULTS; a test holds
   the two equal). An untouched flag is only a preselection when the label is
   still this one: a row saved before the flag existed restores the flag as
   false beside whatever effort the person chose then, and the client reads
   it the same way (js/personalize.js applyEffort). */
export const PRESELECTED_EFFORT = 'Weekend reset';
export function effortUntouched(context) {
  return !!context && context.effortTouched === false && context.effort === PRESELECTED_EFFORT;
}
/* Whether the request carries a contents list the user confirmed: they
   edited the step and ticked something, or they are on a client from before
   the flag existed, for which a list it sends is theirs. The prompt's two
   halves and the repair pass all read this one function. */
export function listConfirmed(context) {
  if (!context) return false;
  const n = Array.isArray(context.categories) ? context.categories.filter((x) => typeof x === 'string' && x.trim()).length : 0;
  if (context.categoriesTouched === true) return n > 0;
  return context.categoriesTouched === undefined && n > 0;
}
/* The effort label is user-supplied; looked up as an own property so a label
   like "constructor" is an unknown effort, not a prototype function. */
export function knownEffort(context) {
  const effort = context && context.effort;
  return typeof effort === 'string' && Object.hasOwn(EFFORT_STEP_RANGES, effort);
}

/* The prompt asks for a task of at most 8 words and a why of at most 12; these
   are the lengths at which the answer is REJECTED, and they sit deliberately
   above the ask.

   The report renders each step as one line beside its animation, so a runaway
   task is a real defect — "Take all of the canned goods and group them together
   by what kind they are" is seventeen words and wraps to three lines. But
   validating at the number the prompt requests would throw away an 80-second
   analysis over a ninth word, and a validator stricter than its own prompt is
   how the last three invariant bugs here were made. So the style target stays
   in the prompt and the hard limit is the point where the line stops fitting.

   The numbers are measured, not guessed. This app's own deterministic
   scenarios in js/demo-scenarios.js — the fallback a rejected plan lands on,
   and the closest thing here to house-authored reference prose — run up to 11
   words of task ("Group mugs on the lower shelf with a riser if available") and
   16 of why. A cap at the prompt's 8 would reject the answer this app ships
   when the model fails, which is the same trap that nearly put heavy bins
   overhead: enforcing the prompt as written against work that was already
   right. Re-measure before lowering either number.

   A word is a run of non-space characters, which counts "10-15 minutes" as one
   the way a reader does. */
export const STEP_TASK_MAX_WORDS = 12;
export const STEP_WHY_MAX_WORDS = 18;

export function wordCount(s) {
  return String(s == null ? '' : s).trim().split(/\s+/).filter(Boolean).length;
}

/* Every free-text field is length-capped, and the cap is an abuse bound, not a
   style rule: the prompt asks for sentences of 10 to 20 words, and the longest
   string this app's own deterministic scenarios ship is under 400 characters,
   so a compliant answer never comes near it. What it stops is a plan whose
   "summary" is a novel, stored as-is in the spaces row and re-sent to every
   share-link visitor. Icons are keywords from a list the prompt states, so
   theirs is tighter. Both are restated to the model in the enforced-limits
   block, so the validator is never stricter than its own prompt. */
export const PLAN_TEXT_MAX_CHARS = 1000;
export const PLAN_ICON_MAX_CHARS = 40;
const text = () => z.string().max(PLAN_TEXT_MAX_CHARS);
const iconKeyword = () => z.string().max(PLAN_ICON_MAX_CHARS);

const safetySchema = z.object({
  flag: z.enum(SAFETY_FLAGS).nullable(),
  why: text().nullable(),
});

/* Soft: `.catch(undefined)` turns a bad value into an absent one instead of a
   rejected plan. These fields are new, optional, and read by nothing that
   cannot do without them, so a model that gets one wrong must not cost the
   user the analysis. (The validator must never be stricter than its prompt;
   here it is deliberately looser.) */
const mapRowSchema = z.object({
  level: text(),
  icon: iconKeyword(),
  zone: text(),
  why: text(),
  eye: z.boolean().optional(),
  shelfIndex: z.number().int(),
  safety: safetySchema,
  items: z.array(z.object({
    name: text(),
    size: z.enum(ITEM_SIZES).optional(),
    flags: z.array(text()).optional(),
  })).optional(),
  surface: z.enum(SURFACES).nullable().optional(),
  wall: z.enum(WALLS).nullable().optional().catch(undefined),
  tier: z.number().int().min(0).optional().catch(undefined),
});

const geometrySchema = z.object({
  unit: text(),
  width: z.number().positive(),
  height: z.number().positive(),
  depth: z.number().positive(),
  shelfCount: z.number().int().min(1).max(12),
  shelfYFracs: z.array(z.number().min(0).max(1)),
  estimated: z.boolean(),
});

const productNeedSchema = z.object({
  type: z.enum(PRODUCT_TYPES),
  qty: z.number().int().positive(),
  purpose: text(),
  targetZone: text(),
  maxDims: z.object({
    w_in: z.number().positive(),
    h_in: z.number().positive(),
    d_in: z.number().positive(),
  }).nullable(),
  priority: z.enum(['high', 'nice']),
});

const layoutSectionSchema = z.object({
  id: text(),
  label: text().optional(),
  // A place the enum does not know used to reject the whole plan; now the
  // section keeps its rows and loses only the place.
  place: z.enum(PLACES).optional().catch(undefined),
  rows: z.array(z.number().int().min(0)).max(12),
});

const stepSchema = z.object({
  task: text(),
  time: text(),
  why: text(),
  // Any list is taken; the repair pass keeps the entries that are real
  // shelf indexes, so one bad entry does not cost the step its whole list.
  rows: z.array(z.unknown()).optional().catch(undefined),
  goal: text().nullable().optional().catch(undefined),
});

// A broken entry becomes null and is dropped in the repair pass; a broken
// list becomes no list.
const spottedSchema = z.array(z.object({
  name: text(),
  row: z.number().int().nullable().optional().catch(undefined),
}).catch(null)).optional().catch(undefined);

const layoutSchema = z.object({
  type: z.enum(ARCHETYPES),
  sections: z.array(layoutSectionSchema).max(8).optional(),
}).nullable().optional();

export const planSchema = z.object({
  spaceType: text(),
  summary: text(),
  categories: z.array(text()).optional(),
  problems: z.array(text()).optional(),
  opportunities: z.array(text()).optional(),
  map: z.array(mapRowSchema).min(1),
  geometry: geometrySchema,
  layout: layoutSchema,
  safetyNotes: z.array(text()).optional(),
  productNeeds: z.array(productNeedSchema).optional(),
  existingLede: text().optional(),
  existing: z.array(z.object({ icon: iconKeyword(), title: text(), detail: text() })).optional(),
  dontBuy: text().optional(),
  steps: z.array(stepSchema).min(1),
  spotted: spottedSchema,
  time: text().optional(),
  cost: text().optional(),
});

function issuesToStrings(zodError) {
  return zodError.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

/* The prompt's hard safety rules, in the numbers it states them in. Kept as
   named constants because the enforced-limits block in analyze-space quotes
   them back to the model from here: a rule the validator applies and the
   prompt describes differently is how three production plans were thrown away
   after the user had already waited out the analysis. */
export const KID_REACH_IN = 48;      // "must NEVER be placed below 48 inches"
export const YOUNG_KID_MAX_AGE = 9;  // "when kids ages 0-9 are present"
/* The flags where "within a small child's reach" IS the danger, and so the
   only two the height rule applies to.

   The prompt used to name four — heavy, chemical, sharp, fragile — and
   enforcing that literally would have been worse than not enforcing it at all.
   A heavy bin is dangerous because a child pulls it DOWN on themselves, so it
   belongs at or below waist height; this app's own scenarios say exactly that
   ("Heavy bins go low so kids pull them out safely", "Heavy bins should always
   be on lower shelves to prevent injury"). A rule that forced heavy items
   above 48in to satisfy a child-safety check would have produced the plan that
   actually hurts somebody, on 12 of the 16 deterministic scenarios. The prompt
   now states the two rules separately, in opposite directions, and this is the
   half a validator can decide. */
export const HAZARD_ITEM_FLAGS = ['chemical', 'sharp'];

/* A row's height above the floor, using the same arithmetic the 3D viewer
   draws it with (js/three/scene.js: `y = H * (1 - frac)`). shelfYFracs
   measures DOWN from the top, which is the thing to get wrong here — reading
   it as height above the floor would put the bleach on the top shelf and
   pass. Duplicated rather than imported for the same reason as
   evenShelfFracs: this module is shared by the Deno edge function and the
   Node suite, neither of which can reach the browser bundle. */
function rowHeightIn(plan, row) {
  const fracs = plan.geometry.shelfYFracs;
  const frac = Array.isArray(fracs) ? Number(fracs[row.shelfIndex]) : NaN;
  if (!Number.isFinite(frac) || frac < 0 || frac > 1) return null;
  const height = Number(plan.geometry.height);
  if (!Number.isFinite(height) || height <= 0) return null;
  return height * (1 - frac);
}

const hazardsOn = (row) => (row.items || [])
  .filter((item) => (item.flags || []).some((f) => HAZARD_ITEM_FLAGS.includes(f)))
  .map((item) => item.name);

const kidItemsOn = (row) => (row.items || [])
  .filter((item) => (item.flags || []).includes('kid-frequent'))
  .map((item) => item.name);

/**
 * Business rules the prompt states but the model isn't guaranteed to follow:
 * the household safety contract, step count scaled to the chosen effort, no
 * two map rows claiming the same shelf, and product footprints that fit the
 * space the user actually measured.
 *
 * The safety half used to be one rule out of five — a flag set with no kids in
 * the household — while the prompt asked for four more in the imperative
 * ("must NEVER", "every safety-driven placement must"). Everything else was
 * left to model compliance, which is the one thing a validator exists not to
 * rely on, and the rules left unchecked were the ones about where the bleach
 * goes. What can be decided from the plan and the household is decided here;
 * what cannot is named in a comment rather than half-enforced.
 */
function checkInvariants(plan, context) {
  const errors = [];
  const household = context && context.household;
  const kids = (household && household.kids) || {};
  const pets = (household && household.pets) || {};
  const kidsPresent = kids.present === true;
  const petsPresent = pets.present === true;
  /* An age nobody gave is not evidence of an older child. The rule protects
     0-9s, and a household that said "kids" and skipped the ages gets it. */
  const ageYears = kids.ageYears;
  const youngKids = kidsPresent
    && (!ageYears || !Number.isFinite(Number(ageYears.min)) || Number(ageYears.min) <= YOUNG_KID_MAX_AGE);

  plan.map.forEach((row, i) => {
    const safety = row.safety || {};
    const where = `map[${i}] ("${row.level}")`;

    /* A flag is a claim about who is in the house. `lock-or-latch` is the one
       a pet household legitimately needs — the prompt tells the model a cat
       reaches ANY height, so a closed door is the only barrier that works —
       and rejecting every flag without kids made that instruction impossible
       to follow. `kid-safe` still means what it says. */
    if (safety.flag === 'kid-safe' && !kidsPresent) {
      errors.push(`${where}: safety flag "kid-safe" is set but no kids are present in the household`);
    } else if (safety.flag && !kidsPresent && !petsPresent) {
      errors.push(`${where}: safety flag "${safety.flag}" is set but this household has no kids and no pets`);
    }

    // "Every safety-driven placement must carry a plain-language safety.why."
    // A flagged row with no reason renders a badge and no explanation.
    if (safety.flag && !String(safety.why || '').trim()) {
      errors.push(`${where}: safety flag "${safety.flag}" has no safety.why; say in plain language why this placement is safer`);
    }

    /* "Heavy, chemical, sharp, or fragile items must NEVER be placed below 48
       inches when kids ages 0-9 are present, unless that zone is flagged
       lock-or-latch." The one rule in this file where being wrong is not a
       cosmetic problem, and it was not being checked at all. */
    if (youngKids && safety.flag !== 'lock-or-latch') {
      const hazards = hazardsOn(row);
      const heightIn = rowHeightIn(plan, row);
      if (hazards.length && heightIn !== null && heightIn < KID_REACH_IN) {
        errors.push(`${where}: ${hazards.map((n) => `"${n}"`).join(', ')} `
          + `${hazards.length === 1 ? 'is' : 'are'} flagged hazardous and this row sits about `
          + `${Math.round(heightIn)}in from the floor, within reach of a child aged ${YOUNG_KID_MAX_AGE} or under. `
          + `Move ${hazards.length === 1 ? 'it' : 'them'} above ${KID_REACH_IN}in, or flag this row "lock-or-latch" and say so in safety.why.`);
      }
    }

    /* "Kid-frequent items go on the lowest safe shelf so children can reach
       them without climbing." How low is a judgement, so what is checked is
       the plan contradicting itself: an item the plan says a child uses
       daily, on a row the same plan says is locked or deliberately out of
       reach. That is not a placement anyone can follow. */
    if (safety.flag === 'keep-high' || safety.flag === 'lock-or-latch') {
      const forKids = kidItemsOn(row);
      if (forKids.length) {
        errors.push(`${where}: ${forKids.map((n) => `"${n}"`).join(', ')} `
          + `${forKids.length === 1 ? 'is' : 'are'} flagged "kid-frequent" on a row flagged "${safety.flag}". `
          + `Kid-frequent items belong on the lowest safe shelf; move them, or drop the flag if this row is not restricted.`);
      }
    }
  });

  /* Deliberately NOT enforced: "with Limited reach, Avoid bending or
     Wheelchair user, daily-use items belong between 30 and 60 inches". The
     plan carries no marker for "daily-use" — `eye` is about eye level, not
     frequency — so every version of this check has to guess which items the
     rule is about, and a guess that throws away an 80-second analysis is
     worse than the rule going unchecked. It stays a prompt instruction until
     the contract carries the fact it needs. */

  const seenShelves = new Map();
  plan.map.forEach((row, i) => {
    if (row.shelfIndex < 0 || row.shelfIndex >= plan.geometry.shelfCount) {
      errors.push(`map[${i}] ("${row.level}"): shelfIndex ${row.shelfIndex} is out of range for shelfCount ${plan.geometry.shelfCount}`);
    }
    if (seenShelves.has(row.shelfIndex)) {
      errors.push(`map[${i}] ("${row.level}") duplicates shelfIndex ${row.shelfIndex} already used by map[${seenShelves.get(row.shelfIndex)}] ("${plan.map[seenShelves.get(row.shelfIndex)].level}"); merge these into one row`);
    } else {
      seenShelves.set(row.shelfIndex, i);
    }
  });

  // shelfYFracs is not checked here: it is repaired in validatePlan instead.
  // See normalizeShelfYFracs for why rejecting a plan over it was wrong.

  if (plan.layout && plan.layout.sections) {
    const sectionSeen = new Set();
    for (const sec of plan.layout.sections) {
      for (const r of sec.rows) {
        if (r >= plan.geometry.shelfCount) {
          errors.push(`layout.section "${sec.id}": row ${r} >= shelfCount ${plan.geometry.shelfCount}`);
        }
        if (sectionSeen.has(r)) {
          errors.push(`layout.section "${sec.id}": row ${r} appears in multiple sections`);
        }
        sectionSeen.add(r);
      }
    }
  }

  const [minSteps, maxSteps] = stepRangeFor(context);
  if (plan.steps.length < minSteps || plan.steps.length > maxSteps) {
    // The label is printed only when it is one of ours: this message goes
    // back to the model as a trusted correction turn.
    const forWhom = effortUntouched(context)
      ? 'an effort left on the preselection (the general range applies)'
      : `effort "${knownEffort(context) ? context.effort : 'unspecified'}"`;
    errors.push(`steps: expected ${minSteps}-${maxSteps} steps for ${forWhom}, got ${plan.steps.length}`);
  }

  /* Step COUNT was checked above and step LENGTH was not, so a model that
     ignored the 8-word ask shipped a plan that validated and then rendered
     three lines deep next to its animation. Checked per step and reported per
     step, so the retry is told which one to shorten rather than being handed
     "the steps are too long" for a list of nine. */
  plan.steps.forEach((step, i) => {
    const task = wordCount(step.task);
    if (task > STEP_TASK_MAX_WORDS) {
      errors.push(`steps[${i}].task is ${task} words ("${step.task}"); the limit is ${STEP_TASK_MAX_WORDS}. Rewrite it as an instruction that starts with a verb and stops.`);
    }
    const why = wordCount(step.why);
    if (why > STEP_WHY_MAX_WORDS) {
      errors.push(`steps[${i}].why is ${why} words ("${step.why}"); the limit is ${STEP_WHY_MAX_WORDS}. One short sentence.`);
    }
  });

  /* A plan that tells you to buy something must say WHAT to buy.

     A live plan instructed turntables, can risers and airtight containers
     across four steps and returned productNeeds: [] — so the shopping list was
     empty and the Cost tile read "$0" over a checklist that cannot be done for
     $0. The user had said they were open to buying; they were told to buy and
     handed no list. Nothing in the schema made those two halves agree.

     Deliberately narrow. This rejects a plan and costs the user a retry, so it
     only fires on nouns you cannot improvise: a turntable is a purchase, while
     a "bin", a "basket" or a label is something a household may well already
     own, and demanding a product entry for those would reject good plans. A
     step that names the thing as already present is not a purchase either. */
  const BUYABLE = [
    [/\bturntables?\b|\blazy susans?\b/i, 'turntable', ['turntable']],
    [/\bcan risers?\b|\bshelf risers?\b|\brisers?\b/i, 'can-riser or shelf-riser', ['can-riser', 'shelf-riser']],
    [/\bairtight containers?\b/i, 'airtight-container', ['airtight-container']],
    [/\bdoor racks?\b/i, 'door-rack', ['door-rack']],
    [/\bhook racks?\b/i, 'hook-rack', ['hook-rack']],
    [/\bdrawer (?:organizer|divider)s?\b/i, 'drawer-organizer', ['drawer-organizer']],
  ];
  const ALREADY_OWNED = /\bexisting\b|\balready\b|\byou (?:have|own)\b|\byour own\b/i;
  /* Mirrors analyze-space: the wizard PRESELECTS "Use what I have", so the
     answer is only a constraint once the user has touched the step. `=== false`
     rather than a falsy check, because a client built before the flag existed
     sends nothing and has to keep the meaning it was built against. Without
     this the validator enforced a rule the prompt had stopped stating — the
     two halves of one answer, disagreeing again. */
  const ctx = context || {};
  const usesWhatTheyHave = ctx.shopping === 'Use what I have' && ctx.shoppingTouched !== false;

  /* A plan that tells you to buy something must say WHAT to buy.

     This used to run only when productNeeds was ENTIRELY empty, so one entry
     bought silence for every other purchase in the plan: a list holding a
     label set, over steps instructing turntables and risers, passed — and the
     Cost tile added up the labels while the checklist could not be done
     without the rest. The check is per-noun now, against the types actually
     listed.

     Still deliberately narrow. It rejects a plan and costs the user a retry,
     so it only fires on nouns you cannot improvise: a turntable is a purchase,
     while a "bin", a "basket" or a label is something a household may well
     already own, and demanding an entry for those would reject good plans. A
     step that names the thing as already present is not a purchase either. */
  const listedTypes = new Set((plan.productNeeds || []).map((n) => n.type));
  if (!usesWhatTheyHave) {
    const named = [];
    for (const step of plan.steps) {
      const text = `${step.task || ''}`;
      if (ALREADY_OWNED.test(text)) continue;
      for (const [re, label, types] of BUYABLE) {
        if (!re.test(text)) continue;
        if (types.some((t) => listedTypes.has(t))) continue;
        if (!named.some((n) => n.label === label)) named.push({ label, task: step.task });
      }
    }
    if (named.length) {
      errors.push(`${named.length === 1 ? 'a step tells' : 'steps tell'} the user to buy things that productNeeds does not list: `
        + named.map((n) => `"${n.task}" needs ${n.label}`).join('; ')
        + '. Add an entry to productNeeds for each, or rewrite the step to work with what is already in the space.');
    }
  } else if ((plan.productNeeds || []).length) {
    /* The other half of the same answer, and it was enforced nowhere: the
       prompt requires an EMPTY productNeeds from someone who chose to use
       only what they already own, and a plan that returns one anyway puts a
       shopping list under a report that promises every step works with what
       is already in the space. */
    errors.push(`productNeeds has ${plan.productNeeds.length} `
      + `${plan.productNeeds.length === 1 ? 'entry' : 'entries'} (${[...listedTypes].join(', ')}), `
      + 'but this user chose to use only what they already have. Return an empty productNeeds array '
      + 'and write every step to work with containers already in the space.');
  }

  const shelfDepth = usableShelfDepth(plan.layout && plan.layout.type, context && context.dims);
  if (shelfDepth) {
    (plan.productNeeds || []).forEach((need, i) => {
      if (need.maxDims && need.maxDims.d_in > shelfDepth - 0.5 + 1e-6) {
        errors.push(`productNeeds[${i}] ("${need.type}"): maxDims.d_in ${need.maxDims.d_in} does not fit the ${shelfDepth}in usable shelf depth minus 0.5in clearance`);
      }
    });
  }

  return errors;
}

/* For most archetypes the measured depth IS the shelf depth. For a walk-in or
   an L-run it is not: the user measured a ROOM, so d_in is 72 inches of floor
   while the shelving along its walls is 8 to 18 inches deep. Checking product
   depth against the room let a 20-inch bin pass for a shelf that could never
   hold it, and the same number drove the 3D view, which rendered organizers
   straight through the shelf they sat on.

   The two formulas mirror js/three/layouts/walkin-u.js and l-run.js, which are
   what the viewer actually builds; keep them in step. Duplicated rather than
   imported for the same reason as evenShelfFracs below — this module is shared
   by the Deno edge function and the Node test suite, neither of which can
   reach the browser bundle. */
const ROOM_SHAPED_ARCHETYPES = { 'walkin-u': 0.2, 'l-run': 0.22 };

export function usableShelfDepth(archetype, dims) {
  const depth = Number(dims && dims.d_in) || 0;
  if (!depth) return 0;
  const factor = ROOM_SHAPED_ARCHETYPES[archetype];
  if (!factor) return depth;
  const width = Number(dims && dims.w_in) || depth;
  /* The builders' formula in full, 14-inch floor included: a 4-foot walk-in
     is drawn with 14-inch shelving, and this used to cap the model's
     maxDims at 9.6 for the same room, so the catalog pick and the viewer
     disagreed about every bin in it. js/catalog.js shelfDepthFor is the same
     expression; a test holds the two equal. */
  const smallest = Math.min(width, depth);
  return Math.max(8, Math.min(18, Math.max(14, smallest * factor), smallest * 0.5));
}

/* The optional fields are soft at the schema and repaired here: a row index
   the map does not have is dropped, lists are deduped and capped, and a field
   left with nothing in it is removed rather than left empty, which is the
   shape the client's normalizeAi expects (absent, not empty). */
function repairOptionalFields(plan, context) {
  const count = plan.geometry.shelfCount;
  const validRow = (r) => Number.isInteger(r) && r >= 0 && r < count;
  for (const step of plan.steps) {
    const rows = Array.isArray(step.rows) ? [...new Set(step.rows.filter(validRow))].slice(0, STEP_ROWS_MAX) : [];
    if (rows.length) step.rows = rows; else delete step.rows;
    if (typeof step.goal === 'string' && step.goal.trim()) step.goal = step.goal.trim(); else delete step.goal;
  }
  // With no confirmed list the scope is the photos and the prompt says
  // spotted stays empty; a list sent anyway is dropped, not a rejection.
  const seenSpotted = new Set();
  const spotted = (listConfirmed(context) && Array.isArray(plan.spotted) ? plan.spotted : [])
    .filter((s) => s && typeof s.name === 'string' && s.name.trim())
    .map((s) => ({ name: s.name.trim(), row: validRow(s.row) ? s.row : null }))
    .filter((s) => { const k = s.name.toLowerCase(); if (seenSpotted.has(k)) return false; seenSpotted.add(k); return true; })
    .slice(0, SPOTTED_MAX);
  if (spotted.length) plan.spotted = spotted; else delete plan.spotted;
  for (const row of plan.map) {
    if (row.wall == null) delete row.wall;
    if (!Number.isInteger(row.tier) || row.tier < 0) delete row.tier;
  }
  if (plan.layout && Array.isArray(plan.layout.sections)) {
    for (const sec of plan.layout.sections) if (sec.place === undefined) delete sec.place;
  }
}

/* One line of counts per accepted plan, for the function log: whether the
   answers reached the plan. Counts only, never a name, a goal or an item.
   Watched after deploy the way validation_failed is. */
export function planQuality(plan, context = {}) {
  const goals = new Set((Array.isArray(context.goals) ? context.goals : [])
    .filter((g) => typeof g === 'string' && g.trim()).map((g) => g.trim().toLowerCase()));
  const covered = new Set(plan.steps
    .map((s) => (typeof s.goal === 'string' ? s.goal.trim().toLowerCase() : ''))
    .filter((g) => g && goals.has(g)));
  return {
    mapRows: plan.map.length,
    rowsWithWall: plan.map.filter((r) => WALLS.includes(r.wall)).length,
    eyeRows: plan.map.filter((r) => r.eye === true).length,
    steps: plan.steps.length,
    stepsWithRows: plan.steps.filter((s) => Array.isArray(s.rows) && s.rows.length).length,
    goalsGiven: goals.size,
    goalsCovered: covered.size,
    spotted: Array.isArray(plan.spotted) ? plan.spotted.length : 0,
    categoriesEdited: context.categoriesTouched === true,
    listConfirmed: listConfirmed(context),
    effortTouched: !effortUntouched(context),
  };
}

/* Mirrors evenShelfFracs in js/three/viewerOptions.js. Duplicated rather than
   imported because this module is shared by the Deno edge function and the Node
   test suite, neither of which can reach the browser bundle. */
function evenShelfFracs(count) {
  const n = Math.max(1, Math.min(12, Math.round(Number(count) || 1)));
  return Array.from({ length: n }, (_, i) => 0.08 + 0.82 * (n === 1 ? 0.5 : i / (n - 1)));
}

/**
 * shelfYFracs positions shelves in the 3D view and nothing else reads it.
 * normalizeViewerGeometry already applies this exact test on the client and
 * silently substitutes even spacing when it fails, so rejecting the plan here
 * discarded a complete 80-second analysis over a value the renderer was going
 * to overwrite anyway. Multi-wall spaces make that routine rather than rare:
 * the prompt has the model walk a walk-in wall by wall, so heights legitimately
 * reset at every wall boundary and the list can never be globally increasing.
 * Repair it the way the client does and keep the plan.
 */
function normalizeShelfYFracs(geometry) {
  const fracs = geometry.shelfYFracs;
  const usable = Array.isArray(fracs) &&
    fracs.length === geometry.shelfCount &&
    fracs.every((v, i, all) => Number.isFinite(v) && v >= 0 && v <= 1 && (i === 0 || v > all[i - 1]));
  if (!usable) geometry.shelfYFracs = evenShelfFracs(geometry.shelfCount);
}

/**
 * @param {unknown} raw - parsed JSON from the model's response
 * @param {object} [context] - the same context object sent to the model (household, effort, dims, ...)
 * @returns {{ok: true, value: object, errors: []} | {ok: false, value: null, errors: string[]}}
 */
/* "geometry.shelfCount must equal the number of map rows" is stated in the
   prompt as a hard limit and was checked nowhere: the row-index rules only
   require every shelfIndex to be inside the count, so a map of 5 rows with
   shelfCount 8 passed. That is not cosmetic. The client keeps the model's
   count (js/plan.js normalizeGeometry) and then CLAMPS every shelfIndex into
   it, so a count smaller than the map silently stacks rows onto one shelf —
   two zones drawn on top of each other in the 3D view — and a count larger
   draws shelves the plan never describes.
 *
   Repaired rather than rejected, on the same reasoning as shelfYFracs below:
   the right value is knowable with certainty from the plan itself (the map IS
   the plan), so throwing away an 80-second analysis to ask the model for a
   number we already have would be a worse trade than any it saves. The
   shelfIndex range check runs afterwards against the corrected count, so a
   plan whose rows genuinely disagree with each other still fails.

   Note this cannot fix the client's other override: a user who typed their own
   shelf count still wins over both. That is deliberate there and unchanged. */
function alignShelfCount(plan) {
  if (plan.geometry.shelfCount !== plan.map.length) {
    plan.geometry.shelfCount = plan.map.length;
  }
}

export function validatePlan(raw, context = {}) {
  const structural = planSchema.safeParse(raw);
  if (!structural.success) {
    return { ok: false, value: null, errors: issuesToStrings(structural.error) };
  }
  // Order matters: the fracs are regenerated to match the corrected count,
  // and the optional row references are checked against that count.
  alignShelfCount(structural.data);
  normalizeShelfYFracs(structural.data.geometry);
  repairOptionalFields(structural.data, context);
  const errors = checkInvariants(structural.data, context);
  if (errors.length) {
    return { ok: false, value: null, errors };
  }
  return { ok: true, value: structural.data, errors: [] };
}
