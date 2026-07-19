// Telemetry event contract, shared by the client (js/telemetry.js imports it
// relatively), the track-events edge function, and the Node test suite.
//
// Privacy rules, enforced here rather than by convention:
// - Event names come from a fixed allowlist. Unknown names are dropped.
// - Props are flat primitives only (string/number/boolean), no nesting —
//   so photos, free text blobs, and structured personal data can't ride along.
// - String props are capped hard; a whole event serializes to <= 1 KB.
// - No IPs, no exact timestamps from the client (the server stamps arrival).

export const EVENT_NAMES = [
  'screen_viewed',        // { screen } — wizard funnel / drop-off
  'plan_created',         // { space, source, steps } — a plan was generated
  'step_checked',         // { index, total, checkedCount } — the >=3 signal
  'product_clicked',      // { retailer, productType } — shopping intent
  'feedback_submitted',   // { useful, vs, nextSpace } — incl. "I would pay for this"
  'share_link_created',   // {} — owner minted a read-only link
  'shared_plan_viewed',   // {} — someone opened a share link
  'after_render_requested', // { ok } — the before/after preview feature
];

const MAX_STRING = 80;
const MAX_EVENT_BYTES = 1024;
const MAX_BATCH = 25;

// Returns the sanitized event, or null if it should be dropped entirely.
export function sanitizeEvent(ev) {
  if (!ev || typeof ev !== 'object') return null;
  if (!EVENT_NAMES.includes(ev.name)) return null;
  const props = {};
  if (ev.props && typeof ev.props === 'object' && !Array.isArray(ev.props)) {
    for (const [k, v] of Object.entries(ev.props)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) props[k] = v;
      else if (typeof v === 'boolean') props[k] = v;
      else if (typeof v === 'string') props[k] = v.slice(0, MAX_STRING);
      // objects, arrays, null, undefined: dropped — flat primitives only
    }
  }
  const out = { name: ev.name, props };
  if (JSON.stringify(out).length > MAX_EVENT_BYTES) return null;
  return out;
}

// Validate a client batch: cap the count, sanitize each event, drop the rest.
export function sanitizeBatch(events) {
  if (!Array.isArray(events)) return [];
  return events.slice(0, MAX_BATCH).map(sanitizeEvent).filter(Boolean);
}
