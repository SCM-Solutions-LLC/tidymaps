import { test, expect } from 'playwright/test';

/* E2E matrix: drive the real 12-step wizard (room → area → setup → measure →
   photos → household → contents → goals → style → effort → shopping → review)
   to a finished plan for EVERY area and assert the plan actually belongs to
   the chosen area — the "pantry content leaking into garage" regression
   class. Each run also checks that typed measurements round-trip to the 3D
   view, that the checklist and shelf map rendered, and that no console
   errors or failed local requests occurred.

   The matrix runs with no photos (capture resolves to the demo scenario) so
   it exercises the full wizard, plan rendering, and 3D pipeline without a
   backend. Kid-household variants assert the safety-notes path. Product
   links are checked for shape (https + known retailer) — live non-404
   resolution against retailer sites is deliberately NOT done in CI because
   bot-blocking makes it flaky; scripts/check-product-links.mjs covers that
   on demand. */

// area id → [room card text, area card text, results masthead label]
const MATRIX = {
  pantry: ['Kitchen', 'Pantry', 'Pantry'],
  cabinet: ['Kitchen', 'Cabinets', 'Kitchen cabinet'],
  drawers: ['Kitchen', 'Drawers', 'Kitchen drawers'],
  closet: ['Bedroom', 'Closet', 'Closet'],
  dresser: ['Bedroom', 'Dresser', 'Dresser'],
  bathroom: ['Bathroom & hall', 'Vanity & under-sink', 'Bathroom vanity'],
  linen: ['Bathroom & hall', 'Linen closet', 'Linen closet'],
  garage: ['Garage', 'Shelving & storage', 'Garage shelf'],
  workbench: ['Garage', 'Workbench', 'Workbench'],
};

// feet typed into the measurements step → inches shown in the 3D status line
const DIMS_FT = { w: '3', h: '6', d: '1.33' };
const DIMS_IN = { w: '36', h: '72', d: '16' };

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

async function next(page) {
  await page.locator('#flow-next').click();
}

/* Drive the wizard through all 12 steps. The household step makes no child
   assumption; kid variants explicitly add one child. */
async function driveWizard(page, areaId, { kids = 'no', onContents = null } = {}) {
  const [roomText, areaText] = MATRIX[areaId];
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();

  // 1 room → 2 area → 3 setup (each preselects a valid default)
  await page.locator('#room-cards .room-card', { hasText: roomText }).first().click();
  await next(page);
  await page.locator('#area-cards .room-card', { hasText: areaText }).first().click();
  await next(page);
  await expect(page.locator('#setup-cards .wz-setup.sel')).toHaveCount(1);
  await next(page);

  // 4 measurements: type feet; they must win everywhere downstream.
  await page.fill('#m-num-w', DIMS_FT.w);
  await page.fill('#m-num-h', DIMS_FT.h);
  await page.fill('#m-num-d', DIMS_FT.d);
  await next(page);

  // 5 photos: none — the plan builds from the demo scenario.
  await next(page);

  // 6 household: steppers (defaults 2 adults · 0 kids · 0 pets).
  if (kids === 'yes') {
    await page.locator('.wz-count', { hasText: 'Kids' }).locator('.wc-btn[data-d="1"]').click();
  }
  await next(page);

  // 7 contents · 8 goals · 9 style · 10 effort · 11 shopping
  if (onContents) await onContents(page);
  await next(page);
  await page.locator('#goal-list .wz-goal').first().click();
  await next(page);
  await next(page);
  await next(page);
  await next(page);

  // 12 review → build
  await expect(page.locator('#flow-next')).toContainText('Build my plan');
  await next(page);
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 25_000 });
}

for (const [areaId, [, , label]] of Object.entries(MATRIX)) {
  test(`wizard → plan for ${areaId}: plan belongs to "${label}"`, async ({ page }) => {
    const { failed, consoleErrors } = watchRequests(page);
    await driveWizard(page, areaId);

    // (a) The plan is for the chosen area — masthead, and no stray demo-pantry
    // leakage in the shelf map for non-kitchen spaces.
    await expect(page.locator('#mast-space')).toHaveText(label);
    await expect(page.locator('#plan-hero-img')).toHaveAttribute('data-space', areaId);
    await expect(page.locator('#plan-hero-img')).not.toHaveAttribute('src', /pantry-after/);

    // Zones and steps rendered with content.
    expect(await page.locator('#res-map > *').count()).toBeGreaterThan(0);
    expect(await page.locator('#res-steps .task').count()).toBeGreaterThan(0);
    expect(await page.locator('#res-cat-tags .tag').count()).toBeGreaterThan(0);

    // Every step slot carries a well-formed media key (step-media contract).
    const keys = await page.$$eval('#res-steps .step-art', (els) => els.map((e) => e.dataset.stepMedia));
    for (const k of keys) expect(k).toMatch(/^[a-zA-Z]+-[a-z]+-[a-z]+$/);

    // (b) Measurements typed in feet round-trip into the 3D status line in inches.
    await page.getByRole('button', { name: 'Open the 3D view' }).first().click();
    await expect(page.locator('#v3d-status')).toContainText(
      `Built from your measurements: ${DIMS_IN.w}″w × ${DIMS_IN.h}″h × ${DIMS_IN.d}″d`,
      { timeout: 15_000 },
    );

    // (d) No console errors, no failed local requests anywhere along the flow.
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
    expect(failed, failed.join('\n')).toHaveLength(0);
  });
}

