import { test, expect } from 'playwright/test';

/* The camera distance framed the cabinet body, and for a seven-foot pantry
   that put the top of the cabinet on the top edge of the canvas. Labels sit
   ABOVE what they name: the zone label above its shelf, and the item labels
   that come up when a sidebar row is hovered above the items on it. So the
   top shelf's item labels drew off the canvas, clipped along their top edge.
   Measured on the sample plan at the default camera: their top edges
   projected to 1.01 in normalised device coordinates, where the frame ends
   at 1.00. The same on a phone: the vertical field of view is fixed, so the
   canvas aspect changes nothing about this.

   Both cases read every label sprite, shown or hidden, and project its top
   edge with the viewer's own camera. Hidden labels count: the hover that
   shows them is the moment the clipping is seen. */

const LIMIT = 0.95;   // the camera fit aims for 0.94; the extra is float slack

const highestLabelTop = (view) => {
  const cam = view.camera;
  cam.updateMatrixWorld();
  let max = -Infinity;
  let worst = null;
  view.scene.traverse((node) => {
    if (!node.userData || !node.userData.isLabel) return;
    const top = node.position.clone();
    top.y += node.scale.y * (1 - node.center.y);
    const y = top.project(cam).y;
    if (y > max) { max = y; worst = node.userData.labelText || '(item label)'; }
  });
  return { max, worst };
};

test('the sample plan opens with every label inside the frame', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.getByRole('button', { name: 'Open the 3D view' }).first().click();
  await page.locator('#v3d-organizer-list .v3d-organizer-chip').first().waitFor({ timeout: 15_000 });

  // The helper is defined in this file, so it goes over as source and runs
  // in the page against the viewer's exposed view.
  const { max, worst } = await page.evaluate(`(${highestLabelTop})(window.__v3dView)`);
  expect(max, `the highest label is "${worst}", top edge at NDC ${max.toFixed(3)}`).toBeLessThanOrEqual(LIMIT);
});

/* The fit is generic, so every setup's own scene is held to it, the way
   three-setup-matrix builds them: each demo scenario straight into a
   throwaway canvas. */
test('every setup builds its scene with its labels inside the frame', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/index.html');
  const results = await page.evaluate(async ({ limit, src }) => {
    const highest = new Function(`return ${src}`)();
    const [{ SETUP_TYPES, scenarioKeyFor }, { resolveLayout }, { getDemoScenario }, { normalizeAi }, { state }, { buildScene }] = await Promise.all([
      import('/js/wizard-data.js'), import('/js/layout.js'), import('/js/demo-scenarios.js'),
      import('/js/plan.js'), import('/js/state.js'), import('/js/three/scene.js'),
    ]);
    state.dims = null;
    const out = [];
    for (const [space, setups] of Object.entries(SETUP_TYPES)) {
      for (const setup of setups) {
        const raw = getDemoScenario(scenarioKeyFor(space, setup.id), null, { kids: { present: 'no' }, pets: { present: 'no' }, mobility: [] }, null);
        const ai = normalizeAi(raw);
        const layout = resolveLayout({ ai, setup: setup.id, scenarioKey: space, map: ai.map });
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;left:-2000px;top:0;width:320px;height:240px';
        document.body.appendChild(canvas);
        const view = buildScene({
          geometry: ai.geometry, map: ai.map, placements: [], canvas, layout, representativeItems: false, environment: false,
          organizerPlan: { space, styles: [], prefs: [], productNeeds: ai.productNeeds, existingText: '' },
        });
        const { max, worst } = highest(view);
        out.push({ key: `${space}/${setup.id}`, layout: layout.type, max: +max.toFixed(3), worst, over: max > limit });
        view.dispose();
        view.renderer.forceContextLoss();
        canvas.remove();
      }
    }
    return out;
  }, { limit: LIMIT, src: highestLabelTop.toString() });
  expect(results).toHaveLength(33);
  const over = results.filter((r) => r.over).map((r) => `${r.key} (${r.layout}) ${r.max} "${r.worst}"`);
  expect(over, `label tops above the frame limit:\n${over.join('\n')}`).toEqual([]);
});
