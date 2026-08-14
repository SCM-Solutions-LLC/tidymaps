import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

/* The legal documents only work as a set.

   Each one is a standalone HTML file outside the app shell, which is exactly
   why they rot: nothing imports them, no route resolves them, and a broken
   link between two of them looks identical to a working one until someone
   clicks it. A footer that promises five documents and delivers four is worse
   than a footer that promises one, so the set is pinned here — every page
   carries the whole navigation, every relative link resolves to a file that
   exists, and every page loads the shared stylesheet rather than its own copy
   of the prose styles.

   The stylesheet check is not housekeeping. privacy.html shipped for months
   using the site footer's markup without loading the stylesheet that styles it,
   so the footer rendered as a stack of bare divs. Loading the shared four is
   what makes a legal page look like the rest of the site. */

const root = new URL('../', import.meta.url);

/* Filename to the label it goes by in navigation. Order is the order the links
   appear in, so a page that reorders its own nav fails rather than drifting. */
const PAGES = {
  'privacy.html': 'Privacy',
  'terms.html': 'Terms',
  'security.html': 'Security',
  'cookies.html': 'Cookies',
  'accessibility.html': 'Accessibility',
};
const FILES = Object.keys(PAGES);

const read = (f) => readFileSync(new URL(f, root), 'utf8');
const source = Object.fromEntries(FILES.map((f) => [f, read(f)]));

/* The stylesheets every legal page needs. tokens and base are the design
   system, components carries the site header and footer, legal carries the
   reading column. Missing any one of them ships a page that looks unfinished. */
const STYLESHEETS = ['css/tokens.css', 'css/base.css', 'css/components.css', 'css/legal.css'];

test('every legal document exists and is a complete page', () => {
  for (const file of FILES) {
    assert.ok(existsSync(new URL(file, root)), `missing legal document: ${file}`);
    const src = source[file];
    assert.match(src, /^<!doctype html>/i, `${file}: no doctype`);
    assert.match(src, /<html lang="en">/, `${file}: no lang on <html>`);
    assert.match(src, /<title>[^<]+<\/title>/, `${file}: no title`);
    assert.match(src, /<meta name="description" content="[^"]{40,}"/, `${file}: no useful meta description`);
    assert.match(src, /<link rel="icon" href="assets\/favicon\.svg" \/>/, `${file}: no favicon`);
    // A canonical pointing at another page de-indexes this one.
    assert.ok(
      src.includes(`<link rel="canonical" href="https://scmsolutions.org/tidymaps/${file}" />`),
      `${file}: canonical URL missing or points elsewhere`,
    );
  }
});

test('every legal document loads the shared stylesheets and none carries its own', () => {
  for (const file of FILES) {
    const src = source[file];
    for (const sheet of STYLESHEETS) {
      assert.ok(src.includes(`href="${sheet}"`), `${file}: does not load ${sheet}`);
    }
    /* The prose styles live in css/legal.css. A <style> block here means one
       document has started drifting from the other four. */
    assert.ok(!/<style[\s>]/.test(src), `${file}: has a page-local <style> block; put it in css/legal.css`);
  }
});

test('every legal document carries the whole set in its sibling nav, marking itself current', () => {
  for (const file of FILES) {
    const nav = source[file].match(/<ul class="legal-nav">([\s\S]*?)<\/ul>/);
    assert.ok(nav, `${file}: no legal-nav`);

    const links = [...nav[1].matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];
    assert.deepEqual(
      links.map((m) => m[1]), FILES,
      `${file}: sibling nav does not list every legal document, in order`,
    );
    assert.deepEqual(
      links.map((m) => m[3]), Object.values(PAGES),
      `${file}: sibling nav labels do not match`,
    );

    /* aria-current is the only thing telling a screen reader which of five
       near-identical links is the page already open. */
    const current = links.filter((m) => m[2].includes('aria-current="page"'));
    assert.equal(current.length, 1, `${file}: expected exactly one aria-current link, got ${current.length}`);
    assert.equal(current[0][1], file, `${file}: marks ${current[0][1]} as the current page`);
  }
});

test('every legal document, and the app itself, links the whole set in the footer', () => {
  const footers = { ...source, 'index.html': read('index.html') };
  for (const [file, src] of Object.entries(footers)) {
    const footer = src.match(/<div class="footer-legal">([\s\S]*?)<\/div>/);
    assert.ok(footer, `${file}: no footer-legal block`);
    for (const [target, label] of Object.entries(PAGES)) {
      assert.ok(
        footer[1].includes(`<a href="${target}">${label}</a>`),
        `${file}: footer does not link ${label} (${target})`,
      );
    }
  }
});

test('no legal document links to a page that does not exist', () => {
  for (const file of FILES) {
    const hrefs = [...source[file].matchAll(/href="([^"]+\.html)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 0, `${file}: no internal links at all`);
    for (const href of hrefs) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      assert.ok(existsSync(new URL(href, root)), `${file}: dead link to ${href}`);
    }
  }
});

test('every legal document is dated and says how to reach a human', () => {
  for (const file of FILES) {
    const src = source[file];
    /* Undated legal text is unusable: a reader cannot tell whether it describes
       the product they are using or the one from two years ago. */
    assert.match(
      src, /(Effective|Last reviewed) [A-Z][a-z]+ \d{1,2}, \d{4}/,
      `${file}: no effective or last-reviewed date`,
    );
    assert.ok(
      src.includes('mailto:contact@scmsolutions.org'),
      `${file}: no contact address`,
    );
  }
});

test('the pages do not name a third party the site stopped using', () => {
  /* The privacy policy told readers their browser fetched fonts from Google
     long after the fonts moved into vendor/. A policy naming a company that
     never sees a request is not a harmless stale line — it is the document
     being wrong about the one thing it exists to be right about. This ties the
     claim to the code: self-hosted fonts, so no page may credit Google Fonts. */
  const tokens = read('css/tokens.css');
  const selfHosted = /@font-face\{[^}]*url\("\.\.\/vendor\/fonts\//s.test(tokens);
  const pages = { ...source, 'index.html': read('index.html') };

  for (const [file, src] of Object.entries(pages)) {
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(src), `${file}: requests fonts from Google`);
  }
  if (!selfHosted) return; // fonts moved back out; the claim below no longer applies

  for (const [file, src] of Object.entries(pages)) {
    assert.ok(!/Google Fonts/.test(src) || /not from Google Fonts/.test(src),
      `${file}: credits Google Fonts, but the fonts are self-hosted`);
  }
});
