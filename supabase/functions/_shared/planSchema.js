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
const DEFAULT_STEP_RANGE = [4, 10];

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

/**
 * Business rules the prompt states but the model isn't guaranteed to follow:
 * kid-safety flags only when kids are actually in the household, step count
 * scaled to the chosen effort, no two map rows claiming the same shelf, and
 * product footprints that fit the space the user actually measured.
 */
function checkInvariants(plan, context) {
  const errors = [];
  const household = context && context.household;
  const kidsPresent = !!(household && household.kids && household.kids.present === true);

  plan.map.forEach((row, i) => {
    if (row.safety && row.safety.flag && !kidsPresent) {
      errors.push(`map[${i}] ("${row.level}"): safety flag "${row.safety.flag}" is set but no kids are present in the household`);
    }
  });

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

  const shelfYFracs = plan.geometry.shelfYFracs;
  if (shelfYFracs.length !== plan.geometry.shelfCount) {
    errors.push(`geometry.shelfYFracs: expected ${plan.geometry.shelfCount} positions for shelfCount ${plan.geometry.shelfCount}, got ${shelfYFracs.length}`);
  }
  for (let i = 1; i < shelfYFracs.length; i++) {
    if (shelfYFracs[i] <= shelfYFracs[i - 1]) {
      errors.push('geometry.shelfYFracs: positions must be strictly increasing');
      break;
    }
  }

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

  const measuredDepth = context && context.dims && Number(context.dims.d_in);
  if (measuredDepth) {
    (plan.productNeeds || []).forEach((need, i) => {
      if (need.maxDims && need.maxDims.d_in > measuredDepth - 0.5 + 1e-6) {
        errors.push(`productNeeds[${i}] ("${need.type}"): maxDims.d_in ${need.maxDims.d_in} does not fit the measured ${measuredDepth}in depth minus 0.5in clearance`);
      }
    });
  }

  return errors;
}

/**
 * @param {unknown} raw - parsed JSON from the model's response
 * @param {object} [context] - the same context object sent to the model (household, effort, dims, ...)
 * @returns {{ok: true, value: object, errors: []} | {ok: false, value: null, errors: string[]}}
 */
export function validatePlan(raw, context = {}) {
  const structural = planSchema.safeParse(raw);
  if (!structural.success) {
    return { ok: false, value: null, errors: issuesToStrings(structural.error) };
  }
  const errors = checkInvariants(structural.data, context);
  if (errors.length) {
    return { ok: false, value: null, errors };
  }
  return { ok: true, value: structural.data, errors: [] };
}
