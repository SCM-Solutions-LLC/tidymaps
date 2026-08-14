import { test, expect } from 'playwright/test';

/* The Adjust screen, twice over.

   1. Three of its cards ran the same two lines. "Make it more
      budget-friendly", "Use only what I already own" and "Remove storage
      product recommendations" each dropped productNeeds and turned the upsell
      off — the same defect the fewer/faster pair had, which this file's
      neighbour already documents, except there were three of them and the
      code said so in one condition: id==='rmprod'||id==='own'||id==='budget'.

   2. It was a dead end. The only way back to the report was to apply a
      revision, so opening Adjust and changing your mind meant leaving the
      plan by the browser's back button or not at all. */

async function openSample(page) {
  await page.goto('/index.html');
  // each pass starts from nothing: applying a revision writes a guest draft,
  // and the landing offers to resume it instead of the sample
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

async function openAdjust(page) {
  await openSample(page);
  await page.getByRole('button', { name: 'Adjust this plan' }).click();
  await expect(page.locator('#screen-customize')).toHaveClass(/active/);
}

test('no two options describe the same change', async ({ page }) => {
  await openAdjust(page);
  const titles = await page.$$eval('#customize-opts .opt .ttl', (els) => els.map((e) => e.textContent.trim()));
  /* Judged by outcome, not by wording: apply each product-related option to a
     fresh plan and compare the plan it leaves behind. */
  const productish = titles.filter((t) => /product|own|budget/i.test(t));
  const outcomes = [];
  for (const title of productish) {
    await openSample(page);
    await page.getByRole('button', { name: 'Adjust this plan' }).click();
    await page.locator('#customize-opts .opt', { hasText: title }).click();
    outcomes.push({
      title,
      state: await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return JSON.stringify({
          upgrades: state.upgrades,
          needs: (state.ai.productNeeds || []).length,
          cost: state.ai.cost,
        });
      }),
    });
  }
  const bySignature = new Map();
  for (const o of outcomes) bySignature.set(o.state, [...(bySignature.get(o.state) || []), o.title]);
  const dupes = [...bySignature.values()].filter((g) => g.length > 1);
  expect(dupes, `these options leave the plan in the same state: ${JSON.stringify(dupes)}`).toEqual([]);
});

test('you can leave without changing anything', async ({ page }) => {
  await openSample(page);
  // read it while it is on screen: innerText collapses differently on a
  // hidden section, which would make any comparison meaningless
  const before = await page.locator('#screen-results').innerText();
  await page.getByRole('button', { name: 'Adjust this plan' }).click();
  await expect(page.locator('#screen-customize')).toHaveClass(/active/);
  await page.locator('#screen-customize').getByRole('button', { name: /Back to plan/ }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  expect(await page.locator('#screen-results').innerText(), 'leaving Adjust changed the plan').toBe(before);
});

test('every screen past the plan offers a way back to it', async ({ page }) => {
  /* Save and Feedback were the same dead end: six things to do and no route
     back to the thing they are about. */
  await openSample(page);
  for (const screen of ['customize', 'save', 'feedback']) {
    await page.evaluate((s) => window.go(s), screen);
    await expect(page.locator(`#screen-${screen}`)).toHaveClass(/active/);
    const back = page.locator(`#screen-${screen}`).getByRole('button', { name: /Back to (plan|my plan)/ });
    await expect(back, `#screen-${screen} has no way back to the plan`).toHaveCount(1);
    await back.click();
    await expect(page.locator('#screen-results')).toHaveClass(/active/);
  }
});

test('the feedback screen has a way back on both of its branches', async ({ page }) => {
  /* Feedback renders one of two panels — the form, or "you already sent this"
     for a plan that has been rated. The way back was added to the form only,
     so the branch a returning user actually lands on was still a dead end. */
  await openSample(page);
  await page.evaluate(() => window.go('feedback'));
  for (const branch of ['fb-form', 'fb-sent']) {
    await page.evaluate((show) => {
      document.getElementById('fb-form').classList.toggle('hide', show !== 'fb-form');
      document.getElementById('fb-sent').classList.toggle('hide', show !== 'fb-sent');
    }, branch);
    const back = page.locator(`#${branch}`).getByRole('button', { name: /Back to plan/ });
    await expect(back, `#${branch} has no way back to the plan`).toHaveCount(1);
    await expect(back).toBeVisible();
  }
});
