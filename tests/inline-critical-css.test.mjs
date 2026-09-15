import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inlineCriticalCss, run } from '../scripts/inline-critical-css.mjs';

/* Every page paid for tokens.css and base.css as a blocking round trip before
   anything could paint. This inlines the two critical stylesheets into a
   <style> tag and swaps every stylesheet after them to the standard
   preload-as-style pattern, in the built site only — the source pages keep
   separate <link> tags for anyone editing styles.

   The tests build a throwaway site directory rather than parsing regexes
   against the real one, so a change to the transform or to the marker
   contract is caught the same way a browser would catch it: by what actually
   comes out. */

function scratchSite() {
  const dir = mkdtempSync(join(tmpdir(), 'tidymap-css-'));
  mkdirSync(join(dir, 'css'));
  writeFileSync(join(dir, 'css', 'tokens.css'), ':root{--spot:#b5522f}\n@font-face{src:url("../vendor/fonts/a.woff2")}');
  writeFileSync(join(dir, 'css', 'base.css'), 'body{margin:0}');
  writeFileSync(join(dir, 'css', 'components.css'), '.btn{padding:8px}');
  return dir;
}

const PAGE = (extraLinks = '') => `<!doctype html>
<html><head>
<title>t</title>
<!-- critical-css:start -->
<link rel="stylesheet" href="css/tokens.css" />
<link rel="stylesheet" href="css/base.css" />
<!-- critical-css:end -->
<link rel="stylesheet" href="css/components.css" />
${extraLinks}
</head><body>hi</body></html>`;

test('the critical block becomes one inline <style>, its url()s rebased to the page', () => {
  const dir = scratchSite();
  try {
    const out = inlineCriticalCss(PAGE(), dir);
    assert.match(out, /<style>[\s\S]*--spot:#b5522f[\s\S]*body\{margin:0\}[\s\S]*<\/style>/, 'tokens.css and base.css are not both inlined');
    assert.match(out, /url\("vendor\/fonts\/a\.woff2"\)/, 'a css/-relative url() was not rebased to the page');
    assert.doesNotMatch(out, /href="css\/tokens\.css"/, 'tokens.css is still linked as well as inlined');
    assert.doesNotMatch(out, /critical-css:(start|end)/, 'the marker comments leak into the built page');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('every stylesheet after the critical block loads async, with a noscript fallback', () => {
  const dir = scratchSite();
  try {
    const out = inlineCriticalCss(PAGE(), dir);
    assert.match(out, /<link rel="preload" href="css\/components\.css" as="style" onload="this\.onload=null;this\.rel='stylesheet'" \/>/);
    assert.match(out, /<noscript><link rel="stylesheet" href="css\/components\.css" \/><\/noscript>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a page with no critical-css block is left untouched', () => {
  const dir = scratchSite();
  try {
    const plain = '<html><head><link rel="stylesheet" href="css/components.css" /></head></html>';
    assert.equal(inlineCriticalCss(plain, dir), plain);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('run() rewrites every .html file in the site directory and only those', () => {
  const dir = scratchSite();
  try {
    writeFileSync(join(dir, 'index.html'), PAGE());
    writeFileSync(join(dir, 'privacy.html'), PAGE('<link rel="stylesheet" href="css/legal.css" />'));
    writeFileSync(join(dir, 'notes.txt'), 'not html');
    const changed = run(dir).sort();
    assert.deepEqual(changed, ['index.html', 'privacy.html']);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(join(dir, file), 'utf8');
      assert.doesNotMatch(html, /critical-css/, `${file} still carries the marker comments`);
      assert.match(html, /<style>/, `${file} was not rewritten`);
    }
    assert.equal(readFileSync(join(dir, 'notes.txt'), 'utf8'), 'not html', 'a non-html file was touched');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
