import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Design contract for the warm editorial direction: empathetic language in,
// exclusivity language out, glass restrained to exactly two focal surfaces.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
const landingCss = readFileSync(new URL('../css/luxury.css', import.meta.url), 'utf8');

test('landing leads with empathy, not exclusivity', () => {
  for (const phrase of [
    'No tidying up first',
    'progress, not perfection',
    'what you already own',
    'one space',
  ]) {
    assert.ok(html.toLowerCase().includes(phrase.toLowerCase()), `missing phrase: ${phrase}`);
  }
});

test('exclusivity-era language is gone', () => {
  for (const phrase of ['atelier', 'Private Registry', 'discerning', 'exclusiv', 'Commission a plan']) {
    assert.ok(!html.toLowerCase().includes(phrase.toLowerCase()), `stale phrase present: ${phrase}`);
  }
});

test('glass is reserved for exactly two focal surfaces', () => {
  const count = (html.match(/\blxg\b/g) || []).length;
  assert.equal(count, 2, `expected 2 lxg surfaces, found ${count}`);
});

test('warm material tokens exist', () => {
  for (const token of ['--sage:', '--sage-bg:', '--paper-grain:', '--primary:', '--ease:']) {
    assert.ok(tokens.includes(token), `missing token: ${token}`);
  }
});

test('animated orb scene is retired', () => {
  assert.ok(!landingCss.includes('lx-orb'), 'lx-orb styles still present');
  assert.ok(!html.includes('lx-orb'), 'lx-orb markup still present');
});
