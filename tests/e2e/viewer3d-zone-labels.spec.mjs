import { test, expect } from 'playwright/test';

/* A zone and a shelf are one row of the plan. The viewer used to present them
   as two unrelated things: the controls said "Number of shelves", the sidebar
   said "Zones", and the only place the two met was a sprite in the 3D scene
   that was built `visible=false` and revealed solely while a pointer rested on
   a sidebar row.

   That is three separate problems, and this file pins each of them:

     - the sprite carried `row.lv` — the place, "top shelf" — while the sidebar
       beside it showed `row.zone`, the purpose. Same row, two names, neither
       one saying so.
     - hover is not available on a touch screen, so on a phone the zone names
       could not be reached at all.
     - the sidebar heading never said the two lists were the same list.

   The scene itself is a canvas, so none of this can be asserted by reading
   pixels. It is asserted against the sprite objects the scene builds, which is
   where the visibility decision is actually made. */

async function openViewer(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await page.evaluate(() => window.openViewer3d());
  await expect(page.locator('#v3d-layouts .v3d-chip').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#v3d-canvas')).toHaveAttribute('data-layout', /.+/, { timeout: 20_000 });
  await page.waitForTimeout(1200);
}

/* Every zone label in the scene, with the state the renderer left it in. */
async function labels(page) {
  return page.evaluate(() => {
    const out = [];
    const view = window.__v3dView;
    if (!view) return out;
    view.scene.traverse((node) => {
      if (node.userData && node.userData.isZoneLabel) {
        out.push({
          visible: node.visible,
          shelfIndex: node.userData.zoneShelfIndex,
          scaleX: node.scale.x,
          hasNormal: !!node.userData.faceNormal,
        });
      }
    });
    return out;
  });
}

test('the scene carries one zone label per plan row, drawn by default', async ({ page }) => {
  await openViewer(page);

  const rows = await page.locator('#v3d-zone-list .v3d-zone-item').count();
  expect(rows).toBeGreaterThan(1);

  const found = await labels(page);
  expect(found.length, 'one label per zone row').toBe(rows);

  /* The point of the change: visible without anyone hovering anything. At
     least one must be on screen — a walk-in legitimately hides the labels on
     walls the camera is behind, so "all of them" would be the wrong assertion
     and would fail on exactly the layout this matters most for. */
  expect(found.some((l) => l.visible), 'no zone label is drawn at rest').toBe(true);
  expect(found.every((l) => l.hasNormal), 'a label with no facing cannot be culled').toBe(true);
});

test('a zone label names the shelf and the job, not just the shelf', async ({ page }) => {
  await openViewer(page);

  /* The sidebar is the reference: whatever it calls zone 1, the drawing has to
     agree. Reading the sprite's text means reading what was drawn into its
     canvas texture, so the label records its own source text instead. */
  const first = await page.locator('#v3d-zone-list .v3d-zone-item h4').first().textContent();
  // Zone strings arrive in two shapes — "Name: detail" from the model and
  // "Name · detail · detail" from the demo scenarios. The name is the head of
  // either, and the name is what has to reach the drawing.
  const zoneHead = first.split(/[:·]/)[0].trim();
  expect(zoneHead.length).toBeGreaterThan(2);

  const texts = await page.evaluate(() => {
    const out = [];
    window.__v3dView.scene.traverse((n) => {
      if (n.userData && n.userData.isZoneLabel) out.push(n.userData.labelText || '');
    });
    return out;
  });
  expect(texts.some((t) => t.includes(zoneHead)),
    `no label mentions the zone "${zoneHead}" — labels were: ${texts.join(' | ')}`).toBe(true);
});

test('the toggle turns every label off and back on, and survives a rebuild', async ({ page }) => {
  await openViewer(page);
  const box = page.locator('#v3d-show-labels');
  await expect(box).toBeChecked();

  await box.uncheck();
  await page.waitForTimeout(200);
  expect((await labels(page)).every((l) => !l.visible), 'a label survived the switch').toBe(true);

  /* A rebuild throws the scene away and builds a new one whose labels default
     to on. The user's choice has to be re-applied to the new scene rather than
     living inside the old one. */
  await page.evaluate(() => {
    const input = document.getElementById('v3d-shelf-count');
    input.value = String(Math.max(2, Number(input.value) - 1));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1400);
  expect((await labels(page)).every((l) => !l.visible),
    'the rebuilt scene ignored the switch and turned the labels back on').toBe(true);

  await box.check();
  await page.waitForTimeout(200);
  expect((await labels(page)).some((l) => l.visible), 'switching back on drew nothing').toBe(true);
});

test('hovering a zone row no longer decides whether its label exists', async ({ page }) => {
  await openViewer(page);

  const before = await labels(page);
  /* Without this the test is vacuous against the old behaviour: when every
     label starts hidden, "nothing changed" is trivially true whatever hover
     does. The comparison below only means something if there was something
     visible to lose. */
  expect(before.some((l) => l.visible), 'nothing was drawn, so nothing could be lost').toBe(true);
  const row = page.locator('#v3d-zone-list .v3d-zone-item').first();
  await row.hover();
  await page.waitForTimeout(150);
  /* Moving away used to switch the label off — which, once labels are on by
     default, means hovering a row and leaving it would delete something the
     user had asked to see. */
  await page.locator('#v3d-zones-h').hover();
  await page.waitForTimeout(250);

  const after = await labels(page);
  expect(after.map((l) => l.visible)).toEqual(before.map((l) => l.visible));
});

test('the sidebar says the zones are the shelves', async ({ page }) => {
  await openViewer(page);
  const rows = await page.locator('#v3d-zone-list .v3d-zone-item').count();

  /* The count still reads the way the older test expects, but the heading now
     also names what one zone corresponds to — the same noun the controls above
     use for the same rows. */
  const heading = await page.locator('#v3d-zones-h').textContent();
  expect(heading).toContain(`${rows} zones`);
  expect(heading).toMatch(/one per (shelf|drawer|zone|level|bay|rod)/i);

  /* The sidebar names one row ("one per shelf"); the controls count them
     ("Number of shelves"). They differ by a plural, and shelf/shelves is
     irregular, so this singularises the controls' noun by the same rule the
     app itself uses (singularLevel: ves -> f, else drop the s) and requires
     the two to land on the same word. A prefix or substring check would pass
     on "shel" and prove nothing. */
  const controls = await page.locator('#v3d-shelf-count-label').textContent();
  const headingNoun = heading.match(/one per (\w+)/i)[1].toLowerCase();
  const controlsPlural = controls.toLowerCase().match(/number of (\w+)/)[1];
  const singular = /ves$/.test(controlsPlural)
    ? controlsPlural.replace(/ves$/, 'f')
    : controlsPlural.replace(/s$/, '');
  expect(singular, 'the controls and the sidebar use different words for one thing')
    .toBe(headingNoun);
});
