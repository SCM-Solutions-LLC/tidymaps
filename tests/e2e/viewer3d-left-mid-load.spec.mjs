import { test, expect } from 'playwright/test';

/* Audit 11-24 (open item 24): leave the 3D view while it is still loading
   and the scene is built against a hidden canvas, so its drawing buffer is
   sized from fallbacks rather than the canvas. Coming back reused that view
   as it was (`if(view) return`), so the drawing stayed the wrong size. */
test('a 3D view left while loading draws at the canvas size when reopened', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  // Hold the scene module so "still loading" lasts until we have left.
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route('**/js/three/scene.js', async (route) => { await held; await route.continue(); });
  await page.locator('#res-actions').getByRole('button', { name: 'Open the 3D view' }).click();
  await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/);
  await page.getByRole('button', { name: '‹ Back to plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  release();
  await page.waitForTimeout(1500);   // the abandoned load finishes behind the report
  await page.locator('#res-actions').getByRole('button', { name: 'Open the 3D view' }).click();
  await page.locator('#v3d-canvas[data-layout]').waitFor({ state: 'attached', timeout: 20_000 });
  await page.waitForTimeout(500);
  const size = await page.evaluate(() => {
    const c = document.getElementById('v3d-canvas');
    const r = window.__v3dView.renderer;
    return { cw: c.clientWidth, ch: c.clientHeight, bw: c.width / r.getPixelRatio(), bh: c.height / r.getPixelRatio() };
  });
  expect(size.cw).toBeGreaterThan(0);
  expect(Math.abs(size.bw - size.cw), JSON.stringify(size)).toBeLessThan(2);
  expect(Math.abs(size.bh - size.ch), JSON.stringify(size)).toBeLessThan(2);
});
