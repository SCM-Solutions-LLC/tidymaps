import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

/* Whole-site checks that no single feature owns.

   A static site rots in ways no feature test sees: a link to a file somebody
   renamed, a copyright year frozen at the year it was typed, a missing 404 so
   every mistyped URL lands on GitHub's default page with no way back. None of
   those break a test that exercises the wizard, and all of them are visible to
   the first person who hits them.

   tests/legal-pages.test.mjs pins the five legal documents as a set. This file
   is the layer above: every page on the site, including index and 404. */

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

/* Discovered rather than listed, so a page added later is covered without
   anyone remembering to add it here. */
const PAGES = readdirSync(new URL(root)).filter((f) => f.endsWith('.html')).sort();

test('the site is the set of pages we think it is', () => {
  assert.deepEqual(PAGES, [
    '404.html', 'accessibility.html', 'cookies.html',
    'index.html', 'privacy.html', 'security.html', 'terms.html',
  ]);
});

/* ---------- every link points at something ---------- */

/* href values that are not files: fragments, mail, and off-site links. The
   off-site ones are not fetched here — a unit test that reaches the network is
   a unit test that fails when the network does. */
const isExternal = (h) => /^(https?:|mailto:|tel:|data:)/.test(h);

test('every internal link and asset reference resolves to a file that exists', () => {
  for (const page of PAGES) {
    const src = read(page);
    const refs = new Set();
    for (const m of src.matchAll(/(?:href|src)="([^"]+)"/g)) refs.add(m[1]);

    for (const ref of refs) {
      if (isExternal(ref) || ref === '#' || ref.startsWith('#')) continue;
      const [path, fragment] = ref.split('#');
      assert.ok(
        existsSync(new URL(path, root)),
        `${page}: links to ${path}, which does not exist`,
      );
      /* A link into another page's anchor is just as broken as a link to a
         missing page, and it fails silently — the browser lands at the top of
         the page and the reader never learns they missed the section. */
      if (fragment) {
        assert.match(
          read(path),
          new RegExp(`id="${fragment}"`),
          `${page}: links to ${path}#${fragment}, and that page has no such id`,
        );
      }
    }
  }
});

test('every in-page anchor has a target on the same page', () => {
  for (const page of PAGES) {
    const src = read(page);
    for (const m of src.matchAll(/href="#([^"]+)"/g)) {
      assert.match(src, new RegExp(`id="${m[1]}"`), `${page}: #${m[1]} goes nowhere`);
    }
  }
});

/* ---------- the copyright year does not go stale ---------- */

test('no page carries a hard-coded copyright year', () => {
  for (const page of PAGES) {
    const src = read(page);
    if (!src.includes('&copy;')) continue;
    assert.match(
      src,
      /&copy; <span data-year>\d{4}<\/span>/,
      `${page}: copyright year is not in a data-year slot, so it freezes`,
    );
    /* The slot is only useful if something fills it. */
    assert.match(src, /<script src="js\/year\.js"/, `${page}: has a year slot but never loads js/year.js`);
  }
});

test('the year script rewrites every slot from the clock', async () => {
  const src = read('js/year.js');
  const slots = [{ textContent: '2019' }, { textContent: '2020' }];
  const document = { querySelectorAll: (sel) => (sel === '[data-year]' ? slots : []) };
  new Function('document', src)(document);
  const now = String(new Date().getFullYear());
  assert.deepEqual(slots.map((s) => s.textContent), [now, now]);
});

/* ---------- the 404 ---------- */

test('the 404 page is a complete page that leads somewhere', () => {
  const src = read('404.html');
  assert.match(src, /^<!doctype html>/i, 'no doctype');
  assert.match(src, /<html lang="en">/, 'no lang on <html>');
  assert.match(src, /<title>[^<]+<\/title>/, 'no title');
  assert.match(src, /<meta name="description" content="[^"]{40,}"/, 'no useful meta description');
  assert.match(src, /<link rel="icon" href="assets\/favicon\.svg" \/>/, 'no favicon');

  /* A miss must not be indexed, and it must not claim to be a page: no
     canonical, because the URL that produced it is not one. */
  assert.match(src, /<meta name="robots" content="noindex/, '404 does not tell crawlers to skip it');
  assert.ok(!src.includes('rel="canonical"'), '404 declares a canonical URL');

  /* The point of a custom 404 is the way out. */
  assert.ok(src.includes('href="index.html"'), '404 has no link home');
  for (const page of ['privacy.html', 'terms.html', 'security.html', 'cookies.html', 'accessibility.html']) {
    assert.ok(src.includes(`href="${page}"`), `404 does not link to ${page}`);
  }
  assert.ok(src.includes('mailto:contact@scmsolutions.org'), '404 gives no way to report the bad link');
});

/* ---------- titles and descriptions, on every page ---------- */

test('every page has a distinct title and its own description', () => {
  const titles = new Map();
  const descriptions = new Map();
  for (const page of PAGES) {
    const src = read(page);
    const title = src.match(/<title>([^<]+)<\/title>/);
    assert.ok(title, `${page}: no title`);
    assert.ok(title[1].trim().length >= 10, `${page}: title is too short to say anything`);
    assert.ok(!titles.has(title[1]), `${page}: shares its title with ${titles.get(title[1])}`);
    titles.set(title[1], page);

    const desc = src.match(/<meta name="description" content="([^"]+)"/);
    assert.ok(desc, `${page}: no meta description`);
    const length = desc[1].length;
    assert.ok(length >= 50 && length <= 300, `${page}: description is ${length} characters`);
    assert.ok(!descriptions.has(desc[1]), `${page}: shares its description with ${descriptions.get(desc[1])}`);
    descriptions.set(desc[1], page);
  }
});
