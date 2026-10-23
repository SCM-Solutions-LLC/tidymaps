import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/* The stylesheets grew 40 font sizes, several half a pixel apart (13, 13.5,
   14, 14.5px), so labels, rows and captions that meant the same thing were
   set a hair apart and never lined up. The scale in css/tokens.css is the
   whole vocabulary now: eight set sizes and six fluid heading sizes. A raw
   size anywhere else is how the drift starts again. SVG text drawn by the
   scripts is in the drawing's own units and is not type on the page. */

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const uncomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

function scale() {
  const tokens = uncomment(read('css/tokens.css'));
  return Object.fromEntries([...tokens.matchAll(/(--fs-[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
}

function sizesIn(text) {
  return [...uncomment(text).matchAll(/font-size\s*:\s*([^;}"]+)/g)].map((m) => m[1].trim());
}

const sheets = readdirSync(new URL('css/', root)).filter((f) => f.endsWith('.css') && f !== 'tokens.css');
const pages = readdirSync(root).filter((f) => f.endsWith('.html'));

test('the scale is eight whole-pixel steps, smallest to largest, and six fluid sizes', () => {
  const s = scale();
  const fixed = Object.entries(s).filter(([, v]) => /^\d+px$/.test(v));
  const fluid = Object.entries(s).filter(([, v]) => v.startsWith('clamp('));
  assert.equal(fixed.length, 8, `set sizes: ${fixed.map(([k]) => k)}`);
  assert.equal(fluid.length, 6, `fluid sizes: ${fluid.map(([k]) => k)}`);
  const px = fixed.map(([, v]) => parseInt(v, 10));
  assert.deepEqual(px, [...px].sort((a, b) => a - b), 'declared in ascending order');
  assert.ok(px[0] >= 11, 'nothing on the page is set below 11px');
  assert.equal(Object.keys(s).length, fixed.length + fluid.length, 'every --fs token is a size');
});

test('every font-size in the stylesheets and pages is a token from the scale', () => {
  const s = scale();
  const bad = [];
  for (const [file, text] of [...sheets.map((f) => [`css/${f}`, read(`css/${f}`)]), ...pages.map((f) => [f, read(f)])]) {
    for (const v of sizesIn(text)) {
      const m = /^var\((--fs-[\w-]+)\)$/.exec(v);
      if (v === 'inherit' || (m && s[m[1]])) continue;
      bad.push(`${file}: font-size:${v}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the scale is used, not just declared', () => {
  const used = new Set(sheets.flatMap((f) => [...read(`css/${f}`).matchAll(/var\((--fs-[\w-]+)\)/g)].map((m) => m[1])));
  const unused = Object.keys(scale()).filter((k) => !used.has(k));
  assert.deepEqual(unused, [], 'a step nothing uses is a step to drop');
});
