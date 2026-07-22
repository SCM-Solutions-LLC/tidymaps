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
