import { test, expect } from 'playwright/test';
import { fakeSession, REF, USER_ID } from './helpers.mjs';

/* Two promises this suite pins down:

   1. A signed-in visitor's plan exists in their account the moment it is
      built. Before this, nothing was written until they found "Save plan"
      two screens past the report, and updateSpacePatch refused to persist
      progress without an activeSpaceId — so a signed-in user could lose a
      finished plan that a signed-out one would have kept in localStorage.
   2. That autosave never uploads photos. Photo storage stays tied to an
      explicit save or share, which is what the privacy page promises.

   The Supabase session is faked in localStorage and every call to the
   project is intercepted, so this runs offline and touches no real data. */

const NEW_SPACE_ID = '11111111-2222-4333-8444-555555555555';
// A second id so a test can tell "inserted a new row" from "overwrote the old one".
const SECOND_SPACE_ID = '99999999-8888-4777-8666-555555555555';

// Records every Supabase call and answers it locally.
async function stubBackend(page, { signedIn, updateMatchesNothing = false }) {
  const wire = [];
  const newIds = [NEW_SPACE_ID, SECOND_SPACE_ID];
  let inserted = 0;
  if (signedIn) {
    const session = fakeSession();
    await page.addInitScript(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, [`sb-${REF}-auth-token`, session]);
  }
  await page.route(`**/${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const url = req.url().replace(`https://${REF}.supabase.co`, '');
    wire.push({ method: req.method(), url, body: req.postData() });
    if (/\/auth\/v1\/token/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession()) });
    }
    if (/\/auth\/v1\/user/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession().user) });
    }
    if (/\/rest\/v1\/spaces/.test(url) && req.method() === 'POST') {
      const id = newIds[Math.min(inserted++, newIds.length - 1)];
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id }) });
    }
    /* An UPDATE ... RETURNING id answers with the row it changed, and saveSpace
       now reads that row: an update matching nothing is not an error, it is a
       save that silently wrote nothing, and it used to be reported as "Saved".
       The catch-all below returns `[]` for everything, which is what a real
       PATCH says only when it matched no rows — so the stub has to be specific
       here or it stands in for the very failure the check exists to catch. */
    if (/\/rest\/v1\/spaces/.test(url) && req.method() === 'PATCH') {
      if (updateMatchesNothing) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      const id = new URL(`https://x${url}`).searchParams.get('id') || '';
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ id: id.replace(/^eq\./, '') || NEW_SPACE_ID }]),
      });
    }
    if (/\/rest\/v1\//.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return wire;
}

async function buildAPlan(page, { room = 'Bedroom', area = 'Closet' } = {}) {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await walkWizardFromSpaceStep(page, { room, area });
}

// Everything from the room step onward. Split out so a test can re-enter the
// wizard from "Edit answers" without starting a new page.
async function walkWizardFromSpaceStep(page, { room, area }) {
  await page.locator('#room-cards .room-card', { hasText: room }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#area-cards .room-card', { hasText: area }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#flow-next').click();              // setup
  await page.fill('#m-num-w', '4');
  await page.fill('#m-num-h', '7');
  await page.fill('#m-num-d', '2');
  await page.locator('#flow-next').click();              // measure
  await page.locator('#flow-next').click();              // capture (no photos)
  await page.locator('#flow-next').click();              // household
  await page.locator('#flow-next').click();              // contents
  await page.locator('#goal-list .wz-goal').first().click();
  await page.locator('#flow-next').click();              // goals
  await page.locator('#flow-next').click();              // style
  await page.locator('#flow-next').click();              // effort
  await page.locator('#flow-next').click();              // shopping
  await page.locator('#flow-next').click();              // review → build
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 30_000 });
}

const spaceWrites = (wire) => wire.filter((c) => c.method === 'POST' && /\/rest\/v1\/spaces/.test(c.url));

/* setArea() reset every answer that depends on the space — setup, dims,
   categories, goals, styles — but not state.activeSpaceId. saveSpace()
   branches on exactly that: still set from the first space, the second plan
   became an UPDATE of the first space's row, and rowFromState() overwrites
   every column, so the first space was destroyed. autoSaveSpace() only toasts
   when the row is new, so there was no signal either. "Edit answers" is the
   shortest way in, but the landing gallery and the Product Library's "Plan
   this space" reach setArea() the same way. */
