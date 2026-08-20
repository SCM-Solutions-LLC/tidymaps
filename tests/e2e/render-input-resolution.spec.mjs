import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';

/* The photo preview came back globally brightened and straightened rather than
   rearranged, through three separately designed briefs. One mechanism that is
   not about wording: at a 1100px long edge, a jar in a wide corner pantry is
   about forty pixels, which is near the floor of what an image model can pick
   up and put back as a recognisable object.

   So the render path now asks for 1568 — Gemini's tile size — while the
   analysis keeps 1100, because it sends up to five photos under a time budget
   and is reading the space rather than redrawing it.

   Asserted on the wire: the same source photo has to arrive at render-after
   bigger than it arrives at analyze-space. A constant can be edited to agree
   with itself; the bytes that actually leave the browser cannot. */

/* Deliberately a LARGE source: 1744x1882. The pantry fixtures are all under
   1000px on the long edge, so neither cap scales them and both payloads come
   out byte-identical — this test passed against the change and against its
   absence until the fixture was big enough to be cut down. Content is
   irrelevant here; pixel count is the whole assertion. */
const PHOTO = fileURLToPath(new URL('../../assets/product/plan-shopping.png', import.meta.url));

const PLAN = {
  spaceType: 'Pantry', summary: 'A test plan.', categories: ['Canned goods'],
  map: [{
    level: 'Top shelf', icon: 'up', zone: 'Backstock', why: 'Rarely reached.',
    eye: false, shelfIndex: 0, safety: { flag: null, why: null },
    items: [{ name: 'Canned goods', size: 'm', flags: [] }], surface: 'shelf',
  }],
  geometry: { unit: 'in', width: 36, height: 72, depth: 16, shelfCount: 1, shelfYFracs: [0.1], estimated: false },
  layout: null, safetyNotes: [], productNeeds: [],
  steps: Array.from({ length: 7 }, (_, i) => ({ task: `Step ${i + 1}`, time: '5 min', why: 'Because.' })),
  time: '45-60 min', cost: '$0', observed: true,
};

// A 1x1 PNG is enough: this test is about what goes UP, not what comes back.
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('the render gets a bigger photo than the analysis does', async ({ page }) => {
  const sent = {};

  await page.route('**/functions/v1/analyze-space', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    sent.analysis = body.images && body.images[0] && body.images[0].data;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ plan: PLAN, model: 'test-model', requestId: 'test' }),
    });
  });
  await page.route('**/functions/v1/render-after', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    sent.render = body.image && body.image.data;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ image: { media_type: 'image/png', data: TINY_PNG }, storagePath: null }),
    });
  });

  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#room-cards .room-card', { hasText: 'Kitchen' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#area-cards .room-card', { hasText: 'Pantry' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();
  await page.fill('#m-num-w', '3');
  await page.fill('#m-num-h', '6');
  await page.fill('#m-num-d', '1.33');
  await page.locator('#flow-next').click();                 // measure -> photos
  await page.setInputFiles('#photo-input', PHOTO);
  await expect(page.locator('#photo-tiles .wz-photo')).toHaveCount(1);
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();
  await page.locator('#goal-list .wz-goal').first().click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();                 // review -> build
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  expect(sent.analysis, 'the analysis never received the photo').toBeTruthy();

  await page.locator('#ch-after .ch-head').click();
  await page.getByRole('button', { name: 'Generate photo preview' }).click();
  await expect.poll(() => sent.render, { timeout: 30_000 }).toBeTruthy();

  /* Same source file, same JPEG quality, so more bytes means more pixels.
     Area scales as the square of the edge, so 1568/1100 should land well
     clear of a rounding difference. */
  expect(sent.render.length).toBeGreaterThan(sent.analysis.length * 1.2);
});
