import { test, expect } from 'playwright/test';

/* Recruiting posts go out with ?ref=<where> on the link, and screen_viewed
   carries that tag so the funnel can be read per channel. The router only
   ever rewrites the fragment, so the tag has to survive the first step AND
   every pushed step after it; a regression that dropped the query on the
   first pushState would still tag the opening screen and nothing else. */

async function screenViews(page) {
  const views = [];
  /* Telemetry is off under automation on purpose (js/telemetry.js checks
     navigator.webdriver). Opted back in for this page only, with the endpoint
     stubbed, so nothing leaves the browser. */
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
  });
  await page.route('**/functions/v1/track-events', async (route) => {
    try {
      const body = JSON.parse(route.request().postData() || '{}');
      for (const ev of body.events || []) if (ev.name === 'screen_viewed') views.push(ev.props);
    } catch (_) { /* a batch we cannot read is not a screen view */ }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}',
    });
  });
  return views;
}

async function flushTelemetry(page) {
  await page.evaluate(async () => {
    const t = await import('/js/telemetry.js');
    t.flush();
  });
  await page.waitForTimeout(300);
}

async function firstTwoSteps(page, path) {
  await page.goto(path);
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#space-cards .room-card', { hasText: 'Pantry' }).first().click();
  await page.locator('#flow-next').click();
  await expect(page.locator('#screen-setup')).toBeVisible();
  await flushTelemetry(page);
}

test('a tagged link tags every step, past the first pushed one', async ({ page }) => {
  const views = await screenViews(page);
  await firstTwoSteps(page, '/?ref=Reddit-Organization');
  expect(views.map((v) => v.screen)).toEqual(['space', 'setup']);
  for (const v of views) expect(v.ref, `screen ${v.screen}`).toBe('reddit-organization');
});

test('an untagged visit and a tag that is not a slug send no ref at all', async ({ page }) => {
  const views = await screenViews(page);
  await firstTwoSteps(page, '/');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
  await firstTwoSteps(page, '/?ref=me%40example.com');
  expect(views.length).toBeGreaterThanOrEqual(4);
  for (const v of views) expect(v, `screen ${v.screen}`).not.toHaveProperty('ref');
});
