/* Shared helpers for the end-to-end suite.

   Not a spec file: Playwright's default testMatch only picks up *.spec.* and
   *.test.*, so this is imported, never run. */
import { expect } from 'playwright/test';

/* The report opens with Summary and Step-by-step expanded and the four
   reference chapters folded, so the screen is readable on a phone instead of
   fourteen screens long. Tests that assert on content inside a folded chapter
   have to open it first, the same as a reader does — and a folded element
   reports its declared styles rather than its resolved ones, so measuring one
   while hidden silently measures the wrong thing. */
export async function expandChapters(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.chapter.collapsed').forEach((ch) => {
      ch.classList.remove('collapsed');
      const head = ch.querySelector('.ch-head');
      if (head) head.setAttribute('aria-expanded', 'true');
    });
  });
  // Uncollapsing removes display:none from the chapter's children; a rect read
  // in the same frame catches pre-reflow numbers. Two rAFs is the shortest
  // wait that lands after the browser has re-styled and laid out.
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

/* ---------- a signed-in visitor, offline ----------
   supabase-js reads its session straight out of localStorage, so a plausible
   JWT put there before the app boots is a signed-in user for every purpose a
   test has — with the project's own calls intercepted, nothing leaves the
   browser. Shared because more than one spec needs an account now, and a
   second hand-rolled JWT is a second thing to keep in step with the client. */
