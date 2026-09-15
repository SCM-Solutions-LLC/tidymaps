import { test, expect } from 'playwright/test';
import { driveWizardToReview } from './helpers.mjs';

/* The rail under the running head reached 100% at Review, dropped to 75% on
   the loading screen and rose to 81% on the report: building the plan read as
   losing two steps. The width is set inline by the router on every screen
   change, so it is read back from the style rather than measured, and read
   the moment each screen becomes active. */

const railWidth = (page) => page.evaluate(() => document.getElementById('rail').style.width);

test('the rail stays full once the wizard is complete', async ({ page }) => {
  test.setTimeout(120_000);
  await driveWizardToReview(page);
  expect(await railWidth(page), 'Review').toBe('100%');

  await page.locator('#flow-next').click();   // Build my plan
  await expect(page.locator('#screen-loading')).toHaveClass(/active/);
  expect(await railWidth(page), 'loading').toBe('100%');

  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  expect(await railWidth(page), 'results').toBe('100%');
});

/* The same walk driveWizardToReview makes, with the rail read on every step. */
const STEPS = [
  ['space', (page) => page.locator('#space-cards .room-card', { hasText: 'Pantry' }).first().click()],
  ['setup', null],
  ['measure', async (page) => {
    await page.fill('#m-num-w', '3');
    await page.fill('#m-num-h', '6');
    await page.fill('#m-num-d', '1.33');
  }],
  ['capture', null],
  ['household', null],
  ['contents', null],
  ['goals', (page) => page.locator('#goal-list .wz-goal').first().click()],
  ['style', null],
  ['effort', null],
  ['shopping', null],
  ['review', null],
];

test('the rail advances one step at a time and never backs up', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
  await page.goto('/index.html');
  expect(await railWidth(page), 'landing').toBe('0%');
  await page.locator('#screen-landing .btn-primary').first().click();
  let last = 0;
  for (const [screen, answer] of STEPS) {
    await expect(page.locator(`#screen-${screen}`)).toHaveClass(/active/);
    const pct = parseInt(await railWidth(page), 10);
    expect(pct, `${screen} reads ${pct}% after ${last}%`).toBeGreaterThan(last);
    last = pct;
    if (answer) await answer(page);
    if (screen !== 'review') await page.locator('#flow-next').click();
  }
  expect(last).toBe(100);
});