test('planning a second space inserts its own row instead of overwriting the first', async ({ page }) => {
  const wire = await stubBackend(page, { signedIn: true });
  await buildAPlan(page, { room: 'Bedroom', area: 'Closet' });
  await page.waitForTimeout(1500);
  expect(spaceWrites(wire), 'the first space should have been autosaved').toHaveLength(1);

  await page.getByRole('button', { name: 'Edit answers' }).click();
  await expect(page.locator('#screen-space')).toHaveClass(/active/);
  await walkWizardFromSpaceStep(page, { room: 'Kitchen', area: 'Pantry' });
  await page.waitForTimeout(1500);

  const writes = spaceWrites(wire);
  expect(writes, 'the second space needs a row of its own').toHaveLength(2);
  expect(JSON.parse(writes[0].body).space_type).toBe('closet');
  expect(JSON.parse(writes[1].body).space_type).toBe('pantry');

  // The precise failure: the closet's row patched with the pantry's plan.
  const clobbered = wire
    .filter((c) => c.method === 'PATCH' && c.url.includes(NEW_SPACE_ID) && c.body)
    .map((c) => JSON.parse(c.body))
    .filter((body) => body.space_type && body.space_type !== 'closet');
  expect(clobbered, 'the pantry plan overwrote the saved closet').toEqual([]);
});

/* The spaces table has no setup column, so the setup type was simply dropped
   on save. resolveLayout() keys the 3D archetype off state.setup, so a saved
   walk-in reopened as whatever setup happened to be in memory. */
test('a saved space remembers its setup type', async ({ page }) => {
  const wire = await stubBackend(page, { signedIn: true });
  await buildAPlan(page, { room: 'Kitchen', area: 'Pantry' });
  await page.waitForTimeout(1500);

  const row = JSON.parse(spaceWrites(wire)[0].body);
  expect(row.prefs.setup, 'setup must survive the round trip').toBeTruthy();
  expect(row.prefs.setupLabel).toBeTruthy();
});

