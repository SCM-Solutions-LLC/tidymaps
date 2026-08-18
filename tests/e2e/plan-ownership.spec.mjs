import { test, expect } from 'playwright/test';
import { fileURLToPath } from 'node:url';
import { driveWizardToReview, expandChapters, fakeSession, REF } from './helpers.mjs';
import { normalizeAi } from '../../js/plan.js';

/* Ownership of asynchronous work, from the user's side of the screen.

   Every operation here reads or writes the one shared `state` object after an
   await, and in each case the user can start a different plan inside that
   window. The rule (js/state.js) is that the plan instance decides who may
   write: capture it before the first await, snapshot everything you need, and
   apply nothing if it has moved. These are the three places it was reachable
   without a debugger.

   The Supabase session is faked in localStorage and every call to the project
   is intercepted, so this runs offline and touches no real data. */

const PHOTO = fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url));

const SPACE_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const SPACE_B = 'bbbbbbbb-2222-4222-8222-222222222222';

const planNamed = (firstStep, spaceType) => ({
  spaceType,
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
  steps: [
    { task: firstStep, time: '10 min', why: 'A clear shelf is easier to plan.' },
    { task: 'Group like with like', time: '10 min', why: 'You stop buying duplicates.' },
    { task: 'Put backstock up top', time: '5 min', why: 'Daily items stay in reach.' },
    { task: 'Label the fronts', time: '10 min', why: 'Everyone can put things back.' },
    { task: 'Wipe the shelf down', time: '5 min', why: 'Crumbs attract pests.' },
    { task: 'Set a restock spot', time: '5 min', why: 'You see gaps before you shop.' },
    { task: 'Check reachability', time: '5 min', why: 'The plan has to survive a hurry.' },
  ],
  time: '45-60 min',
  cost: '$0',
});

const STEP_A = 'Empty the pantry the user opened first';
const STEP_B = 'Empty the closet the user opened second';

