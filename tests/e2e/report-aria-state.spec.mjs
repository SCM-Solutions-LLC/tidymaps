import { test, expect } from 'playwright/test';
import { expandChapters } from './helpers.mjs';

/* Two things axe cannot see on the report, both from the 2026-09-14 review.
   The rating buttons (the inline ask under the plan, and the feedback screen
   that repeats it) were marked chosen by a class alone, so a screen reader
   heard four plain buttons and no answer. And the items on each shelf sat in
   a div with an aria-label and no role, which is a name nothing reads: a
   label needs a role to attach to. */

async function toSamplePlan(page) {
  await page.route('**/functions/v1/submit-form', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}',
  }));
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await expandChapters(page);
}

const pressed = (page, sel) => page.$$eval(sel, (els) => els.map((el) => el.getAttribute('aria-pressed')));

test('the rating buttons on the report say which one is chosen', async ({ page }) => {
  await toSamplePlan(page);
  const opts = '#rate-opts .opt';
  expect(await pressed(page, opts)).toEqual(['false', 'false', 'false', 'false']);
  await page.click(`${opts} >> text=Very useful`);
  expect(await pressed(page, opts)).toEqual(['false', 'false', 'true', 'false']);
  await page.click(`${opts} >> text=Not useful`);
  expect(await pressed(page, opts)).toEqual(['true', 'false', 'false', 'false']);
  // The follow-ups that unfold carry the same state, chips included.
  await page.click('#rate-next .chip >> text=Garage');
  const chips = await page.$$eval('#rate-next .chip', (els) => els.filter((el) => el.getAttribute('aria-pressed') === 'true').map((el) => el.textContent));
  expect(chips).toEqual(['Garage']);
  // Each group is named by its question.
  for (const id of ['rate-opts', 'rate-vs', 'rate-next']) {
    const group = page.locator(`#${id}`);
    await expect(group).toHaveAttribute('role', 'group');
    const by = await group.getAttribute('aria-labelledby');
    await expect(page.locator(`#${by}`)).toHaveText(/\?$/);
  }
});

test('the feedback screen repeats the state, and an answer given on the report is shown as pressed there', async ({ page }) => {
  await toSamplePlan(page);
  await page.click('#rate-opts .opt >> text=Somewhat useful');
  await page.evaluate(() => window.go('feedback'));
  await expect(page.locator('#screen-feedback')).toHaveClass(/active/);
  expect(await pressed(page, '#fb-useful .opt')).toEqual(['false', 'true', 'false', 'false']);
  for (const id of ['fb-useful', 'fb-vs', 'fb-next']) {
    await expect(page.locator(`#${id}`)).toHaveAttribute('role', 'group');
  }
});

test("each shelf's items are a named list", async ({ page }) => {
  await toSamplePlan(page);
  const lists = page.locator('#res-map .map-items');
  expect(await lists.count()).toBeGreaterThan(0);
  const shape = await lists.evaluateAll((els) => els.map((el) => ({
    role: el.getAttribute('role'), label: el.getAttribute('aria-label'),
    items: [...el.children].map((c) => c.getAttribute('role')),
  })));
  for (const s of shape) {
    expect(s.role).toBe('list');
    expect(s.label).toBe('Items in this zone');
    expect(s.items.length).toBeGreaterThan(0);
    expect(s.items.every((r) => r === 'listitem')).toBe(true);
  }
});
