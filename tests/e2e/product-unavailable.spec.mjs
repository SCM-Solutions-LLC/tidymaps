import { test, expect } from 'playwright/test';

/* A saved plan stores the product it picked. The owner picked a turntable
   from a real plan and found Amazon listing it as unavailable; the catalog
   now marks it so, and a plan that still points at it has to say "no longer
   sold" and ask for another pick, everywhere the product used to be named:
   the card, the summary list under the total, and the exported list. */

const GONE = 'copco-basics-lazy-susan-9in'; // available:false in data/catalog.json
const GONE_NAME = 'Copco Basics 9in Lazy Susan';

async function openPlanPointingAtGoneProduct(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  await expect(page.locator('#res-upgrades .prod').first()).toBeVisible({ timeout: 15_000 });
  await page.evaluate(async ([id, name]) => {
    const [{ state }, { buildResults }] = await Promise.all([import('/js/state.js'), import('/js/screens/results.js')]);
    state.upgrades = true;
    // What spaces.shopping holds for a plan saved before the product went.
    state.shopping[0] = {
      ...state.shopping[0], checked: true, productId: id, name, price_usd: 9.99,
      url: 'https://www.amazon.com/dp/B088N867YS', retailer: 'Amazon', fit: 'fits', dims_in: { w: 9, h: 1.4, d: 9 },
    };
    buildResults();
  }, [GONE, GONE_NAME]);
  await expect(page.locator('#res-upgrades .prod').first()).toBeVisible({ timeout: 15_000 });
  return page.locator('#res-upgrades .prod').first();
}

test('a product that is no longer sold is named as gone, not linked, and gets a picker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const row = await openPlanPointingAtGoneProduct(page);

  await expect(row.locator('.punavailable')).toHaveText(`No longer sold: ${GONE_NAME}. Pick another below.`);
  await expect(row.locator('.pname')).toHaveCount(0);
  await expect(row.locator('select option[value=""]')).toHaveText('Choose one');
  await expect(row.locator('.cost')).toHaveText('–');
  // The picker is now the row's one action, so it is a full tap target.
  const box = await row.locator('select').boundingBox();
  expect(box.height, 'the picker is under 44px').toBeGreaterThanOrEqual(44);

  // The other two places that name the pick agree with the card.
  await expect(page.locator('#res-shopping li').first()).toContainText('(pick a product)');
  await expect(page.locator('#res-shopping li').first()).not.toContainText(GONE_NAME);
  const exported = await page.evaluate(async () => (await import('/js/planExport.js')).shoppingListText());
  expect(exported).not.toContain(GONE_NAME);
  expect(exported).toContain('no product picked yet');

  // Picking a replacement clears every trace, and focus lands on the new pick.
  await row.locator('select').selectOption({ index: 1 });
  await expect(row.locator('.punavailable')).toHaveCount(0);
  await expect(row.locator('.pname')).toHaveCount(1);
  await expect(row.locator('.pname')).toBeFocused();
  await expect(row.locator('.cost')).not.toHaveText('–');
  await expect(page.locator('#res-shopping li').first()).not.toContainText('(pick a product)');
});

/* "Remove all upgrades" sits outside the product list and stays clickable
   when the catalog never loaded. It used to re-render the list from whatever
   state.shopping held: a TypeError on a fresh plan, or rows built from a saved
   selection the catalog never confirmed. */
test('when the catalog cannot load, removing all upgrades keeps the failed state', async ({ page }) => {
  await page.route('**/data/catalog.json', (route) => route.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  await expect(page.locator('#res-upgrades .load-failed')).toBeVisible();

  await page.evaluate(() => window.uncheckAllUpgrades());
  await expect(page.locator('#res-upgrades .load-failed')).toBeVisible();
  await expect(page.locator('#res-upgrades .prod')).toHaveCount(0);
  await expect(page.locator('#res-shop-total')).toHaveText('$0');
  expect(errors).toEqual([]);
});
