import { test, expect } from 'playwright/test';

/* Audit 11-24 (open item 24): Edit answers, pick a different space, then
   Back. Picking the space clears the plan (setArea), but Back still went to
   the report screen, which showed the old plan's DOM with no plan behind it. */
test('Back after choosing a new space does not open the cleared report', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.getByRole('button', { name: 'Edit answers' }).click();
  await expect(page.locator('#screen-space')).toHaveClass(/active/);
  await page.locator('#space-cards .room-card', { hasText: 'Closet' }).first().click();
  await page.goBack();
  await page.waitForTimeout(800);
  const s = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return { screen: document.querySelector('.screen.active').id, ai: !!state.ai, space: state.space };
  });
  expect(s.screen === 'screen-results' && !s.ai, `a report with no plan: ${JSON.stringify(s)}`).toBe(false);
});
