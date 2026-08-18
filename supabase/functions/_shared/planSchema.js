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
export const PLACES = ['left','back','right','upper','lower','run-a','run-b','floor','bench','wall'];

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

const safetySchema = z.object({
  flag: z.enum(SAFETY_FLAGS).nullable(),
  why: z.string().nullable(),
});

const mapRowSchema = z.object({
  level: z.string(),
  icon: z.string(),
  zone: z.string(),
  why: z.string(),
  eye: z.boolean().optional(),
  shelfIndex: z.number().int(),
  safety: safetySchema,
  items: z.array(z.object({
    name: z.string(),
    size: z.enum(ITEM_SIZES).optional(),
    flags: z.array(z.string()).optional(),
  })).optional(),
  surface: z.enum(SURFACES).nullable().optional(),
});

const geometrySchema = z.object({
  unit: z.string(),
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
  purpose: z.string(),
  targetZone: z.string(),
  maxDims: z.object({
    w_in: z.number().positive(),
    h_in: z.number().positive(),
    d_in: z.number().positive(),
  }).nullable(),
  priority: z.enum(['high', 'nice']),
});

const layoutSectionSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  place: z.enum(PLACES).optional(),
  rows: z.array(z.number().int().min(0)).max(12),
});

const layoutSchema = z.object({
  type: z.enum(ARCHETYPES),
  sections: z.array(layoutSectionSchema).max(8).optional(),
}).nullable().optional();

export const planSchema = z.object({
  spaceType: z.string(),
  summary: z.string(),
  categories: z.array(z.string()).optional(),
  features: z.array(z.object({ icon: z.string(), title: z.string(), sub: z.string() })).optional(),
  problems: z.array(z.string()).optional(),
  opportunities: z.array(z.string()).optional(),
  map: z.array(mapRowSchema).min(1),
  geometry: geometrySchema,
  layout: layoutSchema,
  safetyNotes: z.array(z.string()).optional(),
  productNeeds: z.array(productNeedSchema).optional(),
  existingLede: z.string().optional(),
  existing: z.array(z.object({ icon: z.string(), title: z.string(), detail: z.string() })).optional(),
  dontBuy: z.string().optional(),
  steps: z.array(z.object({ task: z.string(), time: z.string(), why: z.string() })).min(1),
  time: z.string().optional(),
  cost: z.string().optional(),
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

  const [minSteps, maxSteps] = EFFORT_STEP_RANGES[context && context.effort] || DEFAULT_STEP_RANGE;
  if (plan.steps.length < minSteps || plan.steps.length > maxSteps) {
    errors.push(`steps: expected ${minSteps}-${maxSteps} steps for effort "${(context && context.effort) || 'unspecified'}", got ${plan.steps.length}`);
  }

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
  return Math.max(8, Math.min(18, Math.min(width, depth) * factor));
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
  // Order matters: the fracs are regenerated to match the corrected count.
  alignShelfCount(structural.data);
  normalizeShelfYFracs(structural.data.geometry);
  const errors = checkInvariants(structural.data, context);
  if (errors.length) {
    return { ok: false, value: null, errors };
  }
  return { ok: true, value: structural.data, errors: [] };
}
