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
  for (const space of ['closet', 'dresser', 'linen', 'bathroom', 'garage', 'workbench', 'drawers']) {
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
