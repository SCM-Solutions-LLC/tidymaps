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

test('Start over puts every cleared step out of Back\'s reach', async ({ page }) => {
  /* History entries cannot be deleted, so the ones below Start over survive.
     Returning to one drops the user into a step whose answers were wiped —
     a Garage run reappearing as the Pantry default, under "Step 7 of 12". */
  await enterWizard(page);
  for (let i = 0; i < 5; i++) await page.locator('#flow-next').click();
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => window.restart());
  await expect(page.locator('#screen-landing')).toHaveClass(/active/);

  for (let i = 0; i < 4; i++) {
    await page.goBack();
    expect(await screen(page), `Back press ${i + 1} after Start over`).toBe('landing');
  }
});

test('a table-of-contents link scrolls the report instead of leaving it', async ({ page }) => {
  /* The report's contents list is six ordinary fragment links. Following one is
     a same-document navigation that fires popstate with null state — which a
     handler that treats "no screen" as "go home" answers by throwing the
     finished plan away. */
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  const links = page.locator('.report-toc a[href^="#"]:visible');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await links.nth(i).click();
    expect(await screen(page), `contents link ${i + 1}`).toBe('results');
  }
  // and Back still works afterwards, rather than walking out through the jumps
  await page.goBack();
  expect(await screen(page)).toBe('results');
});