export const REF = 'jwubrtaacveavbkosgtf';
export const USER_ID = '00000000-0000-4000-8000-000000000001';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  const token = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp }),
    'signature',
  ].join('.');
  return {
    access_token: token, token_type: 'bearer', expires_in: 31536000, expires_at: exp,
    refresh_token: 'fake-refresh',
    user: {
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: 'tester@example.com', app_metadata: {}, user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
}

/* ---------- results fingerprint ----------
   Canonical text of everything the results screen renders, so a test can ask
   "did this answer change the plan at all?" in one comparison.

   It exists with `assertResultsCoverage` below as a pair, and the pair is the
   point. A fingerprint is only as good as its completeness, and completeness is
   exactly what rots: this app's QA sweep twice read a plan surface under the
   wrong selector, and both times the result was a change that looked like no
   change — a working feature reported as an ignored one. Under-reporting is the
   dangerous direction, because a missed surface is indistinguishable from a
   passing test.

   So the selector list is not maintained by hand. The guard asks the live
   screen what it rendered and checks it against this function's own source. */
const FP = () => {
  const t = (sel) => (document.querySelector(sel)?.textContent || '').trim().replace(/\s+/g, ' ');
  const all = (sel) => [...document.querySelectorAll(sel)].map((e) => (e.textContent || '').trim().replace(/\s+/g, ' '));
  return {
    title: t('#res-title'),
    byline: t('#res-byline'),
    aiBadge: t('#res-ai-badge'),
    kpis: all('#res-kpis > *'),
    /* Only the FIRST sentence stays in #res-summary once a summary reaches
       three; the rest move to #res-summary-points. Reading one without the
       other is the miss this file exists to prevent. */
    summary: t('#res-summary'),
    summaryPoints: all('#res-summary-points li'),
    categories: all('#res-cat-tags .tag'),
    problems: all('#res-problems li'),
    opportunities: all('#res-opps li'),
    safetyNotes: all('#res-safety-notes .safety-note'),
    mapZones: all('#res-map .shelf'),
    /* A walk-in's rows sit under wall tabs; the tabs are part of what the
       screen says about the plan, since they name walls the rows never did. */
    wallTabs: all('#res-wall-tabs [role=tab]'),
    /* "Also in your photo": the heading says where the things came from, and
       each chip carries its name and, as "+" or "✓", whether it is in the plan
       yet. Tapping one is a plan change that lives nowhere else on the page. */
    spottedHeading: t('#res-spotted-h'),
    spotted: all('#res-spotted .spot-chip'),
    steps: all('#res-steps .tname'),
    stepWhere: all('#res-steps .step-where'),
    upgradesSub: t('#res-upgrades-sub'),
    products: all('#res-upgrades .pname'),
    shoppingLines: all('#res-shopping li'),
    shoppingTotal: t('#res-shop-total'),
    existingLede: t('#res-existing-lede'),
    existingCards: all('#res-existing .feat'),
    dontBuy: t('#res-dontbuy'),
    fallbackBanner: t('#res-fallback-note'),
    shareBanner: t('#res-share-note'),
  };
};

export const resultsFingerprint = (page) => page.evaluate(FP);

/* Every id the fingerprint mentions, read out of its own source so there is no
   second list to drift. */
const FP_IDS = new Set([...FP.toString().matchAll(/#(res-[a-z0-9-]+)/g)].map((m) => m[1]));

/* Text-carrying elements that are deliberately not plan content. Each carries a
   reason, so adding one stays a decision rather than an accident. */
export const FP_WAIVED = new Map([
  ['res-cat-title', 'static heading'],
  ['res-problems-title', 'static heading'],
  ['res-summary-points-title', 'observed/unobserved label, asserted in ai-plan-honesty'],
  ['res-actions', 'navigation buttons, not plan content'],
  ['res-rate', 'feedback widget, not plan content'],
  ['res-price-asof', 'a timestamp — would make every comparison dirty'],
  ['res-upgrades-wrap', 'container; its children are in the fingerprint'],
  ['res-shopping', 'container; read line-by-line as shoppingLines'],
  ['res-existing', 'container; read card-by-card as existingCards'],
]);

/* Fails when the results screen renders something the fingerprint cannot see. */
export async function assertResultsCoverage(page) {
  const rendered = await page.evaluate(() => [...document.querySelectorAll('#screen-results [id^="res-"]')]
    .filter((el) => (el.textContent || '').trim())
    .map((el) => el.id));
  const unread = rendered.filter((id) => !FP_IDS.has(id) && !FP_WAIVED.has(id));
  if (unread.length) {
    throw new Error(
      `The results screen renders ${unread.join(', ')}, which resultsFingerprint does not read. `
      + `A change confined to one of them would look identical to no change at all. `
      + `Add it to the fingerprint, or to FP_WAIVED with a reason.`);
  }
  return rendered.length;
}

/* ---------- driving the wizard ----------
   Eleven steps stand between the landing page and a plan, and any spec about
   what happens AFTER the build has to walk all of them first. Shared so the
   walk is written once: a miscounted Continue click fails in a way that looks
   like the behaviour under test.

   `cats` ticks those chips on the contents step, by their exact names. Left
   out, the step is passed with nothing ticked, which is what every caller
   before it did and what "the plan's own categories stand" is tested
   against; a ticked chip makes the list the user's (state.catsTouched) and
   scopes the plan to it, so a caller asks for that on purpose.

   `setup` picks a setup card by its label ("Walk-in"); left out, the step
   keeps whatever it offers first. `dims` is the width, height and depth typed
   on the measure step, in feet, as the strings a reader types; the default is
   the small pantry every earlier caller measured. */
export async function driveWizardToReview(page, { photo = null, cats = null, setup = null, dims = null } = {}) {
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#space-cards .room-card', { hasText: 'Pantry' }).first().click();
  await page.locator('#flow-next').click();
  if (setup) await page.locator('#setup-cards .wz-setup', { hasText: setup }).first().click();
  await page.locator('#flow-next').click();          // setup
  const [w, h, d] = dims || ['3', '6', '1.33'];
  await page.fill('#m-num-w', w);
  await page.fill('#m-num-h', h);
  await page.fill('#m-num-d', d);
  await page.locator('#flow-next').click();          // measure → photos
  if (photo) {
    await page.setInputFiles('#photo-input', photo);
    // The tile confirms the file reached handleFiles, which is what sets
    // state.capture — without it the analysis is silently skipped downstream.
    await page.locator('#photo-tiles .wz-photo').first().waitFor();
  }
  await page.locator('#flow-next').click();          // photos → household
  await page.locator('#flow-next').click();          // household
  for (const name of cats || []) {
    // Exact, not a substring: "Snacks" must not tick "Kids' snacks" as well.
    const chip = page.locator('#contents-chips').getByRole('button', { name, exact: true });
    await chip.click();
    // The chip's own state is the proof the tap registered, since a miss here
    // shows up later as a plan that ignored the category list.
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  }
  await page.locator('#flow-next').click();          // contents
  await page.locator('#goal-list .wz-goal').first().click();
  await page.locator('#flow-next').click();          // goals
  await page.locator('#flow-next').click();          // style
  await page.locator('#flow-next').click();          // effort
  await page.locator('#flow-next').click();          // shopping → review
  await page.locator('#screen-review.active').waitFor();
}

/* ---------- the 3D viewer ----------
   The viewer's sidebar is two panels under one pair of tabs: View, what the
   drawing shows, and Adjust, what changes it. The layout chips, the count
   slider and the exact sizes all live under Adjust and start hidden, so the
   old readiness signal, a visible layout chip, is never true on arrival. The
   canvas's data-layout attribute is the signal now: it is set on the line
   after buildScene returns, so it is the proof the scene was built. Shared so
   a spec that drives the controls opens the panel the way a reader does, and
   no spec carries its own idea of which panel holds what.

   `sample` opens the landing page's sample plan first; a spec that seeds its
   own state passes false, with the page already loaded. `adjust` lands on
   the Adjust panel. */
export async function openViewer(page, { adjust = false, sample = true } = {}) {
  if (sample) {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'View a sample plan' }).click();
    await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  }
  await page.evaluate(() => window.openViewer3d());
  await page.locator('#v3d-canvas[data-layout]').waitFor({ state: 'attached', timeout: 20_000 });
  if (adjust) await openAdjust(page);
}

/* Switch the sidebar to Adjust by its tab, the way a reader does, and wait
   for the panel. For a spec that opened the viewer itself. */
export async function openAdjust(page) {
  await page.locator('#v3d-tab-adjust').click();
  await expect(page.locator('#v3d-panel-adjust')).toBeVisible();
}

/* ---------- a walk-in plan from the backend ----------
   A walk-in at the schema's 12-row ceiling, split across three walls: the
   largest thing the viewer is ever asked to build, and the one plan in the
   suite whose sections name their walls, so it is what every per-wall
   assertion reads. results-3d-entry walks it in through the hero button;
   viewer3d-per-wall reads the drawing it makes. One copy, so the two cannot
   be testing different plans. */
export const WALKIN_ROWS = 12;
export const WALKIN_PLAN = {
  spaceType: 'Pantry',
  summary: 'A walk-in pantry with shelving on two walls.',
  categories: ['Canned goods', 'Baking', 'Snacks'],
  map: Array.from({ length: WALKIN_ROWS }, (_, i) => ({
    level: `Shelf ${i + 1}`, icon: 'up', zone: `Zone ${i + 1}`, why: 'Reachable from the doorway.',
    eye: i === 4, shelfIndex: i, safety: { flag: null, why: null },
    items: [{ name: 'Canned goods', size: 'm', flags: [] }], surface: 'shelf',
  })),
  geometry: {
    unit: 'in', width: 72, height: 96, depth: 72, shelfCount: WALKIN_ROWS,
    shelfYFracs: Array.from({ length: WALKIN_ROWS }, (_, i) => 0.08 + (0.82 * i) / (WALKIN_ROWS - 1)),
    estimated: false,
  },
  layout: {
    type: 'walkin-u',
    sections: [
      { id: 'left', label: 'Left wall', place: 'left', rows: [0, 1, 2, 3, 4] },
      { id: 'back', label: 'Back wall', place: 'back', rows: [5, 6, 7, 8, 9] },
      { id: 'corner', label: 'Corner and floor', place: 'right', rows: [10, 11] },
    ],
  },
  safetyNotes: [],
  productNeeds: [],
  steps: Array.from({ length: 10 }, (_, i) => ({
    task: `Step ${i + 1}`, time: '10 min', why: 'It keeps the plan honest.',
  })),
  time: '3-4 hrs',
  cost: '$0',
};

/* Answer the analyze-space call with `plan`, so a wizard run with a photo
   lands on that plan with no backend in the loop. */
export async function mockAnalyzeSpace(page, plan) {
  await page.route('**/functions/v1/analyze-space', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ plan, model: 'test-model', requestId: 'test' }),
  }));
}
