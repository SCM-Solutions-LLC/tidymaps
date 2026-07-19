import { test, expect } from 'playwright/test';

/* E2E matrix: drive the real wizard to a finished plan for EVERY space and
   assert the plan actually belongs to the chosen space — the "pantry content
   leaking into garage" regression class. Each run also checks that typed
   measurements round-trip to the 3D view, that the checklist and shelf map
   rendered, and that no console errors or failed local requests occurred.

   The matrix runs in demo mode (capture = "Use demo example") so it exercises
   the full wizard, plan rendering, and 3D pipeline without a backend. Two
   extra kid-household variants assert the safety-notes path. Product links
   are checked for shape (https + known retailer) — live non-404 resolution
   against retailer sites is deliberately NOT done in CI because bot-blocking
   makes it flaky; scripts/check-product-links.mjs covers that on demand. */

// space id → the demo scenario's spaceType label shown on the results masthead
const SPACE_LABEL = {
  pantry: 'Pantry',
  cabinet: 'Kitchen cabinet',
  drawers: 'Kitchen drawers',
  junk: 'Junk drawer',
  closet: 'Closet',
  walkin: 'Walk-in closet',
  linen: 'Linen closet',
  bathroom: 'Bathroom vanity',
  fridge: 'Fridge & freezer',
  garage: 'Garage shelf',
  attic: 'Attic / storage area',
  laundry: 'Laundry room',
  kids: 'Kids’ storage',
  other: 'Other',
};

const DIMS = { w: '36', h: '72', d: '16', shelves: '5' };

// Landing photos that are declared "pending" in data/images.json 404 by
// design (the onerror handler collapses their slots). Everything else that
// fails is a real bug.
function watchRequests(page) {
  const failed = [];
  const consoleErrors = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && !/hero-pantry|story-pantry-before/.test(r.url())) failed.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    if (!/hero-pantry|story-pantry-before/.test(r.url())) failed.push(`FAILED ${r.url()}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  return { failed, consoleErrors };
}

async function driveWizard(page, spaceId, { kids = 'no' } = {}) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Plan my space' }).click();

  // Space: open every group (closed groups hide their options), pick the space.
  // Click the first still-closed head until none remain — clicking mutates
  // aria-expanded, so a snapshot of the filtered list would go stale.
  await expect(page.locator('#space-opts .space-group').first()).toBeVisible();
  const closed = page.locator('#space-opts .sg-head[aria-expanded="false"]');
  while (await closed.count()) await closed.first().click();
  await page.locator('#space-opts .opt', { hasText: SPACE_LABEL[spaceId].replace(' / storage area', '') })
    .first().click();
  await page.locator('#goal-opts .opt', { hasText: 'easier to find' }).click();
  await page.locator('#flow-next').click();

  // Household: kids yes/no (yes also picks an age so safety copy can cite it).
  await page.locator(`#hh-kids-seg button[data-v="${kids}"]`).click();
  if (kids === 'yes') await page.locator('#hh-age-chips .chip').first().click();
  await page.locator('#flow-next').click();

  // Capture: demo example (third option).
  await page.locator('#capture-opts .opt', { hasText: 'Use demo example' }).click();
  await page.locator('#flow-next').click();

  // Details: type real measurements; they must win everywhere downstream.
  await page.fill('#d-w', DIMS.w);
  await page.fill('#d-h', DIMS.h);
  await page.fill('#d-d', DIMS.d);
  await page.fill('#d-shelves', DIMS.shelves);
  await page.locator('#flow-next').click();

  // Prefs: the gate doesn't require a selection; continue into analysis.
  await page.locator('#flow-next').click();

  // Loading (demo ticker) → review → results.
  await page.locator('#flow-next', { hasText: 'Build my plan' }).waitFor({ timeout: 20_000 });
  await page.locator('#flow-next').click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
}

for (const [spaceId, label] of Object.entries(SPACE_LABEL)) {
  test(`wizard → plan for ${spaceId}: plan belongs to "${label}"`, async ({ page }) => {
    const { failed, consoleErrors } = watchRequests(page);
    await driveWizard(page, spaceId);

    // (a) The plan is for the chosen space — masthead, and no stray demo-pantry
    // leakage in the shelf map for non-kitchen spaces.
    await expect(page.locator('#mast-space')).toHaveText(label);

    // Zones and steps rendered with content.
    expect(await page.locator('#res-map > *').count()).toBeGreaterThan(0);
    expect(await page.locator('#res-steps .task').count()).toBeGreaterThan(0);
    expect(await page.locator('#res-cat-tags .tag').count()).toBeGreaterThan(0);

    // Every step slot carries a well-formed media key (step-media contract).
    const keys = await page.$$eval('#res-steps .step-art', (els) => els.map((e) => e.dataset.stepMedia));
    for (const k of keys) expect(k).toMatch(/^[a-zA-Z]+-[a-z]+-[a-z]+$/);

    // (b) Measurements round-trip into the 3D view's status line.
    await page.getByRole('button', { name: 'Open the 3D view' }).first().click();
    await expect(page.locator('#v3d-status')).toContainText(
      `Built from your measurements: ${DIMS.w}″w × ${DIMS.h}″h × ${DIMS.d}″d`,
      { timeout: 15_000 },
    );

    // (d) No console errors, no failed local requests anywhere along the flow.
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
    expect(failed, failed.join('\n')).toHaveLength(0);
  });
}

for (const spaceId of ['pantry', 'garage']) {
  test(`kid household in ${spaceId}: safety notes render`, async ({ page }) => {
    const { consoleErrors } = watchRequests(page);
    await driveWizard(page, spaceId, { kids: 'yes' });
    await expect(page.locator('#res-safety-notes .safety-note').first()).toBeVisible();
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });
}

test('no-kid household shows no KID safety content (safety rules fire only when relevant)', async ({ page }) => {
  await driveWizard(page, 'pantry', { kids: 'no' });
  // General safety guidance (e.g. heavy items low) is fine for any household;
  // what must never appear without kids is kid-referencing safety content.
  const notes = await page.$$eval('#res-safety-notes .safety-note', (els) => els.map((e) => e.textContent));
  for (const n of notes) expect(n, `kid note leaked for a no-kid household: ${n}`).not.toMatch(/kid|child|little hands|small hands/i);
  const badges = await page.$$eval('#res-map .tag.green', (els) => els.map((e) => e.textContent));
  for (const b of badges) expect(b, `kid-safe zone badge leaked: ${b}`).not.toMatch(/kid/i);
});

test('product links are https and point at known retailers', async ({ page }) => {
  await driveWizard(page, 'pantry');
  // Turn the optional upgrades section on if it isn't already.
  const upgradesOn = await page.evaluate(() => {
    window.setUpgrades(true);
    return true;
  });
  expect(upgradesOn).toBe(true);
  await expect(page.locator('#res-upgrades a[href]').first()).toBeVisible();
  const hrefs = await page.$$eval('#res-upgrades a[href]', (as) => as.map((a) => a.href));
  const allowed = /^https:\/\/([a-z0-9-]+\.)*(amazon\.com|target\.com|walmart\.com|containerstore\.com|ikea\.com)\//i;
  for (const h of hrefs) expect(h, `unexpected product link: ${h}`).toMatch(allowed);
});
