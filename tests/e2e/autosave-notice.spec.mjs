import { test, expect } from 'playwright/test';
import { fakeSession, REF, driveWizardToReview } from './helpers.mjs';

/* A signed-in plan is written to "My spaces" the moment it is built, and it
   used to fail in silence: an expired sign-in (PostgREST answers a stale JWT
   with 401, code PGRST301) left the row unwritten and the screen looking
   saved. The failure is said once now, and names the cause. */

async function stubBackend(page, { spacesStatus }) {
  await page.addInitScript(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [`sb-${REF}-auth-token`, fakeSession()]);
  await page.route(`**/${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const url = req.url().replace(`https://${REF}.supabase.co`, '');
    if (/\/auth\/v1\/token/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession()) });
    }
    if (/\/auth\/v1\/user/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession().user) });
    }
    if (/\/rest\/v1\/spaces/.test(url)) {
      if (spacesStatus === 401) {
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST301', message: 'JWT expired', details: null, hint: null }) });
      }
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: '11111111-2222-4333-8444-555555555555' }) });
    }
    if (/\/rest\/v1\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function buildPlan(page) {
  await driveWizardToReview(page);
  await page.locator('#flow-next').click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

test('a plan the server refuses for an expired sign-in says so, once, on the report', async ({ page }) => {
  test.setTimeout(90_000);
  await stubBackend(page, { spacesStatus: 401 });
  const toasts = [];
  await page.exposeFunction('__toasted', (t) => toasts.push(t));
  await page.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('toast');
      new MutationObserver(() => { if (el.textContent) window.__toasted(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  });
  await buildPlan(page);
  await expect.poll(() => toasts.find((t) => /sign-in has expired/.test(t)), { timeout: 10_000 })
    .toBe('Your sign-in has expired, so this plan is not being saved to My spaces. Sign in again to keep it.');
  expect(toasts.filter((t) => /My spaces/.test(t)), 'nothing claimed the plan was saved').toEqual(
    toasts.filter((t) => /sign-in has expired/.test(t)));
  // Later changes fail the same way and do not repeat the notice.
  await page.locator('#res-steps .task .check').first().click();
  await page.waitForTimeout(1500);
  expect(toasts.filter((t) => /sign-in has expired/.test(t))).toHaveLength(1);
});

test('a plan the server accepts is still announced as saved', async ({ page }) => {
  test.setTimeout(90_000);
  await stubBackend(page, { spacesStatus: 201 });
  await buildPlan(page);
  await expect(page.locator('#toast')).toContainText('Saved to', { timeout: 10_000 });
});
