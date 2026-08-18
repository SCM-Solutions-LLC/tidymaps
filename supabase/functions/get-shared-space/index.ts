// Public read-only fetch of a shared plan. The caller presents a share_id
// (an unguessable v4 UUID the owner generated); the function looks the space
// up with the service role and returns ONLY the sanitized payload from
// _shared/sharePayload.js — never household, progress, shopping, or media,
// and never the household details the plan's own prose was written from.
// Revocation is instant: owner sets share_id to null and the lookup misses.
import { preflight, json } from '../_shared/cors.ts';
import { readJsonObject } from '../_shared/body.js';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { checkAndLog, RateLimitError } from '../_shared/ratelimit.ts';
import { sharedSpacePayload } from '../_shared/sharePayload.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const parsed = await readJsonObject(req);
  if (!parsed) return json(req, 400, { error: 'invalid_body' });
  const body = parsed as unknown as { shareId?: string };
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

  /* `household` is selected so that it can be REMOVED. sharedSpacePayload
     never emits it; it reads the ages, pet types, reach needs and note this
     owner gave, and uses them to find the same details written into the plan's
     own prose — which is where they actually live, because the analysis prompt
     asks for them there. Selecting less would mean sharing more. */
  const { data, error } = await admin
    .from('spaces')
    .select('name,space_type,goal,dims,household,plan,plan_meta,updated_at')
    .eq('share_id', shareId)
    .is('deleting_at', null)
    .maybeSingle();
  if (error) {
    console.error('shared-space lookup failed', error);
    return json(req, 500, { error: 'internal' });
  }
  if (!data) return json(req, 404, { error: 'not_found' });

  return json(req, 200, { space: sharedSpacePayload(data) });
});
