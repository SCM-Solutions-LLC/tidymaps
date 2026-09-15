import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Copy the 2026-09-14 review found saying something the site does not do, or
   two things at once. Each is pinned here so it cannot drift back. */

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');

test('the report contents list names each chapter the way its heading does', () => {
  /* "Use what you own" pointed at "Use what you already have first" and
     "Before & after" at "What it could look like": a reader following the
     list arrived somewhere with a different name. */
  const toc = [...html.matchAll(/<a href="#(ch-[a-z]+)"[^>]*>([^<]+)<\/a>/g)];
  assert.ok(toc.length >= 5, 'the contents list is missing');
  for (const [, id, text] of toc) {
    const head = new RegExp(`<h[1-6] id="${id}-h">([^<]+)</h[1-6]>`).exec(html);
    assert.ok(head, `${id} has no heading`);
    assert.equal(text.replace(/&amp;/g, '&'), head[1].replace(/&amp;/g, '&'), `contents entry for ${id} disagrees with its heading`);
  }
});

test('the sign-in copy makes no claim about the code\'s length', () => {
  /* The modal said "8-digit" while the check accepted 6 to 8 and its message
     said "6–8 digits". The length is set by the hosted auth config, which the
     repo cannot see (config.toml says 6), so neither sentence names one. */
  const modal = html.slice(html.indexOf('id="auth-modal"'), html.indexOf('id="auth-step-code"'));
  assert.doesNotMatch(modal, /\d-digit|\d–\d digit/, 'the sign-in modal names a code length');
  const account = read('js/screens/account.js');
  assert.doesNotMatch(account, /\d–\d digits|\d-digit/, 'the code check names a code length');
});

test('the safety notes are not called green when nothing on the report is', () => {
  const results = read('js/screens/results.js');
  assert.ok(!/green notes/.test(results), 'results.js still says "green notes"');
  assert.ok(/The notes below are placements chosen for safety/.test(results), 'the safety-note lede is gone');
});

test('the landing figure does not call a sample shelf the visitor\'s own', () => {
  assert.ok(!html.includes('Fits your 14&Prime; shelf'), '"your" shelf on a landing page that has measured nothing');
  assert.ok(html.includes('Fits a 14&Prime; shelf'));
});

test('the hero asks for a space, the word the wizard uses, not a room', () => {
  assert.ok(html.includes('Bring order to the space that runs your day.'));
});

test('Review shows the space as one answer, not a room and a spot', () => {
  const wizard = read('js/screens/wizard.js');
  assert.ok(!/\['Room',/.test(wizard) && !/\['Spot',/.test(wizard), 'Review still splits the space into Room and Spot rows');
  assert.match(wizard, /\['Space', state\.spaceTouched \? `\$\{area\.label\} · \$\{room\.label\}`/);
});

test('a photo run is not told its key frames are being extracted', async () => {
  const { LOAD_LABELS_PHOTOS, LOAD_LABELS_VIDEO } = await import('../js/data.js');
  assert.ok(!LOAD_LABELS_PHOTOS.some((l) => /key frames|video/i.test(l)), 'the photo labels claim video work');
  assert.ok(LOAD_LABELS_VIDEO.some((l) => /key frames/.test(l)), 'the video labels lost the key-frame step');
  const loading = read('js/screens/loading.js');
  assert.match(loading, /state\.uploadedVideo\s*\?\s*\[\.\.\.LOAD_LABELS_VIDEO/, 'loading.js does not pick the video labels for a video');
  assert.match(loading, /state\.uploadedFiles\.length > 0\s*\?\s*\[\.\.\.LOAD_LABELS_PHOTOS/, 'loading.js does not pick the photo labels for photos');
});

test('the shopping list says what must fit in the reader\'s units', async () => {
  const { state } = await import('../js/state.js');
  const { shoppingListText } = await import('../js/planExport.js');
  const { getDemoScenario } = await import('../js/demo-scenarios.js');
  const { normalizeAi } = await import('../js/plan.js');
  state.space = 'pantry';
  state.ai = normalizeAi(getDemoScenario('pantry', null, state.household, null));
  state.shopping = (state.ai.productNeeds || []).map(() => ({ checked: true, productId: null, fit: null }));
  state.units = 'metric';
  const metric = shoppingListText();
  assert.match(metric, /must fit: \d+ cm wide/, 'a metric reader is told inches');
  assert.doesNotMatch(metric, /inches|″/, 'inches leaked into a metric list');
  state.units = 'imperial';
  const imperial = shoppingListText();
  assert.match(imperial, /must fit: \d+″ wide/, 'an imperial reader lost the inch mark');
});
