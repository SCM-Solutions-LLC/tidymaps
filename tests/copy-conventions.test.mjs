import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/* CLAUDE.md: no em dash in user-facing copy. The analysis prompt forbids it
   and the design uses a period, comma, or colon instead. The site's own copy
   had 40 of them in index.html alone and another hundred in the strings the
   scripts show, so the rule held for the model's prose and nowhere else.

   Pages are read with their HTML comments removed and scripts with their
   comments blanked; a comment is not copy. In scripts only quoted text is
   checked, because a regex character class may legitimately list the dash
   (personalize.js splits a cite on any dash it might have been written with). */

const root = new URL('../', import.meta.url);
const PAGES = ['index.html', '404.html', 'privacy.html', 'terms.html', 'security.html', 'cookies.html', 'accessibility.html'];

function scripts(dir) {
  return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? scripts(`${dir}${e.name}/`) : (e.name.endsWith('.js') ? [`${dir}${e.name}`] : []));
}

/* True when any string literal on the line holds an em dash. Literals are
   walked in order, because a pattern that just looks for quote-dash-quote pairs
   an empty '' with a later quote and reads a regex literal between them as a
   string (personalize.js:95 is exactly that). */
function quotedEmDash(line) {
  for (let i = 0; i < line.length; i++) {
    const q = line[i];
    if (q !== "'" && q !== '"' && q !== '`') continue;
    let j = i + 1, text = '';
    while (j < line.length && line[j] !== q) {
      if (line[j] === '\\') j++;
      text += line[j] || '';
      j++;
    }
    if (text.includes('—')) return true;
    i = j;
  }
  return false;
}

test('no em dash reaches a reader', () => {
  const offenders = [];
  for (const page of PAGES) {
    const src = readFileSync(new URL(page, root), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    src.split('\n').forEach((line, i) => {
      if (/—|&mdash;/.test(line)) offenders.push(`${page}:${i + 1}`);
    });
  }
  for (const file of scripts('js/')) {
    const src = readFileSync(new URL(file, root), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
    src.split('\n').forEach((line, i) => {
      if (quotedEmDash(line)) offenders.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], 'em dash in user-facing copy; use a period, comma, or colon (CLAUDE.md)');
});

test('the em dash check can see one', () => {
  // A guard that matches nothing passes forever. Prove the pattern reads both forms.
  assert.equal(quotedEmDash("toast('Saved — find it later')"), true);
  assert.equal(quotedEmDash('x = `Pantry — checklist`'), true);
  assert.equal(quotedEmDash("String(s || '').split(/\\s+[—–-]\\s+/)[0].replace(/[.,]$/, '')"), false);
});
