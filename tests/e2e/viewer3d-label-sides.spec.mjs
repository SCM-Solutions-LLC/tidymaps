import { test, expect } from 'playwright/test';

/* A zone label is as wide as its name, starts at the unit's left edge, and is
   sized in world units, while the field of view is fixed vertically. So a
   phone's canvas, 352 pixels across at a 390 viewport, sees far less width
   than a desktop's at the same label size, and long names ran off the side:
   "binet: top shelf" on the left after an orbit, a drawer bank's names past
   the right edge at rest. 16 of the 37 setups cut at least one label.

   Each setup's own plan (projected onto its setup, the way the wizard builds
   it) is drawn at the 390 viewer's canvas size, at rest and swung either way
   around its target, and every zone label the renderer shows must sit inside
   the frame. Two guards keep a lazy fix out: a label facing the camera stays
   shown (hiding it would also "fit"), and a label is shrunk past the
   distance rule only when it is filling the frame's width. */

const PHONE = { w: 352, h: 560 };

test('every setup keeps its zone labels inside a phone-width frame, at rest and orbited', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/index.html');
  const results = await page.evaluate(async ({ w, h }) => {
    const [{ SETUP_TYPES, scenarioKeyFor }, { resolveLayout }, { getDemoScenario }, { normalizeAi }, { state }, { buildScene }] = await Promise.all([
      import('/js/wizard-data.js'), import('/js/layout.js'), import('/js/demo-scenarios.js'),
      import('/js/plan.js'), import('/js/state.js'), import('/js/three/scene.js'),
    ]);
    state.dims = null;
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const read = (view) => {
      const cam = view.camera;
      cam.updateMatrixWorld();
      const right = cam.position.clone().set(1, 0, 0).applyQuaternion(cam.quaternion);
      const dir = cam.getWorldDirection(cam.position.clone());
      const labels = [];
      view.scene.traverse((n) => {
        if (!n.userData || !n.userData.isZoneLabel) return;
        const facing = !n.userData.faceNormal || n.userData.faceNormal.dot(dir) < -0.12;
        const left = n.position.clone().addScaledVector(right, -n.scale.x / 2).project(cam).x;
        const rightEdge = n.position.clone().addScaledVector(right, n.scale.x / 2).project(cam).x;
        labels.push({
          text: n.userData.labelText, visible: n.visible, facing,
          left: +left.toFixed(3), right: +rightEdge.toFixed(3),
          ratio: n.scale.y / n.userData.baseScale.y,
        });
      });
      return labels;
    };
    const out = [];
    for (const [space, setups] of Object.entries(SETUP_TYPES)) {
      for (const setup of setups) {
        const raw = getDemoScenario(scenarioKeyFor(space, setup.id), null,
          { kids: { present: 'no' }, pets: { present: 'no' }, mobility: [] }, {}, setup.id);
        const ai = normalizeAi(raw);
        const layout = resolveLayout({ ai, setup: setup.id, scenarioKey: space, map: ai.map });
        const canvas = document.createElement('canvas');
        canvas.style.cssText = `position:fixed;left:-2000px;top:0;width:${w}px;height:${h}px`;
        document.body.appendChild(canvas);
        const view = buildScene({
          geometry: ai.geometry, map: ai.map, placements: [], canvas, layout, representativeItems: false, environment: false,
          organizerPlan: { space, styles: [], prefs: [], productNeeds: ai.productNeeds, existingText: '' },
        });
        const target = view.controls.target;
        const start = view.camera.position.clone().sub(target);
        for (const swing of [0, 0.7, -0.7]) {
          view.camera.position.copy(start).applyAxisAngle(view.camera.up, swing).add(target);
          view.controls.update();
          view.requestRender();
          await frame();
          out.push({ key: `${space}/${setup.id}`, swing, labels: read(view) });
        }
        view.dispose();
        view.renderer.forceContextLoss();
        canvas.remove();
      }
    }
    return out;
  }, PHONE);

  expect(new Set(results.map((r) => r.key)).size).toBe(37);
  const clipped = [], hidden = [], shrunk = [];
  for (const { key, swing, labels } of results) {
    const at = `${key} swung ${swing}`;
    for (const l of labels) {
      if (l.facing && !l.visible) hidden.push(`${at}: "${l.text}"`);
      if (l.visible && (l.left < -1 || l.right > 1)) clipped.push(`${at}: "${l.text}" spans ${l.left} to ${l.right}`);
    }
    /* The distance rule scales every label alike and never below 0.55
       (scene.js), so a label under either that floor or the size the rest
       share was shrunk to fit, and has to be using the width it was shrunk
       for. */
    const shown = labels.filter((l) => l.visible);
    const shared = Math.max(...shown.map((l) => l.ratio));
    for (const l of shown) {
      if ((l.ratio < shared - 1e-6 || l.ratio < 0.55 - 1e-6) && l.right - l.left < 1.85) {
        shrunk.push(`${at}: "${l.text}" at ${l.ratio.toFixed(2)} of its size, ${(l.right - l.left).toFixed(2)} wide`);
      }
    }
  }
  expect(clipped, `zone labels cut off at the frame's sides:\n${clipped.join('\n')}`).toEqual([]);
  expect(hidden, `labels facing the camera but hidden:\n${hidden.join('\n')}`).toEqual([]);
  expect(shrunk, `labels shrunk without filling the frame:\n${shrunk.join('\n')}`).toEqual([]);
});
