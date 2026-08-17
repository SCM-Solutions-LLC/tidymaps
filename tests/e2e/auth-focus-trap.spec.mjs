import { test, expect } from 'playwright/test';

/* The sign-in modal keeps BOTH of its steps in the DOM and hides one with
   `.hide` (display:none). The focus trap read the modal with
   querySelectorAll, which does not consider CSS visibility — so `last` was
   routinely a control on the step that is not on screen.

   Tabbing off the last visible control then matched nothing and let focus
   escape to the page behind an aria-modal dialog, and shift-tabbing off the
   first sent focus to an element nobody can see. Either way a keyboard or
   screen-reader user ends up somewhere the modal claims they cannot be.

   The original review filed this as "the selector includes hidden inputs";
   it does not — `input:not([type=hidden])` covers the input TYPE. CSS
   visibility is the actual cause, which is why the fix filters on rendering
   rather than on the selector. */

const inModal = (page) => page.evaluate(() => {
  const el = document.activeElement;
  const modal = document.querySelector('#auth-modal .modal');
  return !!(el && modal && modal.contains(el));
});

// Focus resting on something the user cannot see is its own failure, distinct
// from focus escaping the modal entirely.
const onVisibleElement = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (!el) return false;
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
});

async function openModal(page) {
  await page.goto('/index.html');
  await page.evaluate(() => window.openAuth());
  await expect(page.locator('#auth-modal')).not.toHaveClass(/hide/);
  await expect(page.locator('#auth-email')).toBeFocused();
}

/* On the email step the modal shows: close, the email input, "Email me a
   code". The code step's input, "Sign in" and "Resend code" are all in the
   DOM and all hidden — and unfiltered, "Resend code" is `last`. */

test('Tab off the last visible control wraps instead of leaving the modal', async ({ page }) => {
  await openModal(page);
  await page.locator('#auth-send-btn').focus();
  await page.keyboard.press('Tab');

  expect(await inModal(page), 'focus escaped an aria-modal dialog').toBe(true);
  await expect(page.locator('#auth-modal .modal-x')).toBeFocused();
});

test('Shift+Tab off the first control wraps to a control the user can see', async ({ page }) => {
  await openModal(page);
  await page.locator('#auth-modal .modal-x').focus();
  await page.keyboard.press('Shift+Tab');

  /* Not just "focus stayed in the modal": calling .focus() on a display:none
     element silently does nothing, so the broken version leaves focus exactly
     where it was and Shift+Tab reads as a dead key. The wrap target has to be
     named for the test to tell those apart. */
  await expect(page.locator('#auth-send-btn')).toBeFocused();
  expect(await onVisibleElement(page)).toBe(true);
});

test('the trap follows the modal to the verification step', async ({ page }) => {
  await openModal(page);
  // Swap the steps the way sendAuthCode does, without sending a real code.
  await page.evaluate(() => {
    document.getElementById('auth-step-email').classList.add('hide');
    document.getElementById('auth-step-code').classList.remove('hide');
    document.getElementById('auth-code').focus();
  });

  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await inModal(page), `focus left the modal after ${i + 1} back-tabs`).toBe(true);
    expect(await onVisibleElement(page), `focus landed on a hidden control after ${i + 1} back-tabs`).toBe(true);
  }
  // The email step's controls are hidden now, so none of them may hold focus.
  const onEmailStep = await page.evaluate(() =>
    document.getElementById('auth-step-email').contains(document.activeElement));
  expect(onEmailStep, 'focus reached the step that is no longer on screen').toBe(false);
});
