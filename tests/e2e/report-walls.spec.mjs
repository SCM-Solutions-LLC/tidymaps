import { test, expect } from 'playwright/test';
import { expandChapters, assertResultsCoverage } from './helpers.mjs';

/* A walk-in pantry's plan read as one impossibly tall unit: six rows top to
   bottom, each carrying its wall as a prefix in the level text ("Left wall:
   high shelf") that nothing else on the page picked up, so a reader could not
   tell whether "Daily folded" meant the whole pantry or the shelf they face
   walking in. The eye row was peach and the rest grey, and nothing said why.
   Every row also opened with its full rationale, which made "Where things go"
   a wall of text.

   The map now groups a room's rows under one tab per wall, with a small
   outline lighting the selected wall; each row is a compact head that says
   its level without the wall (the tab already said it), marks the eye row
   with the words "Eye level", and folds its reasons behind a tap. A single
   unit keeps its flat list and its full level names. */

/* The walk-in scenario, built the way organizer-depth-fit.spec seeds one:
   straight into state, so the test is about the report and not the wizard.
   The setup is marked as the user's own choice, which is what makes the
   layout a walk-in whatever the rows say. */
async function openWalkIn(page) {
  await page.goto('/index.html');
  await page.evaluate(async () => {
    const [{ state }, { getDemoScenario }, { normalizeAi }, { buildResults }] = await Promise.all([
      import('/js/state.js'), import('/js/demo-scenarios.js'), import('/js/plan.js'), import('/js/screens/results.js'),
    ]);
    state.space = 'pantry';
    state.setup = 'walkin';
    state.setupTouched = true;
    state.dims = { w_in: 72, h_in: 96, d_in: 72 };
    state.ai = normalizeAi(getDemoScenario('walkin', null, state.household, null));
    state.planMeta = { model: 'demo', source: 'demo', analyzedAt: 0 };
    buildResults();
    window.go('results');
  });
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
}

/* The plan's own level texts, so the expectations below are derived from the
   scenario rather than retyped from it and left to go stale. */
const levelsOf = (page) => page.evaluate(async () => (await import('/js/state.js')).state.ai.map.map((m) => m.lv));

const WALL_PREFIX = /^(left|back|right|front) wall:/i;

/* What a row reads once its wall is said by the tab: the text after the
   colon, with its first letter raised. */
const withoutWall = (lv) => {
  const rest = lv.replace(/^[^:]*:\s*/, '');
  return rest.charAt(0).toUpperCase() + rest.slice(1);
};

const bgOf = (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);

