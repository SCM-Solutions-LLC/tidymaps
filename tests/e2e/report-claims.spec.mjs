import { test, expect } from 'playwright/test';
import { expandChapters } from './helpers.mjs';

/* The report is where the app makes claims. These are the ones it could not
   support: a Cost tile quoting a constant over a shopping list it disagreed
   with, a Skip button recording completed work, and a "Detected" heading over
   answers the user typed in themselves. */

async function openSamplePlan(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

const kpi = (page, name) => page.locator('.kpi', { hasText: name }).locator('.v');
const money = async (locator) => Number((await locator.textContent()).replace(/[^\d]/g, '') || 0);

test('the Cost tile agrees with the shopping list on the same screen', async ({ page }) => {
  /* It printed the scenario's own constant — "$0 / $45–85" — over six products
     the app had pre-selected and pre-ticked to $153, and adjusting the plan did
     not move it. */
  await openSamplePlan(page);
  await expandChapters(page);
  const total = page.locator('#res-shop-total');
  await expect(total).toBeVisible();

  const listed = await money(total);
  const quoted = await money(kpi(page, 'Cost'));
  expect(quoted, `Cost tile says ${quoted}, the list totals ${listed}`).toBe(listed);

  // and it tracks the list when products are unticked
  await page.evaluate(() => window.uncheckAllUpgrades());
  await expect(kpi(page, 'Cost')).toHaveText('$0');
  expect(await money(page.locator('#res-shop-total'))).toBe(0);
});

test('Skip sets a step aside instead of recording it as done', async ({ page }) => {
  await openSamplePlan(page);
  const first = page.locator('#res-steps .task').first();
  await first.getByRole('button', { name: 'Skip' }).click();

  await expect(first).toHaveClass(/skipped/);
  await expect(first).not.toHaveClass(/\bdone\b/);
  await expect(first.locator('.mark')).toHaveText('Mark complete');
  await expect(page.locator('#prog-text')).toContainText('Step 0 of');
  await expect(page.locator('#prog-text')).toContainText('set aside');
  await expect(page.locator('#prog-pct')).toHaveText('0%');

  // and it is reversible, because setting something aside is not a decision
  await first.getByRole('button', { name: 'Unskip' }).click();
  await expect(first).not.toHaveClass(/skipped/);
  await expect(page.locator('#prog-text')).not.toContainText('set aside');
});

test('a plan built from no photos does not call the answers a detection', async ({ page }) => {
  await openSamplePlan(page);
  await expect(page.locator('#res-cat-title')).toHaveText(/you told us about/i);
  await expect(kpi(page, 'Categories')).toContainText('listed');
  await expect(kpi(page, 'Categories')).not.toContainText('found');
});
