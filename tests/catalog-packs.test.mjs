import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { packsFor, lineCost, packNote, rankProducts, reconcileSelection } from '../js/catalog.js';
import { state } from '../js/state.js';

/* A listing can hold more than one of what a need counts. The sample fridge
   plan asks for 3 freezer bins and picks iDesign's set of 2 at $26.99; the
   card, the list and the export all priced that as 3 sets ($81) and told the
   reader to buy 3, when 2 sets ($54) cover it with one bin spare. */

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const FRIDGE_SET = 'idesign-fridge-freezer-bin-14x8x4-2pk';

/* The pack size lives in the listing's name before it lives in `pack`, so a
   multipack added without one would price as singles again. A label set is
   exempt: its need counts sets, and "Pack of 24" is 24 labels in one set. */
test('every multipack in the catalog says how many come in one purchase', () => {
  const COUNT = /(\d+)[\s-]*Pack\b|Set of (\d+)|(\d+) Locks\b/i;
  const named = catalog.products.filter((p) => p.type !== 'label-set' && COUNT.test(p.name));
  assert.ok(named.length >= 5, `found only ${named.map((p) => p.id)}`);
  for (const p of named) {
    const m = p.name.match(COUNT);
    assert.equal(p.pack, Number(m[1] || m[2] || m[3]), `${p.id}: name says ${m[0]}, pack is ${p.pack}`);
  }
  for (const p of catalog.products) {
    if ('pack' in p) assert.ok(Number.isInteger(p.pack) && p.pack > 1, `${p.id}: pack ${p.pack} is not a count above 1`);
  }
});

test('a need is bought in whole packs, and a row costs the pack price per pack', () => {
  assert.equal(packsFor(3, 2), 2);
  assert.equal(packsFor(2, 2), 1);
  assert.equal(packsFor(4, 2), 2);
  assert.equal(packsFor(3, 8), 1);
  assert.equal(packsFor(3, undefined), 3, 'a listing with no pack is a single');
  assert.equal(packsFor(0, 2), 1, 'a row always buys something');

  assert.equal(lineCost({ price_usd: 26.99, qty: 3, pack: 2 }), 26.99 * 2);
  assert.equal(lineCost({ price_usd: 12.98, qty: 2 }), 12.98 * 2);
  assert.equal(lineCost({ price_usd: null, qty: 3, pack: 2 }), null, 'no product is no price, not $0');

  assert.equal(packNote({ qty: 3, pack: 2 }), '2 packs of 2, 1 spare');
  assert.equal(packNote({ qty: 2, pack: 2 }), '1 pack of 2');
  assert.equal(packNote({ qty: 1, pack: 8 }), '1 pack of 8, 7 spare');
  assert.equal(packNote({ qty: 3 }), '', 'a single says nothing');
});

/* A saved plan stores its selection, and plans saved before `pack` existed
   have none. reconcileSelection re-reads the product on every load, so the
   pack has to come from the catalog there, and go when the product does. */
test('a selection takes its pack from the catalog, and drops it with the product', () => {
  state.space = 'fridge';
  const need = { type: 'clear-bin', qty: 3, maxDims: null };
  const saved = { needIdx: 0, checked: true, qty: 3, type: 'clear-bin', productId: FRIDGE_SET, name: 'old', price_usd: 26.99 };
  const fresh = reconcileSelection(saved, need, catalog.products);
  assert.equal(fresh.pack, 2);
  assert.equal(lineCost(fresh), 26.99 * 2);

  const gone = reconcileSelection(saved, need, catalog.products.map((p) => p.id === FRIDGE_SET ? { ...p, available: false } : p));
  assert.equal(gone.pack, 1);
  assert.equal(lineCost(gone), null);
  const elsewhere = reconcileSelection(saved, need, catalog.products, 'closet');
  assert.equal(elsewhere.pack, 1, 'out of its space, the row is the bare type');
  state.space = 'pantry';
});

/* The export is the list people shop from, so its count is what to put in
   the cart and its total is what they will pay. */
test('the exported list buys the sample fridge\'s freezer bins as 2 sets', async () => {
  const { normalizeAi, activeProductNeeds } = await import('../js/plan.js');
  const { getDemoScenario } = await import('../js/demo-scenarios.js');
  const { shoppingListText } = await import('../js/planExport.js');
  const NO_KIDS = { kids: { present: 'no', ages: [] }, pets: { present: null, types: [] }, mobility: [], notes: '' };
  state.space = 'fridge';
  state.setup = 'frenchdoor';
  state.dims = null;
  state.ai = normalizeAi(getDemoScenario('fridge', 'frenchdoor', NO_KIDS));
  const needs = activeProductNeeds();
  const i = needs.findIndex((n) => n.type === 'clear-bin' && n.qty === 3);
  assert.ok(i >= 0, 'the sample fridge no longer asks for 3 bins');
  assert.equal(rankProducts(catalog.products, needs[i]).filter((m) => m.fit !== 'no-fit')[0].product.id, FRIDGE_SET,
    'the sample fridge no longer picks the set of 2 for its freezer bins');

  state.shopping = needs.map((n, k) => k === i
    ? reconcileSelection({ needIdx: k, checked: true, qty: n.qty, productId: FRIDGE_SET }, n, catalog.products)
    : { needIdx: k, checked: false, qty: n.qty, type: n.type, productId: null });
  const txt = shoppingListText();
  assert.match(txt, /^2 x iDesign Plastic Refrigerator and Freezer Storage Bin, Set of 2, [^\n]*\(\$26\.99 each\)\n {4}2 packs of 2, 1 spare$/m);
  assert.match(txt, /Estimated total: \$53\.98/);
  state.shopping = null;
  state.ai = null;
  state.space = 'pantry';
});
