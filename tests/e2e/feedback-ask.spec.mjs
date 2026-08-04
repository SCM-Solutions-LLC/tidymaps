import { test, expect } from 'playwright/test';

/* The feedback ask on the report.

   The funnel said the dedicated feedback screen was unreachable: fifteen views
   of the results screen against zero of the three screens that follow it. So
   the question is asked under the plan instead. This walks it in the real UI —
   the ask appears, answering unfolds the rest without navigating away, sending
   collapses it, and the screen that used to own the question does not ask it
   again. That last one is the part that broke first: buildFeedback() ran once
   at startup, so it read fbSent long before there was anything to read. */

async function toSamplePlan(page) {
  await page.goto('/');
  await page.click('text=View a sample plan');
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#res-rate')).toBeVisible();
}

test('the report asks, unfolds, and sends without leaving the plan', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toSamplePlan(page);

  // The follow-up questions stay out of the way until there is an answer.
  await expect(page.locator('#rate-more')).toBeHidden();
  await page.click('#rate-opts .opt >> text=I would pay for this');
  await expect(page.locator('#rate-more')).toBeVisible();
  // Answering must not navigate: the whole point is asking where the value is.
  await expect(page.locator('#screen-results')).toBeVisible();

  await page.click('#rate-vs .opt >> text=I want both');
  await page.click('#rate-next .chip >> text=Garage');
  await page.fill('#rate-text', 'The zone map is the useful part.');
  await page.click('#res-rate >> text=Send feedback');

  await expect(page.locator('#rate-thanks')).toBeVisible();
  await expect(page.locator('#rate-ask')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the feedback screen does not ask a question already answered', async ({ page }) => {
  await toSamplePlan(page);
  await page.click('#rate-opts .opt >> text=Very useful');
  await page.click('#res-rate >> text=Send feedback');
  await expect(page.locator('#rate-thanks')).toBeVisible();

  await page.evaluate(() => window.go('feedback'));
  await expect(page.locator('#fb-sent')).toBeVisible();
  await expect(page.locator('#fb-form')).toBeHidden();
});

test('an unanswered report still leaves the full feedback screen working', async ({ page }) => {
  await toSamplePlan(page);
  await page.evaluate(() => window.go('feedback'));
  await expect(page.locator('#fb-form')).toBeVisible();
  await expect(page.locator('#fb-sent')).toBeHidden();
  // The options render on entry rather than only at startup.
  await expect(page.locator('#fb-useful .opt')).toHaveCount(4);
});

/* Two buttons on the report's shopping card toasted "Shopping list saved" and
   "List sent" without doing either — the same defect PR #46 removed from the
   save screen, one screen earlier. */
test('the shopping card downloads a real list instead of claiming it saved one', async ({ page }) => {
  await toSamplePlan(page);
  await page.locator('#res-shopping').scrollIntoViewIfNeeded();
  const download = page.waitForEvent('download');
  await page.click('text=Download list');
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/shopping-list\.txt$/);
});
