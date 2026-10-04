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
    'Bring order to the space that runs your day',
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
  // Two faces, both self-hosted: Archivo for titles and labels, Source Serif 4
  // for reading. The preload names the same file the stylesheet does.
  assert.ok(tokens.includes('vendor/fonts/archivo-latin-wdth-normal.woff2'), 'Archivo is not self-hosted');
  assert.ok(!tokens.includes('@font-face{\n  font-family:"Bodoni'), 'a display serif is back');
  assert.ok(html.includes('rel="preload" href="vendor/fonts/archivo-latin-wdth-normal.woff2"'), 'Archivo is not preloaded');
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

// The first figure is the mechanism, drawn: the sample pantry's items slide
// into the plan's zones, and the notes beside them are the plan's reasons.
test('Figure 1 draws the sort, with reduced motion showing the finished figure', () => {
  assert.ok(landing.includes('id="fig-el"'), 'Figure 1 is missing');
  assert.ok(landing.includes('class="f-items"'), 'Figure 1 has no items to sort');
  assert.ok((landing.match(/class="it/g) || []).length >= 12, 'Figure 1 has too few items to read as a pantry');
  assert.ok(!landing.includes('fig-replay'), 'the replay control is back: the sort is one authored moment, and replaying it always lands on the same plan');
  assert.match(landingCss, /\.fig-el\.sorted \.f-items \.it\{transform:none\}/, 'sorted items no longer land in place');
  const reduced = landingCss.slice(landingCss.indexOf('@media(prefers-reduced-motion:reduce)'));
  assert.match(reduced, /\.f-items \.it\{transform:none\}/, 'reduced motion does not show the finished figure');
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
  for (const shot of ['assets/product/hero-3d.webp', 'assets/photos/ex-pantry-after.webp']) {
    assert.ok(landing.includes(shot), `missing image slot: ${shot}`);
    assert.ok(existsSync(new URL(`../${shot}`, import.meta.url)), `image missing on disk: ${shot}`);
  }
});

// A section headed "See a finished plan" showing a chaotic pantry argues
// against itself. The before shot is the wizard's business, not the homepage's.
test('the sample-plan section shows the finished space, not the mess', () => {
  assert.ok(landing.includes('ex-pantry-after.webp'), 'sample plan lost its finished-space photo');
  assert.ok(!landing.includes('pantry-before.webp'), 'the before shot is back on the homepage');
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
  assert.match(landingCss, /\.space-room\{[^}]*font-size:clamp\(2[0-9]px/, 'room labels shrank back to caption size');
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

// The Warm Shelf: cream paper, white cards, soft corners and low warm shadows,
// terracotta as the one button colour with sage, butter and sky as supporting
// fields. The owner asked for this on 2026-10-03 because the square, one-ink
// manual look read as clinical. Ambient gradients and glass stay out.
test('terracotta buttons, soft corners, supporting colours, no ambient gradients', () => {
  assert.ok(tokens.includes('--spot:      oklch(0.56 0.13 36)'), 'the accent colour drifted');
  assert.ok(tokens.includes('--brass:     var(--spot)'), 'a second accent is carrying the figure label');
  assert.ok(tokens.includes('--primary:      var(--spot)'), 'the legacy accent no longer points at terracotta');
  assert.match(tokens, /--radius: 1[2-8]px;/, 'cards lost their soft corners');
  assert.match(tokens, /--radius-pill: 999px;/, 'the pill radius is gone');
  assert.ok(!tokens.includes('--shadow: none;'), 'shadows were flattened again');
  for (const family of ['sage', 'butter', 'sky']) {
    assert.ok(tokens.includes(`--${family}-f:`), `the ${family} field is missing`);
  }
  assert.ok(!tokens.includes('--line:      var(--ink)'), 'borders are hard ink again');
  for (const css of [landingCss, baseCss, tokens]) {
    assert.ok(!css.includes('radial-gradient'), 'ambient gradient present');
    assert.ok(!css.includes('backdrop-filter'), 'glass surface present');
  }
});

/* The report's shelf map used to say "eye level" with a colour: the eye row's
   label column was the accent tint and every other row's was warm grey, and
   that fill was the only thing telling the two apart. The design rules say
   colour carries no meaning on its own (a word or an icon carries it), and a
   walk-in made the point for them, with three walls of peach-or-grey rows and
   no legend in sight. The label column is gone. The eye row says "Eye level"
   in a pill beside its zone, and no rule in components.css paints a shelf
   label any colour at all. The landing figure keeps its tinted eye zone,
   because it keeps the legend that explains it. */
test('eye level is a word, not a fill', () => {
  // A comment may still name the old rule to say where it went; only live
  // selectors count.
  const componentsCss = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const results = readFileSync(new URL('../js/screens/results.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const selector of ['.shelf .label', '.shelf.eye .label']) {
    assert.ok(!componentsCss.includes(selector),
      `components.css still styles ${selector}: the label column is back, and with it a fill standing in for a word`);
  }
  assert.match(results, /class="(?:lv )?eye-mark"/, 'the eye row has no eye-mark pill');
  assert.ok(results.includes('Eye level</span>'), 'the eye row never says "Eye level" in its markup');
  // The landing figure draws its own rule, with a legend; it must not drift.
  assert.match(landingCss, /\.f-zone\{fill:var\(--tint\)/, 'Figure 1 ordinary zones are not warm grey');
  assert.match(landingCss, /\.f-zone-eye\{fill:var\(--tint-2\)\}/, 'Figure 1 eye-level zone is not the accent tint');
});

// Buttons are pills and labels are sentence case; the narrowed, letterspaced
// caps of the manual look are what made the site read as a form.
test('buttons are pills and no label is set in caps', () => {
  assert.match(baseCss, /\.btn\{[^}]*border-radius:var\(--radius-pill\)/, 'buttons are not pills');
  for (const [name, css] of [['base', baseCss], ['landing', landingCss]]) {
    assert.ok(!css.includes('text-transform:uppercase'), `${name}.css still sets a caps label`);
  }
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

/* ---------- the report does not draw a space it has not seen ----------

   "Fake shelf mockups" were already banned from the landing page above, as an
   AI-template signal. The same graphic survived in the report, where it was
   doing something worse than looking generic: `.pantry-vis.messy` — five rows
   of empty <b> elements in a flat grey, byte-identical for every user and
   every space — sat under the heading "Before · today", beside the real plan.

   So a reader was shown a picture captioned as their own pantry as it stands.
   It was not. It could not be: nothing about it varies. And its five rows did
   not correspond to the plan's rows either, so it did not even work as the
   comparison it was laid out as.

   A reader knows what their space looks like now. The half worth the width is
   the other one. */

const report = html.slice(html.indexOf('id="ch-after"'), html.indexOf('id="ch-shop"'));

test('the before/after section draws only the plan, never a stand-in "today"', () => {
  /* Bans the class being applied, not the word being written: the comment in
     index.html that explains why it went names it, and a test that forbids
     naming a thing forbids explaining it. */
  assert.ok(!/class="[^"]*pantry-vis/.test(html),
    'the generic shelf mockup is back — it describes no actual space');
  assert.ok(!report.includes('Before &middot; today') && !report.includes('Before · today'),
    'a pane is captioned as the reader\'s space today');
  assert.ok(!report.includes('class="before"'),
    'the fabricated before pane is back beside the plan');

  // The real plan is still what the section renders.
  assert.ok(report.includes('id="after-cabinet"'), 'the plan drawing is gone from the section');
});

test('the photo slider keeps its before, because that one is really theirs', () => {
  /* Not everything labelled "before" was dishonest. The AI photo preview
     compares the reader's OWN uploaded photo against the edited version, and
     both halves of that are real. Removing the drawn stand-in must not take
     the genuine comparison with it. */
  assert.ok(report.includes('id="ba-before-img"'), 'the photo slider lost its before image');
  assert.ok(report.includes('id="ba-after-img"'), 'the photo slider lost its after image');
});
