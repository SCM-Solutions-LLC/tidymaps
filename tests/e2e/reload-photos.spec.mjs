import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';

/* A reload part-way through the wizard keeps every answer in localStorage and
   loses the photos, which are File objects in memory. The toast on landing
   said "your answers are still here", and a reader took that to cover the
   photos: the photo step had emptied without a word. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url));

test('a reload that lost the photos says so', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#space-cards .room-card', { hasText: 'Pantry' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();   // measure, with its defaults, to the photo step
  await expect(page.locator('#screen-capture')).toHaveClass(/active/);
  await page.setInputFiles('#photo-input', PHOTO);
  await page.locator('#photo-tiles .wz-photo').first().waitFor();
  await page.waitForTimeout(400);   // the draft is written on the next screen change or tick; give it one
  await page.locator('#flow-next').click();   // household, which writes the draft
  await page.reload();
  await expect(page.locator('#toast')).toContainText('photos you added were not kept', { timeout: 5_000 });
  await expect(page.locator('#toast')).toContainText('answers are still here');
});

test('a reload with no photos to lose says only that the answers are here', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#space-cards .room-card', { hasText: 'Pantry' }).first().click();
  await page.locator('#flow-next').click();
  await page.reload();
  await expect(page.locator('#toast')).toHaveText('Your answers are still here. Pick up where you left off.', { timeout: 5_000 });
});
