import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* The step clips are baked video, so they carry a copy of the site's palette
   (remotion/src/tokens.ts). The 10-03 warm-up re-coloured css/tokens.css and
   left the copy alone: every clip kept the old stone background on the new
   sand band, a visible box around each animation, and nothing failed. Each
   colour in the copy names the variable it mirrors; this holds them equal. */

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function cssVars() {
  const root = read('css/tokens.css').match(/:root\s*\{([\s\S]*?)\n\}/)[1];
  const vars = {};
  for (const [, name, value] of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[name] = value.trim();
  const resolve = (v, seen = new Set()) => {
    const m = /^var\((--[\w-]+)\)$/.exec(v);
    if (!m) return v;
    assert.ok(!seen.has(m[1]) && vars[m[1]], `unresolvable ${v}`);
    return resolve(vars[m[1]], new Set([...seen, m[1]]));
  };
  return Object.fromEntries(Object.keys(vars).map((k) => [k, resolve(vars[k])]));
}

function clipColors() {
  const block = read('remotion/src/tokens.ts').match(/export const color = \{([\s\S]*?)\} as const;/)[1];
  return [...block.matchAll(/^\s*(\w+):\s*'([^']+)',\s*\/\/\s*(--[\w-]+)?/gm)]
    .map(([, name, value, cssVar]) => ({ name, value, cssVar }));
}

const norm = (v) => v.replace(/\s+/g, ' ').trim();

test('every clip colour names the site variable it copies', () => {
  const colors = clipColors();
  assert.ok(colors.length >= 10, 'parsed too few colours from tokens.ts');
  const unnamed = colors.filter((c) => !c.cssVar).map((c) => c.name);
  assert.deepEqual(unnamed, [], 'a clip colour with no CSS variable can drift without a test noticing');
});

test('the clip palette equals css/tokens.css', () => {
  const vars = cssVars();
  const drift = clipColors()
    .filter((c) => norm(c.value) !== norm(vars[c.cssVar] || ''))
    .map((c) => `${c.name}: ${c.value} but ${c.cssVar} is ${vars[c.cssVar]}`);
  assert.deepEqual(drift, []);
});

test('the clip background is the band it plays on', () => {
  // components.css paints .step-art with --tint; a clip on any other colour
  // shows as a box inside the band.
  const band = read('css/components.css').match(/\.step-art\{[^}]*background:var\((--[\w-]+)\)/)[1];
  const bg = clipColors().find((c) => c.name === 'bg');
  assert.equal(norm(bg.value), norm(cssVars()[band]));
});
