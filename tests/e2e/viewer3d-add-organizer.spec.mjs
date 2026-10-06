import { test, expect } from 'playwright/test';
import { expandChapters, openViewer } from './helpers.mjs';

/* Adding an organizer in the 3D view is a PURCHASE, not a sketch: it goes on
   the shopping list and into the cost.

   Which makes attribution the thing to get right. Everything else in that list
   is what the model recommended from the photos; an item the user asked for
   must not wear the same badge, or the plan is taking credit for their idea and
   they have no way to tell the two apart when they come back to it. */

async function openPlan(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

/* The add control is a change to the plan, so it lives under the Adjust tab
   with the other changes; the sample is already open, so the viewer alone. */
async function openAdd(page) {
  await openViewer(page, { sample: false, adjust: true });
}

const costText = (page) => page.locator('#kpi-cost').textContent();

test('adding an organizer puts it on the list and in the cost', async ({ page }) => {
  await openPlan(page);
  const before = await costText(page);
  const beforeCount = await page.locator('#res-upgrades .prod').count();

  await openAdd(page);
  const add = page.locator('#v3d-add-organizer');
  await expect(add).toBeVisible();
  await page.selectOption('#v3d-add-type', 'turntable');
  await page.selectOption('#v3d-add-level', { index: 0 });
  await page.locator('#v3d-add-btn').click();
  await page.waitForTimeout(600);

  await page.evaluate(() => window.go('results'));
  await expandChapters(page);

  const afterCount = await page.locator('#res-upgrades .prod').count();
  expect(afterCount, 'the added organizer did not reach the shopping list').toBe(beforeCount + 1);

  const after = await costText(page);
  expect(after, `cost did not move: ${before} -> ${after}`).not.toBe(before);
});

test('an item the user added is not labelled as recommended', async ({ page }) => {
  await openPlan(page);
  await openAdd(page);
  await page.selectOption('#v3d-add-type', 'basket');
  await page.locator('#v3d-add-btn').click();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.go('results'));
  await expandChapters(page);

  const card = page.locator('#res-upgrades .prod', { hasText: 'Basket' }).last();
  await expect(card).toContainText('you added this');
  expect(await card.textContent()).not.toMatch(/recommended/i);
});

test('the added need survives a re-normalize of the plan', async ({ page }) => {
  /* A saved plan is run back through normalizeAi when it loads, and that
     function is a whitelist — a field it does not name is dropped. `observed`
     and `cite` were both lost that way before. */
  await openPlan(page);
  await openAdd(page);
  await page.selectOption('#v3d-add-type', 'clear-bin');
  await page.locator('#v3d-add-btn').click();
  await page.waitForTimeout(600);

  const survives = await page.evaluate(async () => {
    const { normalizeAi } = await import('/js/plan.js');
    const { state } = await import('/js/state.js');
    const again = normalizeAi(state.ai);
    return (again.productNeeds || []).some(n => n.addedByUser === true);
  });
  expect(survives, 'addedByUser was dropped when the plan was re-normalized').toBe(true);
});

test('a "use what I have" plan offers no way to add a purchase', async ({ page }) => {
  /* Same gate as the organizer panel above it. Someone who asked to use only
     what they own should not be handed a shortcut to a shopping list. */
  await openPlan(page);
  await page.evaluate(() => { window.setUpgrades(false); });
  await openAdd(page);
  await expect(page.locator('#v3d-add-organizer')).toBeHidden();
});
