import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';
import { driveWizardToReview } from './helpers.mjs';

/* Things the plan left out used to vanish without a trace. Two ways in: the
   model saw something in the photo that the contents list never named, and
   the client scoped out a category the user did not tick, taking its items
   and its steps with it. Either way the reader of a plan built from their
   own photo found a shelf with one thing fewer than the picture beside it,
   and no way to ask for it back short of rebuilding.

   "Also in your photo" lists both kinds under the map, one chip each. A tap
   gives the thing its row, a step that says where, and a chip ticked in the
   list, and the tap survives a reload because the plan does. A visitor to a
   shared plan is not offered the owner's leftovers. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url));

const row = (level, icon, zone, why, eye, shelfIndex, items, surface = 'shelf') => ({
  level, icon, zone, why, eye, shelfIndex, surface,
  safety: { flag: null, why: null },
  items: items.map((name) => ({ name, size: 'm', flags: [] })),
});

/* A raw server plan in the shape photo-analysis.spec mocks, for a walk-in
   whose rows name their walls. Two things in it are for the client to take
   out: the floor row's "Small appliances" and the step that moves them,
   since the wizard below ticks only the dry goods and the cans. The item has
   to carry the category's own word: the client matches an item's NAME
   against the removed category, not the zone it sits under, so an item named
   only by its brand ("Nespresso machine") would stay on the row and never be
   offered back. The stand mixer is the model's own leftover, with the row it
   was seen on. */
const PLAN = {
  spaceType: 'Pantry',
  summary: 'A walk-in pantry from the mocked backend.',
  categories: ['Dry goods & grains', 'Canned goods', 'Appliances'],
  map: [
    row('Left wall: top shelf', 'up', 'Backstock', 'Rarely reached.', false, 0, ['Canned goods']),
    row('Left wall: lower shelf', 'down', 'Everyday cans', 'Easy to scan at a glance.', false, 1, ['Canned tomatoes']),
    row('Back wall: eye level', 'eye', 'Daily staples', 'What you reach for most.', true, 2, ['Dry goods', 'Rice and pasta']),
    row('Back wall: lower shelf', 'down', 'Big bags', 'Weight sits low.', false, 3, ['Big bags of rice']),
    row('Floor', 'down', 'Appliances', 'Heavy things live low.', false, 4, ['Small appliances'], 'floor'),
  ],
  geometry: { unit: 'in', width: 72, height: 96, depth: 72, shelfCount: 5, shelfYFracs: [0.1, 0.3, 0.5, 0.7, 0.9], estimated: false },
  layout: { type: 'walkin-u', sections: [] },
  safetyNotes: [],
  productNeeds: [],
  steps: [
    { task: 'Empty the shelves', time: '10 min', why: 'A clear shelf is easier to plan.' },
    { task: 'Group like with like', time: '10 min', why: 'You stop buying duplicates.' },
    { task: 'Put backstock up top', time: '5 min', why: 'Daily items stay in reach.' },
    { task: 'Move all appliances to the floor zone', time: '5 min', why: 'Heavy things live low.' },
    { task: 'Label the fronts', time: '10 min', why: 'Everyone can put things back.' },
    { task: 'Wipe the shelves down', time: '5 min', why: 'Crumbs attract pests.' },
    { task: 'Set a restock spot', time: '5 min', why: 'You see gaps before you shop.' },
  ],
  spotted: [{ name: 'Stand mixer', row: 2 }],
  time: '45-60 min',
  cost: '$0',
};

const TICKED = ['Dry goods & grains', 'Canned goods'];

async function buildFromPhoto(page) {
  await page.route('**/functions/v1/analyze-space', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ plan: PLAN, model: 'test-model', requestId: 'test' }),
  }));
  await driveWizardToReview(page, { photo: PHOTO, cats: TICKED });
  await page.locator('#flow-next').click();          // review → build
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

