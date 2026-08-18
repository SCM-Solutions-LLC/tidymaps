import { test, expect } from 'playwright/test';
import { expandChapters } from './helpers.mjs';

/* The feedback ask on the report.

   The funnel said the dedicated feedback screen was unreachable: fifteen views
   of the results screen against zero of the three screens that follow it. So
   the question is asked under the plan instead. This walks it in the real UI —
   the ask appears, answering unfolds the rest without navigating away, sending
   collapses it, and the screen that used to own the question does not ask it
   again. That last one is the part that broke first: buildFeedback() ran once
   at startup, so it read fbSent long before there was anything to read. */

/* Every send in this file used to go to the real project. Nothing intercepted
   submit-form, so CI wrote rows into production feedback on every run — and
   the suite could not see it, because a failed write was swallowed and the
   thank-you appeared either way. Both halves of that are fixed: the write is
   answered here, and the tests below assert what happens when it fails. */
async function stubSubmitForm(page, { status = 200, body = { ok: true } } = {}) {
  const seen = [];
  await page.route('**/functions/v1/submit-form', async (route) => {
    seen.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });
  });
  return seen;
}

async function toSamplePlan(page, stub = {}) {
  const seen = await stubSubmitForm(page, stub);
  await page.goto('/');
  await page.click('text=View a sample plan');
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#res-rate')).toBeVisible();
  return seen;
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
  await expandChapters(page);   // the purchases chapter starts folded
  await page.locator('#res-shopping').scrollIntoViewIfNeeded();
  const download = page.waitForEvent('download');
  await page.click('text=Download list');
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/shopping-list\.txt$/);
});

/* The thank-you is a claim about a row in a table. When the write fails, the
   card used to collapse to "Thanks — that's genuinely useful" anyway, and the
   answers went with it: the ask was replaced by a thank-you for the rest of
   the session, so there was no way to send them even after the network came
   back. The person is told, and everything they picked is still on screen. */
test('a feedback write that fails says so, and keeps the answers', async ({ page }) => {
  await toSamplePlan(page, { status: 500, body: { error: 'internal' } });

  await page.click('#rate-opts .opt >> text=I would pay for this');
  await page.click('#rate-vs .opt >> text=I want both');
  await page.fill('#rate-text', 'The zone map is the useful part.');
  await page.click('#res-rate >> text=Send feedback');

  await expect(page.locator('#toast')).toContainText('did not reach us');
  await expect(page.locator('#rate-thanks')).toBeHidden();
  await expect(page.locator('#rate-ask')).toBeVisible();
  // The answers are still selected, so trying again is one tap and not five.
  await expect(page.locator('#rate-opts .opt.sel')).toHaveText(/I would pay for this/);
  await expect(page.locator('#rate-vs .opt.sel')).toHaveText(/I want both/);

  // And the feedback screen must not show it as already answered either.
  await page.evaluate(() => window.go('feedback'));
  await expect(page.locator('#fb-form')).toBeVisible();
  await expect(page.locator('#fb-sent')).toBeHidden();
});

test('a retry after a failure sends the same answers and lands', async ({ page }) => {
  let failNext = true;
  await page.route('**/functions/v1/submit-form', async (route) => {
    const bad = failNext;
    failNext = false;
    await route.fulfill({
      status: bad ? 500 : 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(bad ? { error: 'internal' } : { ok: true }),
    });
  });
  await page.goto('/');
  await page.click('text=View a sample plan');
  await expect(page.locator('#res-rate')).toBeVisible({ timeout: 20000 });

  await page.click('#rate-opts .opt >> text=Very useful');
  await page.click('#res-rate >> text=Send feedback');
  await expect(page.locator('#rate-ask')).toBeVisible();

  await page.click('#res-rate >> text=Send feedback');
  await expect(page.locator('#rate-thanks')).toBeVisible();
});

/* The signup wrote the address to localStorage BEFORE sending it and confirmed
   unconditionally, so a failed request left a local record that showed
   "Thanks. We'll write to you" on every later visit — for a list the address
   was never added to. */
test('a signup that fails does not claim the address is on the list', async ({ page }) => {
  await stubSubmitForm(page, { status: 500, body: { error: 'internal' } });
  await page.goto('/');
  await page.fill('#signup-email', 'nobody@example.com');
  await page.click('#signup-form .btn');

  await expect(page.locator('#toast')).toContainText('did not reach us');
  await expect(page.locator('#signup-done')).toBeHidden();
  await expect(page.locator('#signup-form')).toBeVisible();

  const saved = await page.evaluate(() => localStorage.getItem('tidymap_invite_email'));
  expect(saved, 'a failed signup was remembered as a successful one').toBeNull();

  // A reload is where that local record used to speak: it must stay quiet.
  await page.reload();
  await expect(page.locator('#signup-done')).toBeHidden();
});

test('a signup the server confirms is remembered', async ({ page }) => {
  const seen = await stubSubmitForm(page);
  await page.goto('/');
  await page.fill('#signup-email', 'someone@example.com');
  await page.click('#signup-form .btn');

  await expect(page.locator('#signup-done')).toBeVisible();
  await expect(page.locator('#signup-done')).toContainText('someone@example.com');
  expect(seen).toEqual([{ kind: 'invite', email: 'someone@example.com' }]);

  await page.reload();
  await expect(page.locator('#signup-done')).toBeVisible();
});
