import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';

/* The 3D view is the payoff of the whole flow, and its most prominent entry
   point — the "Walk through it in 3D" button on the plan hero — was
   unreachable on every load: the hero's placeholder image was a truncated GIF,
   its onerror hid the enclosing figure, and nothing ever un-hid it. Nothing in
   the suite walked from a real AI plan to a built scene, so a dead button and
   a viewer that never opened looked identical from the outside. This walks it:
   photos in, backend plan back, button visible, scene built. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url));

// A walk-in at the schema's 12-row ceiling, split across three walls — the
// largest thing the viewer is ever asked to build.
const ROWS = 12;
const PLAN = {
  spaceType: 'Pantry',
  summary: 'A walk-in pantry with shelving on two walls.',
  categories: ['Canned goods', 'Baking', 'Snacks'],
  map: Array.from({ length: ROWS }, (_, i) => ({
    level: `Shelf ${i + 1}`, icon: 'up', zone: `Zone ${i + 1}`, why: 'Reachable from the doorway.',
    eye: i === 4, shelfIndex: i, safety: { flag: null, why: null },
    items: [{ name: 'Canned goods', size: 'm', flags: [] }], surface: 'shelf',
  })),
  geometry: {
    unit: 'in', width: 72, height: 96, depth: 72, shelfCount: ROWS,
    shelfYFracs: Array.from({ length: ROWS }, (_, i) => 0.08 + (0.82 * i) / (ROWS - 1)),
    estimated: false,
  },
  layout: {
    type: 'walkin-u',
    sections: [
      { id: 'left', label: 'Left wall', place: 'left', rows: [0, 1, 2, 3, 4] },
      { id: 'back', label: 'Back wall', place: 'back', rows: [5, 6, 7, 8, 9] },
      { id: 'corner', label: 'Corner and floor', place: 'right', rows: [10, 11] },
    ],
  },
  safetyNotes: [],
  productNeeds: [],
  steps: Array.from({ length: 10 }, (_, i) => ({
    task: `Step ${i + 1}`, time: '10 min', why: 'It keeps the plan honest.',
  })),
  time: '3-4 hrs',
  cost: '$0',
};

test('a walk-in AI plan reaches the 3D view through the button on the plan hero', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.route('**/functions/v1/analyze-space', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ plan: PLAN, model: 'test-model', requestId: 'test' }),
  }));

  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#room-cards .room-card', { hasText: 'Kitchen' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#area-cards .room-card', { hasText: 'Pantry' }).first().click();
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
  await expect(page.locator('#plan-hero-img')).toHaveJSProperty('naturalWidth', 200);
  await page.locator('.plan-3d-badge').click();

  await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/, { timeout: 20_000 });
  const canvas = page.locator('#v3d-canvas');
  // dataset.layout is set on the line after buildScene returns, so its presence
  // is the proof that three.js loaded and the scene was actually assembled.
  await expect(canvas).toHaveAttribute('data-layout', 'walkin-u', { timeout: 20_000 });
  await expect(canvas).not.toHaveJSProperty('width', 0);
  await expect(page.locator('#v3d-status')).not.toContainText('could not load');
  await expect(page.locator('#v3d-zones-h')).toContainText(`${ROWS} zones`);
  expect(errors, 'the 3D view threw').toEqual([]);
});
