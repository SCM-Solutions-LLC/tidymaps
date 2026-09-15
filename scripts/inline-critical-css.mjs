#!/usr/bin/env node
// Every page paid for tokens.css and base.css (the two stylesheets nothing
// renders without) as a blocking round trip, then blocked again on whichever
// heavier stylesheets it happened to load next. Inlining the critical two and
// loading the rest with the standard preload-as-style swap (a noscript
// fallback covers JS-off) measured FCP 1116->488ms and LCP 1476->496ms on a
// throttled phone. Concatenating all the stylesheets into one file, and
// modulepreloading them, were both tried and both measured worse.
//
// The source pages keep separate <link> tags (css/tokens.css unchanged for
// anyone editing styles); this rewrites the <!-- critical-css:start/end -->
// block plus every stylesheet link after it, in the *built* site only.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

const START = '<!-- critical-css:start -->';
const END = '<!-- critical-css:end -->';

// tokens.css's url(../vendor/fonts/...) is relative to css/, where the link
// tag used to live. Inlined into the page's own <style>, the same string
// would resolve one directory above the site root instead — a font 404
// nothing would catch outside an actual browser load. Every url() is
// rewritten relative to the page (all pages here live at the site root).
function rebaseCssUrls(css, cssHref) {
  const cssDir = posix.dirname(cssHref);
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (whole, quote, url) => {
    if (/^([a-z]+:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('/')) return whole;
    return `url(${quote}${posix.normalize(posix.join(cssDir, url))}${quote})`;
  });
}

export function inlineCriticalCss(html, siteRoot) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start === -1 || end === -1) return html;

  const block = html.slice(start + START.length, end);
  const hrefs = [...block.matchAll(/href="([^"]+\.css)"/g)].map((m) => m[1]);
  const inlined = hrefs
    .map((href) => rebaseCssUrls(readFileSync(join(siteRoot, href), 'utf8'), href))
    .join('\n');

  const before = html.slice(0, start);
  const after = html.slice(end + END.length);
  const asyncAfter = after.replace(
    /<link rel="stylesheet" href="([^"]+\.css)" \/>/g,
    (_m, href) =>
      `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'" />\n` +
      `<noscript><link rel="stylesheet" href="${href}" /></noscript>`,
  );

  return `${before}<style>\n${inlined}\n</style>${asyncAfter}`;
}

export function run(siteRoot) {
  const changed = [];
  for (const file of readdirSync(siteRoot)) {
    if (!file.endsWith('.html')) continue;
    const path = join(siteRoot, file);
    const html = readFileSync(path, 'utf8');
    const out = inlineCriticalCss(html, siteRoot);
    if (out !== html) {
      writeFileSync(path, out);
      changed.push(file);
    }
  }
  return changed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv[2] || '_site');
}
