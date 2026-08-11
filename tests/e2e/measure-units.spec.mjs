import { test, expect } from 'playwright/test';

/* The app measured in feet and inches everywhere and offered no way out. The
   toggle changes what is DISPLAYED and never what is stored — state.dims stays
   in inches, because it is the plan and 3D contract — so the risk this file
   exists for is the round trip: a value typed in one system, re-read in the
   other, and quietly corrupted on the way through the input field. */

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

test('imperial is the default, and the toggle switches the whole step', async ({ page }) => {
  await driveToMeasure(page);
  await expect(page.locator('.wz-unit.on')).toHaveText('ft / in');
  await expect(page.locator('#measure-summary')).toContainText('′');

  await page.locator('[data-units="metric"]').click();
  await expect(page.locator('.wz-unit.on')).toHaveText('cm');
  const summary = await page.locator('#measure-summary').textContent();
  expect(summary).toContain('cm');
  expect(summary).not.toMatch(/[″′]/);
  await expect(page.locator('.wm-unit').first()).toHaveText('cm');
});

test('switching units re-renders the same space, it does not resize it', async ({ page }) => {
  await driveToMeasure(page);
  await page.fill('#m-num-w', '10');
  await page.locator('#m-num-w').blur();
  await expect(page.locator('#measure-summary')).toContainText('10′');

  await page.locator('[data-units="metric"]').click();
  // 10 ft is 305 cm; the field shows the same width in the other system
  await expect(page.locator('#m-num-w')).toHaveValue('305');

  // and back again, without the round trip eating the measurement
  await page.locator('[data-units="imperial"]').click();
  await expect(page.locator('#measure-summary')).toContainText('10′');
});

test('a measurement typed in centimetres reaches the plan', async ({ page }) => {
  await driveToMeasure(page);
  await page.locator('[data-units="metric"]').click();
  await page.fill('#m-num-w', '200');
  await page.locator('#m-num-w').blur();
  await expect(page.locator('#measure-summary')).toContainText('200 cm');

  /* What is stored is inches — the plan and 3D contract — and the way to prove
     the right physical size landed there is to read it back in the other
     system rather than to reach into state: 200 cm is 6′7″. */
  await page.locator('[data-units="imperial"]').click();
  await expect(page.locator('#measure-summary')).toContainText('6′7″');

  // and it is the plan's own measurement, not just the step's
  await page.locator('[data-units="metric"]').click();
  await page.evaluate(() => window.go('review'));
  await expect(page.locator('#screen-review')).toContainText('200 cm');
});

test('out-of-range input is corrected in the units the user typed in', async ({ page }) => {
  /* The correction notice quotes a number back at the reader, so it has to be
     the number they can see in the field. Comparing against the imperial bound
     while showing centimetres would tell a metric user that 500 cm is outside
     a range whose limit reads as 14. */
  await driveToMeasure(page);
  await page.locator('[data-units="metric"]').click();
  await page.fill('#m-num-w', '900');
  await page.locator('#m-num-w').blur();
  const note = page.locator('#m-note-w');
  await expect(note).toContainText('900 cm');
  await expect(note).toContainText('cm');
  expect(await note.textContent()).not.toMatch(/ft/);
});

test('the units choice survives a reload, and the plan does not carry it', async ({ page }) => {
  /* Units describe the reader, not the space: kept in their own key so they
     outlive a draft, and deliberately absent from the plan so a shared link
     renders in the units of whoever opens it. */
  await driveToMeasure(page);
  await page.locator('[data-units="metric"]').click();
  await expect(page.locator('.wz-unit.on')).toHaveText('cm');

  const stored = await page.evaluate(() => localStorage.getItem('tidymap_units'));
  expect(stored).toBe('metric');
  const draft = await page.evaluate(() => localStorage.getItem('tidymap_draft_v2'));
  expect(draft, 'no draft was written, so this assertion would prove nothing').toBeTruthy();
  expect(draft).not.toContain('metric');

  /* A reload lands back on the landing screen (the draft is offered, not
     resumed in place), so the toggle is checked where it renders. */
  await page.reload();
  await expect(page.locator('#screen-landing')).toHaveClass(/active/);
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.evaluate(() => window.go('measure'));
  await expect(page.locator('.wz-unit.on')).toHaveText('cm');
  await expect(page.locator('#measure-summary')).toContainText('cm');
});
