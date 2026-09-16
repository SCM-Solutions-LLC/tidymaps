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

/* ---------- the security page describes the backend that exists ----------
   A security page is only worth reading if its claims are true of the code,
   and three of them were not: the CORS allowlist was said to stop other
   sites spending the rate limit (it only decides who may READ a response;
   the request arrives and is counted either way), the IP-hash salt was
   said to rotate daily (auth.ts hashes ip|date|salt with one static
   secret, so the date varies and the salt never does), and guest use was
   said to touch no database (every call writes a usage row, and telemetry
   writes its events). Each check below is tied to the code that makes the
   claim false, so a backend change that makes it true again is what turns
   the check off, not an edit to this file. */

test('no legal page says the IP-hash salt rotates while auth.ts hashes with one static salt', () => {
  const auth = read('supabase/functions/_shared/auth.ts');
  const staticSalt = /Deno\.env\.get\('IP_HASH_SALT'\)/.test(auth) && /\$\{ip\}\|\$\{day\}\|\$\{salt\}/.test(auth);
  if (!staticSalt) return; // the hash changed shape; the claim below no longer applies
  for (const [file, src] of Object.entries(source)) {
    assert.doesNotMatch(src, /salt (rotates|changes|is rotated) (daily|every day|each day)/i, `${file}: says the salt rotates`);
    assert.doesNotMatch(src, /short-lived[^.]*hash/i, `${file}: calls the hash short-lived; nothing purges usage_events`);
  }
});

test('the security page does not say guest use touches no database', () => {
  /* checkAndLog inserts a usage row on every call the limiter admits, for
     signed-in and anonymous callers alike. */
  const limiter = read('supabase/functions/_shared/ratelimit.ts');
  assert.match(limiter, /check_and_log_usage/, 'the limiter moved; re-derive what a guest call writes');
  assert.doesNotMatch(source['security.html'], /touches no database/i);
  assert.match(source['security.html'], /usage row/i, 'the page should say what a guest call writes');
});

