import { test, expect } from 'playwright/test';
import { PLAN as FRIDGE_1023 } from '../fixtures/fridge-1023.mjs';

/* Every unit builder drew one level per plan row, whatever the row was. The
   first real fridge plan (2026-10-23, French door, twelve rows) came out as
   twelve glass shelves in one box, its door bins and freezer baskets among
   them, and the sample pantry's "Door / side" row was a fifth board at the
   cabinet's floor. These build the real scenes and read back what they drew:
   a row's surface kind, how many shelves, and one label per row. */

async function build(page, cases) {
  return page.evaluate(async (cases) => {
    const [{ normalizeAi }, { resolveLayout }, { getDemoScenario }, { buildScene }, { state }] = await Promise.all([
      import('/js/plan.js'), import('/js/layout.js'), import('/js/demo-scenarios.js'), import('/js/three/scene.js'), import('/js/state.js'),
    ]);
    state.dims = null;
    const out = [];
    for (const c of cases) {
      /* With the setup, as the app builds a sample: the scenario is fitted to
         the setup's shape first (a reach-in pantry has no door to hang the
         pantry scenario's "Door / side" row on). */
      const raw = c.raw || getDemoScenario(c.scenario, null, { kids: { present: 'no' }, pets: { present: 'no' }, mobility: [] }, null, c.setup);
      if (c.extraRow) {
        const n = raw.map.length;
        raw.map = [...raw.map, { ...c.extraRow, shelfIndex: n }];
        raw.geometry = { ...raw.geometry, shelfCount: n + 1, shelfYFracs: undefined };
      }
      const ai = normalizeAi(raw);
      const layout = resolveLayout({ ai, setup: c.setup, setupTouched: true, scenarioKey: c.space, map: ai.map });
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;left:-2000px;top:0;width:320px;height:240px';
      document.body.appendChild(canvas);
      const view = buildScene({ geometry: ai.geometry, map: ai.map, placements: [], canvas, layout, representativeItems: false, environment: false, organizerPlan: {} });
      const labels = [];
      view.scene.traverse((node) => { if (node.userData && node.userData.isZoneLabel) labels.push(node.userData.zoneShelfIndex); });
      out.push({
        id: c.setup, layout: layout.type,
        rows: ai.map.map((row) => ({ index: row.shelfIndex, lv: row.lv, surface: row.surface })),
        surfaces: view.surfaces.map((s) => ({ index: s.index, kind: s.kind, y: Math.round(s.y * 10) / 10, hasRow: !!s.row })),
        labels,
      });
      view.dispose(); view.renderer.forceContextLoss(); canvas.remove();
    }
    return out;
  }, cases);
}

test('the 10-23 fridge is drawn as each card: three shelves, two door bins, every row in its place', async ({ page }) => {
  await page.goto('/index.html');
  const cards = ['topfreezer', 'bottomfreezer', 'sidebyside', 'frenchdoor'];
  const scenes = await build(page, cards.map((setup) => ({ setup, space: 'fridge', raw: structuredClone(FRIDGE_1023) })));
  for (const s of scenes) {
    expect(s.layout, s.id).toBe('fridge');
    const of = (lv) => s.surfaces.find((x) => x.index === s.rows.find((r) => r.lv === lv).index);
    expect(of('Left door').kind, `${s.id}: left door row`).toBe('door');
    expect(of('Right door').kind, `${s.id}: right door row`).toBe('door');
    const shelves = ['Top shelf', 'Middle shelf', 'Lower shelf'].map(of);
    expect(shelves.every((x) => x.kind === 'shelf'), `${s.id}: fresh shelves`).toBe(true);
    expect(new Set(shelves.map((x) => x.y)).size, `${s.id}: three shelves at three heights`).toBe(3);
    // Twelve rows were twelve glass shelves. Only the three shelf rows are now.
    const shelfKinds = s.surfaces.filter((x) => x.kind === 'shelf' && x.hasRow);
    expect(shelfKinds.length, `${s.id}: rows drawn as shelves`).toBeLessThanOrEqual(3 + (s.id === 'topfreezer' || s.id === 'sidebyside' ? 4 : 0));
    expect(new Set(s.surfaces.map((x) => x.index)).size, `${s.id}: one place per row`).toBe(12);
    expect(new Set(s.labels).size, `${s.id}: one label per row`).toBe(12);
  }
});

test('every setup draws each row once, labels it, and hangs a door row on a door', async ({ page }) => {
  await page.goto('/index.html');
  const cases = await page.evaluate(async () => {
    const [{ SETUP_TYPES, scenarioKeyFor }, { SETUP_ARCHETYPE }, { surfacesFor }] = await Promise.all([
      import('/js/wizard-data.js'), import('/js/layout.js'), import('/js/setupStructure.js'),
    ]);
    const out = [];
    for (const [space, setups] of Object.entries(SETUP_TYPES)) {
      for (const setup of setups) {
        const doors = surfacesFor(SETUP_ARCHETYPE[setup.id], setup.id).includes('door');
        out.push({
          setup: setup.id, space, scenario: scenarioKeyFor(space, setup.id), doors,
          /* A door rack, where the setup has a door to hang one on. */
          extraRow: doors ? {
            level: 'Door rack', icon: 'door', zone: 'Small jars', why: 'In sight.', eye: false,
            safety: { flag: null, why: null }, items: [{ name: 'Spice jars', size: 's', flags: [] }], surface: 'door',
          } : null,
        });
      }
    }
    return out;
  });
  expect(cases).toHaveLength(37);
  const scenes = await build(page, cases);
  /* Only a setup with a door can hang a row on one, and every setup with a
     door does. A reach-in pantry is drawn as shelves but stands behind a door
     (setupStructure.SETUP_SURFACES), so its door rack hangs on it; until
     10-23 it was one more board. Open shelving has no door, so nothing is
     drawn on one there, and its sample has no door row to hang. */
  const hasDoor = new Map(cases.map((c) => [c.setup, c.doors]));
  const problems = [];
  for (const s of scenes) {
    for (const row of s.rows) {
      const drawn = s.surfaces.filter((x) => x.index === row.index);
      if (drawn.length !== 1) problems.push(`${s.id}: "${row.lv}" drawn ${drawn.length} times`);
      else if (hasDoor.get(s.id) && row.surface === 'door' && drawn[0].kind !== 'door') problems.push(`${s.id}: "${row.lv}" is a door row drawn as a ${drawn[0].kind}`);
      else if (!hasDoor.get(s.id) && drawn[0].kind === 'door') problems.push(`${s.id}: "${row.lv}" drawn on a door the setup does not have`);
      if (!s.labels.includes(row.index)) problems.push(`${s.id}: "${row.lv}" has no label`);
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
