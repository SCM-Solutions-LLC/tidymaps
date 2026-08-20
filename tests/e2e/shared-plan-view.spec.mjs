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

/* What the server sends: sharedSpacePayload() output, nothing more. Household,
   progress, shopping, user_id, and media paths are absent by construction —
   the function never returns them.

   The plan's own household section is absent for a different reason, and the
   difference matters to what this file can prove. `safetyNotes` and every
   row's `safety` are REMOVED by sharedSpacePayload rather than never stored:
   the analysis writes them from the ages, pets and reach needs the owner gave,
   and they used to travel. This payload is the shape that arrives after that
   removal, so the tests below check what a visitor's browser does with a plan
   that has no household section — which is now every shared plan. */
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
      steps: [
        /* No `cite`: the citation is the owner's own wizard answer quoted back,
           and the server strips it now rather than relying on the report to
           hide it. The client-side guard is still asserted below, because a
           row saved by an older build can still carry one. */
        { t: 'Pull everything off the shelves and sort into category piles', m: '45 min', w: 'You cannot see what you have until it is all out.' },
        { t: 'Toss expired items and donate duplicates', m: '15 min', w: 'Less stuff means less to organize.' },
      ],
      map: [
        {
          lv: 'Top shelf: left and back wall', zone: 'Rarely used appliances and bulk backup',
          why: 'Large items live here out of the way.', eye: false, shelfIndex: 0, surface: 'shelf',
          ic: '<svg viewBox="0 0 24 24"></svg>',
          items: [{ name: 'Rice cooker', size: 'l', flags: [] }],
        },
        {
          lv: 'Eye-level shelf: left wall', zone: 'Daily grab items: snacks, spreads',
          why: 'Eye level is prime real estate.', eye: true, shelfIndex: 1, surface: 'shelf',
          ic: '<svg viewBox="0 0 24 24"></svg>',
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

  /* The plan's own safety section used to be exempt from this, on the reasoning
     that "keep heavy jars at mid-shelf height" is placement advice about the
     space rather than a description of who lives there. Some of it is. But the
     analysis is asked to write those notes from the household — to name the
     child's age in a row's safety.why, to name the pet type the owner gave —
     and the report heads the section "Safety notes for your household". The
     server drops it now, so the visitor's page must have nowhere to put it. */
  await expect(page.locator('#res-safety-notes .safety-note')).toHaveCount(0);
  // The per-row badge ("kid safe", "lock or latch") is the same disclosure in
  // two words: it is the only `.tag` the map renders.
  await expect(page.locator('#res-map .tag')).toHaveCount(0);

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

test('a shared plan does not tell the visitor what they asked for', async ({ page }) => {
  /* Steps carry the owner's own answers on their face now. Those travel with
     the plan, and rendering "You asked for labels and categories" to someone
     who answered nothing is the same class of lie as the observed-prose
     scoping: an assertion about a person, made to the wrong person. */
  await openShared(page);
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#res-steps .task').first()).toBeVisible();
  expect(await page.locator('#res-steps .step-cite').count()).toBe(0);
  // the step itself is still there — it is the attribution that is dropped
  await expect(page.locator('#res-steps .tname').first()).toContainText(/pull everything off the shelves/i);
});

/* A plan with no safety section reads as a plan that needs none, and for a
   space with bleach in it that is a worse outcome than the disclosure was.
   The banner says so — on every shared plan, in the same words, whether or
   not this one had notes removed. A line that appeared only when there was
   something to hide would announce that there was something to hide. */
test('the visitor is told the household section is missing, on every plan', async ({ page }) => {
  await openShared(page);
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  const banner = page.locator('#res-share-note');
  await expect(banner).toContainText('leave out everything about the owner’s household');
  await expect(banner).toContainText('safety notes');

  /* The same words for a plan that plainly never had a household section: a
     one-shelf plan with no safety anything. If this line were conditional,
     the two payloads would read differently and the difference would be the
     leak. */
  await openShared(page, {
    space: {
      ...PAYLOAD.space,
      plan: { ...PAYLOAD.space.plan, map: [PAYLOAD.space.plan.map[0]], geometry: { ...PAYLOAD.space.plan.geometry, shelfCount: 1, shelfYFracs: [0.08] } },
    },
  });
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#res-share-note')).toContainText('leave out everything about the owner’s household');
});

/* Redaction can empty a list — a plan whose only opportunity was the
   household's own note comes back with none. The report fills an empty
   problems/opportunities list with a sample one, which is fine for a plan
   that has not been built yet and is not fine here: it would render six
   sentences nobody wrote as this owner's findings about their own space. */
test('a shared plan never fills its gaps with sample content', async ({ page }) => {
  await openShared(page, {
    space: {
      ...PAYLOAD.space,
      plan: { ...PAYLOAD.space.plan, problems: [], opportunities: [] },
    },
  });
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#res-steps .task').first()).toBeVisible();

  await expect(page.locator('#res-problems li')).toHaveCount(0);
  await expect(page.locator('#res-opps li')).toHaveCount(0);
  const report = await page.locator('#screen-results').innerHTML();
  expect(report, 'the sample plan’s prose reached a visitor as the owner’s')
    .not.toContain('Frequently used snacks are too high');
});

/* The hero illustration is picked by space type, and for the whole life of the
   share view it was picked wrong. applySharedSpace read `payload.space_type`
   while sharedSpacePayload emits `spaceType`, so the read was always undefined,
   `areaFor(null)` fell through to the first kitchen area, and EVERY shared plan
   — garage, closet, workbench — was illustrated with a drawn pantry under a
   title naming the real space.

   The comment above that line describes the bug it was meant to fix, which is
   the tell: the fix was written and wired to a key that does not exist.

   Every other test in this file uses a pantry fixture, which is also the
   fallback, so none of them could ever have caught it. This one is deliberately
   not a pantry. */
const WORKBENCH = {
  space: {
    ...PAYLOAD.space,
    name: 'Workbench',
    spaceType: 'workbench',
    plan: { ...PAYLOAD.space.plan, spaceType: 'Workbench' },
  },
};

test('a shared plan is illustrated as the space it is about, not as a pantry', async ({ page }) => {
  await openShared(page, WORKBENCH);

  const hero = page.locator('#plan-hero-img');
  await expect(hero).toBeVisible();

  const shown = await hero.evaluate((img) => ({
    space: img.dataset.space || '', alt: img.alt || '',
  }));
  expect(shown.space || shown.alt.toLowerCase(),
    `the workbench plan is illustrated as: ${JSON.stringify(shown)}`).not.toMatch(/pantry/i);
  expect(`${shown.space} ${shown.alt}`.toLowerCase()).toMatch(/workbench/);
});
