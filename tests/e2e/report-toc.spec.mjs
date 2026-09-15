import { test, expect } from 'playwright/test';

/* The report's contents list said "Use what you own" and "Before & after"
   for chapters headed "Use what you already have first" and "What it could
   look like". It carries the headings' own words now, and the longest of them
   is wider than the desktop column, where the entries used to be held to one
   line and clipped. */

async function openSample(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

const entries = (page) => page.$$eval('.report-toc a', (els) => {
  const toc = document.querySelector('.report-toc');
  const ol = toc.querySelector('ol');
  // The phone bar scrolls, so an entry past its edge there is simply further
  // along the bar. The desktop column is a grid, and a grid lets an unwrapped
  // entry grow past the column rather than clip inside it, so there an entry
  // past the column's edge is the failure.
  const column = getComputedStyle(ol).display === 'grid';
  return els
    .filter((a) => a.getClientRects().length)
    .map((a) => {
      const id = a.getAttribute('href').slice(1);
      const head = document.getElementById(`${id}-h`);
      return {
        text: a.textContent.trim(),
        heading: head ? head.textContent.trim() : null,
        clipped: a.scrollWidth > a.clientWidth + 1
          || (column && a.getBoundingClientRect().right > toc.getBoundingClientRect().right + 1),
      };
    });
});

for (const width of [390, 1280]) {
  test(`at ${width} every contents entry says what its chapter heading says, and none is clipped`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await openSample(page);
    const list = await entries(page);
    expect(list.length).toBeGreaterThanOrEqual(5);
    for (const e of list) {
      expect(e.heading, `${e.text} points at no heading`).not.toBeNull();
      expect(e.text, 'entry disagrees with its heading').toBe(e.heading);
      expect(e.clipped, `"${e.text}" is clipped`).toBe(false);
    }
  });
}
