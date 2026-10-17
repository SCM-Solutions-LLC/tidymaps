import { test, expect } from 'playwright/test';

/* The fridge became a wizard space on 2026-10-16. Its plan sizes bins
   against the depth typed here, and a fridge measured the way a cupboard is
   (door handle to back wall) is about 30 inches deep, nearly twice the
   shelf. So the field says which depth it wants, and only for a fridge. */

async function next(page) {
  await page.locator('#flow-next').click();
}

async function pickSpace(page, card) {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#space-cards .room-card', { hasText: card }).first().click();
  await next(page);
  await expect(page.locator('#screen-setup')).toHaveClass(/active/);
}

test('the fridge offers its four door layouts, and each asks for the inside depth', async ({ page }) => {
  await pickSpace(page, 'Fridge & freezer');
  await expect(page.locator('#screen-setup h1')).toHaveText('Which one looks like your fridge?');
  const cards = ['Top freezer', 'Bottom freezer', 'Side-by-side', 'French door'];
  await expect(page.locator('#setup-cards .wz-setup .ws-ttl')).toHaveText(cards);

  for (const card of cards) {
    await page.locator('#setup-cards .wz-setup', { hasText: card }).click();
    await next(page);
    await expect(page.locator('#screen-measure h1')).toHaveText('How big is your fridge?');
    await expect(page.locator('#measure-fields .wm-name'), card).toHaveText(['Width', 'Inside depth', 'Height']);
    await page.goBack();
    await expect(page.locator('#screen-setup')).toHaveClass(/active/);
  }
});

test('a pantry still asks for plain depth', async ({ page }) => {
  await pickSpace(page, 'Pantry');
  await page.locator('#setup-cards .wz-setup', { hasText: 'Cabinet' }).first().click();
  await next(page);
  await expect(page.locator('#measure-fields .wm-name')).toHaveText(['Width', 'Depth', 'Height']);
});
