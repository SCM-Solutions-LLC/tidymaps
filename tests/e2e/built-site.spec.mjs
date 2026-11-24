import { test, expect } from 'playwright/test';

/* Every other spec serves the source tree. The deploy runs
   scripts/build-site.sh first, and its CSS inliner once rebased the url(#n)
   inside the paper-grain data: SVG: the grain's rect lost its filter, painted
   black, and the landing page went black on production only (11-24). This
   reads the built page's background back as pixels; a computed style still
   says paper while the grain paints over it. */
test('the built landing page is paper, not black', async ({ page }) => {
  await page.goto('http://localhost:8124/');
  await page.waitForLoadState('load');
  const shot = await page.screenshot();
  const lum = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    // The left gutter beside the hero: bare page at any desktop width.
    const [r, g, b] = ctx.getImageData(20, Math.round(img.height * 0.55), 1, 1).data;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }, shot.toString('base64'));
  expect(lum, 'the page background should be warm paper').toBeGreaterThan(200);
});
