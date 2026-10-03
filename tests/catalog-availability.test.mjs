import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rankProducts, reconcileSelection, loadCatalog, catalogFailed, catalogProducts, priceAsOf, fmtChecked } from '../js/catalog.js';
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
  const fresh = reconcileSelection(saved, need, [bin({ name: 'New name', price_usd: 11, url: 'https://www.target.com/p/new', retailer: 'Walmart', checked: '2026-10-01' })]);
  assert.equal(fresh.name, 'New name');
  assert.equal(fresh.price_usd, 11);
  assert.equal(fresh.url, 'https://www.target.com/p/new');
  assert.equal(fresh.retailer, 'Walmart');
  assert.equal(fresh.checkedOn, '2026-10-01');
  assert.deepEqual(fresh.dims_in, { w: 10, h: 6, d: 10 });
  assert.equal(fresh.unavailable, undefined);
  assert.equal(fresh.qty, 2, 'the quantity is the user\'s');
  assert.equal(fresh.checked, true, 'the include checkbox is the user\'s too');

  // The fit is re-judged from the catalog's dimensions, not kept from the
  // save: the saved 9-inch bin "fits", the catalog's 10-inch one does not.
  const tight = reconcileSelection(saved, { type: 'clear-bin', maxDims: { w_in: 12, h_in: 8, d_in: 9.5 } }, [bin()]);
  assert.equal(tight.fit, 'no-fit');

  const gone = reconcileSelection(saved, need, [bin({ available: false })]);
  assert.equal(gone.productId, null);
  assert.equal(gone.unavailable, true);
  assert.equal(gone.formerName, 'Old name', 'the card can still say what it used to suggest');
  assert.equal(gone.formerProductId, 'here', 'the id is kept so a product that comes back is found again');
  assert.equal(gone.name, 'Clear bin', 'the summary list and the export name the type, not a product nobody can buy');
  assert.equal(gone.retailer, null);
  assert.equal(gone.price_usd, null, 'a product nobody can buy adds nothing to the total');
  assert.equal(gone.url, null);
  assert.equal(gone.checked, true);

  const missing = reconcileSelection(saved, need, []);
  assert.equal(missing.unavailable, true, 'a product that left the catalog is treated the same way');

  // The flagged row is what gets saved. Opened again while the product is
  // still gone it keeps its notice; opened after the product is back on sale
  // it is the product again, not "no longer sold" forever.
  const stillGone = reconcileSelection(gone, need, [bin({ available: false })]);
  assert.equal(stillGone.unavailable, true);
  assert.equal(stillGone.formerName, 'Old name');
  assert.equal(stillGone.name, 'Clear bin');
  const back = reconcileSelection(gone, need, [bin({ name: 'Back again', price_usd: 12 })]);
  assert.equal(back.productId, 'here');
  assert.equal(back.name, 'Back again');
  assert.equal(back.price_usd, 12);
  assert.equal(back.unavailable, undefined);
  assert.equal(back.formerProductId, undefined);
  assert.equal(back.formerName, undefined);

  // A row that never had a product has nothing to lose.
  const never = reconcileSelection({ ...saved, productId: null, name: 'Clear bin', price_usd: null, url: null }, need, []);
  assert.equal(never.unavailable, undefined);
  assert.equal(never.name, 'Clear bin');
});

test('the check date reads as a date, and the as-of month as a month', () => {
  assert.equal(fmtChecked('2026-07'), 'Jul 2026');
  assert.equal(fmtChecked('2026-10-03'), 'Oct 3, 2026');
  assert.equal(fmtChecked('2026-12-31'), 'Dec 31, 2026');
  assert.equal(fmtChecked(''), '');
  assert.equal(fmtChecked(null), '');
  assert.equal(fmtChecked('soon'), 'soon', 'junk comes back as it was rather than as "Invalid Date"');
});

/* CI runs in UTC, where a month label built from a local-time Date happens
   to be right. A reader west of Greenwich is the case: without the explicit
   UTC in fmtChecked, "2026-07" rendered "Jun 2026" there. The suite cannot
   change its own time zone, so a child process runs the function in one. */
test('the check date reads the same in every time zone', () => {
  const mod = new URL('../js/catalog.js', import.meta.url).href;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { fmtChecked } from ${JSON.stringify(mod)}; console.log(fmtChecked('2026-07'), '|', fmtChecked('2026-12-31'));`],
  { env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8' }).trim();
  assert.equal(out, 'Jul 2026 | Dec 31, 2026');
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
      // The newest check of all is the one that found a product gone; it
      // confirms nothing about the prices still on offer.
      json: async () => ({ version: 1, priceAsOf: '2026-07', products: [bin({ checked: '2026-07' }), bin({ id: 'b', checked: '2026-09-15' }), bin({ id: 'gone', available: false, checked: '2026-10-03' })] }),
    });
    const again = await loadCatalog();
    assert.equal(catalogFailed(), false, 'a failed load was cached as if it had succeeded');
    assert.equal(again.products.length, 3);
    assert.equal(catalogProducts().length, 3);
    assert.equal(priceAsOf(), '2026-09', 'the as-of date is the newest check among products still sold, as a month');
  } finally {
    globalThis.fetch = realFetch;
  }
});
