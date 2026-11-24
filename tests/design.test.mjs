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
    'Your shelves, <em>thought through.</em>',
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
  // Three faces, all self-hosted: Literata for reading and headings, Archivo
  // for controls and labels, Architects Daughter for the pen's short notes.
  // The preloads name the same files the stylesheet does.
  assert.ok(tokens.includes('vendor/fonts/archivo-latin-wdth-normal.woff2'), 'Archivo is not self-hosted');
  assert.ok(tokens.includes('vendor/fonts/literata-latin-normal.woff2'), 'Literata is not self-hosted');
  assert.ok(tokens.includes('vendor/fonts/architects-daughter-latin.woff2'), 'the pen face is not self-hosted');
  assert.ok(html.includes('rel="preload" href="vendor/fonts/literata-latin-normal.woff2"'), 'Literata is not preloaded');
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

// The hero shows the change a plan makes, on a real pantry: the sample's
// after photo with the plan's notes pinned to the shelves they describe, and
// the same pantry before, as a smaller print. The notes are a real list, so a
// screen reader hears them; the drawn Figure 1 this replaced (2026-11-24) was
// a cupboard elevation the owner found read as generated.
test('the hero is the sample pantry after its plan, with the plan\'s notes on it', () => {
  const hero = landing.slice(landing.indexOf('class="hero"'), landing.indexOf('id="spaces"'));
  assert.ok(hero.includes('data-img="sample-after"'), 'the hero lost the after photo');
  assert.ok(hero.includes('data-img="sample-before"'), 'the hero lost the before print');
  assert.match(hero, /<ol class="hp-notes"[^>]*aria-label=/, 'the notes are not a labelled list');
  assert.ok((hero.match(/<li style="--y:/g) || []).length >= 3, 'the photo carries too few notes to read as a plan');
  assert.ok(!landing.includes('id="fig-el"'), 'Figure 1 is back beside the photo');
  assert.match(landingCss, /\.hp-notes li\{[^}]*font-family:var\(--hand\)/, 'the notes are no longer in the pen');
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

// A section about a finished plan showing a chaotic pantry argues against
// itself. The before shot appears once, as the small print beside the hero's
// after photo, never on its own and never in the sample-plan section.
test('the before shot is only ever the small print beside the after', () => {
  const sample = landing.slice(landing.indexOf('id="sample"'), landing.indexOf('id="how"'));
  assert.ok(!sample.includes('pantry-before.webp'), 'the before shot is in the sample-plan section');
  assert.equal((landing.match(/pantry-before\.webp/g) || []).length, 1, 'the before shot appears more than once');
  assert.match(landing, /<figure class="hp-before">\s*<img data-img="sample-before"/, 'the before shot left the hero print');
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

// The landing lists the spaces as an index: the wizard's own buttons, with
// the art hidden here only, and the space names set at a reading size so the
// list never shrinks back to captions. Step 2 of the wizard keeps the art.
test('the spaces read as an index, and only the landing hides their art', () => {
  assert.match(landingCss, /\.space-group \.room-card \.rc-img\{display:none\}/, 'the landing shows the card art again');
  assert.match(landingCss, /\.space-group \.rc-label h3\{[^}]*font-size:var\(--fs-xl\)/, 'space names shrank below reading size');
  const componentsCss = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8');
  assert.ok(!/(^|\})\s*\.room-card \.rc-img\{[^}]*display:none/.test(componentsCss), 'the wizard lost its card art');
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

// The Marked-up Shelf (2026-11-24): warm paper, ink buttons, olive as the
// one accent ink, quiet supporting fields. It replaced the Warm Shelf (cream,
// terracotta, pastel cards), which the owner found read as AI-generated. The
// Warm Shelf had itself replaced a square, one-ink manual look that read as
// clinical (2026-10-03), so buttons keep soft corners and sheets keep shadows.
test('ink buttons, soft corners, an olive accent, no ambient gradients', () => {
  assert.ok(tokens.includes('--spot:      oklch(0.245 0.009 75)'), 'the button ink drifted');
  assert.ok(tokens.includes('--spot-ink:  oklch(0.39 0.052 124)'), 'the olive accent drifted');
  /* The favicon, and the touch icon drawn from it, is --spot in sRGB as
     Chromium converts it: an SVG cannot read a CSS token, so the hex is copied.
     It was terracotta (#B3543B) until 2026-11-24. Change the token and this
     hex together, then rerun scripts/render-touch-icon.mjs. */
  assert.match(readFileSync(new URL('../assets/favicon.svg', import.meta.url), 'utf8'),
    /<rect width="24" height="24"[^>]* fill="#23201c"/i, 'the favicon is off --spot');
  assert.ok(tokens.includes('--brass:     var(--spot)'), 'a second accent is carrying the figure label');
  assert.ok(tokens.includes('--primary:      var(--spot)'), 'the legacy accent no longer points at the button ink');
  assert.match(tokens, /--radius-btn: (8|9|1[0-2])px;/, 'buttons lost their soft corners');
  assert.match(tokens, /--radius: [4-8]px;/, 'sheets are rounding like app cards again');
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

/* results.js draws the elevation plate as an <img>, reading each colour from
   the tokens at draw time with a hex fallback. All seven fallbacks were still
   the palette before the Warm Shelf until 2026-10-25: a palette change has no
   reason to open results.js. (Five since stage 3 took the pastel fields out.)
   So each token is converted here, OKLCH to sRGB
   and clipped, which gives the same hex as Chromium for every one of them. */
test('the plate\'s colour fallbacks are the tokens they stand in for', () => {
  const toHex = (L, C, H) => {
    const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
    return '#' + rgb.map((x) => {
      const c = Math.min(1, Math.max(0, x));
      const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
      return Math.round(v * 255).toString(16).padStart(2, '0');
    }).join('');
  };
  const results = readFileSync(new URL('../js/screens/results.js', import.meta.url), 'utf8');
  const fallbacks = [...results.matchAll(/v\('(--[a-z0-9-]+)','(#[0-9a-f]{6})'\)/g)];
  assert.ok(fallbacks.length >= 5, `found only ${fallbacks.length} plate fallbacks`);
  for (const [, name, fallback] of fallbacks) {
    const token = new RegExp(`\\s${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`).exec(tokens);
    assert.ok(token, `${name} is not an oklch() token`);
    assert.equal(fallback, toHex(+token[1], +token[2], +token[3]), `results.js falls back to a stale ${name}`);
  }
});

/* The report's shelf map used to say "eye level" with a colour: the eye row's
   label column was the accent tint and every other row's was warm grey, and
   that fill was the only thing telling the two apart. The design rules say
   colour carries no meaning on its own (a word or an icon carries it), and a
   walk-in made the point for them, with three walls of peach-or-grey rows and
   no legend in sight. The label column is gone. The eye row says "Eye level"
   in a pill beside its zone, and no rule in components.css paints a shelf
   label any colour at all. */
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
});

// Buttons are gently rounded and labels are sentence case; the square
// corners and letterspaced caps of the manual look made the site read as a
// form (2026-10-03), and a pill read as an app template (2026-11-24).
test('buttons are softly rounded and no label is set in caps', () => {
  assert.match(baseCss, /\.btn\{[^}]*border-radius:var\(--radius-btn\)/, 'buttons lost their own radius');
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

/* Stage 2 of the redesign (2026-11-24): the wizard's controls take the
   button's soft corner, not a pill, and its illustration stages are ink on
   the plain sheet, not a pastel field per card. The owner's brief was warm but
   adult; pills and a grid of tinted tiles read as a children's app. Toasts,
   step dots and the report's tags are other stages' business. */
test('wizard controls are not pills and its art stages are not tinted', () => {
  const css = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sel) => {
    const m = new RegExp(`(?:^|\\})\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`).exec(css);
    assert.ok(m, `no rule for ${sel}`);
    return m[1];
  };
  for (const sel of ['.chip', '.seg', '.seg button', '.wz-units', '.wz-unit', '.wz-detected-chip', '.wz-prefilled', '.opt .rec']) {
    assert.ok(!rule(sel).includes('radius-pill'), `${sel} is a pill again`);
  }
  assert.match(rule('.chip.sel::before'), /border-width:0 2px 2px 0/, 'a selected chip lost its drawn tick');
  // The ink-filled chip set its label in stock; on sel-bg that is white on near-white.
  assert.ok(!/\.chip\.sel\{[^}]*color:var\(--stock\)/.test(css), 'a selected chip is setting its label in white again');
  const stage = rule('.card-visual');
  assert.match(stage, /background:var\(--stock\)/, 'the art stage is not the plain sheet');
  assert.ok(!/tone-\d/.test(css), 'a per-card tint is back on the art stage');
  for (const sel of ['.wz-detected', '.wz-prefilled', '.wz-effort .we-ico']) {
    assert.ok(!/sage|butter|sky/.test(rule(sel)), `${sel} is a pastel field again`);
  }
});

/* Stage 3 of the redesign (2026-11-24): the plan report. Its tags, time
   chips, task buttons and tabs take a soft corner, not a pill; its callouts
   and the elevation plate's shelves are the plain sheet, not a pastel field
   (the eye-level shelf alone keeps the faint olive). The clips were re-rendered
   in the new palette, so the frozen --clip-* tokens are gone. */
test('the report has no pills and no pastel fields', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const components = strip(readFileSync(new URL('../css/components.css', import.meta.url), 'utf8'));
  const report = strip(readFileSync(new URL('../css/report.css', import.meta.url), 'utf8'));
  const rule = (css, sel) => {
    const m = new RegExp(`(?:^|\\})\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`).exec(css);
    assert.ok(m, `no rule for ${sel}`);
    return m[1];
  };
  for (const sel of ['.tag', '.eye-mark', '.wall-tabs [role=tab]', '.task .time', '.task .acts button', '.after-tab', '.cab-tag', '.prod .pmeta span']) {
    assert.ok(!rule(components, sel).includes('radius-pill'), `${sel} is a pill again`);
  }
  for (const sel of ['.plan-chip', '.plan-3d-badge', '.ch-flag', '.map-items .mi']) {
    assert.ok(!rule(report, sel).includes('radius-pill'), `${sel} is a pill again`);
  }
  for (const [css, sel] of [[report, '.safety-note'], [report, '.plan-rate'], [components, '.step-tip'], [components, '.callout.warn'], [components, '.callout.info']]) {
    assert.ok(!/sage|butter|sky|warn-bg|teal-bg/.test(rule(css, sel)), `${sel} is a pastel field again`);
  }
  // A pale selected tab must not keep the white label of the old ink fill.
  assert.ok(!rule(components, '.after-tab.sel').includes('color:var(--stock)'), 'a selected after-tab sets white text on a pale fill');
  const report_ = html.slice(html.indexOf('id="ch-reuse"'), html.indexOf('id="ch-shop"'));
  assert.ok(!/style="[^"]*(sage|butter|sky)-/.test(report_), 'the reuse chapter is a pastel card again');

  const results = readFileSync(new URL('../js/screens/results.js', import.meta.url), 'utf8');
  assert.ok(!/v\('--(sky|butter|sage)-f'/.test(results), 'the elevation plate paints its shelves in pastel fields again');
  assert.match(results, /fill="\$\{m\.eye\?EL_TINT2:EL_SHEET\}"/, 'the plate\'s shelves are not the plain sheet');
  assert.ok(!tokens.includes('--clip-'), 'the frozen clip palette is back in tokens.css');
  assert.ok(!components.includes('--clip-'), 'the step band reads the frozen clip palette again');
});
