import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Design contract for the household-service direction: real evidence over
// decorative invention. This is the mechanical anti-slop review — it fails
// if known template signals creep back into the landing page.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
const landingCss = readFileSync(new URL('../css/landing.css', import.meta.url), 'utf8');
const baseCss = readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');
const landing = html.slice(html.indexOf('id="screen-landing"'), html.indexOf('id="screen-space"'));

test('hero leads with the practical promise', () => {
  for (const phrase of [
    'Make one hard&#8209;working space easier to live with',
    'what you already own',
    'Plan my space',
    'View a sample plan',
  ]) {
    assert.ok(html.includes(phrase), `missing phrase: ${phrase}`);
  }
});

test('no trendy display font or third-party font CDN', () => {
  for (const bad of ['fonts.googleapis.com', 'Bricolage', 'Fraunces', 'DM Sans', 'IBM Plex']) {
    assert.ok(!html.includes(bad), `font tell present in index.html: ${bad}`);
    assert.ok(!tokens.includes(bad), `font tell present in tokens.css: ${bad}`);
  }
  assert.ok(tokens.includes('vendor/fonts/figtree'), 'brand typeface is not self-hosted');
});

test('AI-template landing patterns stay gone', () => {
  // decorative eyebrows, glass surfaces, fake shelf mockups, stat strips,
  // scroll-reveal choreography, prototype badges
  for (const bad of ['lx-eyebrow', 'lxg', 'pantry-vis', 'lx-assure', 'lx-reveal', 'Prototype<']) {
    assert.ok(!landing.includes(bad), `template signal on landing: ${bad}`);
  }
  assert.ok(!landing.includes('lx-'), 'legacy lx-* landing classes still present');
});

test('exclusivity and invented-product language stays gone', () => {
  for (const phrase of ['Founding Circle', 'Request an Invitation', 'founding community', 'atelier', 'discerning', 'exclusiv', 'Meridian']) {
    assert.ok(!html.toLowerCase().includes(phrase.toLowerCase()), `stale phrase present: ${phrase}`);
  }
});

test('signup asks plainly, with no exclusivity framing', () => {
  assert.ok(landing.includes('Get occasional product updates and practical organizing ideas'));
  assert.ok(landing.includes('id="signup-email"'));
});

test('landing shows real evidence: sample-plan excerpt and product screenshots', () => {
  assert.ok(landing.includes('Plan excerpt'), 'household story lost its plan excerpt');
  for (const shot of [
    'assets/product/plan-map.png', 'assets/product/plan-steps.png', 'assets/product/plan-shopping.png',
    'assets/product/hero-3d.png', 'assets/product/wizard-household.png',
  ]) {
    assert.ok(landing.includes(shot), `missing product screenshot slot: ${shot}`);
    assert.ok(existsSync(new URL(`../${shot}`, import.meta.url)), `screenshot file missing on disk: ${shot}`);
  }
});

test('photo slots degrade gracefully until real photography exists', () => {
  assert.ok(landing.includes("classList.add('no-photo')"), 'photo fallback handler missing');
  assert.ok(landingCss.includes('.no-photo'), 'no-photo layout styles missing');
});

test('single red accent, flat canvas, no ambient gradients', () => {
  assert.ok(tokens.includes('--primary:      oklch(0.545 0.185 31)'), 'brand accent drifted');
  for (const css of [landingCss, baseCss, tokens]) {
    assert.ok(!css.includes('radial-gradient'), 'ambient gradient present');
    assert.ok(!css.includes('backdrop-filter'), 'glass surface present');
  }
});

test('buttons are not universal pills', () => {
  assert.ok(!baseCss.includes('border-radius:999px'), 'pill buttons are back');
});

test('report uses ordinary language, not decorative chapters', () => {
  for (const bad of ['ch-num', 'class="tn"']) {
    assert.ok(!html.includes(bad), `decorative report numbering present: ${bad}`);
  }
  for (const label of ['Where things go', 'Optional purchases', 'Step-by-step']) {
    assert.ok(html.includes(label), `plain report label missing: ${label}`);
  }
});
