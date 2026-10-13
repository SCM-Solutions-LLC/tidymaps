import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/* index.html lists the startup module graph as <link rel="modulepreload"> so
   the browser fetches it in parallel rather than one import level at a time.
   A hand-kept list rots silently: a new static import is simply not
   preloaded, and a deferred one (viewer3d.js, products.js, demo-scenarios.js)
   left in the list would put back the download tests/e2e/startup-weight
   keeps out. So the list must equal main.js's static graph exactly. */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

const IMPORT_RE = /(?:^|[;\n])\s*(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|(?:^|[;\n])\s*import\s*['"]([^'"]+)['"]/g;

function staticGraph(entry) {
  const seen = new Set();
  (function walk(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] || m[2];
      assert.ok(spec.startsWith('.'), `bare import "${spec}" in ${relative(root, file)}: resolve it through the import map before preloading`);
      walk(resolve(dirname(file), spec));
    }
  })(resolve(root, entry));
  return [...seen].map((f) => relative(root, f)).sort();
}

const preloaded = () => [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);

test('modulepreload lists exactly the static module graph of js/main.js', () => {
  assert.deepEqual([...preloaded()].sort(), staticGraph('js/main.js'));
});

test('the lazily loaded modules stay out of the preload list', () => {
  for (const lazy of ['js/screens/viewer3d.js', 'js/screens/products.js', 'js/demo-scenarios.js']) {
    assert.ok(!preloaded().includes(lazy), `${lazy} is preloaded`);
  }
});

test('the preloads come after the import map', () => {
  /* A module fetch that starts before the import map is parsed makes Chrome
     reject the map, and "three" stops resolving. */
  const map = html.indexOf('<script type="importmap">');
  const first = html.indexOf('<link rel="modulepreload"');
  assert.ok(map > -1 && first > map, 'modulepreload precedes the import map');
});

test('the early-click guard is in <head> and main.js releases it', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /addEventListener\('click',hold,true\)/, 'the guard is not listening in the capture phase from <head>');
  assert.match(head, /window\.__tmReleaseClicks=function/);
  const main = readFileSync(resolve(root, 'js/main.js'), 'utf8');
  const release = main.indexOf('__tmReleaseClicks');
  assert.ok(release > -1, 'main.js never releases held clicks');
  assert.ok(release < main.indexOf('initializeRoute({'), 'clicks are released after the route restore, which waits on the network');
});
