import { test, expect } from 'playwright/test';

/* Nothing on this site is meant to scroll sideways, and until now nothing
   checked it. Two real bands of horizontal scroll existed:

     320-430px  the appbar row itself overran the viewport — 19px on the
                landing screen, 49px on the report, before any content
     720-777px  the desktop nav was shown from 720px up, but laid out in a row
                the brand, four nav items, "Sign in" and the CTA need 777px

   The widths below bracket both bands and the breakpoints that now separate
   them (400, 480, 860), so a future change to any of those rules that brings
   the sideways scroll back fails here rather than on a phone. */

const PAGES = [
  'index.html', 'privacy.html', 'terms.html',
  'security.html', 'accessibility.html', 'cookies.html',
];

/* Narrow enough to be a real phone in portrait, plus every point where the
   appbar changes shape, plus the tablet width the old breakpoint broke. */
const WIDTHS = [320, 360, 390, 399, 400, 430, 479, 480, 600, 719, 768, 800, 859, 860, 1024, 1280];

async function overflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
}

test('no page scrolls sideways at any phone, tablet or desktop width', async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of PAGES) {
      await page.goto(`/${path}`);
      expect(await overflow(page), `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('the report screen fits every width too', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    // the sticky chapter rail re-measures on resize; give it the frame
    await page.waitForTimeout(60);
    expect(await overflow(page), `report at ${width}px`).toBeLessThanOrEqual(0);
  }
});

test('the report actions keep their names when they shrink to icons', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);

  // Wide: both labels are drawn.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('button', { name: 'View in 3D' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit answers' })).toBeVisible();

  /* Narrow: the label is visually hidden, not removed. A button whose text
     were simply dropped would still pass a visibility check while losing its
     accessible name, so assert the name and the collapse separately. */
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole('button', { name: 'View in 3D' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit answers' })).toBeVisible();
  const labelWidth = await page.locator('.appbar .results-only .btn-label').first()
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(labelWidth).toBeLessThan(2);
});

test('the mobile menu covers every width the desktop nav cannot fit', async ({ page }) => {
  await page.goto('/index.html');
  const toggle = page.locator('#nav-toggle');
  const nav = page.locator('.site-nav');

  /* 800px is inside the old broken band: the desktop nav did not fit, so this
     is the hamburger's job now. */
  for (const width of [320, 768, 800, 859]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(toggle, `toggle at ${width}px`).toBeVisible();
    await expect(nav, `nav at ${width}px`).toBeHidden();
  }

  await page.setViewportSize({ width: 860, height: 800 });
  await expect(toggle).toBeHidden();
  await expect(nav).toBeVisible();
});

test('every item in the opened mobile menu is reachable and laid out as a row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html');
  await page.locator('#nav-toggle').click();
  await expect(page.locator('.site-nav')).toBeVisible();

  /* "Products" is a <button> among <a>s. The dropdown rules used to name only
     links, so it rendered unpadded and centred while the rest were tall,
     left-aligned rows — and short enough to be an awkward tap target. */
  const rows = await page.locator('.site-nav > *').evaluateAll((els) =>
    els.map((el) => ({
      text: (el.textContent || '').trim(),
      height: el.getBoundingClientRect().height,
      left: el.getBoundingClientRect().left,
    })),
  );
  expect(rows.map((r) => r.text)).toEqual(['Spaces', 'What you get', 'How it works', 'Products']);
  for (const row of rows) {
    expect(row.height, `${row.text} height`).toBeGreaterThanOrEqual(44);
    expect(row.left, `${row.text} left edge`).toBe(rows[0].left);
  }
});
