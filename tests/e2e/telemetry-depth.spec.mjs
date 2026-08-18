import { test, expect } from 'playwright/test';

/* `step_checked` carries `checkedCount`, which this app calls its core
   engagement-depth signal — "did they actually work the plan" — and the
   handoff reads it per anon_id to decide what to build next.

   Every RESTORE of a checklist was counted as fresh engagement. Restoring is
   not a second tap: it is the same checklist arriving back on screen, and it
   happens on a reload with a guest draft, on opening a saved plan, on a
   ?space= deep link, and on each Adjust option a user clicks. All of them go
   through applySavedProgress, which ticked each completed step back on
   through the same handler a tap uses. */

async function countedSteps(page) {
  const events = [];
  /* Telemetry is off under automation on purpose — js/telemetry.js checks
     navigator.webdriver so a CI run never lands in the product analytics.
     That guard is also the reason no test could see a telemetry bug until
     now, and this is a telemetry bug. Opted back in for this page only, with
     the endpoint stubbed below, so nothing leaves the browser either way. */
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
  });
  await page.route('**/functions/v1/track-events', async (route) => {
    try {
      const body = JSON.parse(route.request().postData() || '{}');
      for (const ev of body.events || []) if (ev.name === 'step_checked') events.push(ev.props);
    } catch (_) { /* a batch we cannot read is not a step_checked */ }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}',
    });
  });
  return events;
}

/* The queue debounces for 4s and also flushes on batch size, so waiting is
   both slow and racy. Draining it is what the page does on hide anyway. */
async function flushTelemetry(page) {
  await page.evaluate(async () => {
    const t = await import('/js/telemetry.js');
    t.flush();
  });
  await page.waitForTimeout(300);
}

async function samplePlanWithTwoStepsDone(page, counted) {
  await page.goto('/');
  await page.click('text=View a sample plan');
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  await page.locator('#res-steps .task .check').nth(0).click();
  await page.locator('#res-steps .task .check').nth(1).click();
  await flushTelemetry(page);
  expect(counted.length, 'two taps should be two events').toBe(2);
}

test('a reload that restores the checklist does not re-count it', async ({ page }) => {
  const counted = await countedSteps(page);
  await samplePlanWithTwoStepsDone(page, counted);

  // The guest draft carries the plan and its progress; startup restores both.
  await page.reload();
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#res-steps .task.done')).toHaveCount(2, { timeout: 10000 });
  await flushTelemetry(page);

  expect(counted.length, `the restore counted ${counted.length - 2} steps nobody ticked`).toBe(2);
});

test('an Adjust option does not re-count the steps already done', async ({ page }) => {
  const counted = await countedSteps(page);
  await samplePlanWithTwoStepsDone(page, counted);

  /* Applying an adjustment re-renders the steps and restores the checklist
     over the top — up to twice per click, since the shopping branch restores
     it and so does the tail of applyAdjustment. */
  await page.evaluate(() => window.go('customize'));
  await expect(page.locator('#screen-customize')).toHaveClass(/active/);
  await page.locator('#customize-opts .opt').first().click();
  await page.waitForTimeout(600);
  await flushTelemetry(page);

  expect(counted.length, `the adjustment counted ${counted.length - 2} steps nobody ticked`).toBe(2);

  // ...and the checklist really did come back, so this is not passing because
  // the progress was quietly dropped instead.
  await page.evaluate(() => window.go('results'));
  await expect(page.locator('#res-steps .task.done')).toHaveCount(2);
});
