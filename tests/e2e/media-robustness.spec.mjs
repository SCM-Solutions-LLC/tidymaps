import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';
import { driveWizardToReview } from './helpers.mjs';

/* fileToScaledB64 ran its whole encode inside `img.onload` with nothing around
   it. Anything the canvas threw there — an allocation refused on a very large
   photo, a SecurityError out of toDataURL — escaped into the event handler and
   settled neither side of the promise.

   That is the worst shape a failure can take here, because of who is waiting.
   The loading screen awaits the encodes BEFORE any request is made, so the
   deadline in js/api.js never comes into it, and finishLoading hands the whole
   screen to that one promise. The user got a spinner that never stopped: no
   banner, no fallback plan, no way out but a reload.

   The throw is forced rather than provoked, because the real triggers (memory
   pressure, a tainted canvas) are not reproducible on demand — but the failure
   mode they produce is exactly this one. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.png', import.meta.url));

const breakCanvas = (page) => page.addInitScript(() => {
  HTMLCanvasElement.prototype.toDataURL = function () {
    throw new Error('Out of memory');
  };
});

test('a photo the canvas cannot encode rejects instead of hanging', async ({ page }) => {
  await breakCanvas(page);
  await page.goto('/index.html');

  const outcome = await page.evaluate(async () => {
    const { fileToScaledB64 } = await import('/js/media.js');
    /* A REAL image, so the decode succeeds and execution actually reaches the
       canvas. An undecodable stand-in would trip img.onerror first and never
       exercise the throw this test is about — which is how the test passed
       against the unfixed code the first time it was written. */
    const blob = await (await fetch('/assets/photos/ex-cab-before.png')).blob();
    const file = new File([blob], 'shelf.png', { type: 'image/png' });
    return Promise.race([
      fileToScaledB64(file).then(() => 'resolved', (e) => 'rejected: ' + e.message),
      new Promise((res) => setTimeout(() => res('HUNG'), 8000)),
    ]);
  });

  expect(outcome, 'the encode promise never settled').not.toBe('HUNG');
  expect(outcome).toContain('rejected');
  expect(outcome, 'the message has to be one a person can act on').toContain('shelf.png');
});

test('photos that will not encode fall back to a plan instead of a dead spinner', async ({ page }) => {
  await breakCanvas(page);
  await page.route('**/functions/v1/analyze-space', async (route) => {
    // Nothing should reach here: every photo fails to encode first.
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });

  await driveWizardToReview(page, { photo: PHOTO });
  await page.locator('#flow-next').click();          // Build my plan

  // The plan that arrives is the deterministic one, and it says why.
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await expect(page.locator('#res-steps .task').first()).toBeVisible();
});
