import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';

/* "I do not see the AI photo option" — reported twice, from two real plans,
   both of which had photos attached.

   The button was there both times. `setupAfterPhoto()` had removed `hide` from
   both `#after-photo` and `#after-gen-row`, exactly as designed. It was 0px
   tall, because `#ch-after` ships `class="chapter collapsed"` and a collapsed
   chapter renders nothing but its `<h3>` — `.ch-sub` is `display:none` while
   folded, so there was no line of text anywhere that could have said what was
   inside. The heading reads "What it could look like", which does not sound
   like somewhere a tool lives.

   Folding the four reference chapters is deliberate (the report is otherwise
   fourteen screens on a phone), so the fix is not to unfold it. It is to say,
   in the one element that survives the fold, that there is something in there.

   These assert the thing that actually failed: not "is the button in the DOM"
   — it always was — but "can a reader tell it exists without opening a section
   whose name gives no clue". */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url));

const PLAN = {
  spaceType: 'Pantry',
  summary: 'A test plan from the mocked backend.',
  categories: ['Canned goods'],
  map: [{
    level: 'Top shelf', icon: 'up', zone: 'Backstock', why: 'Rarely reached.',
    eye: false, shelfIndex: 0, safety: { flag: null, why: null },
    items: [{ name: 'Canned goods', size: 'm', flags: [] }], surface: 'shelf',
  }],
  geometry: { unit: 'in', width: 36, height: 72, depth: 16, shelfCount: 1, shelfYFracs: [0.1], estimated: false },
  layout: null,
  safetyNotes: [],
  productNeeds: [],
  steps: Array.from({ length: 7 }, (_, i) => ({
    task: `Step number ${i + 1}`, time: '5 min', why: 'It moves the plan along.',
  })),
  time: '45-60 min',
  cost: '$0',
};

async function planWithPhoto(page, { photos = 1 } = {}) {
  await page.route('**/functions/v1/analyze-space', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ plan: PLAN, model: 'test-model', requestId: 'test' }),
  }));

  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#room-cards .room-card', { hasText: 'Kitchen' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#area-cards .room-card', { hasText: 'Pantry' }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();                    // setup
  await page.fill('#m-num-w', '3');
  await page.fill('#m-num-h', '6');
  await page.fill('#m-num-d', '1.33');
  await page.locator('#flow-next').click();                    // measure → photos

  if (photos) {
    await page.setInputFiles('#photo-input', Array.from({ length: photos }, () => PHOTO));
    await expect(page.locator('#photo-tiles .wz-photo')).toHaveCount(photos);
  }

  await page.locator('#flow-next').click();                    // photos → household
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();                    // contents
  await page.locator('#goal-list .wz-goal').first().click();
  await page.locator('#flow-next').click();                    // goals
  await page.locator('#flow-next').click();                    // style
  await page.locator('#flow-next').click();                    // effort
  await page.locator('#flow-next').click();                    // shopping
  await page.locator('#flow-next').click();                    // review → build
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.waitForTimeout(600);
}

test('a plan built from photos advertises the preview on the folded chapter', async ({ page }) => {
  await planWithPhoto(page, { photos: 2 });

  /* The chapter is still folded — that part is deliberate and must not
     regress into "expand everything". */
  await expect(page.locator('#ch-after')).toHaveClass(/collapsed/);

  /* And the flag is legible anyway. `toBeVisible` is the whole assertion:
     .ch-sub fails it while collapsed, which is why the flag could not simply
     be a sentence in the subtitle. */
  const flag = page.locator('#after-chapter-flag');
  await expect(flag).toBeVisible();
  await expect(flag).toHaveText(/photo preview/i);

  /* The bug in one line: the button existed and had no height. */
  const beforeOpen = await page.locator('#after-gen-btn').evaluate((b) => b.getBoundingClientRect().height);
  expect(beforeOpen, 'precondition: the button is folded away, as reported').toBe(0);

  await page.locator('#ch-after .ch-head').click();
  await expect(page.locator('#ch-after')).not.toHaveClass(/collapsed/);
  await expect(page.getByRole('button', { name: 'Generate photo preview' })).toBeVisible();
});

test('a plan built without photos advertises nothing', async ({ page }) => {
  await planWithPhoto(page, { photos: 0 });

  /* There is no photo to work from, so the whole block stays hidden — and the
     flag must not outlive it. A flag promising a preview that cannot be
     generated is worse than no flag. */
  await expect(page.locator('#after-photo')).toHaveClass(/hide/);
  await expect(page.locator('#after-chapter-flag')).toBeHidden();
});

test('the flag does not cover the chapter its head belongs to', async ({ page }) => {
  await planWithPhoto(page, { photos: 1 });

  /* The head also carries the expand/collapse chevron as a ::after at
     right:6px. A flag pinned with margin-left:auto lands in the same corner,
     so this pins that they do not overlap and that the head is still one row
     rather than a wrapped stack. */
  const box = await page.locator('#ch-after .ch-head').boundingBox();
  const flagBox = await page.locator('#after-chapter-flag').boundingBox();
  expect(flagBox.x + flagBox.width, 'the flag runs under the chevron')
    .toBeLessThanOrEqual(box.x + box.width - 12);
  expect(flagBox.height).toBeLessThan(box.height);
});

test('the flag survives a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await planWithPhoto(page, { photos: 1 });

  await expect(page.locator('#after-chapter-flag')).toBeVisible();
  /* The report must not start scrolling sideways to fit it — the site-wide
     guarantee tests/e2e/horizontal-overflow.spec.mjs pins everywhere else. */
  const over = await page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
  expect(over, 'the flag pushed the report off the side of a phone').toBeLessThanOrEqual(0);
});
