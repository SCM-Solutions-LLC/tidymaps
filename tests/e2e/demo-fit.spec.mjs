import { test, expect } from 'playwright/test';

/* The sample plan is the one plan every visitor can open, and its 3D view
   opened with a warning: "2 organizers from your list have no spot in this
   view yet". The plan asked for four 10-inch bins on the eye-level shelf of a
   30-inch pantry, a can rack taller than any of its shelf gaps, and a riser
   on a top shelf with four inches of headroom; and the matcher put the
   middle-shelf products on the top shelf on the strength of the word
   "shelf". A sample that does not fit its own view is the product arguing
   against itself, so this walks the real path: landing, sample plan, 3D. */
test('the sample plan opens in 3D with every organizer placed and fitting', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  await page.getByRole('button', { name: 'Open the 3D view' }).first().click();
  await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/);
  // The organizer panel and the fit note are written together, once the scene
  // is built, so a visible chip means the note has been decided.
  await expect(page.locator('#v3d-organizer-list .v3d-organizer-chip').first()).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('#v3d-fit-note')).toBeHidden();
  expect(errors).toEqual([]);
});

/* ---------- every setup, the way a visitor reaches it ----------

   The sample pantry was the only one of the 33 setups fixed on 09-03; a
   wizard run with no backend opened the 3D view with the fit note on 25 of
   the others. The reasons were several and none was the visitor's: the
   projection sent a middle-shelf can rack to the top shelf on the word
   "shelf"; a partial match claimed a need before the row it named was
   reached; drawers reported their pull-out distance as their depth; the
   regenerated shelf spacing made every top compartment a sliver; and three
   trays for one 24-inch drawer had nowhere to go but a warning. This walks
   the real wizard for each setup with the defaults (no photo, the setup's
   own measurements, shopping left at its default so the organizer panel
   shows) and asks the note to stay hidden. One test per space so a failure
   names the room and the run stays inside the per-test budget. */
const SPACES = ['pantry', 'cabinet', 'drawers', 'closet', 'dresser', 'bathroom', 'linen', 'garage', 'workbench'];

async function walkWizardTo3d(page, space, label) {
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) { /* private mode */ } });
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator(`#space-cards .room-card[data-area="${space}"]`).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#setup-cards .wz-setup').filter({ hasText: label }).first().click();
  await page.locator('#flow-next').click();
  // measure, capture, household, contents, goals, style, effort, shopping, review
  for (let i = 0; i < 9; i++) {
    const next = page.locator('#flow-next');
    await next.waitFor();
    if (await next.isDisabled()) await page.locator('#goal-list .wz-goal').first().click();
    await next.click();
  }
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.getByRole('button', { name: 'Open the 3D view' }).first().click();
  await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/);
  await expect(page.locator('#v3d-organizer-list .v3d-organizer-chip').first()).toBeVisible({ timeout: 15_000 });
}

for (const space of SPACES) {
  test(`every ${space} setup opens its 3D view with the plan's organizers placed and fitting`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/functions/v1/**', (route) => route.abort());
    await page.goto('/index.html');
    const setups = await page.evaluate(async (id) => {
      const { SETUP_TYPES } = await import('/js/wizard-data.js');
      return SETUP_TYPES[id].map((s) => s.label);
    }, space);
    expect(setups.length).toBeGreaterThan(0);
    const failures = [];
    for (const label of setups) {
      await walkWizardTo3d(page, space, label);
      const note = await page.locator('#v3d-fit-note').evaluate((el) => (el.classList.contains('hide') ? '' : el.textContent));
      if (note) failures.push(`${space}/${label}: ${note}`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(errors).toEqual([]);
  });
}

/* ---------- the placer, in isolation ---------- */

async function buildDrawerBank(page, productNeeds, geometry, map) {
  return page.evaluate(async ({ productNeeds, geometry, map }) => {
    const { buildScene } = await import('/js/three/scene.js');
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:-2000px;top:0;width:320px;height:240px';
    document.body.appendChild(canvas);
    const view = buildScene({
      geometry, map, placements: [], canvas, layout: { type: 'drawer-bank' }, representativeItems: false, environment: false,
      organizerPlan: { space: 'drawers', styles: [], prefs: [], productNeeds, existingText: '' },
    });
    const placed = view.organizers.filter((o) => o.userData.spec.source === 'plan').map((o) => {
      const item = view.items.find((it) => it.userData.organizer === o);
      return { type: o.userData.type, qty: o.userData.spec.qty, shelfIndex: item.userData.shelfIndex, fits: o.userData.fits };
    });
    const out = { placed, unplaced: view.unplacedOrganizerQty, mounted: view.mountedElsewhere };
    view.dispose(); view.renderer.forceContextLoss(); canvas.remove();
    return out;
  }, { productNeeds, geometry, map });
}

const DRAWERS = [0, 1, 2, 3].map((i) => ({
  shelfIndex: i, lv: ['Top drawer', 'Second drawer', 'Third drawer', 'Deep bottom drawer'][i], zone: `Zone ${i}`,
  surface: 'drawer', items: [{ name: 'Utensils', size: 'm' }, { name: 'Tools', size: 'm' }],
}));
const BANK = { width: 24, height: 30, depth: 20, shelfCount: 4, shelfYFracs: [0.14, 0.38, 0.62, 0.86] };

test('what one level cannot hold goes to the next level that can, and only a rack with nowhere to hang is left out', async ({ page }) => {
  await page.goto('/index.html');
  // Three 16-inch trays for a top drawer 20.5 inches wide: one fits there.
  // The other two used to be "2 organizers from your list have no spot".
  const trays = await buildDrawerBank(page, [
    { type: 'drawer-organizer', qty: 3, purpose: 'Slots', targetZone: 'Top drawer', maxDims: { w_in: 16, h_in: 2, d_in: 12 } },
  ], BANK, DRAWERS);
  expect(trays.unplaced).toBe(0);
  expect(trays.placed.map((p) => p.shelfIndex)).toEqual([0, 1, 2]);
  expect(trays.placed.every((p) => p.fits)).toBe(true);

  // A hook rack in a bank with no door and no pegboard is not "unplaced":
  // it hangs somewhere the drawing does not show, and the panel says so.
  const rack = await buildDrawerBank(page, [
    { type: 'hook-rack', qty: 2, purpose: 'Hooks', targetZone: 'Top drawer', maxDims: null },
  ], BANK, DRAWERS);
  expect(rack.unplaced).toBe(0);
  expect(rack.mounted).toEqual([{ type: 'hook-rack', qty: 2, label: 'Hooks' }]);
});

test('a tray is measured against the drawer box, not the distance the drawer is drawn pulled out', async ({ page }) => {
  await page.goto('/index.html');
  // 20-inch-deep bank: the box is about 18 inches inside, the drawing pulls
  // it out 12. A 13-inch tray fits the drawer; it used to be reported against
  // the 12.
  const tray = await buildDrawerBank(page, [
    { type: 'drawer-organizer', qty: 1, purpose: 'Slots', targetZone: 'Second drawer', maxDims: { w_in: 12, h_in: 2, d_in: 13 } },
  ], BANK, DRAWERS);
  expect(tray.placed).toEqual([{ type: 'divider', qty: 1, shelfIndex: 1, fits: true }]);
  // And one deeper than the box still does not.
  const deep = await buildDrawerBank(page, [
    { type: 'drawer-organizer', qty: 1, purpose: 'Slots', targetZone: 'Second drawer', maxDims: { w_in: 12, h_in: 2, d_in: 19 } },
  ], BANK, DRAWERS);
  expect(deep.placed[0].fits).toBe(false);
});
