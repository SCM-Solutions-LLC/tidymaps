// Ingest anonymous usage events. The client batches events and posts
// { anonId, events: [{name, props}] }; everything is re-sanitized here
// against the shared allowlist (_shared/telemetryEvents.js) — the client's
// copy of the filter is a courtesy, this one is the boundary. Writes go to
// telemetry_events via the service role; the table has RLS with no policies.
import { preflight, json } from '../_shared/cors.ts';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { checkAndLog, RateLimitError } from '../_shared/ratelimit.ts';
import { sanitizeBatch } from '../_shared/telemetryEvents.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  let body: { anonId?: string; events?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'invalid_json' });
  }
  const anonId = UUID_RE.test(String(body.anonId ?? '')) ? String(body.anonId).toLowerCase() : null;
  const events = sanitizeBatch(body.events);
  if (!events.length) return json(req, 200, { accepted: 0 });

  const admin = adminClient();
  const caller = await getCaller(req);
  try {
    // Batches, not events, count against the limit; a full wizard session
    // sends a handful of batches, so these bounds are far from honest use.
    await checkAndLog(admin, 'track-events', caller, { perHour: 60, perDay: 300, globalPerDay: 20000 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(req, 429, { error: 'rate_limited', retryAfterSeconds: e.retryAfterSeconds });
    }
    console.error('ratelimit check failed', e);
    return json(req, 500, { error: 'internal' });
  }

  const rows = events.map((ev) => ({
    anon_id: anonId,
    user_id: caller.userId,
    name: ev.name,
    props: ev.props,
  }));
  const { error } = await admin.from('telemetry_events').insert(rows);
  if (error) {
    console.error('telemetry insert failed', error);
    return json(req, 500, { error: 'internal' });
  }
  return json(req, 200, { accepted: rows.length });
});
