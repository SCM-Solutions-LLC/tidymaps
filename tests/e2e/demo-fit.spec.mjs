import { test, expect } from 'playwright/test';

/* The sample plan is the one plan every visitor can open, and its 3D view
   opened with a warning: "2 organizers from your list have no spot in this
   view yet". The plan asked for four 10-inch bins on the eye-level shelf of a
   30-inch pantry, a can rack taller than any of its shelf gaps, and a riser
   on a top shelf with four inches of headroom; and the matcher put the
   middle-shelf products on the top shelf on the strength of the word
   "shelf". A sample that does not fit its own view is the product arguing
   against itself, so this walks the real path: landing, sample plan, 3D. */
test('the sample plan opens in 3D with every organizer placed and fitting', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  await page.getByRole('button', { name: 'Open the 3D view' }).first().click();
  await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/);
  // The organizer panel and the fit note are written together, once the scene
  // is built, so a visible chip means the note has been decided.
  await expect(page.locator('#v3d-organizer-list .v3d-organizer-chip').first()).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('#v3d-fit-note')).toBeHidden();
  expect(errors).toEqual([]);
});
