import { test, expect } from 'playwright/test';

/* Measurements the user typed must survive two paths that silently wiped
   them back to the setup's defaults:
   1. Re-clicking the setup card that is ALREADY selected (coming Back, or
      Review's Edit re-confirming the same answer) re-applied default dims.
   2. A mid-wizard reload restored dims (inches) but not dimsFt (what the
      measure screen and Review render from), so Review showed the startup
      pantry default against a plan built from the real measurement — and
      blurring a measure field wrote the stale default over the real value. */

async function next(page) {
  await page.locator('#flow-next').click();
}

// landing → Garage → Shelving & storage → Utility shelving → measure
async function driveToMeasure(page) {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#room-cards .room-card', { hasText: 'Garage' }).first().click();
  await next(page);
  await page.locator('#area-cards .room-card', { hasText: 'Shelving & storage' }).first().click();
  await next(page);
  await page.locator('#setup-cards .wz-setup', { hasText: 'Utility shelving' }).first().click();
  await next(page);
  await expect(page.locator('#screen-measure')).toHaveClass(/active/);
}

test('re-clicking the already-selected setup card keeps typed measurements', async ({ page }) => {
  await driveToMeasure(page);
  await page.fill('#m-num-w', '12');
  await page.locator('#m-num-w').blur();
  await expect(page.locator('#measure-summary')).toContainText('12′');

  // Back to the setup step and re-confirm the same card.
  await page.locator('#flow-back').click();
  await page.locator('#setup-cards .wz-setup', { hasText: 'Utility shelving' }).first().click();
  await next(page);
  await expect(page.locator('#measure-summary')).toContainText('12′');
  await expect(page.locator('#m-num-w')).toHaveValue('12');

  // Picking a DIFFERENT card still resets to that setup's defaults.
  await page.locator('#flow-back').click();
  await page.locator('#setup-cards .wz-setup', { hasText: 'Wall cabinets' }).first().click();
  await next(page);
  await expect(page.locator('#measure-summary')).not.toContainText('12′');
});

test('a mid-wizard reload keeps measurements consistent from measure screen to plan', async ({ page }) => {
  await driveToMeasure(page);
  await page.fill('#m-num-w', '12');
  await page.locator('#m-num-w').blur();
  await next(page); // capture
  await next(page); // household — far enough that the draft has the answers

  await page.reload();
  await expect(page.locator('#screen-landing')).toHaveClass(/active/);
  await page.locator('#screen-landing .btn-primary').first().click();

  // The measure screen and its summary show the saved 12′, not the default.
  await page.evaluate(() => window.go('measure'));
  await expect(page.locator('#m-num-w')).toHaveValue('12');
  await expect(page.locator('#measure-summary')).toContainText('12′');

  // Focus + blur (no typing) must not overwrite the restored value.
  await page.locator('#m-num-w').focus();
  await page.locator('#m-num-w').blur();
  await expect(page.locator('#measure-summary')).toContainText('12′');

  // Review agrees with the plan the next click builds.
  await page.evaluate(() => window.go('review'));
  await expect(page.locator('#review-rows')).toContainText('12′ wide');
  await next(page);
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 25_000 });
  await expect(page.locator('#chip-dims')).toContainText('12′');
});
