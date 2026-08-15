import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';
import { driveWizardToReview } from './helpers.mjs';

/* An analysis runs 70-90 seconds and Back is reachable the whole time, so a
   second run can begin while the first is still in the air. Nothing tied a
   response to the run that asked for it: whichever finished LAST wrote
   state.ai and pushed the user to the report. Someone who pressed Back to
   change an answer, changed it, and rebuilt could be thrown onto the report
   for the answers they had just abandoned — mid-run, from the loading screen
   for the analysis they actually wanted.

   The screen check that existed was not enough on its own. It asked "are we
   still on the loading screen?", and a second run puts the loading screen back
   up, so the stale run found exactly what it expected. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.png', import.meta.url));

const planNamed = (firstStep) => ({
  spaceType: 'Pantry',
  summary: 'A test plan from the mocked backend.',
  categories: ['Canned goods'],
  map: [{
    level: 'Top shelf', icon: 'up', zone: 'Backstock', why: 'Rarely reached.',
    eye: false, shelfIndex: 0, safety: { flag: null, why: null },
    items: [{ name: 'Canned goods', size: 'm', flags: [] }], surface: 'shelf',
  }],
  geometry: { unit: 'in', width: 36, height: 72, depth: 16, shelfCount: 1, shelfYFracs: [0.1], estimated: false },
  layout: null,
  safetyNotes: [],
  productNeeds: [],
  steps: [
    { task: firstStep, time: '10 min', why: 'A clear shelf is easier to plan.' },
    { task: 'Group like with like', time: '10 min', why: 'You stop buying duplicates.' },
    { task: 'Put backstock up top', time: '5 min', why: 'Daily items stay in reach.' },
    { task: 'Label the fronts', time: '10 min', why: 'Everyone can put things back.' },
    { task: 'Wipe the shelf down', time: '5 min', why: 'Crumbs attract pests.' },
    { task: 'Set a restock spot', time: '5 min', why: 'You see gaps before you shop.' },
    { task: 'Check reachability', time: '5 min', why: 'The plan has to survive a hurry.' },
  ],
  time: '45-60 min',
  cost: '$0',
});

const STALE = 'Empty the shelf the user gave up on';
const WANTED = 'Empty the shelf the user actually asked about';


test('a superseded analysis cannot overwrite the plan the user is waiting for', async ({ page }) => {
  const release = [];
  let calls = 0;

  await page.route('**/functions/v1/analyze-space', async (route) => {
    const n = calls++;
    // Both runs are held open, and the STALE one is released FIRST — the
    // ordering that used to hand the user the plan they had walked away from.
    await new Promise((res) => { release[n] = res; });
    const plan = planNamed(n === 0 ? STALE : WANTED);
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plan, model: 'test-model', requestId: 'r' + n }),
      });
    } catch (_) {
      // The client aborts the superseded request; fulfilling it then throws.
    }
  });

  await driveWizardToReview(page, { photo: PHOTO });
  await page.locator('#flow-next').click();          // Build my plan → run 1
  await expect(page.locator('#screen-loading')).toHaveClass(/active/);
  // Wait until run 1's checklist has finished, which is when it arms the
  // navigation that fires the moment its response lands.
  await expect(page.locator('#ls-final')).toHaveClass(/doing/, { timeout: 20_000 });

  // The user changes their mind, goes back, and rebuilds.
  await page.goBack();
  await expect(page.locator('#screen-review')).toHaveClass(/active/);
  await page.locator('#flow-next').click();          // Build my plan → run 2
  await expect(page.locator('#screen-loading')).toHaveClass(/active/);
  await expect.poll(() => calls, { timeout: 20_000 }).toBe(2);

  // Run 1 lands while run 2 is still working. It must change nothing.
  release[0]();
  await page.waitForTimeout(2500);
  await expect(page.locator('#screen-loading'),
    'the abandoned run threw the user onto its own report').toHaveClass(/active/);

  release[1]();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await expect(page.locator('#res-steps .task').first()).toContainText(WANTED);
  await expect(page.locator('#res-steps .task').first()).not.toContainText(STALE);
});

/* Starting another analysis is not the only way to walk away from one. Start
   over and My spaces both sit in the appbar, which the loading screen keeps,
   and Back is always there. A run abandoned that way started no replacement,
   so a token that only advanced on a NEW run left it current: sixty seconds
   later it wrote its plan over the answers Start over had just cleared, and
   the guest-draft writer put that plan back on disk — so the next visit
   offered to restore the plan the user had explicitly deleted. */
test('an analysis abandoned by Start over does not come back', async ({ page }) => {
  let release;
  await page.route('**/functions/v1/analyze-space', async (route) => {
    await new Promise((res) => { release = res; });
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plan: planNamed(STALE), model: 'test-model', requestId: 'r' }),
      });
    } catch (_) { /* aborted, which is the point */ }
  });

  await driveWizardToReview(page, { photo: PHOTO });
  await page.locator('#flow-next').click();
  await expect(page.locator('#screen-loading')).toHaveClass(/active/);
  await expect(page.locator('#ls-final')).toHaveClass(/doing/, { timeout: 20_000 });

  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => window.restart());
  await expect(page.locator('#screen-landing')).toHaveClass(/active/);

  release();
  await page.waitForTimeout(2000);

  const planInMemory = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return !!state.ai;
  });
  expect(planInMemory, 'the abandoned analysis wrote its plan over cleared answers').toBe(false);

  // And the next screen change must not write it back to disk: the guest-draft
  // writer runs on every go(), which is how the deleted plan came back.
  await page.locator('#screen-landing .btn-primary').first().click();
  await expect(page.locator('#screen-space')).toHaveClass(/active/);
  const draft = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('tidymap_draft_v2') || 'null'); } catch (_) { return null; }
  });
  expect(draft && draft.ai, 'the deleted plan was written back to localStorage').toBeFalsy();
  expect(draft && draft.planReady, 'the next visit would offer to restore it').toBeFalsy();
});

test('leaving the loading screen during the hand-off delay does not drag the user back', async ({ page }) => {
  /* Navigation to the report is delayed so the last checklist row can be seen
     ticking over. The screen was checked BEFORE that delay and not again
     inside it, so a Back press landed in the gap still ended on the report. */
  let release;
  await page.route('**/functions/v1/analyze-space', async (route) => {
    await new Promise((res) => { release = res; });
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plan: planNamed(WANTED), model: 'test-model', requestId: 'r' }),
      });
    } catch (_) { /* aborted */ }
  });

  await driveWizardToReview(page, { photo: PHOTO });
  await page.locator('#flow-next').click();
  await expect(page.locator('#screen-loading')).toHaveClass(/active/);
  await expect(page.locator('#ls-final')).toHaveClass(/doing/, { timeout: 20_000 });

  release();
  // Inside the 550ms hand-off window.
  await page.waitForTimeout(120);
  await page.goBack();

  await page.waitForTimeout(1500);
  await expect(page.locator('#screen-review'),
    'Back during the hand-off delay must stick').toHaveClass(/active/);
});
