import { test, expect } from 'playwright/test';

/* Three appearance ports, pinned together because they share one risk: each
   changes what an item looks like, and none of them changes anything a normal
   assertion reads. A silent revert of any of the three leaves a viewer that
   still opens, still drags, still passes every other spec in this directory.

   1. bottle and can are turned on a lathe rather than being a cone frustum and
      a cylinder with a torus stuck on the rim.
   2. a deep shelf packs its representative copies in two ranks with a small
      deterministic wobble, instead of one row of identical fronts.
   3. food and container carry a generated packaging label instead of a blank
      white strip.

   The load-bearing test here is the containment one. The back rank is measured
   from the front rank, so an arithmetic slip pushes copies through the back of
   the carcass — where, at the angle the viewer opens at, they simply are not
   visible and nothing looks wrong. */

/* Setups measured to contain multi-unit items, which is what a second rank
   needs. The pantry the sample plan opens on has none, so testing there would
   prove nothing about ranking. */
const PACKED = [
  { space: 'workbench', setup: 'bench' },
  { space: 'garage', setup: 'overhead' },
  { space: 'closet', setup: 'walkinC' },
];

/* Builds each setup offscreen and reports what the renderer actually laid out.
   environment:false for the same reason three-setup-matrix passes it: this
   reads positions and geometry, never a reflection. */
async function layouts(page, setups) {
  return page.evaluate(async (wanted) => {
    const [{ scenarioKeyFor }, { resolveLayout }, { getDemoScenario }, { normalizeAi }, { state }, { buildScene }] =
      await Promise.all([
        import('/js/wizard-data.js'), import('/js/layout.js'), import('/js/demo-scenarios.js'),
        import('/js/plan.js'), import('/js/state.js'), import('/js/three/scene.js'),
      ]);
    state.dims = null;
    const out = [];
    for (const { space, setup } of wanted) {
      const raw = getDemoScenario(scenarioKeyFor(space, setup), null,
        { kids: { present: 'no' }, pets: { present: 'no' }, mobility: [] }, null);
      const ai = normalizeAi(raw);
      const layout = resolveLayout({ ai, setup, scenarioKey: space, map: ai.map });
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;left:-3000px;width:320px;height:240px';
      document.body.appendChild(canvas);
      const view = buildScene({
        geometry: ai.geometry, map: ai.map, placements: [], canvas, layout, environment: false,
        organizerPlan: { space, styles: [], prefs: [], productNeeds: ai.productNeeds, existingText: '' },
      });

      const surfaces = new Map(view.surfaces.map((s) => [s.index, s]));
      const placed = [];
      view.items.forEach((item) => {
        const surface = surfaces.get(item.userData.shelfIndex);
        if (!surface) return;
        const centre = surface.center || (surface.hitbox && surface.hitbox.position) || { x: 0, y: 0, z: 0 };
        const normal = surface.normal || { x: 0, y: 0, z: 1 };
        const shelfDepth = Number(surface.depth) || Number(ai.geometry.depth) || 0;
        const visuals = [item, ...(item.userData.displayCopies || []).filter((c) => c.visible)];
        visuals.forEach((visual, index) => {
          /* Distance out along the shelf's own normal, which is the axis the
             second rank moves on. */
          const along = (visual.position.x - centre.x) * normal.x
            + (visual.position.y - centre.y) * normal.y
            + (visual.position.z - centre.z) * normal.z;
          placed.push({
            index,
            kind: item.userData.kind,
            surfaceKind: surface.kind,
            rank: visual.userData.depthRank || 0,
            backFace: along - visual.scale.z / 2,
            shelfDepth,
            yaw: visual.rotation.y,
            baseYaw: Math.atan2(-(surface.uDir ? surface.uDir.z : 0), surface.uDir ? surface.uDir.x : 1),
          });
        });
      });

      const geometryTypes = {};
      const labelled = { food: 0, container: 0 };
      view.items.forEach((item) => {
        item.traverse((node) => {
          if (!node.isMesh) return;
          const kind = item.userData.kind;
          if (node === item) {
            geometryTypes[kind] = geometryTypes[kind] || new Set();
            geometryTypes[kind].add(node.geometry.type);
          } else if (node.material && node.material.map && (kind === 'food' || kind === 'container')) {
            labelled[kind] += 1;
          }
        });
      });

      out.push({
        space, setup, placed,
        geometryTypes: Object.fromEntries(Object.entries(geometryTypes).map(([k, v]) => [k, [...v]])),
        labelled,
      });
      view.dispose();
      canvas.remove();
    }
    return out;
  }, setups);
}

test('bottle and can are turned on a lathe, not stacked out of primitives', async ({ page }) => {
  await page.goto('/index.html');
  const built = await layouts(page, [{ space: 'pantry', setup: 'reachin' }, ...PACKED]);

  const seen = {};
  built.forEach((b) => Object.entries(b.geometryTypes).forEach(([kind, types]) => {
    seen[kind] = [...new Set([...(seen[kind] || []), ...types])];
  }));

  expect(seen.bottle, 'a bottle somewhere in these layouts to check').toBeTruthy();
  expect(seen.can, 'a can somewhere in these layouts to check').toBeTruthy();
  expect(seen.bottle).toEqual(['LatheGeometry']);
  expect(seen.can).toEqual(['LatheGeometry']);
});

test('food and container carry a generated packaging label', async ({ page }) => {
  await page.goto('/index.html');
  const built = await layouts(page, [{ space: 'pantry', setup: 'reachin' }, ...PACKED]);

  const total = built.reduce((sum, b) => sum + b.labelled.food + b.labelled.container, 0);
  /* Without this the test passes on a build with no boxed goods in it at all,
     which is the shape of vacuous test this repo keeps catching. */
  expect(total, 'labelled boxed goods to find').toBeGreaterThan(3);
});

test('a packed shelf uses two ranks and never pushes an item through the back', async ({ page }) => {
  await page.goto('/index.html');
  const built = await layouts(page, PACKED);
  const placed = built.flatMap((b) => b.placed);

  expect(placed.length, 'items laid out to measure').toBeGreaterThan(10);

  const back = placed.filter((p) => p.rank === 1);
  expect(back.length, 'at least one copy in the second rank across these layouts').toBeGreaterThan(0);

  /* The containment. Measured from where the renderer actually put each copy,
     not recomputed from the function that decided it. */
  const throughWall = placed.filter((p) => p.shelfDepth > 0
    && p.backFace < -p.shelfDepth / 2 - 0.01);
  expect(throughWall, `copies standing behind their shelf: ${JSON.stringify(throughWall.slice(0, 4))}`)
    .toEqual([]);

  /* A rod hangs in one plane and a pegboard has no depth; neither may rank. */
  expect(placed.filter((p) => p.rank === 1 && (p.surfaceKind === 'rod' || p.surfaceKind === 'pegboard')))
    .toEqual([]);
});

test('the draggable item itself is never moved or turned by the packing', async ({ page }) => {
  await page.goto('/index.html');
  const built = await layouts(page, PACKED);
  const primaries = built.flatMap((b) => b.placed).filter((p) => p.index === 0);

  expect(primaries.length, 'primary items to check').toBeGreaterThan(10);

  /* Copy 0 IS the mesh drag and every other spec reads. If the wobble ever
     reaches it, item positions stop being the plan's positions. */
  expect(primaries.filter((p) => p.rank !== 0), 'a primary item in the back rank').toEqual([]);
  const turned = primaries.filter((p) => Math.abs(p.yaw - p.baseYaw) > 1e-9);
  expect(turned, `primary items rotated off their surface: ${turned.length}`).toEqual([]);
});
