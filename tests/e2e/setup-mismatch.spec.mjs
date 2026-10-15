import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';
import { driveWizardToReview } from './helpers.mjs';

/* #3: walk-in photos entered as a reach-in. The model follows the card the
   user picked, so the plan was drawn for a shape the photos do not show.
   analyze-space now says what the photos show (seenLayout), and when that
   differs from the picked card the loading screen asks once, before the plan
   opens. Keep opens the plan already built; Switch builds again for the
   detected setup, so the plan always matches the setup the user confirmed. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url));

const plan = (seenLayout, summary) => ({
  spaceType: 'Pantry',
  summary,
  categories: ['Canned goods'],
  map: [{
    level: 'Top shelf', icon: 'up', zone: 'Backstock', why: 'Rarely reached.',
    eye: false, shelfIndex: 0, safety: { flag: null, why: null },
    items: [{ name: 'Canned goods', size: 'm', flags: [] }], surface: 'shelf',
  }],
  geometry: { unit: 'in', width: 60, height: 90, depth: 24, shelfCount: 1, shelfYFracs: [0.1], estimated: false },
  layout: null,
  ...(seenLayout ? { seenLayout } : {}),
  safetyNotes: [],
  productNeeds: [],
  steps: [
    { task: 'Empty the shelf', time: '10 min', why: 'A clear shelf is easier to plan.' },
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

/* Answers the first request with walk-in photos, and any rebuild with a plan
   that agrees with the setup it was sent, so a Switch ends on the report. */
async function mockAnalysis(page, firstSeen = 'walkin-u', secondSeen = null, { rebuildFails = false } = {}) {
  const calls = [];
  await page.route('**/functions/v1/analyze-space', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push(body);
    if (rebuildFails && calls.length > 1) {
      // The anonymous hourly cap: a first build plus a Switch is two of three.
      await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'rate_limited', retryAfterSeconds: 1800 }) });
      return;
    }
    const p = calls.length === 1
      ? plan(firstSeen, 'First build, for the card the user picked.')
      : plan(secondSeen || body.context.setup.archetype, 'Second build, for the confirmed setup.');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: p, model: 'test-model', requestId: 't' }) });
  });
  return calls;
}

async function build(page) {
  await driveWizardToReview(page, { photo: PHOTO, setup: 'Reach-in', dims: ['4.5', '7', '2'] });
  await page.locator('#flow-next').click();          // review → build
}

test('photos that show a different setup ask before the plan opens, and Keep opens the plan already built', async ({ page }) => {
  const calls = await mockAnalysis(page);
  await build(page);

  const check = page.locator('#setup-check');
  await expect(check).toBeVisible({ timeout: 30_000 });
  await expect(check.locator('#setup-check-q')).toHaveText('Your photos look like a walk-in. Switch?');
  await expect(check.getByRole('button', { name: 'Switch', exact: true })).toBeFocused();
  // Switch is a second full analysis, and the box says so before the choice.
  await expect(check.locator('#setup-check-note')).toHaveText('Switching builds your plan again, which takes one to two minutes.');
  // Held: the report does not open behind the question.
  await page.waitForTimeout(1200);
  await expect(page.locator('#screen-loading')).toHaveClass(/active/);

  await check.getByRole('button', { name: 'Keep reach-in' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 10_000 });
  expect(calls).toHaveLength(1);
  expect(await page.evaluate(() => document.body.innerText)).toContain('First build, for the card the user picked.');
});

test('Switch builds again for the detected setup and keeps what the user measured', async ({ page }) => {
  const calls = await mockAnalysis(page);
  await build(page);

  await page.locator('#setup-check').getByRole('button', { name: 'Switch', exact: true }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 30_000 });

  expect(calls).toHaveLength(2);
  expect(calls[0].context.setup).toMatchObject({ id: 'reachin', archetype: 'shelves', touched: true });
  expect(calls[1].context.setup).toMatchObject({ id: 'walkin', archetype: 'walkin-u', touched: true });
  // Typed on the measure step, so the space's own numbers, not the walk-in card's defaults.
  expect(calls[1].context.dims).toMatchObject({ w_in: 54, h_in: 84, d_in: 24 });
  expect(await page.evaluate(() => document.body.innerText)).toContain('Second build, for the confirmed setup.');
  await expect(page.locator('#setup-check')).toBeHidden();
});

test('photos that agree with the picked setup open the plan with no question', async ({ page }) => {
  const calls = await mockAnalysis(page, 'shelves');   // a reach-in pantry is drawn as shelves
  await build(page);
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 30_000 });
  await expect(page.locator('#setup-check')).toBeHidden();
  expect(calls).toHaveLength(1);
});

test('the check is asked once: a rebuild whose photos read differently again opens the plan', async ({ page }) => {
  const calls = await mockAnalysis(page, 'walkin-u', 'l-run');
  await build(page);
  await page.locator('#setup-check').getByRole('button', { name: 'Switch', exact: true }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 30_000 });
  expect(calls).toHaveLength(2);
});

test('a Switch whose rebuild fails opens the plan already built, with the setup it was built for', async ({ page }) => {
  const calls = await mockAnalysis(page, 'walkin-u', null, { rebuildFails: true });
  await build(page);
  await page.locator('#setup-check').getByRole('button', { name: 'Switch', exact: true }).click();

  await expect(page.locator('#load-sub')).toHaveText('We could not build it again, so here is the plan for the setup you picked.', { timeout: 30_000 });
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 10_000 });
  expect(calls).toHaveLength(2);
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).toContain('First build, for the card the user picked.');
  expect(text).not.toMatch(/demo plan/i);
  // The plan and the setup agree again: the walk-in switch was undone.
  const st = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return { setup: state.setup, source: state.planMeta && state.planMeta.source, aiError: state.aiError };
  });
  expect(st).toEqual({ setup: 'reachin', source: 'ai', aiError: null });
});
