import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PAGES = ['index', '404', 'privacy', 'terms', 'security', 'cookies', 'accessibility'];

/* Every page's theme-color drives the browser chrome color on mobile — a
   different value per page turned the address bar a different shade as
   visitors moved through the site, which is a bug, not a design. */
test('every page uses the same theme-color', () => {
  const values = new Set();
  for (const p of PAGES) {
    const src = readFileSync(new URL(`../${p}.html`, import.meta.url), 'utf8');
    const match = /<meta name="theme-color" content="([^"]+)"/.exec(src);
    assert.ok(match, `${p}.html has no theme-color meta`);
    values.add(match[1]);
  }
  assert.equal(values.size, 1, `theme-color varies across pages: ${[...values].join(', ')}`);

  /* And it is the accent: --spot in sRGB, the same copied hex the favicon
     carries (tests/design.test.mjs pins that one to the token). It sat a
     shade off, on #b5522f, until 2026-10-25. */
  const favicon = readFileSync(new URL('../assets/favicon.svg', import.meta.url), 'utf8');
  const fill = /<rect width="24" height="24"[^>]* fill="(#[0-9a-f]{6})"/i.exec(favicon)[1];
  assert.equal([...values][0].toLowerCase(), fill.toLowerCase(), 'theme-color is not --spot');
});

/* Both light and dark are supported by the design tokens (see css/tokens.css
   for the @media (prefers-color-scheme: dark) block). Declaring color-scheme
   lets the browser render its own UA widgets (form controls, scrollbars)
   with the matching palette rather than defaulting to light. */
test('every page declares color-scheme so browser UA widgets follow the theme', () => {
  for (const p of PAGES) {
    const src = readFileSync(new URL(`../${p}.html`, import.meta.url), 'utf8');
    assert.match(src, /<meta name="color-scheme" content="light dark"/,
      `${p}.html has no color-scheme meta`);
  }
});

/* The hero image on the landing page was declared 522x700 in the HTML but
   the actual file is 1100x858 (its `file` output; verified). A wrong intrinsic
   ratio causes the browser to reserve the wrong amount of space during load,
   producing a layout shift when the real image lands. */
test('the landing page hero image reports its actual aspect ratio', () => {
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tag = /<img[^>]*data-img="product-hero-3d"[^>]*>/.exec(src);
  assert.ok(tag, 'the hero image is not in index.html');
  const width = /width="(\d+)"/.exec(tag[0])?.[1];
  const height = /height="(\d+)"/.exec(tag[0])?.[1];
  assert.ok(width && height, 'the hero image has no width/height attributes');
  const ratio = Number(width) / Number(height);
  // Actual asset is 1100x858 → 1.282; allow a tiny rounding margin.
  assert.ok(Math.abs(ratio - 1100 / 858) < 0.02,
    `hero image aspect ratio ${ratio.toFixed(3)} does not match the file's 1.282`);
});

test('robots.txt exists and points at the sitemap', () => {
  const src = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
  assert.match(src, /^User-agent: \*/m);
  assert.match(src, /Sitemap: https:\/\/scmsolutions\.org\/tidymaps\/sitemap\.xml/);
});

test('sitemap.xml lists the public pages', () => {
  const src = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
  assert.match(src, /<\?xml/);
  assert.match(src, /https:\/\/scmsolutions\.org\/tidymaps\/(<|\/)/,
    'the sitemap does not list the landing page');
  for (const p of ['privacy', 'terms', 'security', 'cookies', 'accessibility']) {
    assert.match(src, new RegExp(`${p}\\.html`), `sitemap is missing ${p}.html`);
  }
});

/* Search results cut a title at about 60 characters, and the old one was 72:
   "...the space that keeps getting away from you" lost its point at the cut.
   The share cards say the same thing, so the three cannot drift apart. */
test('the landing title fits a search result and the share cards repeat it', () => {
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const title = /<title>([^<]+)<\/title>/.exec(src)[1];
  assert.ok(title.length <= 60, `the title is ${title.length} characters: "${title}"`);
  assert.match(title, /^TidyMap/);
  assert.equal(/<meta property="og:title" content="([^"]+)"/.exec(src)[1], title);
  assert.equal(/<meta name="twitter:title" content="([^"]+)"/.exec(src)[1], title);
});

/* Structured data says what the page is. Each value is a claim made
   somewhere else on the site, so it is checked against that place rather
   than retyped: the canonical URL, the meta description, the publisher the
   legal pages name, and "free" while terms.html says so. */
test('the landing page describes itself in JSON-LD that matches the page', () => {
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const blocks = [...src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, 'expected one JSON-LD block');
  const ld = JSON.parse(blocks[0][1]);
  assert.equal(ld['@context'], 'https://schema.org');
  assert.equal(ld['@type'], 'WebApplication');
  assert.equal(ld.name, 'TidyMap');
  assert.equal(ld.url, /<link rel="canonical" href="([^"]+)"/.exec(src)[1]);
  assert.equal(ld.description, /<meta name="description" content="([^"]+)"/.exec(src)[1]);
  assert.equal(ld.image, /<meta property="og:image" content="([^"]+)"/.exec(src)[1]);
  const terms = readFileSync(new URL('../terms.html', import.meta.url), 'utf8');
  assert.ok(terms.includes(ld.publisher.name), `terms.html never names "${ld.publisher.name}"`);
  if (ld.isAccessibleForFree || (ld.offers && ld.offers.price === '0')) {
    assert.match(terms, /TidyMap is free/, 'the JSON-LD says free; terms.html no longer does');
  }
  assert.equal(ld.aggregateRating, undefined, 'there are no ratings to report');
});
