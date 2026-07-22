// Sanitizer for publicly shared plans. A share link is read-only and holds
// only what a housemate needs to see the plan: the space, the zones, the
// steps, the summary. Everything personal stays out — household composition,
// progress, shopping selections, and any media paths (photos require signed
// URLs and consent; a share link must never leak them). Shared between the
// Deno edge function and the Node test suite so the allowlist is verified.

// Field allowlist for the plan JSON itself. The stored plan can carry extra
// keys over time; an allowlist means new private fields default to EXCLUDED.
const PLAN_FIELDS = [
  'spaceType', 'summary', 'problems', 'opportunities',
  'map', 'geometry', 'safetyNotes', 'features', 'steps', 'cats',
  'existingLede', 'existing', 'dontBuy', 'cost', 'time',
];

export function sanitizeSharedPlan(plan) {
  if (!plan || typeof plan !== 'object') return null;
  const out = {};
  for (const k of PLAN_FIELDS) {
    if (plan[k] !== undefined) out[k] = plan[k];
  }
  return out;
}

// The full response body for get-shared-space. Top-level allowlist mirrors
// the plan one: name/space/goal/dims describe the space, plan is the plan.
// No user_id, no household, no progress, no shopping, no storage paths.
export function sharedSpacePayload(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    name: row.name || 'A TidyMap plan',
    spaceType: row.space_type || null,
    goal: row.goal || null,
    dims: row.dims || null,
    plan: sanitizeSharedPlan(row.plan),
    planMeta: row.plan_meta || null,
    sharedAt: row.updated_at || null,
  };
}
