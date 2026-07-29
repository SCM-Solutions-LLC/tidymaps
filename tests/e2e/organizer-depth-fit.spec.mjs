import { test, expect } from 'playwright/test';

/* A walk-in's measured depth is the ROOM — 72 inches of floor — while the
   builder makes the shelving along its walls 8 to 18 inches deep. The fit
   check compared the organizer's depth against the room, and the organizer's
   depth had already been clamped to the room, so the test was true by
   construction and the depth axis could never report a misfit. A 20-inch bin
   assigned to a 14-inch shelf came back "fits", and because the render used
   the same number it was drawn straight through the shelf it sat on.

   Width is held small and quantity at 1 so depth is the only thing that can
   trip the note. */

async function openWalkInWithBin(page, d_in) {
  await page.goto('/index.html');
  await page.evaluate(async (depth) => {
    const [{ state }, { getDemoScenario }, { normalizeAi }] = await Promise.all([
      import('/js/state.js'), import('/js/demo-scenarios.js'), import('/js/plan.js'),
    ]);
    state.space = 'pantry';
    state.setup = 'walkin';
    state.setupLabel = 'Walk-in';
    state.dims = { w_in: 72, h_in: 96, d_in: 72 };
    state.arrangement = null;
    state.shopping = null;
    state.upgrades = true;
    const plan = getDemoScenario('walkin', null, state.household, null);
    plan.productNeeds = [{
      type: 'clear-bin', qty: 1, purpose: 'Corral loose items',
      targetZone: (plan.map[0] && plan.map[0].zone) || 'Eye level',
      maxDims: { w_in: 10, h_in: 8, d_in: depth }, priority: 'high',
    }];
    state.ai = normalizeAi(plan);
    await window.openViewer3d();
  }, d_in);
  await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', 'walkin-u', { timeout: 20_000 });
  await expect(page.locator('#v3d-organizers')).not.toHaveClass(/hide/);
}

test('a bin deeper than the walk-in shelving is called out; one that fits is not', async ({ page }) => {
  await openWalkInWithBin(page, 20);
  await expect(page.locator('#v3d-fit-note'), 'a 20in bin cannot fit 8-18in walk-in shelving')
    .not.toHaveClass(/hide/);
  await expect(page.locator('#v3d-fit-note')).toContainText(/does not fully fit|do not fully fit/);

  await openWalkInWithBin(page, 11);
  await expect(page.locator('#v3d-fit-note'), 'an 11in bin fits walk-in shelving comfortably')
    .toHaveClass(/hide/);
});