test('a signed-in plan saves itself, with a real name and no photo upload', async ({ page }) => {
  const wire = await stubBackend(page, { signedIn: true });
  await buildAPlan(page);
  await page.waitForTimeout(1500);

  const writes = spaceWrites(wire);
  expect(writes, 'the plan should be written without visiting the save screen').toHaveLength(1);

  const row = JSON.parse(writes[0].body);
  expect(row.user_id).toBe(USER_ID);
  expect(row.space_type).toBe('closet');
  expect(row.name).not.toBe('My space');
  expect(row.plan).toBeTruthy();
  expect(row.dims).toMatchObject({ w_in: 48, h_in: 84, d_in: 24 });

  // Nothing went to storage: photo persistence stays opt-in.
  expect(wire.filter((c) => /\/storage\/v1\//.test(c.url))).toHaveLength(0);

  // And the write turned on incremental persistence: checking a step now patches.
  await page.locator('#res-steps .task .check').first().click();
  await page.waitForTimeout(1500);
  expect(wire.filter((c) => c.method === 'PATCH' && /\/rest\/v1\/spaces/.test(c.url)).length).toBeGreaterThan(0);
});

test('a signed-out plan writes nothing to the account', async ({ page }) => {
  const wire = await stubBackend(page, { signedIn: false });
  await buildAPlan(page);
  await page.waitForTimeout(1500);

  expect(spaceWrites(wire)).toHaveLength(0);
  expect(wire.filter((c) => /\/storage\/v1\//.test(c.url))).toHaveLength(0);
  // The guest keeps their plan the way guests always have.
  const draft = await page.evaluate(() => localStorage.getItem('tidymap_draft_v2'));
  expect(draft).toBeTruthy();
});

test('the explicit save still runs and is the thing that uploads photos', async ({ page }) => {
  const wire = await stubBackend(page, { signedIn: true });
  await buildAPlan(page);
  await page.waitForTimeout(1500);
  wire.length = 0;

  await page.getByRole('button', { name: 'Save & share' }).click();
  await expect(page.locator('#screen-save')).toHaveClass(/active/);
  await page.locator('#save-opts .opt', { hasText: 'Save plan' }).click();
  await page.waitForTimeout(1500);

  // The space already exists, so this updates rather than duplicating it.
  expect(spaceWrites(wire)).toHaveLength(0);
  expect(wire.filter((c) => c.method === 'PATCH' && /\/rest\/v1\/spaces/.test(c.url)).length).toBeGreaterThan(0);
  await expect(page.locator('#toast')).toContainText('Saved');
});

/* PostgREST does not treat "matched no rows" as an error, so an UPDATE against
   a space that has since been deleted on another device — or that RLS no
   longer admits — came back clean and was reported as "Saved". The user closes
   the tab believing their plan is filed. */
test('a save that matches no row says so instead of claiming success', async ({ page }) => {
  await stubBackend(page, { signedIn: true, updateMatchesNothing: true });
  await buildAPlan(page);
  await page.waitForTimeout(1500);

  await page.getByRole('button', { name: 'Save & share' }).click();
  await expect(page.locator('#screen-save')).toHaveClass(/active/);
  await page.locator('#save-opts .opt', { hasText: 'Save plan' }).click();

  await expect(page.locator('#toast')).toContainText('Saving failed');
  await expect(page.locator('#toast')).not.toContainText('Find it under');
});

/* Only a full save wrote the `prefs` column, and the report's products switch
   and the whole Adjust screen change answers long after the last one. So a
   row's answers could be older than its plan: turn products on from Adjust,
   reopen the space, and the section was hidden with the cost tile reading $0
   over a plan full of them. Re-deriving `upgrades` from the shopping list was
   a patch over that, and it could only ever express one direction of it.

   Every incremental write carries the answers now. Ticking a step is the
   smallest thing that triggers one. */
test('an incremental write carries the current answers', async ({ page }) => {
  const wire = await stubBackend(page, { signedIn: true });
  await buildAPlan(page);
  await page.waitForTimeout(1500);
  wire.length = 0;

  // The tick is the .check button on the step row, not the row itself.
  await page.locator('#res-steps .task .check').first().click();
  await page.waitForTimeout(1500);

  const patches = wire
    .filter((c) => c.method === 'PATCH' && /\/rest\/v1\/spaces/.test(c.url) && c.body)
    .map((c) => JSON.parse(c.body));
  expect(patches.length, 'ticking a step should write progress').toBeGreaterThan(0);

  const withAnswers = patches.find((b) => b.prefs && b.prefs.answers);
  expect(withAnswers, 'the write carried no answers, so the row can go stale').toBeTruthy();
  expect(withAnswers.prefs.answers.v).toBe(2);
  // It is the whole answer set, not a subset that will drift from the saver's.
  expect(withAnswers.prefs.answers).toHaveProperty('shoppingPref');
  expect(withAnswers.prefs.answers).toHaveProperty('upgrades');
  expect(withAnswers.prefs.answers).toHaveProperty('goals');
  // And the write it was riding along with is still there.
  expect(patches.some((b) => b.progress)).toBe(true);
});

/* A write waits 800ms to be batched, and that wait is spent on a page the user
   may close, background, or switch away from — on a phone, switching apps is
   enough for the tab to be discarded. The queue lives in memory, so it goes
   with the page: the step comes back unticked on the next visit and the only
   person who knows is the user who ticked it.

   Ticking the last step and leaving is not an unusual way to finish a plan. */
test('a write still inside the debounce survives the page going away', async ({ page }) => {
  const wire = await stubBackend(page, { signedIn: true });
  await buildAPlan(page);
  await page.waitForTimeout(1500);
  wire.length = 0;

  await page.locator('#res-steps .task .check').first().click();
  // Hidden immediately — well inside the 800ms the batcher would have waited.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);

  const patches = wire
    .filter((c) => c.method === 'PATCH' && /\/rest\/v1\/spaces/.test(c.url) && c.body)
    .map((c) => JSON.parse(c.body));
  expect(patches.length,
    'the tick was still queued when the page went away, and went with it').toBeGreaterThan(0);
  expect(patches.some((b) => b.progress), 'the progress write is the one that had to survive').toBe(true);
});

test('hiding the page twice does not send the same write again', async ({ page }) => {
  // The queue is drained before the request, so there is nothing left to resend.
  const wire = await stubBackend(page, { signedIn: true });
  await buildAPlan(page);
  await page.waitForTimeout(1500);
  wire.length = 0;

  await page.locator('#res-steps .task .check').first().click();
  const hide = () => page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await hide();
  await page.waitForTimeout(200);
  const afterFirst = wire.filter((c) => c.method === 'PATCH').length;
  await hide();
  await page.waitForTimeout(200);

  expect(wire.filter((c) => c.method === 'PATCH').length).toBe(afterFirst);
});