test('a walk-in is read wall by wall, and the eye row is named rather than coloured', async ({ page }) => {
  await openWalkIn(page);
  const levels = await levelsOf(page);
  const leftRows = levels.map((lv, i) => [lv, i]).filter(([lv]) => /^left wall:/i.test(lv)).map(([, i]) => i);
  expect(leftRows.length, 'the scenario no longer puts rows on the left wall, so this test is seeding the wrong plan').toBeGreaterThan(0);

  // One tab per wall the plan uses, in wall order, and the first one open.
  const tabs = page.locator('#res-wall-tabs [role=tab]');
  await expect(tabs).toHaveText(['Left wall', 'Back wall', 'Right wall', 'Floor']);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.first()).toHaveAttribute('tabindex', '0');

  // Exactly one panel showing, and it holds the left wall's rows, in order.
  const open = page.locator('#res-map .wall-panel:not([hidden])');
  await expect(open).toHaveCount(1);
  await expect(open).toHaveAttribute('id', 'map-wall-left');
  expect(await open.locator('.shelf').evaluateAll((els) => els.map((el) => el.dataset.row)))
    .toEqual(leftRows.map(String));
  // The tab said "Left wall"; the rows do not say it again.
  const shownLevels = (await open.locator('.shelf .lv').allTextContents()).map((s) => s.trim().replace(/\s+/g, ' '));
  expect(shownLevels).toEqual(leftRows.map((i) => withoutWall(levels[i])));
  for (const lv of await page.locator('#res-map .shelf .lv').allTextContents()) {
    expect(lv.trim(), 'a row still carries its wall as a prefix').not.toMatch(WALL_PREFIX);
  }
  // Every row has its one icon, whichever panel it is in.
  await expect(page.locator('#res-map .shelf .ic svg')).toHaveCount(levels.length);

  // Selecting a wall shows its panel alone and lights its segment of the outline.
  const back = page.locator('#res-wall-tabs').getByRole('tab', { name: 'Back wall' });
  await back.click();
  await expect(back).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('#res-map .wall-panel:not([hidden])')).toHaveCount(1);
  await expect(page.locator('#map-wall-back')).toBeVisible();
  await expect(page.locator('#map-wall-left')).toBeHidden();
  await expect(page.locator('.wall-outline [data-wall="back"]')).toHaveClass(/\bon\b/);
  await expect(page.locator('.wall-outline [data-wall="left"]')).not.toHaveClass(/\bon\b/);

  // The arrow keys walk the tabs and carry focus with the selection.
  await back.focus();
  await page.keyboard.press('ArrowRight');
  const right = page.locator('#res-wall-tabs').getByRole('tab', { name: 'Right wall' });
  await expect(right).toHaveAttribute('aria-selected', 'true');
  await expect(right).toBeFocused();
  await expect(right).toHaveAttribute('tabindex', '0');
  await expect(back).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('#map-wall-right')).toBeVisible();
  await expect(page.locator('#map-wall-back')).toBeHidden();

  /* The eye row is told apart by a word, not a fill: its head and its card
     are painted the same as any other row's. Computed, so a rule on either
     element shows up; read through the cascade, so it does not matter which
     panel is open. */
  const eyeRow = page.locator('#res-map .shelf.eye');
  await expect(eyeRow).toHaveCount(1);
  const plainRow = page.locator('#res-map .shelf:not(.eye)').first();
  expect(await bgOf(eyeRow.locator('.shelf-head')), 'the eye row head has its own fill').toBe(await bgOf(plainRow.locator('.shelf-head')));
  expect(await bgOf(eyeRow), 'the eye row card has its own fill').toBe(await bgOf(plainRow));
  await expect(eyeRow.locator('.eye-mark')).toHaveText(/Eye level/);
  await expect(page.locator('#res-map .shelf:not(.eye) .eye-mark')).toHaveCount(0);

  // A row's reasons are folded behind its head, and the head says so.
  await back.click();
  const head = eyeRow.locator('.shelf-head');
  await expect(head).toBeVisible();
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  const whyId = await head.getAttribute('aria-controls');
  expect(whyId, 'the head does not say which panel it opens').toBeTruthy();
  const why = page.locator(`#${whyId}`);
  await expect(why).toBeHidden();
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(why).toBeVisible();
  await expect(why).toContainText(/\S/);

  // The hero still ships as the same 760-wide plate the 3D entry expects.
  await expect(page.locator('#plan-hero-img')).toHaveJSProperty('naturalWidth', 760);
  /* Its zone text wraps between words, never on a separator: a line that
     opened with "· Spare" or closed with "bedding," read as a typo. */
  const heroText = await page.locator('#plan-hero-img').evaluate((img) => {
    const svg = decodeURIComponent(img.getAttribute('src').replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
    return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  });
  expect(heroText.length).toBeGreaterThan(0);
  for (const line of heroText) expect(line, `hero line "${line}" starts or ends on a separator`).not.toMatch(/^[·,;:]|[·,;:]$/);
  // A zone that needs more than two lines of a side case ends in an ellipsis rather than losing words in silence.
  expect(heroText.some((line) => line.endsWith('…')), `no hero line is marked as cut:\n${heroText.join('\n')}`).toBe(true);

  /* The after-drawing tells the same story as the map: rows under a wall
     heading, each level without the wall it already sits under, and no dot
     on a chip that stood for nothing. */
  const after = page.locator('#after-cabinet');
  await expect(after.locator('.cab-wall')).toHaveText(['Left wall', 'Back wall', 'Right wall', 'Floor']);
  const afterLevels = await after.locator('.cab-lv > span:first-child').allTextContents();
  expect(afterLevels.length).toBe(levels.length);
  for (const lv of afterLevels) expect(lv, `after-drawing row "${lv}" repeats its wall`).not.toMatch(/^(left|back|right|front) wall:|^(floor|door):/i);
  await expect(after.locator('.sw')).toHaveCount(0);
  // Its eye row says "eye level" once too: the level is the word, no tag repeats it.
  expect(((await after.locator('.cab-shelf.eye .cab-lv').textContent()) || '').match(/eye level/gi)).toHaveLength(1);

  // Everything the walls added to the screen is something the fingerprint reads.
  await expandChapters(page);
  await assertResultsCoverage(page);
});

