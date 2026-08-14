import { test, expect } from 'playwright/test';

/* Two of the twelve wizard steps arrived with an answer already given.

   Effort came pre-ticked on "Weekend reset" and Products on "Use what I
   have", and both then appeared on the Review screen — the one headed
   "Here's what we heard" — as though the user had said them. The products
   one is the consequential half: it is the answer that empties productNeeds
   and pins the budget to $0, so a plan could arrive with no recommendations
   at all on the strength of an answer nobody gave. It is also the exact
   complaint that started this: "there are no products to buy even though I
   said I was open to buying".

   The default still applies — it is a sensible one and a twelfth gate would
   be worse. It just stops claiming to be the user's. */

async function openWizard(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Plan my space' }).first().click();
  await expect(page.locator('#screen-space')).toHaveClass(/active/);
}

const gotoStep = (page, id) => page.evaluate((s) => window.go(s), id);

test('no step arrives with an answer already ticked', async ({ page }) => {
  await openWizard(page);
  for (const [step, sel] of [['effort', '#effort-cards .wz-effort'], ['shopping', '#shopping-cards .wz-shop']]) {
    await gotoStep(page, step);
    await expect(page.locator(sel).first()).toBeVisible();
    const ticked = await page.locator(`${sel}.sel`).count();
    expect(ticked, `${step} pre-selected an answer the user has not given`).toBe(0);
    const pressed = await page.locator(`${sel}[aria-pressed="true"]`).count();
    expect(pressed, `${step} tells a screen reader an answer is chosen`).toBe(0);
  }
});

test('choosing still ticks, and stays ticked on the way back', async ({ page }) => {
  await openWizard(page);
  await gotoStep(page, 'shopping');
  await page.locator('#shopping-cards .wz-shop', { hasText: 'Open to a few ideas' }).click();
  await expect(page.locator('#shopping-cards .wz-shop.sel')).toHaveCount(1);
  await gotoStep(page, 'effort');
  await gotoStep(page, 'shopping');
  await expect(page.locator('#shopping-cards .wz-shop.sel')).toContainText('Open to a few ideas');
});

test('Review says which answers are ours and which are theirs', async ({ page }) => {
  await openWizard(page);
  await gotoStep(page, 'review');
  const row = (label) => page.locator('.wz-rev-row', { hasText: label }).first();

  await expect(row('PRODUCTS')).toContainText('our default');
  await expect(row('EFFORT')).toContainText('our default');

  // and once answered, it is theirs and says nothing about defaults
  await gotoStep(page, 'shopping');
  await page.locator('#shopping-cards .wz-shop', { hasText: 'Open to a few ideas' }).click();
  await gotoStep(page, 'review');
  await expect(row('PRODUCTS')).toContainText('Open to a few ideas');
  await expect(row('PRODUCTS')).not.toContainText('our default');
});

test('an empty answer reads the same way everywhere on Review', async ({ page }) => {
  /* Style rendered "—" while Contents and What-bugs-you rendered "Nothing
     selected yet" for the identical state. */
  await openWizard(page);
  await gotoStep(page, 'review');
  const rows = await page.$$eval('.wz-rev-row', (els) => els.map((e) => ({
    label: e.querySelector('.wr-label').textContent.trim(),
    value: e.querySelector('.wr-value').textContent.trim(),
  })));
  const dashes = rows.filter((r) => r.value === '—' || r.value === '');
  expect(dashes.map((r) => r.label), 'a row says nothing at all instead of saying nothing is chosen').toEqual([]);
});

test('Start over clears the answers AND the record of who gave them', async ({ page }) => {
  /* restart() reset state.effort and state.shoppingPref but not the flags that
     say whether the user chose them, so after Start over the two defaults were
     pre-ticked again and Review went back to claiming them — the whole bug,
     reinstated by the button meant to clear everything. */
  await openWizard(page);
  await gotoStep(page, 'shopping');
  await page.locator('#shopping-cards .wz-shop', { hasText: 'Open to a few ideas' }).click();
  await expect(page.locator('#shopping-cards .wz-shop.sel')).toHaveCount(1);

  // restart() asks first, and Playwright dismisses dialogs by default —
  // without this the click does nothing and the test passes on a no-op
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => window.restart());
  await page.waitForTimeout(400);
  await page.evaluate(() => window.go('shopping'));
  await expect(page.locator('#shopping-cards .wz-shop').first()).toBeVisible();
  expect(await page.locator('#shopping-cards .wz-shop.sel').count(),
    'Start over left an answer ticked').toBe(0);
  await gotoStep(page, 'review');
  await expect(page.locator('.wz-rev-row', { hasText: 'PRODUCTS' }).first()).toContainText('our default');
});

test('a saved space comes back with the answers it was saved with', async ({ page }) => {
  /* The signed-in snapshot carried effort but never shoppingPref, so reopening
     a space handed back "Use what I have" — the answer that empties the
     product list — whatever the user had chosen. And the two touched flags
     went the same way, so a reopened space labelled the user's own answers
     "(our default)".

     Driven as a real round trip through both halves of the contract, because
     the bug was that one half wrote what the other half never read. */
  await page.goto('/index.html');
  const back = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const { rowFromState, applyLoadedSpace } = await import('/js/db.js');

    state.shoppingPref = 'Open to a few ideas';
    state.shoppingTouched = true;
    state.effort = 'Full overhaul';
    state.effortTouched = true;
    const row = JSON.parse(JSON.stringify(rowFromState('test space')));

    // whatever was in memory must not be what we read back
    state.shoppingPref = 'Use what I have';
    state.shoppingTouched = false;
    state.effort = 'Weekend reset';
    state.effortTouched = false;

    applyLoadedSpace({ data: { ...row, id: 'x' }, beforePhotoUrl: null, afterRenderUrl: null });
    return {
      pref: state.shoppingPref, effort: state.effort,
      shoppingTouched: state.shoppingTouched, effortTouched: state.effortTouched,
    };
  });
  expect(back.pref, 'a reopened space lost the shopping answer').toBe('Open to a few ideas');
  expect(back.effort).toBe('Full overhaul');
  expect(back.shoppingTouched, 'a reopened space calls the user\'s answer our default').toBe(true);
  expect(back.effortTouched).toBe(true);
});

test('the Edit links are big enough to hit on a phone', async ({ page, browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto('/index.html');
  await p.getByRole('button', { name: 'Plan my space' }).first().click();
  await p.evaluate(() => window.go('review'));
  await expect(p.locator('.wr-edit').first()).toBeVisible();
  const small = await p.$$eval('.wr-edit', (els) => els
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.height < 30)
    .map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`));
  expect(small, 'Edit targets under 30px tall').toEqual([]);
  await ctx.close();
});
