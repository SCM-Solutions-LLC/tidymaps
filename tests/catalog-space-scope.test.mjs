import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rankProducts, reconcileSelection, searchLinks, inSpace, FOOD_SPACES } from '../js/catalog.js';
import { state } from '../js/state.js';

/* #2: "Script Pantry Labels for Food Containers" showed up in closet plans.
   A label-set need is generic ("label the bins"), and the cheapest label set
   in the catalog won it in any space. Both label sets are preprinted food
   labels, so they carry `spaces: ["pantry", "cabinet"]`, the two spaces that
   hold food, and the matcher honours it. */

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const need = { type: 'label-set', maxDims: null };

test('the food label sets are offered where food is kept and nowhere else', () => {
  state.dims = null;
  for (const space of ['pantry', 'cabinet']) {
    const offered = rankProducts(catalog.products, need, space).map((r) => r.product.id);
    assert.ok(offered.includes('talented-kitchen-157-pantry-labels'), `${space} plan offered ${offered}`);
  }
  for (const space of ['closet', 'dresser', 'linen', 'bathroom', 'garage', 'workbench', 'drawers', 'fridge']) {
    const offered = rankProducts(catalog.products, need, space).map((r) => r.product.name);
    assert.deepEqual(offered.filter((n) => /pantry|food/i.test(n)), [], `${space} plan offered ${offered}`);
  }
});

test('every label set is scoped to exactly the food spaces the search uses', () => {
  const labelSets = catalog.products.filter((p) => p.type === 'label-set');
  assert.ok(labelSets.length > 0);
  for (const p of labelSets) assert.deepEqual(p.spaces, FOOD_SPACES, p.id);
});

test('a product with no spaces list is still offered everywhere', () => {
  assert.equal(inSpace({ type: 'clear-bin' }, 'closet'), true);
  const bins = rankProducts(catalog.products, { type: 'clear-bin', maxDims: null }, 'closet');
  assert.ok(bins.length > 0);
});

test('a closet plan saved with the pantry labels drops them to the bare type, not "no longer sold"', () => {
  const saved = {
    needIdx: 0, checked: true, qty: 1, type: 'label-set',
    productId: 'talented-kitchen-157-pantry-labels',
    name: 'Talented Kitchen 157 Script Pantry Labels for Food Containers, Black on Clear',
    price_usd: 9.99, url: 'https://www.amazon.com/x', retailer: 'Amazon', img: null,
  };
  const row = reconcileSelection(saved, need, catalog.products, 'closet');
  assert.equal(row.productId, null);
  assert.equal(row.name, 'Label set');
  assert.equal(row.price_usd, null);
  assert.equal(row.unavailable, undefined, 'it is still sold, so it must not read as unavailable');
  assert.equal(row.qty, 1);
  // Unchanged in a pantry.
  assert.equal(reconcileSelection(saved, need, catalog.products, 'pantry').productId, 'talented-kitchen-157-pantry-labels');
});

test('the fallback search outside a food space does not ask for pantry labels', () => {
  state.dims = null;
  state.space = 'closet';
  assert.doesNotMatch(decodeURIComponent(searchLinks(need)[0].url), /pantry/i);
  for (const space of FOOD_SPACES) {
    state.space = space;
    assert.match(decodeURIComponent(searchLinks(need)[0].url), /pantry label set/, space);
  }
});

/* The fridge bins are named for the fridge ("Refrigerator and Freezer
   Storage Bin"), so they belong to fridge plans the way the pantry labels
   belong to pantry plans: a closet handed one would read like the #2 bug. */
test('the fridge bins are offered in a fridge plan and nowhere else', () => {
  state.dims = null;
  const binNeed = { type: 'clear-bin', maxDims: { w_in: 10, h_in: 6, d_in: 16 } };
  const id = 'idesign-fridge-freezer-bin-14x8x4-2pk';
  const offered = (space) => rankProducts(catalog.products, binNeed, space).map((r) => r.product.id);
  assert.ok(offered('fridge').includes(id), `fridge plan offered ${offered('fridge')}`);
  for (const space of ['pantry', 'cabinet', 'closet', 'garage', 'linen', 'bathroom']) {
    assert.ok(!offered(space).includes(id), `${space} plan was offered the fridge bins`);
  }
});

test('the fallback search in a fridge asks for fridge things, and date labels', () => {
  state.dims = null;
  state.space = 'fridge';
  const query = (type) => decodeURIComponent(searchLinks({ type, maxDims: null })[0].url);
  assert.match(query('label-set'), /freezer date labels/);
  assert.doesNotMatch(query('label-set'), /pantry|storage bin label/);
  assert.match(query('clear-bin'), /fridge/);
  assert.doesNotMatch(query('clear-bin'), /pantry/);
  assert.match(query('turntable'), /fridge/);
  // A type the fridge has no wording for keeps the general one.
  assert.match(query('basket'), /storage basket bin/);
  state.space = 'pantry';
});
