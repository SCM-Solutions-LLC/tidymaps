import { test, expect } from 'playwright/test';
import { expandChapters } from './helpers.mjs';

/* Three things the app already knew and did not show.

   A user who said they were open to buying, on a plan carrying $118 of
   recommendations, reported seeing "no product options to purchase". The
   recommendations were there — the chapter renders collapsed, so the list sat
   behind a click nobody knows to make. The same fold hid the shelf map and the
   reuse section, and because nothing overrode it for print, the exported PDF
   of a plan dropped those sections entirely.

   And every map row carries items[] with names, sizes and flags — the 3D view
   builds from them — while the report referenced m.items zero times. */

async function openSamplePlan(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

test('a plan with something to buy opens the purchases chapter', async ({ page }) => {
  await openSamplePlan(page);
  const shop = page.locator('#ch-shop');
  const hasProducts = await page.locator('#res-upgrades .pname').count();

  if (hasProducts > 0) {
    await expect(shop).not.toHaveClass(/collapsed/);
    // and the products are genuinely on screen, not merely un-collapsed
    await expect(page.locator('#res-upgrades .pname').first()).toBeVisible();
  } else {
    /* Nothing to buy is the $0 plan, and a folded empty section is correct.
       Asserting it keeps this test honest either way rather than passing
       vacuously on whichever branch the sample happens to take. */
    await expect(shop).toHaveClass(/collapsed/);
  }
});

test('each shelf row lists the items the plan identified there', async ({ page }) => {
  await openSamplePlan(page);
  await expandChapters(page);
  const rows = page.locator('#res-map .shelf');
  await expect(rows.first()).toBeVisible();

  const items = page.locator('#res-map .map-items .mi');
  const count = await items.count();
  expect(count, 'no identified items rendered on any shelf row').toBeGreaterThan(0);

  /* The names have to be the plan's own, not a generic placeholder: the whole
     point is that the report can show what was seen in this space. */
  const names = await items.allTextContents();
  expect(names.every(n => n.trim().length > 0)).toBe(true);
  expect(new Set(names).size, 'every item rendered the same text').toBeGreaterThan(1);
});

test('Save as PDF keeps the sections that start folded', async ({ page }) => {
  /* A printed plan is the copy someone carries into the room. It should
     contain the plan, not the two chapters that happen to open by default. */
  await openSamplePlan(page);
  await page.emulateMedia({ media: 'print' });

  for (const id of ['ch-map', 'ch-reuse', 'ch-shop']) {
    const hidden = await page.evaluate((chapterId) => {
      const ch = document.getElementById(chapterId);
      if (!ch) return 'missing';
      // the fold hides everything that is not the heading
      return [...ch.children]
        .filter(el => !el.classList.contains('ch-head'))
        .every(el => getComputedStyle(el).display === 'none');
    }, id);
    expect(hidden, `${id} is still folded away when printing`).toBe(false);
  }

  // the disclosure arrow is a control nobody can press on paper
  const arrow = await page.evaluate(() => {
    const head = document.querySelector('#ch-map .ch-head');
    return head ? getComputedStyle(head, '::after').display : null;
  });
  expect(arrow).toBe('none');
});

test('the fold still works on screen', async ({ page }) => {
  /* The print rule must not leak into the screen view and leave every chapter
     permanently open — the report is deliberately short on a phone. */
  await openSamplePlan(page);
  const map = page.locator('#ch-map');
  await expect(map).toHaveClass(/collapsed/);
  const bodyHidden = await page.evaluate(() => {
    const el = document.querySelector('#ch-map .map-rows, #ch-map > *:not(.ch-head)');
    return el ? getComputedStyle(el).display === 'none' : null;
  });
  expect(bodyHidden, 'a collapsed chapter is showing its body on screen').toBe(true);
});
