// Public read-only fetch of a shared plan. The caller presents a share_id
// (an unguessable v4 UUID the owner generated); the function looks the space
// up with the service role and returns ONLY the sanitized payload from
// _shared/sharePayload.js — never household, progress, shopping, or media.
// Revocation is instant: owner sets share_id to null and the lookup misses.
import { preflight, json } from '../_shared/cors.ts';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { checkAndLog, RateLimitError } from '../_shared/ratelimit.ts';
import { sharedSpacePayload } from '../_shared/sharePayload.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  let body: { shareId?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'invalid_json' });
  }
  const shareId = String(body.shareId ?? '').trim().toLowerCase();
  if (!UUID_RE.test(shareId)) return json(req, 400, { error: 'bad_share_id' });

  // Generous limits (viewing is cheap) but enough to make enumeration futile.
  const admin = adminClient();
  const caller = await getCaller(req);
  try {
    await checkAndLog(admin, 'get-shared-space', caller, { perHour: 60, perDay: 300, globalPerDay: 10000 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(req, 429, { error: 'rate_limited', retryAfterSeconds: e.retryAfterSeconds });
    }
    console.error('ratelimit check failed', e);
    return json(req, 500, { error: 'internal' });
  }

  const { data, error } = await admin
    .from('spaces')
    .select('name,space_type,goal,dims,plan,plan_meta,updated_at')
    .eq('share_id', shareId)
    .maybeSingle();
  if (error) {
    console.error('shared-space lookup failed', error);
    return json(req, 500, { error: 'internal' });
  }
  if (!data) return json(req, 404, { error: 'not_found' });

  return json(req, 200, { space: sharedSpacePayload(data) });
});
