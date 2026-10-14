import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* The header and landing buttons are plain HTML and call globals js/main.js
   defines, so a click before main.js has run used to be lost (#1). The inline
   guard in index.html holds it and main.js replays it. The behaviour is
   proven in tests/e2e/early-click.spec.mjs; this pins where the two halves
   sit, which the e2e cannot see. */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

test('the early-click guard is in <head> and main.js releases it before the route restore', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /addEventListener\('click',hold,true\)/, 'the guard is not listening in the capture phase from <head>');
  assert.match(head, /window\.__tmReleaseClicks=function/);
  const main = readFileSync(resolve(root, 'js/main.js'), 'utf8');
  const release = main.indexOf('__tmReleaseClicks');
  assert.ok(release > -1, 'main.js never releases held clicks');
  assert.ok(release < main.indexOf('initializeRoute({'), 'clicks are released after the route restore, which waits on the network');
});

test('the startup module graph is not modulepreloaded', () => {
  /* Measured twice, 09-14 and 10-13: a faster boot on slow 4G but a later
     headline on a fast link, and the guard already keeps early clicks. See
     docs/HANDOFF.md, Decisions, "Measured and not done". */
  assert.doesNotMatch(html, /rel="modulepreload"/);
});
