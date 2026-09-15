import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* pages.yml used to `upload-pages-artifact` with `path: .`: the whole
   checkout, node_modules included, went up as a 168MB artifact for an 11MB
   site. scripts/build-site.sh is what actually decides what ships, so this
   runs it for real (not a text match against the workflow) and reads the
   directory it produces. */

const root = new URL('..', import.meta.url).pathname;
const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');

test('the Pages workflow uploads the built artifact, not the checkout', () => {
  assert.match(workflow, /run: bash scripts\/build-site\.sh _site/, 'the deploy step does not build the artifact');
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v\d+\s*\n\s*with:\s*\n\s*path: _site/, 'the upload step still ships the whole checkout');
});

test('the built site carries every page and asset directory a browser fetches, and nothing else', () => {
  const out = mkdtempSync(join(tmpdir(), 'tidymap-site-'));
  try {
    execFileSync('bash', [join(root, 'scripts/build-site.sh'), out]);
    const entries = new Set(readdirSync(out));
    for (const dir of ['assets', 'css', 'data', 'js', 'media', 'vendor']) {
      assert.ok(entries.has(dir), `${dir}/ is missing from the built site`);
    }
    for (const html of ['index.html', '404.html', 'privacy.html', 'terms.html', 'security.html', 'cookies.html', 'accessibility.html']) {
      assert.ok(entries.has(html), `${html} is missing from the built site`);
    }
    // Everything dev-only stays out: a contributor's node_modules, the test
    // suite, docs and the raw migrations have no business on the public site.
    for (const devOnly of ['node_modules', 'tests', 'docs', '.github', '.git', 'remotion', 'scripts', 'package.json', 'package-lock.json']) {
      assert.ok(!entries.has(devOnly), `${devOnly} leaked into the built site`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the one file js/telemetry.js reaches outside the asset directories is kept at the same relative path', () => {
  const telemetry = readFileSync(new URL('../js/telemetry.js', import.meta.url), 'utf8');
  const imported = telemetry.match(/from '([^']+telemetryEvents\.js)'/)[1];
  const out = mkdtempSync(join(tmpdir(), 'tidymap-site-'));
  try {
    execFileSync('bash', [join(root, 'scripts/build-site.sh'), out]);
    // The import is relative to js/telemetry.js's own directory in the built site.
    const resolved = join(out, 'js', imported);
    assert.ok(existsSync(resolved), `${imported} does not resolve from the built site's js/telemetry.js`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