test('the security page does not claim CORS stops a request from counting', () => {
  /* cors.ts sets Access-Control-Allow-Origin on the response. A browser
     enforces that on the READ; nothing in it rejects the request itself. */
  const cors = read('supabase/functions/_shared/cors.ts');
  assert.match(cors, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(cors, /return new Response\([^)]*40[13]/, 'cors.ts rejects requests now; the claim below may be true again');
  const page = source['security.html'];
  assert.doesNotMatch(page, /cannot quietly spend your rate limit/i);
  assert.doesNotMatch(page, /only answers our own origins/i);
  assert.match(page, /still counts against the rate limit/i, 'the page should say the request is still counted');
});

/* ---------- the legal pages describe the product that exists ----------
   The same shape as the security checks above: each claim is tied to the
   code that makes it true or false, so the check switches itself off when
   the code changes rather than when someone edits this file. */

test('the legal pages do not promise video while the app accepts images only', () => {
  const index = read('index.html');
  const accept = (index.match(/id="photo-input"[^>]*accept="([^"]+)"/) || [])[1] || '';
  if (/video/.test(accept)) return; // the input takes video again; the claim is true
  for (const file of ['privacy.html', 'terms.html']) {
    assert.doesNotMatch(source[file], /\bvideos?\b/i, `${file}: promises video; the input accepts ${accept}`);
  }
});

test('the privacy policy discloses every telemetry event the server accepts', async () => {
  /* The server drops any event name off this list, so the list IS what can
     be collected. Each entry maps to the words the policy uses for it; a new
     event without a disclosure fails here, and a disclosure for an event
     that no longer exists fails too, so the paragraph cannot drift either way. */
  const { EVENT_NAMES } = await import('../supabase/functions/_shared/telemetryEvents.js');
  const DISCLOSED = {
    screen_viewed: /which steps of the planner people reach/,
    plan_created: /when a plan is generated, with the space type, whether the AI or our built-in fallback produced it, and how many steps it has/,
    step_checked: /how many plan steps get checked off/,
    product_clicked: /which product links get clicked, as the retailer and whether it was a named pick or a search, never the product itself/,
    plan_rated: /multiple-choice feedback answers/,
    feedback_submitted: /multiple-choice feedback answers/,
    after_render_requested: /whether a photo preview was requested and whether it worked/,
    share_link_created: /when a share link is created/,
    shared_plan_viewed: /when one is opened/,
    space_saved: /when a plan is saved to an account, with the space type and whether the save was automatic/,
  };
  assert.deepEqual(Object.keys(DISCLOSED).sort(), [...EVENT_NAMES].sort(), 'the disclosure map and the server allowlist name different events');
  const policy = source['privacy.html'];
  for (const [name, words] of Object.entries(DISCLOSED)) {
    assert.match(policy, words, `privacy.html does not disclose ${name}`);
  }
});

test('the terms carry the share-link redaction the privacy policy describes', () => {
  /* sharePayload.js strips the safety notes and every household-naming
     sentence when a link is read. The privacy policy said so; the terms,
     which set what a reader of a link can expect, did not. */
  const share = read('supabase/functions/_shared/sharePayload.js');
  if (!/export function householdPatterns/.test(share)) return; // the redaction is gone; nothing to promise
  for (const file of ['privacy.html', 'terms.html']) {
    assert.match(source[file], /safety notes/i, `${file}: does not say the safety notes are left out of a shared plan`);
    assert.match(source[file], /names? your household|mentions your kids/i, `${file}: does not say household-naming sentences are left out`);
  }
});

test('cookies.html hosts the in-app opt-out and reads it from js/optout.js', () => {
  /* Batch 3.9 named two gaps: the no-banner reasoning ignored the localStorage
     the app actually keeps, and there was no in-app opt-out at all. Both close
     together: the page acknowledges the counter as the one non-essential item
     and offers a toggle right there. This test ties the promise to the code.

     A `setOptedOut` export missing from js/optout.js means the page is
     claiming an opt-out it cannot deliver, the same class of stale-legal-copy
     bug as "we honor Do Not Track" over a `optedOut()` that stopped reading
     the header. */
  const optout = read('js/optout.js');
  assert.match(optout, /export function setOptedOut/, 'js/optout.js no longer exports setOptedOut');
  assert.match(optout, /export function isOptedOut/, 'js/optout.js no longer exports isOptedOut');
  assert.match(optout, /export const OPTOUT_KEY = 'tidymap_optout_v1'/, 'OPTOUT_KEY name drifted; update cookies.html if this is intentional');

  const page = source['cookies.html'];
  assert.match(page, /id="turning-the-counter-on-and-off"/, 'the anchor privacy.html links to is gone');
  assert.match(page, /id="optout-btn"/, 'the toggle button is missing from cookies.html');
  assert.match(page, /id="optout-status"/, 'the toggle status line is missing from cookies.html');
  assert.match(page, /from '\.\/js\/optout\.js'/, 'the cookies page no longer imports js/optout.js');
  assert.match(page, /aria-live="polite"/, 'the status line is not announced');
  assert.match(page, /<noscript>/, 'no fallback for the JS-off case');

  /* privacy.html points at the same anchor. A link that 404s inside the site
     is worse than none, and legal copy that promises an opt-out on a page
     without one is the same shape of bug. */
  assert.match(source['privacy.html'], /cookies\.html#turning-the-counter-on-and-off/, 'privacy.html no longer points at the in-app opt-out');
});

test('every provider the security page depends on is named in the privacy policy', () => {
  /* security.html lists the providers whose outages and protections the
     product inherits. A processor that handles personal data (Resend sees
     every sign-in email) belongs in the privacy policy as well; it was not. */
  const m = source['security.html'].match(/We depend on our providers \(([^)]+)\)/);
  assert.ok(m, 'security.html no longer lists its providers in the expected sentence');
  for (const provider of m[1].split(',').map((p) => p.trim())) {
    assert.ok(source['privacy.html'].includes(provider), `privacy.html does not name ${provider}`);
  }
});
