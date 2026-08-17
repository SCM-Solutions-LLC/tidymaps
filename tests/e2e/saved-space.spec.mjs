import { test, expect } from 'playwright/test';

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

const REF = 'jwubrtaacveavbkosgtf';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const NEW_SPACE_ID = '11111111-2222-4333-8444-555555555555';
// A second id so a test can tell "inserted a new row" from "overwrote the old one".
const SECOND_SPACE_ID = '99999999-8888-4777-8666-555555555555';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  const token = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp }),
    'signature',
  ].join('.');
  return {
    access_token: token, token_type: 'bearer', expires_in: 31536000, expires_at: exp,
    refresh_token: 'fake-refresh',
    user: {
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: 'tester@example.com', app_metadata: {}, user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
}

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
