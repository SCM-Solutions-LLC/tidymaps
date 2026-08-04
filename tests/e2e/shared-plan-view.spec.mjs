import { test, expect } from 'playwright/test';

/* The read-only share view, walked in a real browser.

   PR #23 shipped share links and the handoff has carried "live share-link
   round trip — still unverified" ever since, because until PR #41 no space had
   ever been saved and there was nothing to share. Nothing in the suite opened
   a share link at all: the payload allowlist had unit tests, and the visitor's
   half of the contract had none.

   The payload below is the shape the real get-shared-space returns, taken from
   the production row this was verified against — an AI plan for a walk-in
   pantry. The edge function is mocked because CI cannot reach it, but
   everything downstream of the response is the real client. */

const SHARE_ID = '1d6dcc74-5b57-486a-bc45-afb14524c5a0';

// What the server sends: sharedSpacePayload() output, nothing more. Household,
// progress, shopping, user_id, and media paths are absent by construction —
// the function never selects them.
const PAYLOAD = {
  space: {
    name: 'Pantry',
    spaceType: 'pantry',
    goal: 'capacity',
    dims: { w_in: 72, h_in: 96, d_in: 72, shelves: null },
    planMeta: { model: 'claude-sonnet-4-6', source: 'ai', analyzedAt: 1785373371923 },
    sharedAt: '2026-08-04T14:50:14.451865+00:00',
    plan: {
      spaceType: 'Pantry',
      summary: 'This is a walk-in pantry with L-shaped shelving running along two walls. The main problems are overcrowding on every shelf and no clear category zones. A weekend reset would make a huge difference.',
      problems: ['No category zones', 'Inconsistent containers'],
      opportunities: ['Group all spices onto one shelf', 'Use the wire door rack intentionally'],
      cats: ['Dry goods & grains', 'Canned goods', 'Snacks'],
      cost: '$0 for the sort / $60 to $120 for bins',
      time: '3 to 4 hours',
      existingLede: 'You already have some good stuff in here.',
      existing: [{ ico: '<svg viewBox="0 0 24 24"></svg>', ft: 'Clear acrylic bins', fd: 'Buy a matching set.' }],
      dontBuy: 'Skip a new shelf unit. You have plenty of shelf space already.',
      features: [{ ico: '<svg viewBox="0 0 24 24"></svg>', ttl: 'Multi-level wall shelving', sub: 'Five shelf levels' }],
      safetyNotes: ['Keep heavy jars at mid-shelf height'],
      steps: [
        { t: 'Pull everything off the shelves and sort into category piles', m: '45 min', w: 'You cannot see what you have until it is all out.' },
        { t: 'Toss expired items and donate duplicates', m: '15 min', w: 'Less stuff means less to organize.' },
      ],
      map: [
        {
          lv: 'Top shelf: left and back wall', zone: 'Rarely used appliances and bulk backup',
          why: 'Large items live here out of the way.', eye: false, shelfIndex: 0, surface: 'shelf',
          ic: '<svg viewBox="0 0 24 24"></svg>', safety: { flag: null, why: null },
          items: [{ name: 'Rice cooker', size: 'l', flags: [] }],
        },
        {
          lv: 'Eye-level shelf: left wall', zone: 'Daily grab items: snacks, spreads',
          why: 'Eye level is prime real estate.', eye: true, shelfIndex: 1, surface: 'shelf',
          ic: '<svg viewBox="0 0 24 24"></svg>', safety: { flag: null, why: null },
          items: [{ name: 'Snack bags', size: 's', flags: [] }],
        },
      ],
      geometry: {
        unit: 'in', width: 72, height: 96, depth: 72, shelfCount: 2,
        shelfYFracs: [0.08, 0.45], estimated: false,
      },
      layout: {
        type: 'walkin-u',
        sections: [{ id: 'left', label: 'Left wall', place: 'left', rows: [0, 1] }],
      },
    },
  },
};

async function openShared(page, body = PAYLOAD, status = 200) {
  await page.route('**/functions/v1/get-shared-space', (route) => route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  }));
  await page.goto(`/?share=${SHARE_ID}`);
}

test('a share link opens the plan read-only, and says so', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openShared(page);

  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  // The banner is the whole point: the visitor has to know whose plan this is
  // and that ticking steps changes nothing for the owner.
  const banner = page.locator('#res-share-note');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('read-only');

  // The plan itself renders — a share link that shows a banner and no plan
  // would pass a laxer version of this test.
  await expect(page.locator('#res-map .shelf')).toHaveCount(2);
  await expect(page.locator('#res-steps .task')).toHaveCount(2);
  await expect(page.locator('#res-summary')).toContainText('walk-in pantry');
  expect(errors).toEqual([]);
});

test('owner-only actions are hidden from a visitor', async ({ page }) => {
  await openShared(page);
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });

  for (const label of ['Adjust this plan', 'Save & share']) {
    await expect(page.locator(`#res-actions button:has-text("${label}")`)).toBeHidden();
  }
  // The 3D view is not owner-only — a shared plan is still walkable.
  await expect(page.locator('#res-actions button:has-text("Open the 3D view")')).toBeVisible();

  // The feedback ask is about your own plan for your own space, so it stays
  // off a visitor's copy.
  await expect(page.locator('#res-rate')).toBeHidden();
});

test('nothing personal is on the page, because nothing personal was sent', async ({ page }) => {
  await openShared(page);
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });

  // The household chip is what would carry "2 adults · 1 kid" onto a stranger's
  // screen; with no household in the payload it must not render.
  await expect(page.locator('#chip-household')).toBeHidden();
  // No photos: the payload carries no media path and no signed URL exists.
  await expect(page.locator('#after-photo')).toBeHidden();

  /* The plan's own safetyNotes are deliberately NOT checked for here: they are
     on the share allowlist and they should be. They are placement advice that
     belongs to the plan ("keep heavy jars at mid-shelf height"), not a
     description of who lives there. */

  /* Scoped to the report, not the document: every screen lives in index.html
     at once, so the hidden wizard's household stepper carries data-k="kidCount"
     on a page that leaks nothing.

     Only storage identifiers are matched as substrings. Household words are
     not: the report legitimately renders product names, and "non-skid lazy
     susan" contains "kid". The household surfaces are asserted precisely
     above instead — a loose scan here passed for the wrong reason and failed
     for the wrong reason. */
  const report = await page.locator('#screen-results').innerHTML();
  for (const leak of ['user_id', 'space-media', 'storage_path', 'stepsDone']) {
    expect(report).not.toContain(leak);
  }
});

test('a revoked link says so rather than showing a blank plan', async ({ page }) => {
  // Revocation nulls share_id, so the lookup misses and the function 404s.
  await openShared(page, { error: 'not_found' }, 404);
  await expect(page.locator('#screen-landing')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#screen-results')).toBeHidden();
});
