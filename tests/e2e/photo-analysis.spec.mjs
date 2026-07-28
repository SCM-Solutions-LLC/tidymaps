import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

/* The wizard matrix drives every space with NO photos on purpose, so the whole
   reason the backend exists — send the user's photos, get a real plan — had no
   coverage at all. A signed-in analysis with photos attached reached the
   loading screen and quietly produced the deterministic plan instead, with no
   request ever leaving the browser, and nothing in the suite would have said
   so. This pins the client half of that path: photos attached means a request
   to analyze-space, and the plan that comes back is the one that renders. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.png', import.meta.url));

// The smallest plan the schema and the UI will both accept.
const PLAN = {
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
};

async function driveToPhotos(page) {
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
}

async function finishWizard(page) {
  await page.locator('#flow-next').click();          // photos → household
  await page.locator('#flow-next').click();          // household
  await page.locator('#flow-next').click();          // contents
  await page.locator('#goal-list .wz-goal').first().click();
  await page.locator('#flow-next').click();          // goals
  await page.locator('#flow-next').click();          // style
  await page.locator('#flow-next').click();          // effort
  await page.locator('#flow-next').click();          // shopping
  await page.locator('#flow-next').click();          // review → build
}

test('attaching photos actually sends them to the analysis backend', async ({ page }) => {
  const calls = [];
  await page.route('**/functions/v1/analyze-space', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: PLAN, model: 'test-model', requestId: 'test' }),
    });
  });

  await driveToPhotos(page);
  await page.setInputFiles('#photo-input', PHOTO);
  // The tile confirms the file reached handleFiles, which is what sets
  // state.capture — without it the analysis is silently skipped downstream.
  await expect(page.locator('#photo-tiles .wz-photo')).toHaveCount(1);

  await finishWizard(page);
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  expect(calls, 'a photo was attached, so the backend must have been called').toHaveLength(1);
  expect(calls[0].images).toHaveLength(1);
  expect(calls[0].images[0].media_type).toBe('image/jpeg');
  expect(calls[0].images[0].data.length).toBeGreaterThan(100);
  expect(calls[0].context.dims).toMatchObject({ w_in: 36, h_in: 72, d_in: 16 });

  // The plan on screen is the backend's, not the deterministic fallback.
  await expect(page.locator('#res-steps .task')).toHaveCount(PLAN.steps.length);
  await expect(page.locator('#res-steps .task').first()).toContainText('Empty the shelf');
});

test('one unreadable photo does not sink the photos that are fine', async ({ page }) => {
  // This is the failure that hid the whole backend: a file the browser cannot
  // decode (HEIC off a phone is the common one) rejected the encode step, and
  // Promise.all turned that into "no analysis at all" — no request sent, a
  // deterministic plan on screen, and "Analysis failed" as the only clue.
  const calls = [];
  await page.route('**/functions/v1/analyze-space', async (route) => {
    calls.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: PLAN, model: 'test-model', requestId: 'test' }),
    });
  });

  await driveToPhotos(page);
  await page.setInputFiles('#photo-input', [
    { name: 'shelf.png', mimeType: 'image/png', buffer: readFileSync(PHOTO) },
    // Declared as an image, decodes as nothing — stands in for HEIC.
    { name: 'from-phone.heic', mimeType: 'image/heic', buffer: Buffer.from('not really an image') },
  ]);
  await expect(page.locator('#photo-tiles .wz-photo')).toHaveCount(2);
  // The bad one is called out while the user can still do something about it.
  await expect(page.locator('#photo-tiles .wp-flag', { hasText: "Can't read this file" })).toHaveCount(1);

  await finishWizard(page);
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  expect(calls, 'the readable photo must still reach the backend').toHaveLength(1);
  expect(calls[0].images, 'only the decodable photo is sent').toHaveLength(1);
  await expect(page.locator('#res-steps .task').first()).toContainText('Empty the shelf');
});

test('with no photos the wizard stays offline and never calls the backend', async ({ page }) => {
  const calls = [];
  await page.route('**/functions/v1/analyze-space', async (route) => {
    calls.push(1);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await driveToPhotos(page);
  await finishWizard(page);
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  expect(calls, 'no photos means nothing to analyze').toHaveLength(0);
  expect(await page.locator('#res-steps .task').count()).toBeGreaterThan(0);
});
