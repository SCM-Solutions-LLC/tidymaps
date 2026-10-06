import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';
import { WALKIN_PLAN as PLAN, WALKIN_ROWS as ROWS, mockAnalyzeSpace } from './helpers.mjs';

/* The 3D view is the payoff of the whole flow, and its most prominent entry
   point — the "Walk through it in 3D" button on the plan hero — was
   unreachable on every load: the hero's placeholder image was a truncated GIF,
   its onerror hid the enclosing figure, and nothing ever un-hid it. Nothing in
   the suite walked from a real AI plan to a built scene, so a dead button and
   a viewer that never opened looked identical from the outside. This walks it:
   photos in, backend plan back, button visible, scene built. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url));

test('a walk-in AI plan reaches the 3D view through the button on the plan hero', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // The plan is the 12-row walk-in in helpers.mjs, the largest thing the
  // viewer is ever asked to build.
  await mockAnalyzeSpace(page, PLAN);

  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#space-cards .room-card', { hasText: 'Pantry' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#setup-cards .wz-setup', { hasText: 'Walk-in' }).first().click();
  await page.locator('#flow-next').click();
  await page.fill('#m-num-w', '6');
  await page.fill('#m-num-h', '8');
  await page.fill('#m-num-d', '6');
  await page.locator('#flow-next').click();          // measure → photos
  await page.setInputFiles('#photo-input', PHOTO);
  await expect(page.locator('#photo-tiles .wz-photo')).toHaveCount(1);
  await page.locator('#flow-next').click();          // photos → household
  await page.locator('#flow-next').click();          // household
  await page.locator('#flow-next').click();          // contents
  await page.locator('#goal-list .wz-goal').first().click();
  await page.locator('#flow-next').click();          // goals
  await page.locator('#flow-next').click();          // style
  await page.locator('#flow-next').click();          // effort
  await page.locator('#flow-next').click();          // shopping
  await page.locator('#flow-next').click();          // review → build

  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  // The hero illustration renders, which is what makes its 3D button clickable.
  await expect(page.locator('.plan-hero-photo')).toBeVisible();
  await expect(page.locator('#plan-hero-img')).toHaveJSProperty('naturalWidth', 760);
  await page.locator('.plan-3d-badge').click();

  await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/, { timeout: 20_000 });
  const canvas = page.locator('#v3d-canvas');
  // dataset.layout is set on the line after buildScene returns, so its presence
  // is the proof that three.js loaded and the scene was actually assembled.
  await expect(canvas).toHaveAttribute('data-layout', 'walkin-u', { timeout: 20_000 });
  await expect(canvas).not.toHaveJSProperty('width', 0);
  await expect(page.locator('#v3d-status')).not.toContainText('could not load');
  // The sidebar groups a room's zones by wall and counts the walls that carry
  // rows; this plan names three.
  await expect(page.locator('#v3d-zones-h')).toContainText(new RegExp(`${ROWS} zones on 3 walls`));
  expect(errors, 'the 3D view threw').toEqual([]);
});
