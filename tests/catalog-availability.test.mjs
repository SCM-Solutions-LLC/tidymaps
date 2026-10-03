import test from 'node:test';
import assert from 'node:assert/strict';
import { rankProducts, reconcileSelection, loadCatalog, catalogFailed, catalogProducts, priceAsOf } from '../js/catalog.js';
import { state } from '../js/state.js';

/* The catalog is a hand-curated file, and a product in it can stop being sold
   without the file changing. The owner picked the Copco 9" turntable from a
   plan on 2026-10-03 and found Amazon listing it as unavailable; the link
   checker had reported that page "ok 200" the same day. So every product now
   carries `available` and `checked`, the matcher never offers one marked
   unavailable, and a saved plan that still points at one says so instead of
   linking to a dead listing. */

const bin = (over = {}) => ({
  id: 'here', type: 'clear-bin', name: 'A bin', brand: 'Acme',
  dims_in: { w: 10, h: 6, d: 10 }, price_usd: 10,
  retailer: 'Target', url: 'https://www.target.com/p/a', tags: [],
  img: null, checked: '2026-07', available: true,
  ...over,
});

test('a product marked unavailable is never offered, however cheap or well it fits', () => {
  state.dims = null;
  state.setup = 'cabinet';
  const need = { type: 'clear-bin', maxDims: { w_in: 12, h_in: 8, d_in: 14 } };
  const ranked = rankProducts([bin({ id: 'gone', available: false, price_usd: 1 }), bin()], need);
  assert.deepEqual(ranked.map(r => r.product.id), ['here']);
});

test('a saved selection follows the catalog: refreshed while the product is sold, flagged once it is not', () => {
  const need = { type: 'clear-bin', maxDims: null };
  const saved = {
    needIdx: 0, checked: true, qty: 2, type: 'clear-bin', productId: 'here',
    name: 'Old name', price_usd: 9, url: 'https://old', retailer: 'Target', img: null,
    fit: 'fits', dims_in: { w: 9, h: 6, d: 9 },
  };
  const fresh = reconcileSelection(saved, need, [bin({ name: 'New name', price_usd: 11, url: 'https://www.target.com/p/new', checked: '2026-10-01' })]);
  assert.equal(fresh.name, 'New name');
  assert.equal(fresh.price_usd, 11);
  assert.equal(fresh.url, 'https://www.target.com/p/new');
  assert.equal(fresh.checkedOn, '2026-10-01');
  assert.deepEqual(fresh.dims_in, { w: 10, h: 6, d: 10 });
  assert.equal(fresh.unavailable, undefined);
  assert.equal(fresh.qty, 2, 'the quantity is the user\'s');
  assert.equal(fresh.checked, true, 'the include checkbox is the user\'s too');

  const gone = reconcileSelection(saved, need, [bin({ available: false })]);
  assert.equal(gone.productId, null);
  assert.equal(gone.unavailable, true);
  assert.equal(gone.formerName, 'Old name', 'the card can still say what it used to suggest');
  assert.equal(gone.price_usd, null, 'a product nobody can buy adds nothing to the total');
  assert.equal(gone.url, null);
  assert.equal(gone.checked, true);

  const missing = reconcileSelection(saved, need, []);
  assert.equal(missing.unavailable, true, 'a product that left the catalog is treated the same way');
});

test('a catalog that fails to load says so, and is fetched again next time', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  try {
    const cat = await loadCatalog();
    assert.equal(catalogFailed(), true, 'the failure is not reported');
    assert.deepEqual(cat.products, []);

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ version: 1, priceAsOf: '2026-07', products: [bin({ checked: '2026-09' }), bin({ id: 'b', checked: '2026-10-02' })] }),
    });
    const again = await loadCatalog();
    assert.equal(catalogFailed(), false, 'a failed load was cached as if it had succeeded');
    assert.equal(again.products.length, 2);
    assert.equal(catalogProducts().length, 2);
    assert.equal(priceAsOf(), '2026-10', 'the as-of date is the newest per-product check, as a month');
  } finally {
    globalThis.fetch = realFetch;
  }
});
