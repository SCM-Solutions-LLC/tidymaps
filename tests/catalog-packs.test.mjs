import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { packsFor, lineCost, reconcileSelection } from '../js/catalog.js';
import { state } from '../js/state.js';

/* A need's qty counts organizers; five products are sold as a set. The list
   multiplied a set's price by the qty, so every fridge plan's three bins came
   to three "Set of 2" listings, $80.97 for six bins, where two sets ($53.98)
   cover them. */

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));

test('every set in the catalog says how many it holds, and nothing else claims to', () => {
  /* Read off the listing's own name. A label set is bought as one set
     whatever it holds, so its "Pack of 24" is not a count of the need. */
  const SET = /\b(\d+)[- ]Pack\b|\bSet of (\d+)\b|\b(\d+) Locks\b/i;
  for (const p of catalog.products) {
    const m = p.type === 'label-set' ? null : p.name.match(SET);
    const n = m ? Number(m[1] || m[2] || m[3]) : 1;
    assert.equal(p.pack || 1, n, `${p.id}: "${p.name}" holds ${n}, the catalog says ${p.pack || 1}`);
  }
});

test('a set is bought once for the organizers it covers', () => {
  assert.equal(packsFor({ qty: 2, pack: 2 }), 1);
  assert.equal(packsFor({ qty: 3, pack: 2 }), 2);
  assert.equal(packsFor({ qty: 1, pack: 8 }), 1);
  assert.equal(packsFor({ qty: 3 }), 3, 'a single product is bought one per organizer');
  assert.equal(lineCost({ qty: 3, pack: 2, price_usd: 26.99 }), 53.98);
  assert.equal(lineCost({ qty: 2, price_usd: 12.98 }), 25.96);
  assert.equal(lineCost({ qty: 2, pack: 2, price_usd: null }), null, 'no price is not a price of $0');
});

test('a saved selection takes its set size from the catalog', () => {
  /* Saved before `pack` existed: the reload has to read it, or a returning
     fridge plan keeps the old total. */
  state.space = 'fridge';
  const need = { type: 'clear-bin', qty: 3, maxDims: null };
  const saved = { needIdx: 0, checked: true, qty: 3, type: 'clear-bin', productId: 'idesign-fridge-freezer-bin-14x8x4-2pk',
    name: 'Old name', price_usd: 26.99, url: 'https://old', retailer: 'Target', img: null, fit: 'fits', dims_in: null };
  const fresh = reconcileSelection(saved, need, catalog.products, 'fridge');
  assert.equal(fresh.pack, 2);
  assert.equal(lineCost(fresh), 53.98);
  state.space = 'pantry';
});
