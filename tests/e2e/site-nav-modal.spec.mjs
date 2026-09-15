import { test, expect } from 'playwright/test';

/* The hamburger menu on a phone is an overlay that sits over the page the way
   a dialog does, and it used to be a plain class toggle: Escape did nothing, a
   tap on the page beneath it did whatever the page did while the menu stayed
   open, the page scrolled under it, and Tab walked straight off the menu into
   the content it covered. While it is open it now behaves like the dialog it
   looks like. */

const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

const focusIn = (page, selector) => page.evaluate((sel) => {
  const el = document.activeElement;
  const box = document.querySelector(sel);
  return !!(el && box && box.contains(el) && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
}, selector);

async function openMenu(page) {
  await page.goto('/index.html');
  await page.click('#nav-toggle');
  await expect(page.locator('body')).toHaveClass(/nav-open/);
  await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded', 'true');
}

test.describe('phone', () => {
  test.use(MOBILE);

  test('Escape closes the menu and puts focus back on its button', async ({ page }) => {
    await openMenu(page);
    expect(await focusIn(page, '.site-nav'), 'opening the menu did not move focus into it').toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
    await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#nav-toggle')).toBeFocused();
  });

  test('a tap outside the menu closes it', async ({ page }) => {
    await openMenu(page);
    const menuBottom = await page.locator('.site-nav').evaluate((el) => el.getBoundingClientRect().bottom);
    await page.mouse.click(195, menuBottom + 200);
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
    await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  test('the page behind the menu neither scrolls nor takes focus', async ({ page }) => {
    await openMenu(page);
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await expect(page.locator('.site-footer')).toHaveAttribute('inert', '');
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => scrollY), 'the page scrolled under the open menu').toBe(0);
    // A control under the menu cannot be focused while the menu is open.
    await page.evaluate(() => document.querySelector('#screen-landing .btn-primary').focus());
    expect(await focusIn(page, 'main'), 'focus reached the page behind the menu').toBe(false);

    await page.keyboard.press('Escape');
    await expect(page.locator('main')).not.toHaveAttribute('inert', '');
    await expect(page.locator('.site-footer')).not.toHaveAttribute('inert', '');
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => scrollY), 'the page stayed locked after the menu closed').toBeGreaterThan(0);
  });

  test('Tab cycles through the running head instead of leaving it', async ({ page }) => {
    await openMenu(page);
    for (let i = 1; i <= 10; i++) {
      await page.keyboard.press('Tab');
      expect(await focusIn(page, '.appbar'), `focus left the running head after ${i} tabs`).toBe(true);
    }
    for (let i = 1; i <= 10; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusIn(page, '.appbar'), `focus left the running head after ${i} back-tabs`).toBe(true);
    }
  });

  test('a tap on "Sign in" closes the menu and still opens the sign-in modal', async ({ page }) => {
    await openMenu(page);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#auth-email')).toBeFocused();
  });
});
