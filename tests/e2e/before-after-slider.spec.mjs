import { test, expect } from 'playwright/test';
import { expandChapters } from './helpers.mjs';

/* The photo comparison used to clip the AI render to the LEFT of the divider
   while the tags read "Before" on the left and "After · AI" on the right, so
   every side showed the opposite of its own label: drag the handle and the
   panel marked "After" was your original photo. It read as "the AI did
   nothing". This pins each half to the image its label claims. */

const solid = (hex) => 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${hex}"/></svg>`,
).toString('base64');

const BEFORE = solid('#ff0000');   // red
const AFTER = solid('#0000ff');    // blue

async function showSlider(page, pos, before = BEFORE, after = AFTER) {
  await page.goto('/index.html');
  await page.evaluate(([before, after, at]) => {
    document.getElementById('screen-landing').classList.remove('active');
    document.getElementById('screen-results').classList.add('active');
    document.getElementById('after-photo').classList.remove('hide');
    const slider = document.getElementById('ba-slider');
    slider.classList.remove('hide');
    slider.style.setProperty('--pos', at + '%');
    slider.querySelector('input[type=range]').value = String(at);
    document.getElementById('ba-before-img').src = before;
    document.getElementById('ba-after-img').src = after;
  }, [before, after, pos]);
  // The before/after chapter starts folded, which would hide the slider this
  // test screenshots.
  await expandChapters(page);
  await page.waitForTimeout(400);
}

// Reads the rendered slider back as pixels: 'red' = before photo, 'blue' = render.
async function sampleHalves(page) {
  const shot = await page.locator('#ba-slider').screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const name = (x) => {
      const [r, , b] = ctx.getImageData(Math.round(img.width * x), Math.round(img.height / 2), 1, 1).data;
      if (r > 200 && b < 60) return 'red';
      if (b > 200 && r < 60) return 'blue';
      return 'other';
    };
    return { left: name(0.15), right: name(0.85) };
  }, shot.toString('base64'));
}

test('the half labelled "Before" shows the photo, the half labelled "After" shows the render', async ({ page }) => {
  await showSlider(page, 50);

  // The tags are positioned left and right; assert that before touching pixels.
  await expect(page.locator('#ba-slider .ba-tag.b')).toHaveText('Before');
  await expect(page.locator('#ba-slider .ba-tag.a')).toContainText('After');
  const tagSides = await page.evaluate(() => ({
    before: getComputedStyle(document.querySelector('#ba-slider .ba-tag.b')).left,
    after: getComputedStyle(document.querySelector('#ba-slider .ba-tag.a')).right,
  }));
  expect(tagSides.before).toBe('10px');
  expect(tagSides.after).toBe('10px');

  const { left, right } = await sampleHalves(page);
  expect(left, 'the "Before" side must be the original photo').toBe('red');
  expect(right, 'the "After · AI" side must be the render').toBe('blue');
});

/* A phone photo is portrait. The frame is capped at 480px tall and used to
   cover its full width, so at a computer's width a tall photo showed only its
   middle band (a 2026-10-10 test run: "only the middle band shows"). Green
   top and blue bottom stripes must both be in view. */
const PORTRAIT = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">'
  + '<rect width="300" height="400" fill="#ff0000"/>'
  + '<rect width="300" height="60" fill="#00ff00"/>'
  + '<rect y="340" width="300" height="60" fill="#0000ff"/></svg>',
).toString('base64');

test('a portrait photo is shown top to bottom, not cropped to its middle band', async ({ page }) => {
  await showSlider(page, 100, PORTRAIT, PORTRAIT);
  const box = await page.locator('#ba-slider').boundingBox();
  expect(box.width, 'the frame must be wider than the photo is tall, or nothing gets cropped').toBeGreaterThan(400);
  const shot = await page.locator('#ba-slider').screenshot();
  const { top, bottom } = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const name = (y) => {
      const [r, g, b] = ctx.getImageData(Math.round(img.width / 2), Math.round(img.height * y), 1, 1).data;
      if (g > 200 && r < 60 && b < 60) return 'green';
      if (b > 200 && r < 60 && g < 60) return 'blue';
      if (r > 200 && g < 60 && b < 60) return 'red';
      return 'other';
    };
    return { top: name(0.03), bottom: name(0.97) };
  }, shot.toString('base64'));
  expect(top, 'the top of the photo must be in view').toBe('green');
  expect(bottom, 'the bottom of the photo must be in view').toBe('blue');
});

test('dragging the divider wipes between the two, never showing one image twice', async ({ page }) => {
  await showSlider(page, 2);
  const nearlyAllAfter = await sampleHalves(page);
  expect(nearlyAllAfter.left).toBe('blue');
  expect(nearlyAllAfter.right).toBe('blue');

  await showSlider(page, 98);
  const nearlyAllBefore = await sampleHalves(page);
  expect(nearlyAllBefore.left).toBe('red');
  expect(nearlyAllBefore.right).toBe('red');
});
