import { test, expect } from 'playwright/test';

/* Metal in the viewer used to render flat black. A MeshStandardMaterial takes
   almost all of its colour from reflections once metalness climbs, and there
   was no environment map anywhere in js/three/, so there was nothing to
   reflect. js/three/scene.js now renders three's stock room through
   PMREMGenerator once per build and hands the result to the materials that
   need it.

   Two things are pinned here, and the second is the one that will actually
   catch somebody:

   1. The metal is not black. Asserted on rendered pixels, not on the material
      graph — the whole defect was a rendering outcome, and a material can
      carry a perfectly correct-looking envMap and still come out dark.

   2. The reflection arrives through material.envMap, and scene.environment is
      NOT used. That looks like a stylistic preference and is not one. In this
      build (three r166) IBL arriving via scene.environment is scaled by
      scene.environmentIntensity alone: material.envMapIntensity is ignored on
      that path, so a per-material trim on top of it is inert. Setting
      envMapIntensity to 0 on all 85 materials of the cabinet scene changed the
      rendered frame by not one byte. The consequence is that scene.environment
      can only light everything at once — every intensity that recovered metal
      also lifted the diffuse surfaces 10-28% with it, which is a relight of
      the scene rather than a fix for black metal.

      So a future simplification to `scene.environment = texture` would look
      tidier, still show metal, and quietly brighten every other surface in the
      viewer. That is what assertion 2 exists to stop. */

const METAL_MIN = 0.3;
/* Measured on the cabinet layout: 0.15 before the fix, 0.66 after. */
const METAL_DARK = 0.35;

async function openViewer(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', /.+/, { timeout: 20_000 });
  await page.waitForTimeout(1200);
}

/* Render, then read the framebuffer back in the same task — the canvas has no
   preserveDrawingBuffer, so the pixels are only valid until the frame ends. */
async function metalLuminance(page, metalMin) {
  return page.evaluate(async (MIN) => {
    const THREE = await import('/vendor/three/three.module.min.js');
    const view = window.__v3dView;
    const { renderer, scene, camera } = view;
    scene.updateMatrixWorld(true);

    const targets = [];
    scene.traverse((node) => {
      if (!node.isMesh || !node.material || Array.isArray(node.material)) return;
      if (!(node.material.metalness >= MIN)) return;
      const p = new THREE.Vector3();
      node.getWorldPosition(p);
      p.project(camera);
      targets.push({ x: (p.x + 1) / 2, y: (p.y + 1) / 2 });
    });

    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const out = [];
    for (const t of targets) {
      const x = Math.round(t.x * w), y = Math.round(t.y * h);   // readPixels is bottom-left
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const buf = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      out.push((0.2126 * buf[0] + 0.7152 * buf[1] + 0.0722 * buf[2]) / 255);
    }
    return out;
  }, metalMin);
}

test('metal in the viewer reflects something instead of rendering black', async ({ page }) => {
  await openViewer(page);

  const lums = await metalLuminance(page, METAL_MIN);

  /* Without this the test passes by finding nothing to look at, which is the
     exact shape of vacuous test this repo keeps catching. */
  expect(lums.length, 'the cabinet scene has metal meshes on screen to measure').toBeGreaterThan(1);

  const sorted = [...lums].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  expect(median, `metal median luminance ${median.toFixed(3)} — black metal is the bug`)
    .toBeGreaterThan(METAL_DARK);
});

test('the reflection is per-material, so it cannot relight the diffuse scene', async ({ page }) => {
  await openViewer(page);

  const state = await page.evaluate((MIN) => {
    const view = window.__v3dView;
    const seen = new Set();
    let metal = 0, metalWithEnv = 0, diffuse = 0, diffuseWithEnv = 0;
    view.scene.traverse((node) => {
      const list = Array.isArray(node.material) ? node.material
        : node.material ? [node.material] : [];
      list.forEach((m) => {
        if (seen.has(m) || !('envMapIntensity' in m)) return;
        seen.add(m);
        if (m.metalness >= MIN) {
          metal++;
          if (m.envMap) metalWithEnv++;
        } else if (!(m.transparent && m.opacity < 0.8)) {
          diffuse++;
          if (m.envMap) diffuseWithEnv++;
        }
      });
    });
    return {
      metal, metalWithEnv, diffuse, diffuseWithEnv,
      sceneEnvironment: !!view.scene.environment,
    };
  }, METAL_MIN);

  expect(state.metal, 'metal materials to check').toBeGreaterThan(0);
  expect(state.diffuse, 'diffuse materials to check').toBeGreaterThan(0);

  expect(state.metalWithEnv, 'every metal material carries the reflection').toBe(state.metal);

  /* The two halves of "this cannot have relit the scene". */
  expect(state.diffuseWithEnv, 'no diffuse material was given a reflection').toBe(0);
  expect(state.sceneEnvironment,
    'scene.environment lights everything and ignores envMapIntensity — see the header')
    .toBe(false);
});
