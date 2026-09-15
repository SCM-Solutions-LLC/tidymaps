import { test, expect } from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* A screen is a page to a screen reader. Every one but the landing page
   titled itself with an h2, so the wizard, the report and the 3D view had no
   level-one heading, and no page had a skip link past the running head. */

test('Tab reaches the skip link first, and it lands focus on the content', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Tab');
  const link = page.locator('.skip-link');
  await expect(link).toBeFocused();
  await expect(link).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

/* The screens a visitor can reach without a backend, in flow order; the report
   and the 3D view are opened the way a visitor opens them, below. The
   dashboard needs a session, so its h1 is pinned by the static test in
   tests/site-hygiene.test.mjs instead. */
const SCREENS = ['space', 'setup', 'measure', 'capture', 'household', 'contents', 'goals', 'style',
  'effort', 'shopping', 'review', 'loading', 'customize', 'save', 'feedback', 'done', 'products'];

const visibleH1s = (page) => page.$$eval('h1', (els) => els
  .filter((el) => el.getClientRects().length)
  .map((el) => el.closest('.screen')?.id));

test('every screen shows exactly one h1, its own', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/index.html');
  expect(await visibleH1s(page)).toEqual(['screen-landing']);
  await page.locator('#screen-landing .btn-primary').first().click();
  for (const id of SCREENS) {
    await page.evaluate((s) => window.go(s), id);
    await expect(page.locator(`#screen-${id}`)).toHaveClass(/active/);
    expect(await visibleH1s(page), id).toEqual([`screen-${id}`]);
  }
  await page.evaluate(() => window.go('landing'));
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  expect(await visibleH1s(page), 'results').toEqual(['screen-results']);
  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/);
  expect(await visibleH1s(page), 'viewer3d').toEqual(['screen-viewer3d']);
});

test('axe finds a level-one heading and ordered headings on the wizard, the report and the 3D view', async ({ page }) => {
  test.setTimeout(90_000);
  const scan = async (label) => {
    await page.waitForTimeout(800);
    const { violations } = await new AxeBuilder({ page })
      .withRules(['page-has-heading-one', 'heading-order'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`), label).toEqual([]);
  };
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await expect(page.locator('#screen-space')).toHaveClass(/active/);
  await scan('wizard');
  await page.evaluate(() => window.go('landing'));
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.evaluate(() => document.querySelectorAll('.chapter.collapsed').forEach((ch) => ch.classList.remove('collapsed')));
  await scan('report');
  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#screen-viewer3d')).toHaveClass(/active/);
  await expect(page.locator('#v3d-zone-list .v3d-zone-item').first()).toBeVisible({ timeout: 20_000 });
  await scan('3D view');
});
