import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rateLimit = readFileSync(new URL('../supabase/functions/_shared/ratelimit.ts', import.meta.url), 'utf8');
const migrations = [1, 2, 3, 4, 5, 6, 7]
  .map((n) => {
    try { return readFileSync(new URL(`../supabase/migrations/000${n}_atomic_usage_and_storage.sql`, import.meta.url), 'utf8'); }
    catch { return ''; }
  }).join('\n');
const retention = readFileSync(new URL('../supabase/migrations/0011_event_retention.sql', import.meta.url), 'utf8');
const advisorFixes = readFileSync(new URL('../supabase/migrations/0012_advisor_rls_and_indexes.sql', import.meta.url), 'utf8');
const renderAfter = readFileSync(new URL('../supabase/functions/render-after/index.ts', import.meta.url), 'utf8');
const getSharedSpace = readFileSync(new URL('../supabase/functions/get-shared-space/index.ts', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../supabase/functions/_shared/auth.ts', import.meta.url), 'utf8');
import { callerIp } from '../supabase/functions/_shared/callerIp.js';
import { readJsonObject } from '../supabase/functions/_shared/body.js';

test('rate limiting is delegated to one atomic database operation', () => {
  assert.match(rateLimit, /\.rpc\(['"]check_and_log_usage['"]/);
  assert.doesNotMatch(rateLimit, /countSince/);
  assert.match(migrations, /pg_advisory_xact_lock/);
  assert.match(migrations, /insert into public\.usage_events/);
  assert.match(migrations, /deleting_at/);
  assert.match(migrations, /deletion_files_removed/);
});

test('replacing an after render removes the previous object and metadata', () => {
  assert.match(renderAfter, /previousRenderPath/);
  assert.match(renderAfter, /metadataError/);
  assert.match(renderAfter, /storage\.from\('space-media'\)\.remove/);
  assert.match(renderAfter, /\.from\('space_media'\)\.delete/);
  const persistence = renderAfter.slice(renderAfter.indexOf('let storagePath'));
  const metadataIndex = persistence.indexOf("from('space_media').insert");
  const pointerIndex = persistence.indexOf("from('spaces')", metadataIndex);
  assert.ok(
    metadataIndex >= 0 && pointerIndex > metadataIndex,
    'new render metadata must be recorded before the space pointer changes',
  );
  assert.match(persistence, /\.is\('after_render_path', null\)/);
  assert.match(persistence, /\.eq\('after_render_path', previousRenderPath\)/);
  assert.ok(
    (renderAfter.match(/\.is\('deleting_at', null\)/g)||[]).length >= 2,
    'ownership and pointer updates must both lose once deletion starts',
  );
});

test('anonymous caller hashing requires a configured secret salt', () => {
  assert.match(auth, /IP_HASH_SALT is not configured/);
  assert.doesNotMatch(auth, /\?\? ['"]tidymap['"]/);
});

test('public share lookup hides spaces whose deletion has started', () => {
  assert.match(getSharedSpace, /\.is\('deleting_at', null\)/);
});

/* The redaction in _shared/sharePayload.js works from the household the row
   stores: the ages, pet types, reach needs and note it checks the plan's prose
   against. Drop `household` from this SELECT — an obvious tidy-up, since the
   payload must never contain it — and every one of those checks still runs,
   finds nothing to match, and passes. The sanitizer would keep its tests and
   lose its teeth, silently, for exactly the households that need it. */
test('the share lookup reads the household it is going to redact against', () => {
  const select = /\.select\('([^']*)'\)/.exec(getSharedSpace);
  assert.ok(select, 'the shared-space query must select an explicit column list');
  assert.ok(select[1].split(',').includes('household'),
    'sharePayload cannot remove household details from the plan text without knowing them');
  // And it stays out of the response: the payload builder is the only writer.
  assert.doesNotMatch(getSharedSpace, /household:/);
});

const analyzeSpace = readFileSync(new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');

/* Half of the share-safety guarantee is structural: safetyNotes and every
   row's `safety` are dropped whole, so anything written there cannot reach a
   visitor. That only holds if the prompt keeps household specifics in those
   two fields, which is why the instruction is asserted rather than trusted to
   survive the next prompt edit. */
test('the analysis prompt confines household specifics to the shareable fields', () => {
  assert.match(analyzeSpace, /Household specifics belong in safety\.why and safetyNotes ONLY/);
  assert.match(analyzeSpace, /answer it in a safety\.why or in safetyNotes/,
    'the free-text note is the one the offline path leaks, so it is named explicitly');
});

/* The global breaker exists to cap what an ANONYMOUS flood can cost — a
   caller with no account can mint a fresh rate-limit identity by IP, so the
   shared daily ceiling is the only thing standing between that and unbounded
   cost. Applied to signed-in callers too, that same anonymous flood could
   exhaust the shared ceiling and lock out someone who never made a call of
   their own; a signed-in caller is already capped by their own perHour/perDay.
   Extracts each function's checkAndLog call by source position rather than a
   single regex across the whole file, so the signed-in and anonymous branches
   cannot be matched in the wrong order. */
function checkAndLogBranches(src, fnName) {
  const call = src.slice(src.indexOf(`checkAndLog(admin, '${fnName}'`));
  const body = call.slice(0, call.indexOf(');') + 2);
  const signedIn = /caller\.userId\s*\?\s*(\{[^}]*\})/.exec(body);
  const anon = /:\s*(\{[^}]*\})\s*\)\s*;/.exec(body);
  return { signedIn: signedIn && signedIn[1], anon: anon && anon[1] };
}

test('the global breaker on render-after and analyze-space does not apply to signed-in callers', () => {
  for (const [fn, src] of [['render-after', renderAfter], ['analyze-space', analyzeSpace]]) {
    const { signedIn, anon } = checkAndLogBranches(src, fn);
    assert.ok(signedIn, `${fn}: could not find the signed-in rate-limit branch`);
    assert.ok(anon, `${fn}: could not find the anonymous rate-limit branch`);
    assert.doesNotMatch(signedIn, /globalPerDay/,
      `${fn}: a signed-in caller can still be locked out by an anonymous flood`);
    assert.match(anon, /globalPerDay/, `${fn}: the anonymous branch lost its global breaker entirely`);
  }
});

/* The upstream model API's own error text used to ride straight through to
   the client in the final failure response — logged for debugging (still is,
   a line above) but also handed to whoever is asking, whatever the upstream
   response happened to say. js/api.js reads only the stable `error` code to
   choose what it shows (analysisFailureCopy, renderAfterErrorMessage); it
   never reads a detail field on this path, so returning it added nothing a
   client uses. render-after's own error responses never carried it either —
   this brings analyze-space's last-attempt failure in line with that. */
test('analyze-space does not return the upstream model error text to the caller', () => {
  const finalFailure = analyzeSpace.slice(
    analyzeSpace.indexOf('if (!result.ok) {'),
    analyzeSpace.indexOf('messages = [', analyzeSpace.indexOf('if (!result.ok) {')),
  );
  assert.match(finalFailure, /console\.error\(.*result\.detail/, 'the detail is no longer logged for debugging either');
  assert.match(finalFailure, /return json\(req, result\.status, \{ error: result\.error \}\);/,
    'the client-facing response still carries the upstream error text');
});

/* X-Forwarded-For grows left to right: every proxy APPENDS the address of the
   peer it received from, so a request that crossed one trusted edge reads
   "<whatever the client sent>, <address the edge saw>". Reading entry [0] read
   a value the caller chose, which meant an anonymous caller could vary the
   header per request, mint a fresh rate-limit identity every time, and walk
   past the 3/hour and 6/day ceilings on analyze-space — a function that spends
   real API credit for 70-90 seconds on every call. */
test('a forged X-Forwarded-For cannot change the rate-limit identity', () => {
  const headers = (value) => new Headers(value ? { 'x-forwarded-for': value } : {});
  const REAL = '203.0.113.7';

  // One trusted hop, nothing forged.
  assert.equal(callerIp(headers(REAL)), REAL);

  // The caller prepends whatever it likes; our edge appends the truth.
  assert.equal(callerIp(headers(`1.2.3.4, ${REAL}`)), REAL);
  assert.equal(callerIp(headers(`9.9.9.9, 8.8.8.8, ${REAL}`)), REAL);

  // Two callers forging different values still land on the same identity,
  // which is the whole point — the bypass was that they did not.
  assert.equal(callerIp(headers(`aaa, ${REAL}`)), callerIp(headers(`bbb, ${REAL}`)));

  // Whitespace and empty entries do not shift which hop is trusted.
  assert.equal(callerIp(headers(`  1.2.3.4 ,  ${REAL}  `)), REAL);
  assert.equal(callerIp(headers('')), '');
  assert.equal(callerIp(new Headers()), '');

  /* cf-connecting-ip wins: it carries one address, Cloudflare sets it, and a
     request that tries to send its own is rejected at the edge with a 403
     before the function runs. Measured against the deployment on 2026-08-18 —
     see the header notes in callerIp.js. */
  assert.equal(callerIp(new Headers({ 'cf-connecting-ip': REAL, 'x-forwarded-for': '1.2.3.4' })), REAL);

  // But only when it really holds one well-formed address: a caller that
  // smuggles a chain through that header name is ignored, not trusted.
  assert.equal(callerIp(new Headers({ 'cf-connecting-ip': `1.2.3.4, 5.6.7.8`, 'x-forwarded-for': `evil, ${REAL}` })), REAL);
  assert.equal(callerIp(new Headers({ 'cf-connecting-ip': 'not-an-address', 'x-forwarded-for': `evil, ${REAL}` })), REAL);

  /* `deadbeef` passed the old /^[0-9a-fA-F:.]+$/ guard. It is only reachable
     through a header the gateway controls, so it was never the bypass the
     review took it for — but a value that is not an address has no business
     becoming one. */
  assert.equal(callerIp(new Headers({ 'cf-connecting-ip': 'deadbeef', 'x-forwarded-for': `evil, ${REAL}` })), REAL);
  assert.equal(callerIp(new Headers({ 'cf-connecting-ip': '999.1.1.1', 'x-forwarded-for': `evil, ${REAL}` })), REAL);
  // Real addresses still pass, IPv6 included.
  assert.equal(callerIp(new Headers({ 'cf-connecting-ip': '2001:db8::1' })), '2001:db8::1');

  /* x-real-ip is NOT trusted, though the gateway strips it today. That is the
     gateway's doing, and the day it changes this would hand an attacker the
     identity of their choice with nothing failing. The trusted set holds only
     what was shown to be gateway-controlled. */
  assert.equal(callerIp(new Headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': `evil, ${REAL}` })), REAL);
  assert.equal(callerIp(new Headers({ 'x-real-ip': '1.2.3.4' })), '',
    'x-real-ip alone must not become an identity');

  // And the function actually uses it, rather than re-parsing the header.
  assert.match(auth, /callerIp\(req\.headers\)/);
  assert.doesNotMatch(auth, /x-forwarded-for['"]\s*\)\s*\?\?\s*['"]['"]\)\.split\(','\)\[0\]/);
});

/* feedback and invite_requests were the only tables the browser wrote
   directly. The rate limiter lives in the edge functions, not in RLS, so that
   path had no ceiling; user_id came from the request body; and the unique
   index on lower(email) turned a duplicate-key error into an oracle for
   whether an address had already signed up. */
test('form submissions go through the rate-limited function, not straight to the table', () => {
  const db = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
  assert.doesNotMatch(db, /from\(['"]feedback['"]\)/, 'client still inserts into feedback directly');
  assert.doesNotMatch(db, /from\(['"]invite_requests['"]\)/, 'client still inserts into invite_requests directly');

  const submitForm = readFileSync(new URL('../supabase/functions/submit-form/index.ts', import.meta.url), 'utf8');
  assert.match(submitForm, /checkAndLog\(/, 'submit-form does not rate limit');
  assert.match(submitForm, /user_id: caller\.userId/, 'user_id must come from the caller, not the body');
  // A duplicate invite is reported exactly like a fresh one.
  assert.match(submitForm, /23505/);

  const dropPolicies = readFileSync(
    new URL('../supabase/migrations/0008_form_submissions_via_function.sql', import.meta.url), 'utf8');
  assert.match(dropPolicies, /drop policy if exists "anyone can submit" on public\.feedback/);
  assert.match(dropPolicies, /drop policy if exists "anyone can request an invite" on public\.invite_requests/);
});

/* verify_jwt was undeclared for every function, so production drifted into a
   split state the repo did not record and the next deploy could flip again. */
test('every edge function declares verify_jwt in config.toml', () => {
  const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  for (const fn of ['analyze-space', 'render-after', 'track-events', 'get-shared-space', 'submit-form']) {
    assert.match(config, new RegExp(`\\[functions\\.${fn}\\][\\s\\S]{0,80}?verify_jwt`),
      `${fn}: verify_jwt is not declared, so the deploy decides it`);
  }
});

/* ---------- Request bodies ----------

   Every function wrapped `await req.json()` in a try/catch for malformed JSON
   and then trusted the result — but JSON.parse succeeds just as readily on
   `null`, `4`, `"hi"` and `[]`. Each of those reached the property access on
   the next line, and `body.images` on a null body throws a TypeError the
   runtime turns into a 500: the caller's mistake reported as a server fault,
   generated on demand by anyone, burying the real 500s in the log. */
const noHeaders = { get: () => null };
const asRequest = (text) => ({ json: async () => JSON.parse(text), headers: noHeaders });

test('a body that is not an object is refused rather than dereferenced', async () => {
  for (const bad of ['null', '4', '"hi"', '[]', '[{"kind":"feedback"}]', 'true']) {
    assert.equal(await readJsonObject(asRequest(bad)), null, `${bad} must not pass as a body`);
  }
  assert.equal(await readJsonObject({ json: async () => { throw new SyntaxError('bad'); }, headers: noHeaders }), null,
    'unparseable JSON is still refused');

  assert.deepEqual(await readJsonObject(asRequest('{"kind":"feedback"}')), { kind: 'feedback' });
  assert.deepEqual(await readJsonObject(asRequest('{}')), {}, 'an empty object is a valid body');
});

/* req.json() used to run before any auth or rate-limit check, so a caller
   nobody had authorized yet could still make the function spend CPU and
   memory reading and parsing an arbitrarily large body. Content-Length is
   checked first now, and cheaply, before req.json() is ever called. */
test('a body larger than the shared cap is refused before it is parsed', async () => {
  let parsed = false;
  const req = {
    json: async () => { parsed = true; return {}; },
    headers: { get: (k) => (k.toLowerCase() === 'content-length' ? '20000000' : null) },
  };
  assert.equal(await readJsonObject(req), null, 'an oversized body was not refused');
  assert.equal(parsed, false, 'the oversized body was read and parsed anyway');
});

test('a body within the cap still parses normally', async () => {
  const req = {
    json: async () => ({ ok: true }),
    headers: { get: (k) => (k.toLowerCase() === 'content-length' ? '1000' : null) },
  };
  assert.deepEqual(await readJsonObject(req), { ok: true });
});

test('a request with no Content-Length at all (chunked transfer) still parses', async () => {
  assert.deepEqual(await readJsonObject(asRequest('{"ok":true}')), { ok: true });
});

/* The privacy page's promise is specific: "they are uploaded to your private
   account only when you save or share the space. The plan itself saves
   automatically, your photos do not." autoSaveSpace creates the spaces row
   (and so state.activeSpaceId) the moment a plan exists, well before any
   explicit save — so gating the after-render's storage write on spaceId
   alone persists a photo of the user's home on the strength of an auto-save
   they never asked for. Requiring an existing photo/frame media row first
   ties it to the same explicit save or share that already gates the before
   photo, without the client having to be trusted to say so itself. */
test('render-after only persists its output to a space that already has a saved photo', () => {
  const ownership = renderAfter.slice(
    renderAfter.indexOf('// Ownership check up front'),
    renderAfter.indexOf('try {', renderAfter.indexOf('// Ownership check up front')),
  );
  assert.match(ownership, /from\('space_media'\)/,
    'the ownership check never looks for an existing saved photo');
  assert.match(ownership, /\.in\('kind',\s*\[['"]photo['"],\s*['"]frame['"]\]\)/,
    'the saved-photo check does not look at the same kinds coverUrl treats as the before photo');
  const persistence = renderAfter.slice(renderAfter.indexOf('let storagePath'));
  const guard = /if \(spaceOwned\s*&&\s*(\w+)\s*&&\s*body\.spaceId\s*&&\s*caller\.userId\)/.exec(persistence);
  assert.ok(guard, 'the persistence branch does not check for a saved photo alongside ownership');
});

/* Neither table had a purge before this migration, so both grew forever.
   usage_events only ever answers a "last hour/last day" question
   (check_and_log_usage above), so anything kept past that is pure liability;
   telemetry_events feeds trend reports and gets a longer runway. The function
   is scheduled with pg_cron rather than left to run by hand, because a purge
   nobody remembers to run is the same as no purge. */
test('event retention purges usage_events and telemetry_events on a schedule', () => {
  assert.match(retention, /delete from public\.usage_events where created_at < now\(\) - interval/);
  assert.match(retention, /delete from public\.telemetry_events where created_at < now\(\) - interval/);
  assert.match(retention, /cron\.schedule\(/, 'the purge is defined but never scheduled to actually run');
  assert.match(retention, /revoke all on function public\.purge_old_events\(\)\s*\n?\s*from public, anon, authenticated/,
    'the purge function must not be callable by anon/authenticated clients');
  assert.match(retention, /create extension if not exists pg_cron with schema extensions/,
    'pg_cron should not land in the public schema, the same finding as pg_net');
});

/* A bare auth.uid() in a policy is re-evaluated per row; the Supabase advisor
   flags this as auth_rls_initplan on every policy that does it. Five policies
   had it (0009 already dealt with the project's other two advisor findings,
   as deliberate non-fixes, so they are not repeated here) — each is asserted
   by name so a future policy edit that reintroduces a bare auth.uid() on one
   of these five is caught, rather than the count alone letting a wrap on one
   policy hide a miss on another. */
test('five RLS policies wrap auth.uid() in a scalar subselect instead of leaving it bare', () => {
  const policies = [
    'own profile select', 'own profile insert', 'own profile update',
    'own spaces all', 'own media all',
  ];
  for (const name of policies) {
    const stmt = advisorFixes.slice(advisorFixes.indexOf(`alter policy "${name}"`));
    const clause = stmt.slice(0, stmt.indexOf(';') + 1);
    const wrapped = clause.match(/\(select auth\.uid\(\)\)/g) || [];
    const total = clause.match(/auth\.uid\(\)/g) || [];
    assert.ok(wrapped.length > 0, `policy "${name}" still has a bare auth.uid()`);
    assert.equal(wrapped.length, total.length, `policy "${name}" mixes a wrapped and a bare auth.uid()`);
  }
});

test('the three previously unindexed user_id foreign keys are now indexed', () => {
  for (const table of ['feedback', 'invite_requests', 'space_media']) {
    assert.match(advisorFixes, new RegExp(`create index \\w+ on public\\.${table} \\(user_id\\)`),
      `${table}.user_id has no index`);
  }
});

test('every function reads its body through the shared guard', () => {
  for (const fn of ['analyze-space', 'render-after', 'track-events', 'get-shared-space', 'submit-form']) {
    const src = readFileSync(new URL(`../supabase/functions/${fn}/index.ts`, import.meta.url), 'utf8');
    assert.match(src, /readJsonObject\(req\)/, `${fn} does not use the shared body guard`);
    assert.match(src, /error: 'invalid_body'/, `${fn} does not answer a bad body with 400`);
    assert.doesNotMatch(src, /await req\.json\(\)/,
      `${fn} still parses its own body, so the guard can be bypassed there`);
  }
});
