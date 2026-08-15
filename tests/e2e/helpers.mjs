/* Shared helpers for the end-to-end suite.

   Not a spec file: Playwright's default testMatch only picks up *.spec.* and
   *.test.*, so this is imported, never run. */

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
    steps: all('#res-steps .tname'),
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
   Twelve steps stand between the landing page and a plan, and any spec about
   what happens AFTER the build has to walk all of them first. Shared so the
   walk is written once: a miscounted Continue click fails in a way that looks
   like the behaviour under test. */
export async function driveWizardToReview(page, { photo = null } = {}) {
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#room-cards .room-card', { hasText: 'Kitchen' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#area-cards .room-card', { hasText: 'Pantry' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();          // setup
  await page.fill('#m-num-w', '3');
  await page.fill('#m-num-h', '6');
  await page.fill('#m-num-d', '1.33');
  await page.locator('#flow-next').click();          // measure → photos
  if (photo) {
    await page.setInputFiles('#photo-input', photo);
    // The tile confirms the file reached handleFiles, which is what sets
    // state.capture — without it the analysis is silently skipped downstream.
    await page.locator('#photo-tiles .wz-photo').first().waitFor();
  }
  await page.locator('#flow-next').click();          // photos → household
  await page.locator('#flow-next').click();          // household
  await page.locator('#flow-next').click();          // contents
  await page.locator('#goal-list .wz-goal').first().click();
  await page.locator('#flow-next').click();          // goals
  await page.locator('#flow-next').click();          // style
  await page.locator('#flow-next').click();          // effort
  await page.locator('#flow-next').click();          // shopping → review
  await page.locator('#screen-review.active').waitFor();
}
