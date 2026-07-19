import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Build-time guard for the imagery pipeline. The manifest (data/images.json)
// is the single source of truth; this suite fails CI if the manifest is
// malformed, a "ready" file is missing from disk, a page references an
// undeclared image key, or a hotlinked external photo creeps back in — so a
// broken image is a build failure, never a runtime 404.

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('data/images.json', root), 'utf8'));
const html = readFileSync(new URL('index.html', root), 'utf8');

const STATUSES = new Set(['ready', 'pending']);

test('manifest is versioned and shaped correctly', () => {
  assert.equal(typeof manifest.version, 'number');
  assert.equal(typeof manifest.images, 'object');
  assert.ok(Object.keys(manifest.images).length > 0, 'manifest has no images');
});

test('every manifest entry declares file, non-empty alt, license, and a valid status', () => {
  for (const [key, e] of Object.entries(manifest.images)) {
    assert.equal(typeof e.file, 'string', `${key}: file must be a string`);
    assert.ok(e.file.length, `${key}: file is empty`);
    assert.equal(typeof e.alt, 'string', `${key}: alt must be a string`);
    assert.ok(e.alt.trim().length >= 8, `${key}: alt text is missing or too short`);
    assert.ok(e.license && typeof e.license.type === 'string', `${key}: license.type is required`);
    assert.ok(STATUSES.has(e.status), `${key}: status must be one of ${[...STATUSES].join('/')}`);
  }
});

test('every "ready" image file exists on disk (missing art fails the build, not the browser)', () => {
  for (const [key, e] of Object.entries(manifest.images)) {
    if (e.status !== 'ready') continue;
    assert.ok(existsSync(new URL(e.file, root)), `${key}: ready image missing on disk: ${e.file}`);
  }
});

test('pending images have no file on disk yet (otherwise mark them ready)', () => {
  for (const [key, e] of Object.entries(manifest.images)) {
    if (e.status !== 'pending') continue;
    assert.ok(!existsSync(new URL(e.file, root)), `${key}: file exists but status is still "pending" — mark it "ready": ${e.file}`);
  }
});

test('every data-img key referenced in index.html is declared in the manifest', () => {
  const keys = [...html.matchAll(/data-img="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 0, 'no data-img keys found in index.html');
  for (const k of keys) {
    assert.ok(manifest.images[k], `index.html references undeclared image key: ${k}`);
  }
});

test('every local assets/ image referenced by <img src> is declared in the manifest', () => {
  const srcs = [...html.matchAll(/<img[^>]*\bsrc="(assets\/[^"]+)"/g)].map((m) => m[1]);
  const declared = new Set(Object.values(manifest.images).map((e) => e.file));
  for (const src of srcs) {
    assert.ok(declared.has(src), `index.html <img src> not tracked in the manifest: ${src}`);
  }
});

test('no external image hotlinks (stock/CDN) in the app source', () => {
  const files = ['index.html', 'js/screens/landing.js', 'js/data.js', 'js/images.js'];
  const banned = /(unsplash\.com|images\.pexels\.com|source\.unsplash|cloudinary\.com|imgur\.com)/i;
  for (const f of files) {
    const txt = readFileSync(new URL(f, root), 'utf8');
    assert.doesNotMatch(txt, banned, `external image hotlink found in ${f}`);
  }
});
