import { test, expect } from 'playwright/test';

/* The Back button used to leave the site from step 7 of 12. Nothing was lost —
   the guest draft survives — but a marketing page appearing mid-wizard reads as
   having lost it, and on a phone Back is also the edge-swipe, so it is not a
   button people press by accident. */

const screen = (page) => page.evaluate(() => document.body.dataset.screen);

async function enterWizard(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await expect(page.locator('#screen-space')).toHaveClass(/active/);
}

test('Back walks the wizard in reverse instead of leaving the site', async ({ page }) => {
  await enterWizard(page);
  for (let i = 0; i < 4; i++) await page.locator('#flow-next').click();
  await expect(page.locator('#screen-capture')).toHaveClass(/active/);

  const trail = [];
  for (let i = 0; i < 5; i++) {
    await page.goBack();
    trail.push(await screen(page));
  }
  expect(trail).toEqual(['measure', 'setup', 'area', 'space', 'landing']);
  expect(page.url()).not.toContain('#');
});

test('Forward returns along the same path', async ({ page }) => {
  await enterWizard(page);
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();
  await expect(page.locator('#screen-setup')).toHaveClass(/active/);

  await page.goBack();
  await page.goBack();
  expect(await screen(page)).toBe('space');
  await page.goForward();
  expect(await screen(page)).toBe('area');
  await page.goForward();
  expect(await screen(page)).toBe('setup');
});

test('the answers survive the round trip', async ({ page }) => {
  await enterWizard(page);
  await page.locator('#room-cards .room-card', { hasText: 'Garage' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#area-cards .room-card', { hasText: 'Workbench' }).first().click();
  await page.locator('#flow-next').click();
  await expect(page.locator('#screen-setup')).toHaveClass(/active/);

  await page.goBack();
  await expect(page.locator('#screen-area')).toHaveClass(/active/);
  await expect(page.locator('#area-cards .room-card.sel')).toContainText(/workbench/i);
  await page.goForward();
  await expect(page.locator('#screen-setup')).toHaveClass(/active/);
  // The setup cards are the workbench's, not the kitchen defaults they would
  // fall back to if the area answer had been dropped on the way through.
  await expect(page.locator('#setup-cards .wz-setup.sel')).toHaveCount(1);
  await expect(page.locator('#setup-cards')).toContainText(/bench|tool chest/i);
});

test('the URL names the screen, and the landing page keeps a clean one', async ({ page }) => {
  await enterWizard(page);
  expect(new URL(page.url()).hash).toBe('#space');
  await page.locator('#flow-next').click();
  expect(new URL(page.url()).hash).toBe('#area');
  await page.goBack();
  await page.goBack();
  expect(new URL(page.url()).hash).toBe('');
});

test('the loading screen is never somewhere Back can land', async ({ page }) => {
  /* It exists for as long as an analysis takes and cannot be returned to.
     Pushed onto the stack it would sit behind the report as a spinner that is
     not spinning, so it is replaced by whatever follows it instead. */
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  const seen = [];
  for (let i = 0; i < 3; i++) {
    await page.goBack();
    seen.push(await screen(page));
    if (seen[seen.length - 1] === 'landing') break;
  }
  expect(seen).not.toContain('loading');
});

test('Back closes the sign-in modal rather than the screen behind it', async ({ page }) => {
  await enterWizard(page);
  const before = await screen(page);
  await page.evaluate(() => window.openAuth());
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await screen(page)).toBe(before);

  // and the button still works for navigation once the modal is gone
  await page.goBack();
  expect(await screen(page)).toBe('landing');
});

test('Start over does not leave an entry pointing back into cleared answers', async ({ page }) => {
  await enterWizard(page);
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => window.restart());
  await expect(page.locator('#screen-landing')).toHaveClass(/active/);
  await page.goBack();
  // the entry restart replaced was 'setup', so Back lands one step earlier
  expect(await screen(page)).not.toBe('setup');
});