const savedRow = (id, spaceType, step) => ({
  id,
  name: spaceType === 'pantry' ? 'The pantry' : 'The closet',
  space_type: spaceType,
  goal: 'find',
  dims: { w_in: 36, h_in: 72, d_in: 16 },
  household: { adults: 2, kidCount: 0, petCount: 0, kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' },
  prefs: {},
  /* A saved row holds the plan in the shape the report renders, because that
     is what rowFromState() writes: the raw model JSON is normalized once, on
     the way in. Normalizing here with the app's own function keeps the stub
     honest rather than approximately right. */
  plan: normalizeAi(planNamed(step, spaceType === 'pantry' ? 'Pantry' : 'Closet')),
  plan_meta: { model: 'test-model', source: 'ai', analyzedAt: 1 },
  shopping: null,
  progress: { stepsDone: [] },
  arrangement: null,
  after_render_path: null,
  updated_at: '2026-08-01T00:00:00Z',
});

/* Answers the project's REST calls locally. `hold` names a space id whose
   single-row fetch is parked until the returned release function is called. */
async function stubSpaces(page, { hold = [] } = {}) {
  const waiting = {};
  await page.addInitScript(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [`sb-${REF}-auth-token`, fakeSession()]);

  const gates = new Map(hold.map((id) => {
    let release;
    const gate = new Promise((res) => { release = res; });
    waiting[id] = release;
    return [id, gate];
  }));

  await page.route(`**/${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const url = req.url().replace(`https://${REF}.supabase.co`, '');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (/\/auth\/v1\/token/.test(url)) return json(fakeSession());
    if (/\/auth\/v1\/user/.test(url)) return json(fakeSession().user);
    if (/\/rest\/v1\/spaces/.test(url) && req.method() === 'GET') {
      // The tombstone sweep, which has nothing to recover here.
      if (/not\.is\.null/.test(url)) return json([]);
      const single = /id=eq\.([0-9a-f-]+)/.exec(url);
      if (single) {
        const id = single[1];
        if (gates.has(id)) await gates.get(id);
        return json(id === SPACE_A ? savedRow(SPACE_A, 'pantry', STEP_A) : savedRow(SPACE_B, 'closet', STEP_B));
      }
      return json([savedRow(SPACE_A, 'pantry', STEP_A), savedRow(SPACE_B, 'closet', STEP_B)]);
    }
    if (/\/rest\/v1\/spaces/.test(url) && req.method() === 'POST') return json({ id: SPACE_A }, 201);
    if (/\/rest\/v1\//.test(url)) return json([]);
    return json({});
  });
  return waiting;
}

/* Clicking two saved plans in quick succession applied whichever row the
   network returned LAST — its plan, its categories, its dimensions, and a
   navigation to the report — regardless of which card the user actually meant.
   On a slow connection that is not a narrow window: it is however long the
   first request takes.

   The fix claims the switch at the click, so the card tapped last owns the
   screen and the earlier load lands on a stale id and applies nothing. */
test('opening a second saved plan wins even when the first one loads last', async ({ page }) => {
  const release = await stubSpaces(page, { hold: [SPACE_A, SPACE_B] });

  await page.goto('/index.html');
  // "My spaces" appears once the faked session has been read back by the
  // client, which is also when the dashboard can list anything.
  await page.locator('#acct-btn:not(.hide)').click();
  await expect(page.locator('#screen-dashboard')).toHaveClass(/active/);
  const cards = page.locator('.dash-card [data-open]');
  await expect(cards).toHaveCount(2);

  // Both opens are in the air at once; the SECOND is the one the user wants.
  await cards.nth(0).click();
  await cards.nth(1).click();

  release[SPACE_B]();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 20_000 });
  await expect(page.locator('#res-steps .task').first()).toContainText(STEP_B);

  // Now the abandoned one lands. It must change nothing at all.
  release[SPACE_A]();
  await page.waitForTimeout(1500);

  await expect(page.locator('#res-steps .task').first(),
    'the plan that loaded last replaced the plan the user opened').toContainText(STEP_B);
  const openSpace = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return { id: state.activeSpaceId, space: state.space };
  });
  expect(openSpace.id, 'the report showed one plan while state pointed at another').toBe(SPACE_B);
  expect(openSpace.space).toBe('closet');
});

/* The photo preview awaited the encode and only THEN read buildGeminiBrief()
   and state.activeSpaceId, so a plan switch mid-render sent one space's photo
   with another space's zone plan — and wrote the returned image onto whichever
   plan was on screen when it came back. The user sees a photorealistic
   "after" of a room that is not the one this plan is about. */
test('a photo preview that lands after the user starts over is not shown on the new plan', async ({ page }) => {
  let release;
  let seenSpaceId = 'unset';
  await page.route('**/functions/v1/render-after', async (route) => {
    seenSpaceId = JSON.parse(route.request().postData() || '{}').spaceId ?? null;
    await new Promise((res) => { release = res; });
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // A 1x1 PNG: the smallest thing the client will accept as a render.
        body: JSON.stringify({ image: { media_type: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } }),
      });
    } catch (_) { /* the page moved on */ }
  });
  await page.route('**/functions/v1/analyze-space', (route) => route.fulfill({
    status: 500, contentType: 'application/json', body: '{}',
  }));

  await driveWizardToReview(page, { photo: PHOTO });
  await page.locator('#flow-next').click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });

  // The before/after chapter starts folded, the same as it does for a reader.
  await expandChapters(page);
  await page.locator('#after-gen-btn').click();
  await expect.poll(() => seenSpaceId, { timeout: 10_000 }).not.toBe('unset');

  // The user abandons this plan while the render is out.
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => window.restart());
  await expect(page.locator('#screen-landing')).toHaveClass(/active/);

  release();
  await page.waitForTimeout(1500);

  const rendered = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return !!state.afterRenderB64;
  });
  expect(rendered, 'one plan’s photo preview was written onto another plan').toBe(false);
});
