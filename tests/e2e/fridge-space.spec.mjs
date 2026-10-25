import { test, expect } from 'playwright/test';

/* The fridge became a wizard space on 2026-10-16. Its plan sizes bins
   against the depth typed here, and a fridge measured the way a cupboard is
   (door handle to back wall) is about 30 inches deep, nearly twice the
   shelf. So the field says which depth it wants, and only for a fridge. */

async function next(page) {
  await page.locator('#flow-next').click();
}

async function pickSpace(page, card) {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#space-cards .room-card', { hasText: card }).first().click();
  await next(page);
  await expect(page.locator('#screen-setup')).toHaveClass(/active/);
}

test('the fridge offers its four door layouts, and each asks for the inside depth', async ({ page }) => {
  await pickSpace(page, 'Fridge & freezer');
  await expect(page.locator('#screen-setup h1')).toHaveText('Which one looks like your fridge?');
  const cards = ['Top freezer', 'Bottom freezer', 'Side-by-side', 'French door'];
  await expect(page.locator('#setup-cards .wz-setup .ws-ttl')).toHaveText(cards);

  for (const card of cards) {
    await page.locator('#setup-cards .wz-setup', { hasText: card }).click();
    await next(page);
    await expect(page.locator('#screen-measure h1')).toHaveText('How big is your fridge?');
    await expect(page.locator('#measure-fields .wm-name'), card).toHaveText(['Width', 'Inside depth', 'Height']);
    await page.goBack();
    await expect(page.locator('#screen-setup')).toHaveClass(/active/);
  }
});

test('a pantry still asks for plain depth', async ({ page }) => {
  await pickSpace(page, 'Pantry');
  await page.locator('#setup-cards .wz-setup', { hasText: 'Cabinet' }).first().click();
  await next(page);
  await expect(page.locator('#measure-fields .wm-name')).toHaveText(['Width', 'Depth', 'Height']);
});

test('a fridge is not asked about drilling; a pantry still is', async ({ page }) => {
  const toHousehold = async (card, setup) => {
    await pickSpace(page, card);
    await page.locator('#setup-cards .wz-setup', { hasText: setup }).first().click();
    await next(page);            // setup
    await next(page);            // measure
    await next(page);            // photos
    await expect(page.locator('#screen-household')).toHaveClass(/active/);
  };
  await toHousehold('Fridge & freezer', 'French door');
  await expect(page.locator('#constraints-block')).toBeHidden();
  await toHousehold('Pantry', 'Cabinet');
  await expect(page.locator('#constraints-block')).toBeVisible();
  await expect(page.locator('#constraint-chips .chip')).toHaveText(['Nothing drilled or mounted']);
});

/* The 3D view of the first real fridge plan (2026-10-23) said "12 zones,
   one per zone", offered a slider counting twelve shelves, and captioned it
   "Shown as your french door, drawn as Fridge". */
test('a fridge in 3D is counted by its parts and named by its card', async ({ page }) => {
  const { PLAN } = await import('../fixtures/fridge-1023.mjs');
  await page.goto('/index.html');
  await page.evaluate(async (raw) => {
    const [{ state }, { normalizeAi }] = await Promise.all([import('/js/state.js'), import('/js/plan.js')]);
    state.space = 'fridge'; state.setup = 'frenchdoor'; state.setupLabel = 'French door'; state.setupTouched = true;
    state.styles = []; state.prefs = new Set();
    state.dims = { w_in: 36, h_in: 69, d_in: 18 };
    state.ai = normalizeAi(raw);
    await window.openViewer3d();
  }, PLAN);
  await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', 'fridge', { timeout: 20_000 });
  await expect(page.locator('#v3d-zones-h')).toHaveText('12 zones: 3 shelves, 3 drawers, 2 door bins, 4 in the freezer');
  await expect(page.locator('#v3d-status')).toContainText('Shown as your French-door fridge.');
  await page.locator('#v3d-tab-adjust').click();
  await expect(page.locator('#v3d-shelf-controls')).toBeHidden();
  await expect(page.locator('#v3d-heights-section')).toBeHidden();
  await expect(page.locator('#v3d-w')).toBeAttached();
});

test('a fridge plan buys its bins by the set, and the Cost tile agrees', async ({ page }) => {
  /* Every fridge plan asks for three bins, and the only fridge bins in the
     catalog come two to a set. The list multiplied the set's price by three:
     "3 × iDesign ... Set of 2" for $81, six bins where four would do. */
  await page.goto('/index.html');
  await page.evaluate(async () => {
    const [{ state }, { normalizeAi }, { getDemoScenario }, { buildResults }] = await Promise.all([
      import('/js/state.js'), import('/js/plan.js'), import('/js/demo-scenarios.js'), import('/js/screens/results.js'),
    ]);
    state.space = 'fridge'; state.setup = 'frenchdoor'; state.setupLabel = 'French door'; state.setupTouched = true;
    state.dims = null; state.upgrades = true; state.shopping = null;
    const household = { adults: 0, kidCount: 0, petCount: 0, kids: { present: null, ages: [] }, pets: { present: null, types: [] }, mobility: [], notes: '' };
    state.ai = normalizeAi(getDemoScenario('fridge', 'find', household, null, 'frenchdoor'));
    state.planMeta = { model: 'demo', source: 'demo', analyzedAt: Date.now() };
    buildResults();
    window.go('results');
  });
  const line = page.locator('#res-shopping li', { hasText: 'Set of 2' });
  await expect(line).toContainText('2 × iDesign');
  await expect(line).toContainText('$54');
  const card = page.locator('#res-upgrades .prod', { hasText: 'Set of 2' });
  await expect(card.locator('.cost')).toHaveText('$54');
  // "3 × Clear bin" over a Set of 2 at $54 says how many sets that is.
  await expect(card.locator('.pretail').first()).toContainText('at Target · buy 2');
  const total = await page.locator('#res-shop-total').textContent();
  await expect(page.locator('#kpi-cost')).toHaveText(`$0 / ${total}`);
});
