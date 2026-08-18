import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const rateLimit = readFileSync(new URL('../supabase/functions/_shared/ratelimit.ts', import.meta.url), 'utf8');
const migrations = [1, 2, 3, 4, 5, 6, 7]
  .map((n) => {
    try { return readFileSync(new URL(`../supabase/migrations/000${n}_atomic_usage_and_storage.sql`, import.meta.url), 'utf8'); }
    catch { return ''; }
  }).join('\n');
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

  // A single-value header set by the edge wins, since it carries one address
  // with nothing for a caller to prepend.
  assert.equal(callerIp(new Headers({ 'x-real-ip': REAL, 'x-forwarded-for': `1.2.3.4, 9.9.9.9` })), REAL);
  assert.equal(callerIp(new Headers({ 'cf-connecting-ip': REAL, 'x-forwarded-for': '1.2.3.4' })), REAL);

  // But only when it really holds one well-formed address: a caller that
  // smuggles a chain through that header name is ignored, not trusted.
  assert.equal(callerIp(new Headers({ 'x-real-ip': `1.2.3.4, 5.6.7.8`, 'x-forwarded-for': `evil, ${REAL}` })), REAL);
  assert.equal(callerIp(new Headers({ 'x-real-ip': 'not-an-address', 'x-forwarded-for': `evil, ${REAL}` })), REAL);

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
test('a body that is not an object is refused rather than dereferenced', async () => {
  const asRequest = (text) => ({ json: async () => JSON.parse(text) });

  for (const bad of ['null', '4', '"hi"', '[]', '[{"kind":"feedback"}]', 'true']) {
    assert.equal(await readJsonObject(asRequest(bad)), null, `${bad} must not pass as a body`);
  }
  assert.equal(await readJsonObject({ json: async () => { throw new SyntaxError('bad'); } }), null,
    'unparseable JSON is still refused');

  assert.deepEqual(await readJsonObject(asRequest('{"kind":"feedback"}')), { kind: 'feedback' });
  assert.deepEqual(await readJsonObject(asRequest('{}')), {}, 'an empty object is a valid body');
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

/* ---------- The temporary caller-IP diagnostic ----------

   A diagnostic that leaks is worse than the uncertainty it resolves, so the
   properties that make this one safe to deploy are pinned here rather than
   left to the reviewer's eye. Delete this test with the function. */
test('the header diagnostic is inert without its token and never echoes a value', () => {
  const src = readFileSync(new URL('../supabase/functions/debug-headers/index.ts', import.meta.url), 'utf8');

  // No secret set => the endpoint does nothing, so forgetting to remove it is
  // not the same as leaving a hole open.
  assert.match(src, /if \(!expected \|\| !tokenMatches\(given, expected\)\)/);
  assert.match(src, /return json\(req, 404, \{ error: 'not_found' \}\)/,
    'a wrong token must be indistinguishable from no such endpoint');
  // Compared without an early return, so the token cannot be recovered a byte
  // at a time from response timing.
  assert.match(src, /diff \|= given\.charCodeAt\(i\) \^ expected\.charCodeAt\(i\)/);

  /* Shape only. A caller's address is personal data; the question this answers
     is "which header won", which needs no value. `raw` must reach only
     length/parse checks, never the response body. */
  assert.doesNotMatch(src, /value:\s*raw|raw,\s*$/m, 'a raw header value reaches the response');
  assert.doesNotMatch(src, /console\.(log|error|warn)/, 'a header value could reach the logs');

  // Nothing billable: no model call, no table, no storage.
  for (const forbidden of ['adminClient', 'checkAndLog', 'anthropic', 'generativelanguage', 'from(']) {
    assert.ok(!src.includes(forbidden), `the diagnostic must not use ${forbidden}`);
  }
});

test('the diagnostic and its probe are removed together', () => {
  /* Both halves are temporary, and a probe left pointing at a deleted function
     is a confusing failure rather than an answer. If one is gone the other
     must be too — this test then goes with them. */
  const root = new URL('../', import.meta.url);
  const fnExists = existsSync(new URL('supabase/functions/debug-headers/index.ts', root));
  const probeExists = existsSync(new URL('scripts/probe-caller-ip.mjs', root));
  assert.equal(fnExists, probeExists,
    'debug-headers and scripts/probe-caller-ip.mjs must be added and deleted as a pair');
  if (fnExists) {
    const config = readFileSync(new URL('supabase/config.toml', root), 'utf8');
    assert.match(config, /\[functions\.debug-headers\]/,
      'the diagnostic is deployed by CI, so it has to declare verify_jwt like the rest');
  }
});
