import { test, expect } from 'playwright/test';
import { openViewer } from './helpers.mjs';

/* The 3D view's sliders draw a 4px rule, and the input was the same 4px tall:
   on a phone the whole target was the rule and an 18px thumb. The box is 44px
   now, pulled back into the old footprint, so the panel did not grow and no
   two sliders' targets overlap. */

/* The sliders sit under the Adjust tab, the exact sizes behind its
   disclosure; both open, so every slider has a box to measure. */
async function openSliders(page) {
  await openViewer(page, { adjust: true });
  await page.evaluate(() => { document.getElementById('v3d-advanced').open = true; });
}

const sliderBoxes = (page) => page.$$eval('.v3d-dim input[type=range]', (els) => els
  .filter((el) => el.offsetParent)
  .map((el) => {
    const r = el.getBoundingClientRect();
    const label = el.closest('.v3d-dim').getBoundingClientRect();
    const nameRow = el.previousElementSibling.getBoundingClientRect();
    return {
      id: el.id || el.dataset.shelfHeight, top: r.top, bottom: r.bottom, height: r.height,
      // What the slider takes in the row: the space between its name and the
      // row's end. A 6px gap and the 4px rule; a 44px box left in flow is 50.
      inFlow: label.bottom - nameRow.bottom,
      // The rule is drawn on the track, so the 44px box itself paints nothing.
      boxPaint: getComputedStyle(el).backgroundColor,
    };
  }));

test('every slider is a 44px target that paints only its rule, in a row that did not grow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSliders(page);
  const boxes = await sliderBoxes(page);
  expect(boxes.length, 'no sliders on screen').toBeGreaterThanOrEqual(4);
  for (const b of boxes) {
    expect(b.height, `${b.id} target height`).toBeGreaterThanOrEqual(44);
    expect(b.boxPaint, `${b.id} paints its whole box; the rule belongs on the track`).toBe('rgba(0, 0, 0, 0)');
    expect(b.inFlow, `${b.id} grew its row`).toBeLessThan(30);
  }
});

test('two sliders never share a target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSliders(page);
  const boxes = (await sliderBoxes(page)).sort((a, b) => a.top - b.top);
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i].top, `${boxes[i].id} overlaps ${boxes[i - 1].id}`).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
  }
  // And a tap in the padded band above a slider's rule reaches that slider.
  const hit = await page.evaluate(() => {
    const el = document.getElementById('v3d-w');
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + 3)?.id;
  });
  expect(hit).toBe('v3d-w');
});
