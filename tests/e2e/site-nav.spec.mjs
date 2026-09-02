import { test, expect } from 'playwright/test';

/* Getting around, on a phone. Each of these was seen in a 390px walkthrough
   and none was caught by an existing test, which is how they had all survived. */

const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function openSample(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

test.describe('phone', () => {
  test.use(MOBILE);

  test('the menu closes when it is used to open the product library', async ({ page }) => {
    /* go() only closed the menu when leaving the site pages, and the product
       library is one, so the menu that opened it stayed over its heading. */
    await page.goto('/index.html');
    await page.click('#nav-toggle');
    await expect(page.locator('body')).toHaveClass(/nav-open/);
    await page.locator('.site-nav button', { hasText: 'Products' }).click();
    await expect(page.locator('#screen-products')).toHaveClass(/active/);
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
    await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  test('the 3D view opens on the drawing, not on its controls', async ({ page }) => {
    /* Ten controls stacked above the canvas put it 570px down an 844px screen. */
    await openSample(page);
    await page.click('#res-actions .btn-primary');
    await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/);
    const tops = await page.evaluate(() => ({
      canvas: document.getElementById('v3d-canvas').getBoundingClientRect().top,
      controls: document.querySelector('.v3d-controls').getBoundingClientRect().top,
      zones: document.getElementById('v3d-zone-sidebar').getBoundingClientRect().top,
      viewport: innerHeight,
    }));
    expect(tops.canvas, 'the canvas starts below the first screen').toBeLessThan(tops.viewport * 0.6);
    expect(tops.canvas).toBeLessThan(tops.controls);
    expect(tops.controls).toBeLessThan(tops.zones);
  });

  test('the chapter nav says when it holds more than it shows', async ({ page }) => {
    await openSample(page);
    const nav = page.locator('.report-toc');
    await nav.scrollIntoViewIfNeeded();
    await expect(nav).toHaveClass(/more/);
    await page.evaluate(() => { const ol = document.querySelector('.report-toc ol'); ol.scrollLeft = ol.scrollWidth; });
    await expect(nav).not.toHaveClass(/more/);
  });

  test('a chapter link lands its heading below the sticky chrome', async ({ page }) => {
    await openSample(page);
    await page.click('.report-toc a[href="#ch-steps"]');
    await page.waitForTimeout(600);
    const { head, chrome } = await page.evaluate(() => ({
      head: document.querySelector('#ch-steps .ch-head').getBoundingClientRect().top,
      chrome: document.querySelector('.report-toc').getBoundingClientRect().bottom,
    }));
    expect(head, 'the heading is under the appbar or the nav').toBeGreaterThan(chrome);
  });
});

test('on a desktop a chapter link also clears the appbar', async ({ page }) => {
  await openSample(page);
  await page.click('.report-toc a[href="#ch-steps"]');
  await page.waitForTimeout(600);
  const { head, appbar } = await page.evaluate(() => ({
    head: document.querySelector('#ch-steps .ch-head').getBoundingClientRect().top,
    appbar: document.querySelector('.appbar').getBoundingClientRect().bottom,
  }));
  expect(head).toBeGreaterThan(appbar);
});

test('chapter toggles are named for their chapter', async ({ page }) => {
  /* Six buttons all announced as "Show or hide this section". */
  await openSample(page);
  const names = await page.$$eval('.ch-head[role=button]', (els) =>
    els.map((el) => document.getElementById(el.getAttribute('aria-labelledby') || '')?.textContent.trim()));
  expect(names).toEqual(['Summary', 'Where things go', 'Use what you already have first', 'Step-by-step', 'What it could look like', 'Optional purchases']);
});