test('on a phone every wall tab and every row head is a 44px target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWalkIn(page);
  const rowCount = (await levelsOf(page)).length;
  const heights = (sel) => page.$$eval(sel, (els) => els
    .filter((el) => el.getClientRects().length)
    .map((el) => ({ name: (el.textContent || '').trim().slice(0, 30), h: el.getBoundingClientRect().height })));

  const tabs = await heights('#res-wall-tabs [role=tab]');
  expect(tabs.length).toBeGreaterThan(1);
  // min-height:44px lays out at 43.9999 in Chromium's 1/64px units.
  for (const b of tabs) expect(b.h, `tab "${b.name}"`).toBeGreaterThan(43.9);

  // A hidden panel's rows measure as nothing, so each wall is opened in turn
  // and the count at the end proves every row of the plan was measured.
  let measured = 0;
  const tabLocator = page.locator('#res-wall-tabs [role=tab]');
  for (let i = 0; i < tabs.length; i++) {
    await tabLocator.nth(i).click();
    const heads = await heights('#res-map .wall-panel:not([hidden]) .shelf-head');
    for (const b of heads) expect(b.h, `row "${b.name}"`).toBeGreaterThan(43.9);
    measured += heads.length;
  }
  expect(measured, 'some rows were never shown under any wall').toBe(rowCount);
});

test('a single unit has no wall tabs and keeps its full level names', async ({ page }) => {
  /* The sample pantry is one cabinet. Its level texts are not walls, so there
     is nothing to group by and nothing to strip: "Top shelf" stays whole, and
     so would "Unit 2: middle shelf". */
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await expect(page.locator('#res-wall-tabs')).toHaveCount(0);
  await expect(page.locator('#res-map .wall-panel')).toHaveCount(0);
  const levels = await levelsOf(page);
  expect(levels.length).toBeGreaterThan(0);
  const shown = (await page.locator('#res-map .shelf .lv').allTextContents()).map((s) => s.trim().replace(/\s+/g, ' '));
  expect(shown).toEqual(levels.map((lv) => lv.trim().replace(/\s+/g, ' ')));
  // The after-drawing agrees: no wall headings, and every level whole.
  await expect(page.locator('#after-cabinet .cab-wall')).toHaveCount(0);
  const afterShown = (await page.locator('#after-cabinet .cab-lv > span:first-child').allTextContents()).map((s) => s.trim().replace(/\s+/g, ' '));
  expect(afterShown).toEqual(levels.map((lv) => lv.trim().replace(/\s+/g, ' ')));
  // The eye row says "Eye level" once, as its level, with the mark on it.
  const eyeHead = page.locator('#res-map .shelf.eye .shelf-head');
  await expect(eyeHead).toHaveCount(1);
  expect((await eyeHead.textContent()).match(/eye level/gi)).toHaveLength(1);
  await expect(eyeHead.locator('.eye-mark svg')).toHaveCount(1);
});

/* A unit can still carry a colon-headed level from the model ("Floor: shoes
   and bins"): with no tab to say the wall, the map keeps the prefix, and the
   after-drawing must keep it too, or one page shows the same row under two
   names and the drawing loses the one word that says where it is. */
test('a unit keeps a colon-headed level whole in the map and the after-drawing alike', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(async () => {
    const [{ state }, { getDemoScenario }, { normalizeAi }, { buildResults }] = await Promise.all([
      import('/js/state.js'), import('/js/demo-scenarios.js'), import('/js/plan.js'), import('/js/screens/results.js'),
    ]);
    state.space = 'pantry';
    state.setup = 'cabinet';
    state.setupTouched = true;
    const ai = normalizeAi(getDemoScenario('pantry', null, state.household, null));
    ai.map[ai.map.length - 1] = { ...ai.map[ai.map.length - 1], lv: 'Floor: shoes and bins', wall: null, surface: 'shelf' };
    state.ai = ai;
    state.planMeta = { model: 'demo', source: 'demo', analyzedAt: 0 };
    buildResults();
    window.go('results');
  });
  await expect(page.locator('#screen-results')).toHaveClass(/active/);
  await expect(page.locator('#res-wall-tabs')).toHaveCount(0);
  await expect(page.locator('#res-map .shelf .lv').last()).toHaveText('Floor: shoes and bins');
  await expect(page.locator('#after-cabinet .cab-wall')).toHaveCount(0);
  await expect(page.locator('#after-cabinet .cab-lv > span:first-child').last()).toHaveText('Floor: shoes and bins');
});
