import { test, expect } from 'playwright/test';

/* The in-app opt-out on cookies.html, browser-checked.

   Three things a unit test could not catch on its own: the toggle actually
   changes the localStorage key the reader in js/telemetry.js reads; the flag
   set on cookies.html is read by any other page in the site on its next
   load; and Global Privacy Control makes the toggle disappear rather than
   pretend it can override the browser. Each one is a place the pieces meet
   in a real browser, not in isolation. */

const OPTOUT_KEY = 'tidymap_optout_v1';
const ANON_KEY = 'tidymap_anon_v1';

test('the cookies-page toggle round-trips through localStorage', async ({ page }) => {
  await page.goto('/cookies.html');

  const status = page.locator('#optout-status');
  const btn = page.locator('#optout-btn');

  /* A fresh visitor: nothing in storage, so the counter is on and the
     button offers to turn it off. */
  await expect(status).toContainText('Usage counting is on in this browser.');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('Turn it off');

  /* Seed an anon id so we can prove the opt-out clears it too, not just the
     flag. A visitor who had already been counted should not carry that id
     forward if they later opt back in. */
  await page.evaluate((k) => localStorage.setItem(k, 'existing-uuid'), ANON_KEY);

  await btn.click();
  await expect(status).toContainText('Usage counting is off in this browser.');
  await expect(btn).toHaveText('Turn it back on');
  const afterOptOut = await page.evaluate(
    ([o, a]) => [localStorage.getItem(o), localStorage.getItem(a)],
    [OPTOUT_KEY, ANON_KEY],
  );
  expect(afterOptOut).toEqual(['off', null]);

  await btn.click();
  await expect(status).toContainText('Usage counting is on in this browser.');
  await expect(btn).toHaveText('Turn it off');
  const afterOptIn = await page.evaluate((o) => localStorage.getItem(o), OPTOUT_KEY);
  /* Opting back in REMOVES the key rather than storing 'on'. Two shapes for
     one meaning is one shape too many, and a stale 'on' from a previous
     schema would read as opted in either way. */
  expect(afterOptIn).toBeNull();
});

test('the flag set on cookies.html is what index.html reads on its next load', async ({ page }) => {
  /* This is the whole point of the shared js/optout.js module: the writer on
     one page and the reader on another meet at one key. If the two names
     ever drifted, the toggle would appear to work and telemetry would keep
     firing on the app itself.

     navigator.webdriver is true in Playwright and telemetry.js disables
     itself under automation (the "opens no socket" precedent in
     tests/telemetry.test.mjs). Turning it off here is what lets this test
     see whether the opt-out reason ALSO fires — with webdriver still true,
     every telemetryStatus() reads "automation" first and this file could
     not tell the two cases apart. */
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Refuse the track-events POST so a real leak from the app boot lands
  // here rather than as a silent success.
  const trackHits = [];
  await page.route('**/functions/v1/track-events**', (route) => {
    trackHits.push(route.request().url());
    return route.fulfill({ status: 200, body: '{}' });
  });

  await page.goto('/cookies.html');
  await page.locator('#optout-btn').click();
  await expect(page.locator('#optout-status')).toContainText('off');

  await page.goto('/index.html');
  const status = await page.evaluate(() => window.telemetryStatus());
  expect(status).toBe('off: opted out on this device');

  /* Fire something that WOULD track. router.js calls
     track('screen_viewed', { screen:id }) inside go(); an opted-out
     telemetryEnabled() returns false and track() drops the event before it
     reaches the queue, so nothing gets flushed. The queue flushes on a 4s
     timer, so waiting past it makes a real leak detectable rather than
     assumed away. Without this call the test would pass whether or not
     optedOut() reads the flag, since a fresh landing page fires no track()
     of its own until the visitor moves. */
  await page.evaluate(() => window.go('space'));
  await page.waitForTimeout(4500);
  expect(trackHits, `track-events POST leaked while opted out: ${trackHits.join(', ')}`).toEqual([]);
});

test('a browser sending Global Privacy Control hides the toggle', async ({ page }) => {
  /* The page must not offer a toggle it cannot honor. GPC is a browser-level
     signal telemetry.js reads before the flag; a click that appeared to opt
     someone in over their browser's own opt-out would be dishonest. */
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
  });
  await page.goto('/cookies.html');

  const status = page.locator('#optout-status');
  const btn = page.locator('#optout-btn');
  await expect(status).toContainText('Global Privacy Control');
  await expect(status).toContainText('Usage counting is off.');
  await expect(btn).toBeHidden();
});
