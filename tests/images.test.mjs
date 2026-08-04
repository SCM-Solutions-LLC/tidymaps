import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

// Build-time guard for the imagery pipeline. The manifest (data/images.json)
// is the single source of truth; this suite fails CI if the manifest is
// malformed, a "ready" file is missing from disk, a page references an
// undeclared image key, or a hotlinked external photo creeps back in — so a
// broken image is a build failure, never a runtime 404.
//
// It runs that last check both ways. A page referencing a key nobody declared
// is a 404 waiting to happen; a key nobody references is the quieter problem,
// since it reads to the next person as art still owed. Both fail here.

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('data/images.json', root), 'utf8'));
const html = readFileSync(new URL('index.html', root), 'utf8');

const STATUSES = new Set(['ready', 'pending']);

/* Every source file the app actually ships, concatenated. Used to answer the
   reverse question the guard below asks: is this declared key reachable from
   anywhere? */
function appSource() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(new URL(dir, root), { withFileTypes: true })) {
      if (entry.isDirectory()) walk(`${dir}${entry.name}/`);
      else if (/\.(html|js|mjs|css)$/.test(entry.name)) {
        out.push(readFileSync(new URL(`${dir}${entry.name}`, root), 'utf8'));
      }
    }
  };
  walk('js/');
  walk('css/');
  out.push(html, readFileSync(new URL('privacy.html', root), 'utf8'));
  return out.join('\n');
}

/* Declared-but-unreachable keys are allowed only here, with a reason. The
   manifest is a shipping contract, not a wish list: an entry nothing can
   reach costs a reader real time (it reads as work owed) and the guard used
   to be blind to it, which is how seventeen dead wizard-card entries sat in
   the file long after the wizard settled on line art.
   These four are captures of real screens, on disk and ready, staged for a
   product/marketing section that has not been built yet. */
const UNREFERENCED_OK = new Set([
  'product-plan-map',
  'product-plan-steps',
  'product-plan-shopping',
  'product-wizard-household',
]);

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

test('every declared key is reachable from the app (no dead manifest entries)', () => {
  const src = appSource();
  for (const [key, e] of Object.entries(manifest.images)) {
    if (UNREFERENCED_OK.has(key)) continue;
    const reachable = src.includes(`data-img="${key}"`) || src.includes(e.file);
    assert.ok(
      reachable,
      `${key}: declared in the manifest but nothing references it by data-img or by file path (${e.file}). ` +
        'Reference it, delete it, or add it to UNREFERENCED_OK with a reason.',
    );
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
