import test from 'node:test';
import assert from 'node:assert/strict';

// state.js touches localStorage inside its helpers; provide a shim.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { state, persistGuestDraft, restoreGuestDraft } = await import('../js/state.js');

/* The measure screen renders from dimsFt; dims (inches) is the plan/3D
   contract. A reload restored dims but left dimsFt at the pantry-cabinet
   defaults buildAll() seeds, so Review showed 3′ against a 12′ plan — and
   blurring any measure field wrote the stale 3′ back over the real 12′. */
test('restoring a guest draft rehydrates dimsFt to match the saved measurements', () => {
  state.space = 'garage';
  state.setup = 'utility';
  state.dims = { w_in: 144, h_in: 78, d_in: 18, shelves: null };
  state.shareView = false;
  persistGuestDraft();

  // what a fresh page load leaves behind before the draft is read
  state.dims = null;
  state.dimsFt = { w: 3, h: 6.5, d: 1.5 };

  const res = restoreGuestDraft();
  assert.ok(res && res.restored, 'draft should restore');
  assert.deepEqual(state.dims, { w_in: 144, h_in: 78, d_in: 18, shelves: null });
  assert.deepEqual(state.dimsFt, { w: 12, h: 6.5, d: 1.5 },
    'the measure UI must read the saved measurement, not the startup default');
});

test('a draft without measurements clears both dim fields', () => {
  state.dims = null;
  state.dimsFt = null;
  persistGuestDraft();
  state.dimsFt = { w: 3, h: 6.5, d: 1.5 };
  restoreGuestDraft();
  assert.equal(state.dims, null);
  assert.equal(state.dimsFt, null);
});