test('what the plan left out is offered back, and one tap gives it a place that survives a reload', async ({ page }) => {
  await buildFromPhoto(page);

  // The unticked category is gone from the checklist, as the edit promises.
  const names = await page.locator('#res-steps .tname').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) expect(name, 'a step about the unticked category survived').not.toMatch(/appliance/i);

  const spotted = page.locator('#res-spotted');
  await expect(spotted).toBeVisible();
  await expect(page.locator('#res-spotted-h')).toHaveText('Also in your photo');
  const chips = spotted.locator('.spot-chip');
  // The model's leftover first, then what the client scoped out; neither in the plan yet.
  await expect(chips).toHaveText([/Stand mixer/, /Small appliances/]);
  const mixer = chips.filter({ hasText: 'Stand mixer' });
  const appliances = chips.filter({ hasText: 'Small appliances' });
  await expect(mixer).toHaveAttribute('aria-pressed', 'false');
  await expect(appliances).toHaveAttribute('aria-pressed', 'false');
  // Nothing to rebuild with until something is taken.
  await expect(spotted.locator('.spot-rebuild')).toBeHidden();

  /* The reader has ticked a step and has the back wall open. Taking an item
     redraws the report, and the redraw must not lose the tick, throw them
     back to the first wall or drop their focus to the top of the page. */
  const firstCheck = page.locator('#res-steps .task .check').first();
  await firstCheck.click();
  await expect(firstCheck).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#res-wall-tabs [data-wall="back"]').click();
  await expect(page.locator('#res-wall-tabs [data-wall="back"]')).toHaveAttribute('aria-selected', 'true');
  await mixer.click();
  await expect(mixer).toHaveAttribute('aria-pressed', 'true');
  await expect(appliances).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#res-wall-tabs [data-wall="back"]')).toHaveAttribute('aria-selected', 'true');
  await expect(mixer).toBeFocused();
  await expect(page.locator('#res-steps .task .check').first()).toHaveAttribute('aria-pressed', 'true');
  // On its row, whichever wall tab is open: the count reads through hidden panels.
  await expect(page.locator('#res-map .mi', { hasText: 'Stand mixer' })).toHaveCount(1);
  // One step for it, pointing at the row it was seen on.
  const task = page.locator('#res-steps .task').filter({ has: page.locator('.tname', { hasText: /^Find a spot for stand mixer/ }) });
  await expect(task).toHaveCount(1);
  await expect(task.locator('.step-where')).toHaveText('Back wall · Eye level');
  /* A stand mixer matches no contents chip, so taking it widens nothing the
     next analysis would read, and a rebuild would only repeat this plan. The
     button waits for an item that does grow the list. */
  await expect(spotted.locator('.spot-rebuild')).toBeHidden();
  await appliances.click();
  await expect(appliances).toHaveAttribute('aria-pressed', 'true');
  await expect(mixer).toHaveAttribute('aria-pressed', 'true');
  await expect(spotted.locator('.spot-rebuild')).toBeVisible();
  /* A reopened space keeps the plan but not the photo files. With nothing
     in memory a rebuild would run the analysis empty and save the fallback
     over this plan, so the button goes with the photos. */
  await page.evaluate(async () => {
    const [{ state }, { buildResults }] = await Promise.all([import('/js/state.js'), import('/js/screens/results.js')]);
    state.uploadedFiles = [];
    state.uploadedVideo = null;
    buildResults();
  });
  await expect(spotted.locator('.spot-rebuild')).toBeHidden();

  // The taps are part of the plan now, so the guest draft carries them.
  await page.reload();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 15_000 });
  await expect(page.locator('#res-spotted .spot-chip', { hasText: 'Stand mixer' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#res-spotted .spot-chip', { hasText: 'Small appliances' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#res-map .mi', { hasText: 'Stand mixer' })).toHaveCount(1);
  await expect(task).toHaveCount(1);
  await expect(task.locator('.step-where')).toHaveText('Back wall · Eye level');
  /* The photos lived only in memory. A rebuild now would run the analysis
     with nothing and save the built-in fallback over this plan, so the
     button stays away until photos are added again. */
  await expect(page.locator('#res-spotted .spot-rebuild')).toBeHidden();
});

test('a shared plan does not offer the owner\'s leftovers to a visitor', async ({ page }) => {
  await buildFromPhoto(page);
  await expect(page.locator('#res-spotted')).toBeVisible();
  // The share view is the same screen with state.shareView set, so set it
  // and rebuild rather than mint a share link for one assertion.
  await page.evaluate(async () => {
    const [{ state }, { buildResults }] = await Promise.all([import('/js/state.js'), import('/js/screens/results.js')]);
    state.shareView = true;
    buildResults();
  });
  await expect(page.locator('#res-spotted')).toBeHidden();
  await expect(page.locator('#res-spotted .spot-chip')).toHaveCount(0);
});
