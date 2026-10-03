import { test, expect } from 'playwright/test';

/* A saved plan stores the product it picked. The owner picked a turntable
   from a real plan and found Amazon listing it as unavailable; the catalog
   now marks it so, and a plan that still points at it has to say "no longer
   sold" and ask for another pick, everywhere the product used to be named:
   the card, the summary list under the total, and the exported list. */

const GONE = 'copco-basics-lazy-susan-9in'; // available:false in data/catalog.json
const GONE_NAME = 'Copco Basics 9in Lazy Susan';

/* The sample pantry asks for a turntable; the saved selection for that need
   points at the retired one, the way a plan saved in September does. */
async function openPlanPointingAtGoneProduct(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  await expect(page.locator('#res-upgrades .prod').first()).toBeVisible({ timeout: 15_000 });
  const index = await page.evaluate(async ([id, name]) => {
    const [{ state }, { buildResults }, { activeProductNeeds }] = await Promise.all([
      import('/js/state.js'), import('/js/screens/results.js'), import('/js/plan.js'),
    ]);
    state.upgrades = true;
    const i = activeProductNeeds().findIndex(n => n.type === 'turntable');
    state.shopping[i] = {
      ...state.shopping[i], checked: true, productId: id, name, price_usd: 9.99,
      url: 'https://www.amazon.com/dp/B088N867YS', retailer: 'Amazon', fit: 'fits', dims_in: { w: 9, h: 1.4, d: 9 },
    };
    buildResults();
    return i;
  }, [GONE, GONE_NAME]);
  expect(index).toBeGreaterThanOrEqual(0);
  await expect(page.locator('#res-upgrades .prod').first()).toBeVisible({ timeout: 15_000 });
  return { row: page.locator('#res-upgrades .prod').nth(index), index };
}

test('a product that is no longer sold is named as gone, not linked, and gets a picker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { row, index } = await openPlanPointingAtGoneProduct(page);
  await expect(row.locator('h3')).toContainText('Turntable');

  await expect(row.locator('.punavailable')).toHaveText(`No longer sold: ${GONE_NAME}. Pick another below.`);
  await expect(row.locator('.pname')).toHaveCount(0);
  await expect(row.locator('select option[value=""]')).toHaveText('Choose one');
  await expect(row.locator('.cost')).toHaveText('–');
  // The picker is now the row's one action, so it is a full tap target.
  const box = await row.locator('select').boundingBox();
  expect(box.height, 'the picker is under 44px').toBeGreaterThanOrEqual(44);

  // The other two places that name the pick agree with the card.
  const summary = page.locator('#res-shopping li').nth(index);
  await expect(summary).toContainText('Turntable (no product yet)');
  await expect(page.locator('#res-shopping')).not.toContainText(GONE_NAME);
  const exported = await page.evaluate(async () => (await import('/js/planExport.js')).shoppingListText());
  expect(exported).not.toContain(GONE_NAME);
  expect(exported).toContain('no product picked yet');

  // Picking a replacement clears every trace, and focus lands on the new pick.
  await row.locator('select').selectOption({ index: 1 });
  await expect(row.locator('.punavailable')).toHaveCount(0);
  await expect(row.locator('.pname')).toHaveCount(1);
  await expect(row.locator('.pname')).toBeFocused();
  await expect(row.locator('.cost')).not.toHaveText('–');
  await expect(page.locator('#res-shopping')).not.toContainText('(no product yet)');
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

  // A fresh plan: state.shopping is still null.
  await page.evaluate(() => window.uncheckAllUpgrades());
  await expect(page.locator('#res-upgrades .load-failed')).toBeVisible();
  await expect(page.locator('#res-upgrades .prod')).toHaveCount(0);
  await expect(page.locator('#res-shop-total')).toHaveText('$0');

  // A saved plan: state.shopping is whatever the database held, never
  // re-read from the catalog, so its link and price are unconfirmed.
  await page.evaluate(async ([id, name]) => {
    const { state } = await import('/js/state.js');
    state.shopping = [{ needIdx: 0, checked: true, qty: 1, type: 'clear-bin', productId: id, name, price_usd: 9.99, url: 'https://www.amazon.com/dp/B088N867YS', retailer: 'Amazon', fit: 'fits', dims_in: { w: 9, h: 1.4, d: 9 } }];
    window.uncheckAllUpgrades();
  }, [GONE, GONE_NAME]);
  await expect(page.locator('#res-upgrades .load-failed')).toBeVisible();
  await expect(page.locator('#res-upgrades .prod')).toHaveCount(0);
  await expect(page.locator('#res-upgrades')).not.toContainText(GONE_NAME);
  expect(errors).toEqual([]);
});

/* Clicked while the catalog is still on its way, the same button used to
   read state.shopping[i] off null. There is nothing to remove yet: the
   skeleton stays and the rows arrive when the load lands. */
test('removing all upgrades before the catalog has loaded neither throws nor claims a failure', async ({ page }) => {
  await page.route('**/data/catalog.json', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  await expect(page.locator('#res-upgrades .sk-list')).toBeVisible();

  await page.evaluate(() => window.uncheckAllUpgrades());
  await expect(page.locator('#res-upgrades .sk-list')).toBeVisible();
  await expect(page.locator('#res-upgrades .load-failed')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('once the product list loads');
  // The tap is honoured when the rows land: none of them arrives ticked.
  await expect(page.locator('#res-upgrades .prod').first()).toBeVisible({ timeout: 15_000 });
  const rows = await page.locator('#res-upgrades .prod').count();
  await expect(page.locator('#res-upgrades .prod.excluded')).toHaveCount(rows);
  await expect(page.locator('#res-shop-total')).toHaveText('$0');
  expect(errors).toEqual([]);
});
