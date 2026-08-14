import { test, expect } from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expandChapters } from './helpers.mjs';

/* WCAG 2 A/AA regression guard.

   The contrast pass that shipped with the semantic colour roles took this suite
   from 23 violations to zero; without a scan in the repo, the next token edit
   puts them back silently. So the whole reachable surface is scanned once —
   every wizard step, the report, the screens past it, the auth modal and the
   five legal documents.

   Violations do not change with viewport, so each screen is scanned once at one
   width, and the effort saved goes into the checks axe cannot make: the toast's
   live region, and aria-pressed on the single-select cards (which axe reads as
   plain buttons, so a selected card with no state is invisible to it). */

async function axeScan(page) {
  /* The wizard cards fade in on a stagger — card-arrive is 540ms with delays up
     to 220ms, so the last card lands at ~760ms. Scanning before that measures a
     half-faded grey and reports contrast failures that do not survive the
     animation. Waiting on getAnimations() does not work: the card art animates
     infinitely, so those promises never settle. */
  await page.waitForTimeout(1400);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  // Reported as id + first offending node so a failure names the fix, not a count.
  return violations.map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} node(s), first: ${v.nodes[0]?.target.join(' ')}`);
}

const next = (page) => page.locator('#flow-next').click();

/* One walk through the wizard, scanning where it stands after each answer.
   Re-driving from the landing page per screen costs ~8s a step and buys
   nothing: the DOM at step N is the same either way. */
const WIZARD_STEPS = [
  ['space', async (page) => page.locator('#room-cards .room-card', { hasText: 'Kitchen' }).first().click()],
  ['area', async (page) => page.locator('#area-cards .room-card', { hasText: 'Pantry' }).first().click()],
  ['setup', async (page) => expect(page.locator('#setup-cards .wz-setup.sel')).toHaveCount(1)],
  ['measure', async (page) => {
    await page.fill('#m-num-w', '3');
    await page.fill('#m-num-h', '6');
    await page.fill('#m-num-d', '1.33');
    await page.locator('#m-num-d').blur();
  }],
  ['capture', null],
  ['household', async (page) => {
    await page.locator('.wz-count', { hasText: 'Kids' }).locator('.wc-btn[data-d="1"]').click();
    await page.locator('#mobility-chips .chip').first().click();
  }],
  ['contents', async (page) => page.locator('#contents-chips .chip').first().click()],
  ['goals', async (page) => page.locator('#goal-list .wz-goal').first().click()],
  ['style', async (page) => page.locator('#style-cards .wz-style').first().click()],
  ['effort', async (page) => page.locator('#effort-cards .wz-effort').first().click()],
  ['shopping', async (page) => page.locator('#shopping-cards .wz-shop', { hasText: 'Open to a few ideas' }).first().click()],
  ['review', null],
];

test('landing and every wizard step pass WCAG 2 A/AA', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
  await page.goto('/index.html');

  expect(await axeScan(page), 'landing').toEqual([]);

  await page.locator('#screen-landing .btn-primary').first().click();
  for (const [screen, answer] of WIZARD_STEPS) {
    await expect(page.locator(`#screen-${screen}`)).toHaveClass(/active/);
    if (answer) await answer(page);
    expect(await axeScan(page), `wizard/${screen}`).toEqual([]);
    if (screen !== 'review') await next(page);
  }

  await expect(page.locator('#flow-next')).toContainText('Build my plan');
  await next(page);
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  // Folded chapters hide most of the report from axe; open them the way a
  // reader does, so the scan covers the content rather than four headings.
  await expandChapters(page);
  expect(await axeScan(page), 'results').toEqual([]);
});

test('the screens past the report pass WCAG 2 A/AA', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);

  for (const screen of ['customize', 'save', 'feedback', 'done', 'products']) {
    await page.evaluate((s) => window.go(s), screen);
    await expect(page.locator(`#screen-${screen}`)).toHaveClass(/active/);
    expect(await axeScan(page), screen).toEqual([]);
  }

  // The sign-in modal, which axe should see as a labelled dialog.
  await page.evaluate(() => window.go('landing'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await axeScan(page), 'auth modal').toEqual([]);
  await page.keyboard.press('Escape');

  /* The legal documents are separate pages with their own head and shell, so
     nothing above covers them. They are also the pages a reader is most likely
     to arrive at with a screen reader — an accessibility statement that fails
     an accessibility scan is the worst version of this. */
  for (const doc of ['privacy', 'terms', 'security', 'cookies', 'accessibility']) {
    await page.goto(`/${doc}.html`);
    expect(await axeScan(page), `${doc}.html`).toEqual([]);
  }
});

test('confirmations announce, and single-select cards expose their state', async ({ page }) => {
  /* Neither check is something axe makes. A toast with no live region is valid
     HTML that a screen reader never speaks, and a selected card marked only by
     a CSS class is a button that looks chosen and reads unchosen. */
  await page.goto('/index.html');
  const toast = page.locator('#toast');
  await expect(toast).toHaveAttribute('role', 'status');
  await expect(toast).toHaveAttribute('aria-live', 'polite');

  await page.locator('#screen-landing .btn-primary').first().click();
  await page.evaluate(() => window.go('effort'));
  const effort = page.locator('#effort-cards .wz-effort');
  await expect(effort.first()).toHaveAttribute('aria-pressed', /true|false/);
  await effort.nth(1).click();
  await expect(effort.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(effort.first()).toHaveAttribute('aria-pressed', 'false');

  await page.evaluate(() => window.go('shopping'));
  const shopping = page.locator('#shopping-cards .wz-shop');
  await shopping.nth(1).click();
  await expect(shopping.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(shopping.first()).toHaveAttribute('aria-pressed', 'false');
});
