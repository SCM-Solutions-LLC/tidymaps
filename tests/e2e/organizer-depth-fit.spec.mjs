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

/* resolveLayout ordered setup above the AI's reading of the photos, but
   state.setup is never empty — setArea() preselects one — so the ai branch was
   unreachable code and the viewer's "matched from your photos" status could
   never appear. Worse, the setup step runs before the photos are taken, so a
   guess made with nothing to look at always beat what the photos showed. */
test('the photos decide the layout when the user never picked a setup', async ({ page }) => {
  await page.goto('/index.html');

  const resolved = await page.evaluate(async () => {
    const [{ state }, { getDemoScenario }, { normalizeAi }] = await Promise.all([
      import('/js/state.js'), import('/js/demo-scenarios.js'), import('/js/plan.js'),
    ]);
    const { setArea } = await import('/js/screens/wizard.js');
    // Exactly what the wizard does when someone clicks through the setup step.
    setArea('kitchen', 'pantry');
    state.dims = { w_in: 72, h_in: 96, d_in: 72 };
    const plan = getDemoScenario('walkin', null, state.household, null);
    plan.layout = { type: 'walkin-u', sections: [] };
    state.ai = normalizeAi(plan);
    // Only a real photo analysis outranks a preselected setup; a canned
    // scenario layout does not, so this has to look like the real thing.
    state.planMeta = { model: 'test', source: 'ai', analyzedAt: 0 };

    const out = {};
    await window.openViewer3d();
    out.untouched = document.getElementById('v3d-canvas').dataset.layout;
    out.status = document.getElementById('v3d-status').textContent;

    // Now the user actually picks a setup: their own choice wins again.
    const m = await import('/js/screens/viewer3d.js');
    m.disposeViewer3d();
    const { setSetup } = await import('/js/screens/wizard.js');
    setSetup('reachin');
    await window.openViewer3d();
    out.chosen = document.getElementById('v3d-canvas').dataset.layout;
    return out;
  });

  expect(resolved.untouched, 'the photos said walk-in and nothing overrode them').toBe('walkin-u');
  expect(resolved.status, 'the "matched from your photos" wording was unreachable').toMatch(/from your photos/);
  expect(resolved.chosen, 'an explicit setup choice still wins').not.toBe('walkin-u');
});
