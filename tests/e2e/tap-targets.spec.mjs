import { test, expect } from 'playwright/test';
import { expandChapters } from './helpers.mjs';

/* The 2026-09-14 review measured the site's tap targets at 390 and found
   seven kinds under 44px: the report's product checkboxes (19px), the retailer
   links, the steps segment (32px), the small buttons (34 to 37px), the text
   buttons in sentences (24px), the chapter heads (39px) and Review's Edit
   buttons (32px). Each is a 44px target now without the control growing: text
   controls take padding and give the space back with negative margins, the
   checkbox gets a padded label, and bordered controls take the tap in a band
   above and below the box.

   Two ways of measuring, because the two fixes leave different evidence. A
   padded control reports its target as its own box. A band drawn by a
   pseudo-element does not, so those are probed: the element under a point
   just outside the box must be the control. */

const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

const boxes = (page, sel) => page.$$eval(sel, (els) => els
  .filter((el) => el.getClientRects().length)
  .map((el) => {
    const r = el.getBoundingClientRect();
    return { name: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), w: r.width, h: r.height };
  }));

/* Does a tap `dy` px outside the box, above and below, land on the control? */
const bandReaches = (page, sel, dy) => page.$$eval(sel, (els, dy) => els
  .filter((el) => el.getClientRects().length)
  .map((el) => {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const at = (y) => document.elementFromPoint(x, y);
    return {
      name: (el.textContent || '').trim().slice(0, 30),
      above: at(r.top - dy) === el,
      below: at(r.bottom + dy) === el,
    };
  }), dy);

async function openSample(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await expandChapters(page);
}

test.describe('phone', () => {
  test.use(MOBILE);

  test('text buttons in sentences and the footer links are 44px targets', async ({ page }) => {
    await page.goto('/index.html');
    for (const b of await boxes(page, '.home-link')) {
      expect(b.h, `"${b.name}"`).toBeGreaterThanOrEqual(42);
    }
    for (const b of await boxes(page, '.footer-nav > *')) {
      expect(b.h, `footer "${b.name}"`).toBeGreaterThanOrEqual(44);
    }
    // The padding did not push the sentence apart: the line the sample-plan
    // button sits on is still one line of text.
    const line = await page.locator('#screen-landing .home-link').first().evaluate((el) => {
      const p = el.parentElement.getBoundingClientRect();
      return p.height;
    });
    expect(line).toBeLessThan(70);
  });

  test('the product checkbox has a 44px label that toggles it', async ({ page }) => {
    await openSample(page);
    const labels = await boxes(page, '.prod > .pcheck');
    expect(labels.length).toBeGreaterThan(0);
    for (const b of labels) {
      expect(b.w, `"${b.name}" width`).toBeGreaterThanOrEqual(44);
      expect(b.h, `"${b.name}" height`).toBeGreaterThanOrEqual(44);
    }
    // A tap in the label's corner, well outside the 19px box, flips the box.
    const first = page.locator('.prod > .pcheck').first();
    const input = first.locator('input');
    await first.scrollIntoViewIfNeeded();
    const before = await input.isChecked();
    const r = await first.boundingBox();
    await page.mouse.click(r.x + 3, r.y + 3);
    expect(await input.isChecked()).toBe(!before);
  });

  test('chapter heads, the steps segment and the small buttons take a tap outside their box', async ({ page }) => {
    await openSample(page);
    for (const b of await boxes(page, '.ch-head')) {
      expect(b.h, `chapter head "${b.name}"`).toBeGreaterThanOrEqual(44);
    }
    for (const b of await boxes(page, '.pmore summary')) {
      expect(b.h, `"${b.name}"`).toBeGreaterThanOrEqual(44);
    }
    // The segment's band is below the box only: the sticky progress bar sits
    // over the steps toggle and takes any tap above it.
    for (const hit of await bandReaches(page, '.seg button', 10)) {
      expect(hit.below, `segment "${hit.name}" band`).toBe(true);
    }
    for (const hit of await bandReaches(page, '#ch-shop .btn-sm', 4)) {
      expect(hit.above && hit.below, `small button "${hit.name}" band`).toBe(true);
    }
  });

  test("Review's Edit buttons are 44px targets", async ({ page }) => {
    await page.goto('/index.html');
    await page.locator('#screen-landing .btn-primary').first().click();
    await page.evaluate(() => window.go('review'));
    await expect(page.locator('#screen-review')).toHaveClass(/active/);
    const edits = await boxes(page, '.wr-edit');
    expect(edits.length).toBeGreaterThan(0);
    // min-height:44px lays out at 43.9999 in Chromium's 1/64px units.
    for (const b of edits) expect(b.h, `"${b.name}"`).toBeGreaterThan(43.9);
  });
});
