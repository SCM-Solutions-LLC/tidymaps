/* Does the AI plan path actually work right now?

   The failure this exists for ran for about two weeks unnoticed. The
   ANTHROPIC_API_KEY expired, every analyze-space call returned 502, and the
   client fell back to a demo plan behind an honest banner. Nothing looked
   broken from the user's side, so nothing alerted, and the quiet funnel read
   as low demand rather than as an outage.

   Nothing already in this repo can catch that. CI cannot reach the real model,
   and the function returns the same 502 shape for any upstream failure, so
   there is no way to tell a bad key from a bad day without making a real
   request and looking at what comes back.

   The passive alternative was considered and rejected, and the reason is the
   whole point of this file. `spaces.plan_meta->>'source'` records
   'demo-fallback' whenever the path breaks, and reading it costs nothing —
   but it only says anything when somebody uses the app. At this app's traffic
   an outage can run for weeks with no new rows at all, and silence there is
   indistinguishable from health. That silence is the blind spot that let the
   last outage run, so the check has to generate its own traffic.

   No secrets: analyze-space is `verify_jwt: false` and the anon key is
   publishable by design, so this calls the real production function with the
   same credentials any visitor's browser uses.

   Run by hand:  npm run check:model-path
   Run daily by: .github/workflows/model-path-canary.yml */

import { readFileSync } from 'node:fs';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../js/config.js';

/* The smallest real photo in the repo — 418x630, 22KB. A canary should cost
   the least it can while still exercising the whole path, and the model does
   not need a large image to return a valid plan. */
const FIXTURE = new URL('../assets/photos/ex-cab-before.webp', import.meta.url);

/* Supabase kills the function at 150s; its own budget is 100s. Allow for the
   platform ceiling so a slow answer is reported as slow rather than as a
   client-side abort. */
const TIMEOUT_MS = 155_000;

/* Anonymous callers get 3/hour and 6/day on analyze-space, so one scheduled
   run plus one retry is comfortably inside the allowance. */
const RETRY_WAIT_MS = 70_000;

function log(...args) { console.log(...args); }

/* Two different failures, deliberately not collapsed into one.

   A 5xx from analyze-space is the outage this file exists for. Anything else —
   a rejected request, an unreachable host — means the CANARY is broken, not
   the model path, and saying "MODEL PATH BROKEN" for that would send someone
   to rotate a perfectly good API key. Both exit non-zero, because a check that
   could not run must never report success; they just say different things.

   This distinction was not theoretical: the first run of this script hit a
   403 from an egress proxy and announced the model was down. */
function failModelPath(summary, detail) {
  console.error(`\nMODEL PATH BROKEN: ${summary}`);
  if (detail) console.error(detail);
  console.error(`
What to check, cheapest first:
  1. Is ANTHROPIC_API_KEY still valid? It expires silently, and an expired key
     is what this alert was built for. \`supabase secrets list\` prints digests
     only, so a digest that looks right proves nothing about validity.
  2. Edge logs for analyze-space (function_id 335d0f7e-3935-4a0c-b429-7b9c370e9ce2).
     They retain 24 HOURS, so read them before anything else. A call failing in
     0.3-1.1s is far too fast to have reached the model, and that shape is the
     signature of an auth failure rather than a slow one.
  3. plan_meta->>'source' on the newest rows of \`spaces\`. 'demo-fallback'
     where you expected 'ai' confirms real users are getting demo plans. This
     outlives the logs.

While it is broken the app still works: users get a deterministic plan behind
an honest banner. That is why nobody notices, and why this check exists.`);
  process.exit(1);
}

function failCanary(summary, detail) {
  console.error(`\nCANARY COULD NOT RUN: ${summary}`);
  if (detail) console.error(detail);
  console.error(`
This does NOT mean the model path is down — it means this check could not
reach or satisfy analyze-space, so it learned nothing either way. Do not go
rotating the API key on the strength of it.

Likely causes:
  - the request contract moved (a 400 means analyze-space rejected the body
    this script sends; compare it against supabase/functions/analyze-space)
  - the anon key in js/config.js was rotated (401)
  - the function was renamed, removed, or the project URL changed (404)
  - the runner has no route to the project (network error, proxy)

Confirm the real state by hand before assuming anything:
  plan_meta->>'source' on the newest \`spaces\` rows still says whether real
  users are getting AI plans or demo fallbacks.`);
  process.exit(1);
}

async function callAnalyzeSpace(imageB64) {
  const body = {
    images: [{ media_type: 'image/webp', data: imageB64 }],
    /* A household with no kids and no pets keeps the enforced prompt rules at
       their simplest, so a failure here is the model path rather than a plan
       that tripped an invariant. */
    context: {
      space: 'pantry',
      household: { kids: { present: 'no' }, pets: { present: 'no' }, mobility: [] },
      effort: 'medium',
    },
  };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-space`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  let payload = null;
  try { payload = await res.json(); } catch { /* non-JSON body: status is enough */ }
  return { status: res.status, payload };
}

const imageB64 = readFileSync(FIXTURE).toString('base64');
log(`Calling analyze-space with a ${Math.round(imageB64.length / 1024)}KB fixture...`);

const started = Date.now();
let result;
try {
  result = await callAnalyzeSpace(imageB64);
} catch (e) {
  /* No response at all: DNS, TLS, proxy, or the 155s timeout. Never the model. */
  failCanary('the request never completed', `${e.name}: ${e.message}`);
}

/* Rate limiting is not an outage — but it is also not a pass. A canary that
   was turned away proved nothing, and a check that reports success when it
   never ran is the exact shape of vacuous test this repo keeps finding. So:
   retry once, then fail loudly if it still cannot get through. */
if (result.status === 429) {
  const wait = Math.max(1, Number(result.payload?.retryAfterSeconds) || RETRY_WAIT_MS / 1000);
  log(`Rate limited; waiting ${wait}s to retry once.`);
  await new Promise((r) => setTimeout(r, Math.min(wait, 300) * 1000));
  try {
    result = await callAnalyzeSpace(imageB64);
  } catch (e) {
    failCanary('the retry never completed', `${e.name}: ${e.message}`);
  }
  if (result.status === 429) {
    failCanary(
      'rate limited twice, so the model path was never actually tested',
      'This is not itself an outage, but the check learned nothing and must not\n'
      + 'report success. Either something is consuming the anonymous allowance\n'
      + '(3/hour, 6/day on analyze-space), or the schedule is running too often.',
    );
  }
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);

/* 502 and 504 are what analyze-space returns for every upstream failure,
   including the expired key. That is the outage. Everything else that is not
   200 is the canary's own problem. */
if (result.status >= 500) {
  failModelPath(
    `analyze-space returned ${result.status} after ${elapsed}s`,
    `Response: ${JSON.stringify(result.payload)}`,
  );
}

if (result.status !== 200) {
  failCanary(
    `analyze-space returned ${result.status} after ${elapsed}s`,
    `Response: ${JSON.stringify(result.payload)}`,
  );
}

/* A 200 with no plan in it would mean the contract changed under us, which is
   worth failing on rather than shrugging at. */
if (!result.payload || typeof result.payload.plan !== 'object' || result.payload.plan === null) {
  failCanary('analyze-space returned 200 with no plan', `Response: ${JSON.stringify(result.payload)}`);
}

log(`OK — real plan returned in ${elapsed}s from model ${result.payload.model}.`);
log(`spaceType: ${result.payload.plan.spaceType}, steps: ${result.payload.plan.steps?.length ?? '?'}`);