test('per-space question branching matches the design contract', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();

  // Bedroom → Closet asks about hangers and capsule wardrobes…
  await page.locator('#room-cards .room-card', { hasText: 'Bedroom' }).click();
  await next(page);
  await page.locator('#area-cards .room-card', { hasText: 'Closet' }).first().click();
  await page.locator('#flow-next').click(); // → setup
  await expect(page.locator('#setup-cards .wz-setup', { hasText: 'Walk-in' })).toBeVisible();
  await page.locator('body').evaluate(() => window.go('style'));
  await expect(page.locator('#style-cards')).toContainText('Matching hangers');
  await expect(page.locator('#style-cards')).toContainText('Capsule & minimal');

  // …the garage about latching totes…
  await page.locator('body').evaluate(() => window.go('space'));
  await page.locator('#room-cards .room-card', { hasText: 'Garage' }).click();
  await next(page);
  await page.locator('#area-cards .room-card', { hasText: 'Shelving & storage' }).first().click();
  await page.locator('body').evaluate(() => window.go('style'));
  await expect(page.locator('#style-cards')).toContainText('Clear latching totes');

  // …and the workbench about shadow boards. Never one generic style list.
  await page.locator('body').evaluate(() => window.go('area'));
  await page.locator('#area-cards .room-card', { hasText: 'Workbench' }).first().click();
  await page.locator('body').evaluate(() => window.go('style'));
  await expect(page.locator('#style-cards')).toContainText('Shadow-board pegboard');

  // Per-space goals too: workbench asks about tools, not pantry clutter.
  await page.locator('body').evaluate(() => window.go('goals'));
  await expect(page.locator('#goal-list')).toContainText("Can't find the right tool");
});

for (const areaId of ['pantry', 'garage']) {
  test(`kid household in ${areaId}: safety notes render`, async ({ page }) => {
    const { consoleErrors } = watchRequests(page);
    await driveWizard(page, areaId, { kids: 'yes' });
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

test('wizard answers personalize the plan: style cited, effort sized, use-what-I-have = no purchases, contents authoritative', async ({ page }) => {
  await driveWizard(page, 'pantry', {
    kids: 'no',
    onContents: async (p) => {
      // The user says only these live in the pantry — the contents list is
      // authoritative, so scenario-only categories (e.g. "Paper goods") must
      // leave the shelf map entirely.
      await p.locator('#contents-chips .chip', { hasText: 'Snacks' }).first().click();
      await p.locator('#contents-chips .chip', { hasText: 'Canned goods' }).first().click();
      await p.locator('#contents-chips .chip', { hasText: 'Breakfast' }).first().click();
    },
  }).catch(async (e) => { throw e; });
  await expect(page.locator('#screen-results')).toHaveClass(/active/);

  // Rebuild with distinctive answers: run again through the wizard screens
  // via direct edits (Edit flow), setting style + effort before rebuilding.
  await page.locator('body').evaluate(() => window.go('style'));
  await page.locator('#style-cards .wz-style', { hasText: 'Labeled everything' }).click();
  await page.locator('body').evaluate(() => window.go('effort'));
  await page.locator('#effort-cards .wz-effort', { hasText: 'Quick refresh' }).click();
  await page.locator('body').evaluate(() => window.go('review'));
  await expect(page.locator('#flow-next')).toContainText('Build my plan');
  await page.locator('#flow-next').click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 25_000 });

  // Effort sizes the checklist (Quick ≈ 6, never the full template list).
  const stepCount = await page.locator('#res-steps .task').count();
  expect(stepCount).toBeLessThanOrEqual(6);

  // The user's answers are cited in the plan they see.
  const stepsText = await page.locator('#res-steps').textContent();
  expect(stepsText).toMatch(/labels and categories/i);
  expect(stepsText).toMatch(/already own/i);

  // "Use what I have" (the default) → the shopping upsell stays off.
  await expect(page.locator('#res-upgrades-wrap')).toHaveClass(/hide/);

  // Unticked scenario categories are gone from the shelf map, not just the tags.
  const mapText = await page.locator('#res-map').textContent();
  expect(mapText.toLowerCase()).not.toContain('paper');
  const tagsText = await page.locator('#res-cat-tags').textContent();
  expect(tagsText.toLowerCase()).not.toContain('paper');
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
