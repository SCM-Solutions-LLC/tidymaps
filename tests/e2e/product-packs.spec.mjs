import { test, expect } from 'playwright/test';

/* A set of 2 bins answers a need for 2 bins with one purchase. The card, the
   summary list under the total and the Cost tile priced it per bin instead:
   picking mDesign's 2 pack for the sample pantry's 2 bins showed $50 and
   "2 × mDesign … 2 Pack", which is 4 bins. */

const SET = 'mdesign-open-front-bin-xl-2pk'; // "pack": 2 in data/catalog.json

test('a 2 pack for 2 bins costs one pack on the card, the list and the total', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  await expect(page.locator('#res-upgrades .prod').first()).toBeVisible({ timeout: 15_000 });
  const index = await page.evaluate(async () => {
    const { activeProductNeeds } = await import('/js/plan.js');
    return activeProductNeeds().findIndex((n) => n.type === 'clear-bin' && n.qty === 2);
  });
  expect(index, 'the sample pantry no longer asks for 2 clear bins').toBeGreaterThanOrEqual(0);
  const row = page.locator('#res-upgrades .prod').nth(index);
  const summary = page.locator('#res-shopping li').nth(index);
  const totalBefore = Number((await page.locator('#res-shop-total').textContent()).replace(/[^0-9]/g, ''));

  // The default pick is a single bin, priced per bin as before.
  await expect(row.locator('.ppack')).toHaveCount(0);
  const singleCost = Number((await row.locator('.cost').textContent()).replace(/[^0-9]/g, ''));
  await expect(summary).toContainText(/^2 × /);

  await row.locator('details.pmore summary').click();
  const option = row.locator(`select option[value="${SET}"]`);
  await expect(option).toContainText('$24.99 for 2');
  await row.locator('select').selectOption(SET);

  await expect(row.locator('.cost')).toHaveText('$25');
  await expect(row.locator('.ppack')).toHaveText('1 pack of 2');
  await expect(summary).toContainText('mDesign');
  await expect(summary).not.toContainText(/^\d+ × /);
  await expect(summary.locator('.qcost')).toHaveText('$25');
  // Each figure is rounded on its own, so the total can land a dollar off their sum.
  const totalAfter = Number((await page.locator('#res-shop-total').textContent()).replace(/[^0-9]/g, ''));
  expect(Math.abs(totalAfter - (totalBefore - singleCost + 25)), `total went ${totalBefore} to ${totalAfter}`).toBeLessThanOrEqual(1);
  // The Cost tile reads the same ticked products.
  await expect(page.locator('#kpi-cost')).toHaveText(`$0 / $${totalAfter}`);
  expect(errors).toEqual([]);
});
