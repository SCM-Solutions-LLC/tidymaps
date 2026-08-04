import { test, expect } from 'playwright/test';

/* Opening the 3D view, going back to the plan, and opening it again is the
   single most ordinary thing a user does on this screen, and it used to get
   worse every time: the WebGL pre-flight probed on a throwaway canvas and then
   called WEBGL_lose_context.loseContext() on it. Browsers cap how many context
   losses a document may rack up before they stop handing out contexts at all,
   and the router disposes the viewer on every navigation away, so each round
   trip burned one more. Enough trips and the probe answered "no WebGL" on a
   machine whose GPU was fine, and the viewer showed hardware-acceleration
   advice to someone who did not need it.

   Nothing caught it because the suite only ever opened the viewer once.

   The probe is gone now: createRenderer already walks down from an antialiased
   context to a bare one and throws a labelled error only when every attempt is
   refused, so the real renderer is the only thing that decides. This walks the
   round trip enough times to have tripped the old guard. */

const OPENS = 8;

test('the 3D view survives being opened and closed repeatedly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/index.html');
  await page.evaluate(() => window.go && window.go('results'));

  for (let i = 1; i <= OPENS; i++) {
    await page.evaluate(() => window.openViewer3d());
    await expect(page.locator('#screen-viewer3d.active')).toBeVisible();

    // The scene is up when the canvas has a live context and a layout stamped
    // on it. Poll rather than sleep: the module import is only slow the once.
    await expect.poll(async () => page.evaluate(() => {
      const c = document.getElementById('v3d-canvas');
      return !!(c && c.dataset.layout && (c.getContext('webgl2') || c.getContext('webgl')));
    }), { timeout: 15_000, message: `scene never built on open #${i}` }).toBe(true);

    const status = (await page.locator('#v3d-status').innerText()).trim();
    expect(status, `open #${i} fell back to the WebGL advice`).not.toContain('needs WebGL');

    await page.evaluate(() => window.go('results'));
    await expect(page.locator('#screen-results.active')).toBeVisible();
  }

  expect(errors, 'page errors across the reopen cycle').toEqual([]);
});

/* The failure the removed probe actually caused, modelled directly: a browser
   that refuses a WebGL context on a detached scratch canvas but grants one on
   the real canvas in the page. That is what a document which has used up its
   context-loss allowance looks like, and it is the exact shape the old
   pre-flight got wrong — it asked the canvas that fails and then believed it.

   Only the probe ever called getContext on a detached canvas, so nulling that
   case out reproduces the old veto without touching the real render path. */
test('a browser that refuses a scratch context still gets the 3D view', async ({ page }) => {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (/^webgl/i.test(type) && !this.isConnected) return null;   // detached => refused
      return real.call(this, type, ...rest);
    };
  });

  await page.goto('/index.html');
  await page.evaluate(() => window.go && window.go('results'));
  await page.evaluate(() => window.openViewer3d());

  await expect.poll(async () => page.evaluate(() => {
    const c = document.getElementById('v3d-canvas');
    return !!(c && c.dataset.layout);
  }), { timeout: 15_000, message: 'scene never built' }).toBe(true);

  const status = (await page.locator('#v3d-status').innerText()).trim();
  expect(status, 'showed WebGL advice despite the real canvas working').not.toContain('needs WebGL');
});
