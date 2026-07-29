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
    'Bring order to the room that runs your day',
    'already own',
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

// The homepage sells the whole product, not the pantry it was first built
// around: every area the wizard supports is offered up front, sourced from
// the wizard's own data so the two can't drift apart.
test('landing offers every space the wizard supports', () => {
  const landingJs = readFileSync(new URL('../js/screens/landing.js', import.meta.url), 'utf8');
  assert.ok(landing.includes('id="space-groups"'), 'spaces gallery slot missing');
  assert.match(landingJs, /ROOMS, AREAS/, 'spaces gallery no longer reads the wizard data');
  assert.match(landingJs, /setArea\(card\.dataset\.room, card\.dataset\.area\)/, 'space cards no longer open the planner');
});

test('landing shows real evidence: sample-plan excerpt and the finished space', () => {
  assert.ok(landing.includes('Plan excerpt'), 'sample plan lost its excerpt');
  for (const shot of ['assets/product/hero-3d.png', 'assets/photos/ex-pantry-after.png']) {
    assert.ok(landing.includes(shot), `missing image slot: ${shot}`);
    assert.ok(existsSync(new URL(`../${shot}`, import.meta.url)), `image missing on disk: ${shot}`);
  }
});

// A section headed "See a finished plan" showing a chaotic pantry argues
// against itself. The before shot is the wizard's business, not the homepage's.
test('the sample-plan section shows the finished space, not the mess', () => {
  assert.ok(landing.includes('ex-pantry-after.png'), 'sample plan lost its finished-space photo');
  assert.ok(!landing.includes('pantry-before.png'), 'the before shot is back on the homepage');
});

// A picture of text is not an explanation: app screenshots scaled down to fit
// three-across were unreadable, so "What you get" draws the three pieces of a
// plan at their own size instead. No screenshot belongs in that section.
test('what-you-get explains with drawn panels, not shrunken screenshots', () => {
  const section = landing.slice(landing.indexOf('id="product"'), landing.indexOf('id="sample"'));
  assert.equal((section.match(/class="wy-vis"/g) || []).length, 3, 'expected three drawn explainer panels');
  assert.ok(!section.includes('<img'), 'a screenshot is back in the what-you-get section');
  assert.ok(!landing.includes('assets/product/plan-map.png'), 'plan screenshot re-inlined on the landing page');
  assert.ok(!landing.includes('assets/product/wizard-household.png'), 'wizard screenshot re-inlined on the landing page');
});

test('room labels read as headings and their cards are centred', () => {
  assert.match(landingCss, /\.space-room\{[^}]*font-size:clamp\(22px/, 'room labels shrank back to caption size');
  assert.match(landingCss, /\.space-room\{[^}]*text-align:center/, 'room labels are no longer centred');
  assert.match(landingCss, /\.space-group \.room-cards\{[^}]*justify-content:center/, 'space cards are no longer centred');
});

test('photo slots degrade gracefully until real photography exists', () => {
  assert.ok(landing.includes("classList.add('no-photo')"), 'photo fallback handler missing');
  assert.ok(landingCss.includes('.no-photo'), 'no-photo layout styles missing');
});

/* The plan hero shipped with a truncated 1x1 GIF as its placeholder — header
   and screen descriptor, then a bare image separator and nothing else. Every
   browser rejected it, so the img's onerror fired on every load and hid the
   whole figure, taking the "Walk through it in 3D" button down with it. The
   illustration results.js sets afterwards never brought either back. */
test('the plan hero placeholder is a decodable image, not a truncated one', () => {
  const src = /id="plan-hero-img"[^>]*\ssrc="data:image\/gif;base64,([^"]+)"/.exec(html);
  assert.ok(src, 'plan hero placeholder is no longer an inline GIF — re-point this test');
  const gif = Buffer.from(src[1], 'base64');
  assert.equal(gif.subarray(0, 6).toString('latin1'), 'GIF89a', 'not a GIF header');
  assert.equal(gif[gif.length - 1], 0x3b, 'GIF is truncated: no trailer byte, so it fails to decode');
  assert.ok(gif.includes(Buffer.from([0x2c])), 'GIF has no image descriptor');

  // And the figure has to come back even if some future src does fail first.
  const results = readFileSync(new URL('../js/screens/results.js', import.meta.url), 'utf8');
  assert.match(results, /plan-hero-photo'\)\.classList\.remove\('hide'\)/,
    'results.js sets a good illustration without clearing a stale hide');
});

test('single terracotta accent, flat canvas, no ambient gradients', () => {
  assert.ok(tokens.includes('--primary:      oklch(0.555 0.145 55)'), 'brand accent drifted');
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

// The marketing footer used to render on every screen, including the 12 wizard
// steps. Because .screen has a fixed 120px bottom padding, the footer's position
// does not track viewport height — it sat at a constant ~822px, so on any tall
// window it stranded mid-page above the sticky Back/Continue bar and read as a
// false end-of-page. Flow screens now suppress it via body[data-flow].
test('the marketing footer is suppressed inside the wizard flow', () => {
  const componentsCss = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8');
  const router = readFileSync(new URL('../js/router.js', import.meta.url), 'utf8');
  assert.match(
    componentsCss,
    /body\[data-flow="1"\]\s*\.site-footer\s*\{[^}]*display:\s*none/,
    'flow screens no longer hide .site-footer',
  );
  assert.match(
    router,
    /document\.body\.dataset\.flow\s*=\s*FLOW_SCREENS\[id\]/,
    'router no longer flags flow screens on the body',
  );
});
