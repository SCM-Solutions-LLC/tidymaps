import { test, expect } from 'playwright/test';

/* The 3D screen is two columns of very different lengths: a fixed-height
   canvas on the left, and a sidebar as long as the plan happens to be — five
   zones, the organizer chips, the fit note and the add control. On a desktop
   that ran ~1115px against the canvas column's ~640, and the 475px difference
   was blank page under the model.

   Balancing it is only half the job. The first attempt scrolled the sidebar
   inside the row, which put the fit warning — a message the app deliberately
   makes — below a fold nobody knew was there, and sliced the organizer chips
   flat at the panel edge so the list read as broken rather than continuing. */

async function openViewer(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#v3d-layouts .v3d-chip').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1800);
}

test('neither column trails a screenful of empty page', async ({ browser }) => {
  for (const width of [1280, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await openViewer(page);
    /* Measured as "how much of the row does the canvas column leave empty",
       not "do the two boxes end level" — the grid stretches both boxes to the
       row height, so comparing the boxes is true whatever the layout does and
       would pass on the very bug this is here to catch. */
    const gap = await page.evaluate(() => {
      const main = document.querySelector('.v3d-main');
      const contentBottom = [...main.querySelectorAll('*')]
        .map((c) => c.getBoundingClientRect().bottom)
        .reduce((a, b) => Math.max(a, b), main.getBoundingClientRect().top);
      return document.querySelector('.v3d-body').getBoundingClientRect().bottom - contentBottom;
    });
    expect(gap, `${Math.round(gap)}px of empty page under the canvas at ${width}px`).toBeLessThan(140);
    await ctx.close();
  }
});

test('the fit warning is on screen without hunting for it', async ({ page }) => {
  await openViewer(page);
  const note = page.locator('#v3d-fit-note');
  if (!(await note.isVisible())) test.skip(true, 'this plan places every organizer');
  /* Two things, neither of which is "is it on screen right now" — the canvas
     is 640px tall, so anything under it is a scroll away by design. It must
     not be inside a scroller the reader has no reason to open, and it must
     sit next to the view it is talking about. */
  const where = await page.evaluate(() => {
    const el = document.getElementById('v3d-fit-note');
    const canvas = document.getElementById('v3d-canvas');
    return {
      inSidebarScroller: !!el.closest('.v3d-zones-inner'),
      belowCanvasBy: el.getBoundingClientRect().top - canvas.getBoundingClientRect().bottom,
    };
  });
  expect(where.inSidebarScroller, 'the warning is buried in the sidebar scroller').toBe(false);
  expect(where.belowCanvasBy, 'the warning is nowhere near the view it is about').toBeLessThan(160);
  expect(where.belowCanvasBy).toBeGreaterThan(0);
});

test('a scrolling sidebar says that it scrolls', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await openViewer(page);
  const state = await page.evaluate(() => {
    const inner = document.querySelector('.v3d-zones-inner');
    const fade = getComputedStyle(document.querySelector('.v3d-zones'), '::after');
    return {
      scrolls: inner.scrollHeight > inner.clientHeight + 1,
      fade: fade.content !== 'none' && parseFloat(fade.height) > 0,
      // and the fade must not swallow clicks meant for the list under it
      passesClicks: fade.pointerEvents === 'none',
    };
  });
  if (state.scrolls) {
    expect(state.fade, 'content is cut off with no sign there is more').toBe(true);
    expect(state.passesClicks).toBe(true);
  }
  await ctx.close();
});

test('the add-organizer form fits on a phone', async ({ browser }) => {
  /* Its two labels were written class="sr-only" and no such class exists in
     this stylesheet, so they rendered as ordinary text and pushed the row off
     the side of the screen. */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await openViewer(page);
  const over = await page.evaluate(() => {
    const row = document.getElementById('v3d-add-organizer');
    if (!row || !row.offsetParent) return null;
    const rr = row.getBoundingClientRect();
    return [...row.querySelectorAll('*')]
      .map((el) => ({ tag: el.tagName, r: el.getBoundingClientRect() }))
      .filter((o) => o.r.width > 0 && (o.r.right > rr.right + 1 || o.r.left < rr.left - 1))
      .map((o) => `${o.tag} ${Math.round(o.r.left)}–${Math.round(o.r.right)} vs ${Math.round(rr.left)}–${Math.round(rr.right)}`);
  });
  expect(over ?? [], 'controls hanging outside the panel').toEqual([]);
  await ctx.close();
});

test('no markup leans on a class the stylesheet does not define', async ({ page }) => {
  /* The general form of the bug above: sr-only was used twice and defined
     nowhere, so two labels meant to be invisible were plainly visible. */
  await page.goto('/index.html');
  const orphans = await page.evaluate(async () => {
    const html = (await (await fetch('/index.html')).text())
      .replace(/<!--[\s\S]*?-->/g, '');   // a comment is not markup
    const used = new Set();
    for (const m of html.matchAll(/class="([^"]+)"/g)) {
      m[1].split(/\s+/).filter(Boolean).forEach((c) => used.add(c));
    }
    const defined = new Set();
    for (const sheet of [...document.styleSheets]) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      const walk = (list) => {
        for (const r of list) {
          if (r.selectorText) {
            for (const m of r.selectorText.matchAll(/\.([A-Za-z0-9_-]+)/g)) defined.add(m[1]);
          }
          if (r.cssRules) walk(r.cssRules);
        }
      };
      walk(rules);
    }
    // utility classes carrying no styling of their own are fine; what is not
    // fine is a class whose whole purpose is a style that does not exist
    const MEANS_STYLE = /^(sr-only|visually-hidden|hide|truncate|clearfix)$/;
    return [...used].filter((c) => MEANS_STYLE.test(c) && !defined.has(c));
  });
  expect(orphans, 'markup asks for these classes and no rule defines them').toEqual([]);
});
