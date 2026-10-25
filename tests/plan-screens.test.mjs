import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planScreenGlobals } from '../js/planScreens.js';

/* The report, the analysis, Adjust and the export load on first use
   (js/planScreens.js) instead of with the landing page. Two things keep that
   true and working. */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

function jsFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return jsFiles(rel);
    return e.name.endsWith('.js') ? [rel] : [];
  });
}

/* Every inline on* handler calls a global, and main.js's window table is
   where they come from. Moving a module behind a loader moves its handlers
   to stand-ins: one dropped on the way is a button that does nothing, and
   only the e2e spec that happens to press it would notice. */
test('every function an inline handler calls is on window at boot', () => {
  const sources = ['index.html', ...jsFiles('js')].map(read);
  const called = new Set();
  for (const src of sources) {
    for (const [, body] of src.matchAll(/\son[a-z]+="([^"]*)"/g)) {
      for (const [, name] of body.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (name !== 'if') called.add(name);
      }
    }
  }
  assert.ok(called.size > 20, `found only ${called.size} handler names; the scan is broken`);
  const main = stripComments(read('js/main.js'));
  const table = main.slice(main.indexOf('Object.assign(window, {'));
  const onWindow = new Set([
    ...[...table.slice(0, table.indexOf('});')).matchAll(/[A-Za-z_$][\w$]*/g)].map(([n]) => n),
    ...Object.keys(planScreenGlobals()),
  ]);
  assert.match(table, /\.\.\.planScreenGlobals\(\)/, 'main.js no longer puts the stand-ins on window');
  const missing = [...called].filter((name) => !onWindow.has(name));
  assert.deepEqual(missing, [], `inline handlers call functions nothing puts on window: ${missing.join(', ')}`);
});

/* The boot graph, walked: every static import from js/main.js, transitively.
   One static import of any of these, anywhere on that path, puts it and
   everything it imports back on the landing page. */
test('the landing page reaches none of the plan screens by a static import', () => {
  const edges = new Map();
  const walk = (file) => {
    if (edges.has(file)) return;
    const src = stripComments(readFileSync(file, 'utf8'));
    const out = [...src.matchAll(/(?:^|[;\n}])\s*(?:import\s+(?:[\w*{}\s,$]+\s+from\s+)?|export\s+(?:\*|\{[^}]*\})\s+from\s+)['"](\.[^'"]+)['"]/g)]
      .map(([, spec]) => resolve(dirname(file), spec));
    edges.set(file, out);
    out.filter(existsSync).forEach(walk);
  };
  walk(join(root, 'js/main.js'));
  const eager = new Set([...edges.keys()].map((f) => f.slice(root.length + 1)));
  assert.ok(eager.has('js/router.js') && eager.has('js/screens/wizard.js'), 'the walk missed the boot path');
  const deferred = ['js/screens/results.js', 'js/screens/loading.js', 'js/screens/customize.js', 'js/planExport.js',
    'js/personalize.js', 'js/setupStructure.js', 'js/catalog.js'];
  assert.deepEqual(deferred.filter((f) => eager.has(f)), [],
    'statically reachable from js/main.js again');
});
