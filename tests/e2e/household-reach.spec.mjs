import { test, expect } from 'playwright/test';

/* Two answers that existed everywhere except on screen.

   household.mobility was declared in state, reset by restart(), forwarded to
   the backend by buildAnalysisContext(), honoured by a hard safety rule in the
   analysis prompt, and acted on by the offline scenarios — but no control in
   the wizard ever wrote it, so the rule could never fire for a real user.

   And the Adjust screen kept offering "Make it more kid-friendly" to a
   household that had just said it has no kids: the same contradiction already
   fixed for the contents chips, the goals, and the after-preview tabs, left
   behind because CUSTOMIZE's [id, title, desc] tuples are a shape the shared
   filter did not recognise. */

async function driveToHousehold(page) {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#room-cards .room-card', { hasText: 'Kitchen' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#area-cards .room-card', { hasText: 'Pantry' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();          // setup
  await page.fill('#m-num-w', '3');
  await page.fill('#m-num-h', '6');
  await page.fill('#m-num-d', '1.33');
  await page.locator('#flow-next').click();          // measure
  await page.locator('#flow-next').click();          // capture → household
  await expect(page.locator('#screen-household')).toHaveClass(/active/);
}

async function finishFromHousehold(page) {
  await page.locator('#flow-next').click();          // household
  await page.locator('#flow-next').click();          // contents
  await page.locator('#goal-list .wz-goal').first().click();
  await page.locator('#flow-next').click();          // goals
  await page.locator('#flow-next').click();          // style
  await page.locator('#flow-next').click();          // effort
  await page.locator('#flow-next').click();          // shopping
  await page.locator('#flow-next').click();          // review → build
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

test('the reach question is answerable and changes the plan', async ({ page }) => {
  await driveToHousehold(page);

  const chips = page.locator('#mobility-chips .chip');
  await expect(chips).not.toHaveCount(0);
  const limited = chips.filter({ hasText: 'Limited reach' }).first();
  await limited.click();
  await expect(limited).toHaveAttribute('aria-pressed', 'true');

  await finishFromHousehold(page);
  /* The answer used to produce one generic safety note and nothing else. The
     plan cannot know which things the user reaches for or how high this unit
     hangs, so it no longer rearranges anything — it puts an actionable step
     in the checklist that quotes the answer back. */
  await expect(page.locator('#res-steps')).toContainText(/off the top level/i);
  await expect(page.locator('#res-steps')).toContainText(/reaching high is difficult/i);
});

test('no reach answer produces no reach guidance', async ({ page }) => {
  await driveToHousehold(page);
  await finishFromHousehold(page);
  await expect(page.locator('#screen-results')).not.toContainText('reaching high is difficult');
  await expect(page.locator('#screen-results')).not.toContainText('mid-height');
});

test('the Adjust screen drops the kid option once the household says no kids', async ({ page }) => {
  await driveToHousehold(page);
  // Default household is 2 adults, 0 kids.
  await finishFromHousehold(page);

  await page.getByRole('button', { name: 'Adjust this plan' }).click();
  await expect(page.locator('#screen-customize')).toHaveClass(/active/);
  const opts = page.locator('#customize-opts .opt');
  await expect(opts).not.toHaveCount(0);
  await expect(opts.filter({ hasText: 'kid' })).toHaveCount(0);
});

test('the Adjust screen keeps the kid option when there are kids', async ({ page }) => {
  await driveToHousehold(page);
  await page.locator('.wc-btn[data-k="kidCount"][data-d="1"]').click();
  await expect(page.locator('#count-kidCount')).toHaveText('1');
  await finishFromHousehold(page);

  await page.getByRole('button', { name: 'Adjust this plan' }).click();
  await expect(page.locator('#screen-customize')).toHaveClass(/active/);
  await expect(page.locator('#customize-opts .opt', { hasText: 'kid-friendly' })).toHaveCount(1);
});

/* Six of the eleven Adjust options did something; the other five re-rendered
   the identical checklist under a "Plan revised" banner and a success toast. */
test('an Adjust option that claims to revise the plan visibly changes it', async ({ page }) => {
  await driveToHousehold(page);
  await finishFromHousehold(page);

  const planText = () => page.locator('#screen-results').innerText();
  const before = await planText();

  await page.getByRole('button', { name: 'Adjust this plan' }).click();
  await expect(page.locator('#screen-customize')).toHaveClass(/active/);
  await page.locator('#customize-opts .opt', { hasText: 'Add more labels' }).click();
  await expect(page.locator('#customize-result')).toContainText('Plan revised');
  await page.locator('#customize-result .btn').click();

  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  expect(await planText(), 'the plan is identical after "Plan revised"').not.toBe(before);

  // Asking for the same revision again is honest about it instead of
  // re-announcing a change that cannot happen twice.
  await page.getByRole('button', { name: 'Adjust this plan' }).click();
  await page.locator('#customize-opts .opt', { hasText: 'Add more labels' }).click();
  await expect(page.locator('#customize-result')).toContainText('Already applied');
});

test('the plan shows the reach answer it was built from', async ({ page }) => {
  /* A live plan carried three safety notes arguing from limited reach, while
     the household chip read "2 adults" — the answer that shaped the plan most
     was the one answer the plan did not show. From the outside that is
     indistinguishable from the model inventing a constraint about someone's
     body, which is the worst thing this report could be caught doing. */
  await driveToHousehold(page);
  await page.locator('#mobility-chips .chip').filter({ hasText: 'Limited reach' }).first().click();
  await finishFromHousehold(page);

  const chip = page.locator('#chip-household');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('Limited reach');
  await expect(chip).toContainText('adult');   // the counts still travel with it
});

test('no reach answer, no reach chip', async ({ page }) => {
  await driveToHousehold(page);
  await finishFromHousehold(page);
  const chip = page.locator('#chip-household');
  expect(await chip.textContent()).not.toMatch(/Limited reach|Avoid bending|Wheelchair/i);
});
