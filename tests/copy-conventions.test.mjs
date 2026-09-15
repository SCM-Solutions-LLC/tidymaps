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

/* The text of every string literal on the line, joined. Literals are walked in
   order, because a pattern that just looks for quote-dash-quote pairs an empty
   '' with a later quote and reads a regex literal between them as a string
   (personalize.js:95 is exactly that). */
function quotedText(line) {
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const q = line[i];
    if (q !== "'" && q !== '"' && q !== '`') continue;
    let j = i + 1, text = '';
    while (j < line.length && line[j] !== q) {
      if (line[j] === '\\') j++;
      text += line[j] || '';
      j++;
    }
    out += text + ' ';
    i = j;
  }
  return out;
}
/* The entity counts as much as the character: a template string that becomes
   HTML reaches the reader as an em dash all the same (loading.js printed one
   that way while this test looked only for the character). */
const quotedEmDash = (line) => /—|&mdash;/.test(quotedText(line));

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

/* One spelling. The site is American everywhere it counts (dollars, "color",
   "organize" forty times on the landing page) and British in a handful of
   strings that arrived from elsewhere: "labelled" on four plan lines,
   "cancelled" in one error, "colour" on the accessibility statement. The
   words below are the British forms that have turned up; the list grows when
   one does, and comments are not copy. */
const BRITISH = /\b(colou?r(?:s|ed|ing)?|labell(?:ed|ing)|cancell(?:ed|ing)|organis(?:e|ed|es|ing|ation)|customis(?:e|ed|ing)|centre[sd]?|favourite|honou?r(?:ed|s)?|behaviour|licence|programme|catalogue|grey|realis(?:e|ed)|recognis(?:e|ed)|analys(?:e|ed)|minimis(?:e|ed)|optimis(?:e|ed)|prioritis(?:e|ed)|summaris(?:e|ed)|neighbour|metre|litre|whilst)\b/gi;
const british = (text) => (text.match(BRITISH) || []).filter((w) => !/^(color|colors|colored|coloring|honor|honored|honors)$/i.test(w));

test('copy is spelled the American way, like the prices', () => {
  const offenders = [];
  for (const page of PAGES) {
    const src = readFileSync(new URL(page, root), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    src.split('\n').forEach((line, i) => {
      for (const w of british(line)) offenders.push(`${page}:${i + 1} ${w}`);
    });
  }
  for (const file of scripts('js/')) {
    const src = readFileSync(new URL(file, root), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
    src.split('\n').forEach((line, i) => {
      for (const w of british(quotedText(line))) offenders.push(`${file}:${i + 1} ${w}`);
    });
  }
  assert.deepEqual(offenders, [], 'British spelling in user-facing copy; the site is American');
});
