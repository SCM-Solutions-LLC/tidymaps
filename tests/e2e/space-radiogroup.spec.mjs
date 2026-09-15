import { test, expect } from 'playwright/test';

/* The space step is one question with nine answers, and it was nine buttons
   with aria-pressed: a screen reader heard nine switches, Tab stopped on
   every one, and nothing said "3 of 9". It is a radio group now: each card
   a radio that says whether it is checked, one card in the Tab order, and the
   arrow keys moving between the cards and choosing, the way radios do. */

async function openSpaceStep(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await expect(page.locator('#screen-space')).toHaveClass(/active/);
}

const cards = '#space-cards .room-card';
const tabbable = (page) => page.$$eval(cards, (els) => els.map((el) => el.tabIndex).filter((t) => t === 0).length);
const checked = (page) => page.$$eval(cards, (els) => els.filter((el) => el.getAttribute('aria-checked') === 'true').map((el) => el.querySelector('h3').textContent));
const focusedName = (page) => page.evaluate(() => document.activeElement?.querySelector?.('h3')?.textContent || null);

test('the cards are a radio group named by the question, with one card in the Tab order', async ({ page }) => {
  await openSpaceStep(page);
  const group = page.locator('#space-cards');
  await expect(group).toHaveAttribute('role', 'radiogroup');
  const by = await group.getAttribute('aria-labelledby');
  await expect(page.locator(`#${by}`)).toHaveText('Which space needs sorting out?');
  const roles = await page.$$eval(cards, (els) => els.map((el) => [el.getAttribute('role'), el.getAttribute('aria-checked'), el.hasAttribute('aria-pressed')]));
  expect(roles.length).toBeGreaterThan(3);
  for (const [role, state, pressed] of roles) {
    expect(role).toBe('radio');
    expect(state).toBe('false');
    expect(pressed, 'a radio does not also claim to be a toggle button').toBe(false);
  }
  expect(await tabbable(page), 'exactly one card is in the Tab order').toBe(1);
});

test('the arrow keys move between the cards and choose, and Tab lands on the chosen one', async ({ page }) => {
  await openSpaceStep(page);
  await page.locator(cards).first().focus();
  const first = await focusedName(page);
  await page.keyboard.press('ArrowRight');
  const second = await focusedName(page);
  expect(second).not.toBe(first);
  expect(await checked(page), 'moving with the arrows chooses').toEqual([second]);
  await expect(page.locator('#flow-next')).toBeEnabled();
  await page.keyboard.press('ArrowDown');
  const third = await focusedName(page);
  expect(await checked(page)).toEqual([third]);
  await page.keyboard.press('ArrowLeft');
  expect(await focusedName(page)).toBe(second);
  expect(await checked(page)).toEqual([second]);
  // The chosen card is the one Tab reaches: leave the group and come back.
  expect(await tabbable(page)).toBe(1);
  await page.keyboard.press('Home');
  expect(await focusedName(page)).toBe(first);
  expect(await checked(page)).toEqual([first]);
  await page.keyboard.press('End');
  expect(await checked(page)).toHaveLength(1);
  expect(await checked(page)).not.toEqual([first]);
  // Wrapping: Right from the last card is the first.
  await page.keyboard.press('ArrowRight');
  expect(await focusedName(page)).toBe(first);
});

test('a tap still chooses, and moves the Tab stop to the tapped card', async ({ page }) => {
  await openSpaceStep(page);
  await page.locator(cards, { hasText: 'Closet' }).first().click();
  expect(await checked(page)).toEqual(['Closet']);
  const stop = await page.$$eval(cards, (els) => els.filter((el) => el.tabIndex === 0).map((el) => el.querySelector('h3').textContent));
  expect(stop).toEqual(['Closet']);
  // A screen change and back re-renders the step; the chosen card keeps the stop.
  await page.locator('#flow-next').click();
  await page.locator('#flow-back').click();
  await expect(page.locator('#screen-space')).toHaveClass(/active/);
  expect(await checked(page)).toEqual(['Closet']);
  expect(await page.$$eval(cards, (els) => els.filter((el) => el.tabIndex === 0).map((el) => el.querySelector('h3').textContent))).toEqual(['Closet']);
});
