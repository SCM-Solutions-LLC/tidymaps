// Feedback and Founding Circle invite requests.
//
// Both tables used to be written straight from the browser through PostgREST
// under `insert to anon with check (true)`, which meant three things: the
// rate limiter never ran (it lives in the edge functions, not in RLS), so
// anyone holding the public anon key could insert unbounded rows; `user_id`
// came from the request body, so a caller could attribute a submission to
// someone else; and on invite_requests the unique index on lower(email) turned
// a duplicate-key error into an oracle for "has this address already signed
// up". Routing both through here fixes all three — the limits are the same
// machinery every other function uses, and user_id comes from the verified
// caller, never the body.
import { preflight, json } from '../_shared/cors.ts';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { checkAndLog, RateLimitError } from '../_shared/ratelimit.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_TEXT = 2000;

// Free text is capped rather than rejected: a truncated comment is still
// useful, an error message to someone giving feedback is not.
function text(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  // next_space matches the column and is what js/screens/feedback.js sends;
  // nextSpace is accepted too so either spelling round-trips.
  let body: {
    kind?: string; email?: string; useful?: unknown; vs?: unknown;
    comments?: unknown; next_space?: unknown; nextSpace?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'invalid_json' });
  }

  const kind = String(body.kind ?? '');
  if (kind !== 'feedback' && kind !== 'invite') return json(req, 400, { error: 'bad_kind' });

  const admin = adminClient();
  const caller = await getCaller(req);
  try {
    // Both are one-off human actions; a handful an hour is far above honest use.
    await checkAndLog(admin, 'submit-form', caller, { perHour: 10, perDay: 30, globalPerDay: 5000 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(req, 429, { error: 'rate_limited', retryAfterSeconds: e.retryAfterSeconds });
    }
    console.error('ratelimit check failed', e);
    return json(req, 500, { error: 'internal' });
  }

  if (kind === 'invite') {
    const email = text(body.email, 320);
    if (!email || !EMAIL_RE.test(email)) return json(req, 400, { error: 'bad_email' });
    const { error } = await admin.from('invite_requests')
      .insert({ email, user_id: caller.userId });
    // 23505 is the unique index on lower(email). Already on the list is the
    // outcome the person wanted, and reporting it identically to a fresh
    // signup is what keeps this from answering "is this address registered?".
    if (error && error.code !== '23505') {
      console.error('invite insert failed', error);
      return json(req, 500, { error: 'internal' });
    }
    return json(req, 200, { ok: true });
  }

  const { error } = await admin.from('feedback').insert({
    user_id: caller.userId,
    useful: text(body.useful),
    vs: text(body.vs),
    comments: text(body.comments, MAX_TEXT),
    next_space: text(body.next_space ?? body.nextSpace),
  });
  if (error) {
    console.error('feedback insert failed', error);
    return json(req, 500, { error: 'internal' });
  }
  return json(req, 200, { ok: true });
});
