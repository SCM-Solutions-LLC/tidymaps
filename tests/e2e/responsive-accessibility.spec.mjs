import { test, expect } from 'playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function openSamplePlan(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
}

test('sample plan fits a narrow phone viewport', async ({ page }) => {
  await openSamplePlan(page);
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  const productColumns = await page.locator('.prod').first().evaluate((card) =>
    getComputedStyle(card).gridTemplateColumns.trim().split(/\s+/).length,
  );
  expect(productColumns).toBeLessThanOrEqual(3);
});

test('step controls have accessible state and phone-sized targets', async ({ page }) => {
  await openSamplePlan(page);
  const firstCheck = page.locator('#res-steps .check').first();
  await expect(firstCheck).toHaveAccessibleName(/mark step 1 complete/i);
  await expect(firstCheck).toHaveAttribute('aria-pressed', 'false');
  const boxes = await page.locator('#res-steps .task:first-child button').evaluateAll((buttons) =>
    buttons.map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
  );
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test('sign-in modal exposes dialog semantics and restores focus', async ({ page }) => {
  await page.goto('/index.html');
  const trigger = page.getByRole('button', { name: 'Sign in' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Save your spaces' })).toBeVisible();
  await expect(page.locator('#auth-msg')).toHaveAttribute('aria-live', 'polite');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('wizard navigation focuses the new screen heading and starts with no children assumed', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await expect(page.locator('#screen-space').getByRole('heading').first()).toBeFocused();
  await page.locator('body').evaluate(() => window.go('household'));
  await expect(page.locator('.wz-count', { hasText: 'Kids' }).locator('.wc-val')).toHaveText('0');
});
