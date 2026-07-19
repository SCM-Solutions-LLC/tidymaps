// Structural + business-invariant validation for the raw plan JSON returned
// by the analyze-space model call. Shared between the Deno edge function
// (via the "zod" alias in supabase/functions/import_map.json) and the Node
// test suite (via the "zod" npm package in package.json) so the exact same
// rules run in both places.
import { z } from 'zod';

export const PRODUCT_TYPES = ['clear-bin', 'basket', 'turntable', 'can-riser', 'shelf-riser', 'door-rack', 'airtight-container', 'drawer-organizer', 'hook-rack', 'label-set', 'safety-latch'];
export const SAFETY_FLAGS = ['kid-safe', 'keep-high', 'lock-or-latch'];
export const ITEM_SIZES = ['s', 'm', 'l'];

// From the analyze-space prompt: "steps": 6-9 by default, scaled by effort.
export const EFFORT_STEP_RANGES = {
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
  shelfIndex: z.number(),
  safety: safetySchema,
  items: z.array(z.object({
    name: z.string(),
    size: z.enum(ITEM_SIZES).optional(),
    flags: z.array(z.string()).optional(),
  })).optional(),
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

export const planSchema = z.object({
  spaceType: z.string(),
  summary: z.string(),
  categories: z.array(z.string()).optional(),
  features: z.array(z.object({ icon: z.string(), title: z.string(), sub: z.string() })).optional(),
  problems: z.array(z.string()).optional(),
  opportunities: z.array(z.string()).optional(),
  map: z.array(mapRowSchema).min(1),
  geometry: geometrySchema,
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
