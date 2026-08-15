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

/* Walking back to the landing page is only half of Back working. The session's
   FIRST history entry was written without a generation stamp, so the router's
   `gen !== generation` test read it as an entry from before a Start over —
   `undefined !== 0` — and answered by PUSHING a fresh landing entry over it.
   The next Back popped onto the same unstamped entry and pushed again. The
   stack grew by one per press and Back could never reach whatever the visitor
   was looking at before the site, which on a phone is also the edge swipe.

   So the test enters from a real previous page and insists on getting back to
   it, rather than stopping at the landing page and calling that success. */
test('Back keeps going past the landing page and leaves the app', async ({ page }) => {
  await page.goto('/privacy.html');
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
  await page.locator('#screen-landing .btn-primary').first().click();
  for (let i = 0; i < 3; i++) await page.locator('#flow-next').click();
  await expect(page.locator('#screen-measure')).toHaveClass(/active/);

  for (let i = 0; i < 4; i++) await page.goBack();
  expect(await screen(page)).toBe('landing');

  await page.goBack();
  await expect(page).toHaveURL(/privacy\.html/);
});

test('Back still leaves the app after Start over', async ({ page }) => {
  // Start over bumps the generation, so every entry already on the stack is
  // obsolete. Each must be CLAIMED in place; pushing over them was the trap.
  await page.goto('/privacy.html');
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
  await page.locator('#screen-landing .btn-primary').first().click();
  for (let i = 0; i < 3; i++) await page.locator('#flow-next').click();

  // Same entry point the test above uses: the appbar button is hidden while a
  // step counter is showing, which is every wizard screen.
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => window.restart());
  await expect(page.locator('#screen-landing')).toHaveClass(/active/);

  // At most one press per entry that was on the stack; the bug made this
  // unbounded, so a finite budget that reaches privacy.html is the assertion.
  /* Most of these presses are same-document popstates, which never fire a load
     event, so the default goBack() wait does not apply to them. */
  for (let i = 0; i < 8; i++) {
    if (page.url().includes('privacy.html')) break;
    await page.goBack({ waitUntil: 'commit' });
    await page.waitForTimeout(60);
  }
  await expect(page).toHaveURL(/privacy\.html/);
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
