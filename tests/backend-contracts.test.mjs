import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
