import { test, expect } from 'playwright/test';

/* Open kitchen shelving and bathroom wall shelves hang on a wall. The shelves
   builder drew them from the floor up like a freestanding unit, and skipped
   the base board a freestanding unit stands on, so their bottom row had no
   board at all: its bins stood on the ground under the wall. These build the
   real scenes and read back where the boards and the floor are. A reach-in
   is drawn by the same builder and does stand on the floor; it must still. */

async function build(page, cases) {
  return page.evaluate(async (cases) => {
    const [{ normalizeAi }, { resolveLayout }, { getDemoScenario }, { buildScene }, { state }] = await Promise.all([
      import('/js/plan.js'), import('/js/layout.js'), import('/js/demo-scenarios.js'), import('/js/three/scene.js'), import('/js/state.js'),
    ]);
    state.dims = null;
    const out = [];
    for (const c of cases) {
      const raw = getDemoScenario(c.scenario, null, { kids: { present: 'no' }, pets: { present: 'no' }, mobility: [] }, null, c.setup);
      const ai = normalizeAi(raw);
      const layout = resolveLayout({ ai, setup: c.setup, setupTouched: true, scenarioKey: c.scenario, map: ai.map });
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;left:-2000px;top:0;width:320px;height:240px';
      document.body.appendChild(canvas);
      const view = buildScene({ geometry: ai.geometry, map: ai.map, placements: [], canvas, layout, representativeItems: false, environment: false, organizerPlan: {} });
      const boardTops = [];
      let ground = null;
      view.scene.traverse((node) => {
        if (node.userData && node.userData.isShelfBoard) boardTops.push(node.position.y + node.geometry.parameters.height / 2);
        if (node.geometry && node.geometry.type === 'PlaneGeometry' && node.rotation.x < -1.5) ground = node.position.y;
      });
      out.push({
        id: c.setup, layout: layout.type,
        shelves: view.surfaces.filter((s) => s.kind === 'shelf').map((s) => s.y),
        boardTops, ground,
      });
      view.dispose(); view.renderer.forceContextLoss(); canvas.remove();
    }
    return out;
  }, cases);
}

test('wall-hung shelves hang: a board under every row, and the floor below the lowest', async ({ page }) => {
  await page.goto('/index.html');
  const scenes = await build(page, [
    { setup: 'wallshelf', scenario: 'bathroom' },
    { setup: 'openshelf', scenario: 'cabinet' },
    { setup: 'reachin', scenario: 'pantry' },
  ]);
  for (const s of scenes) {
    expect(s.layout, s.id).toBe('shelves');
    const lowest = Math.min(...s.shelves);
    if (s.id === 'reachin') {
      // A reach-in is a freestanding unit: its lowest row is its base, on the floor.
      expect(s.ground, `${s.id}: floor at the unit's base`).toBeGreaterThan(-1);
      continue;
    }
    for (const y of s.shelves) {
      expect(s.boardTops.some((top) => Math.abs(top - y) < 0.5), `${s.id}: no board under the row at ${y}`).toBe(true);
    }
    expect(s.ground, `${s.id}: the floor is ${s.ground}, the lowest board ${lowest}`).toBeLessThan(lowest - 6);
  }
});
