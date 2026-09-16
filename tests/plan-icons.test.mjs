import test from 'node:test';
import assert from 'node:assert/strict';
import { SVG, iconKey, iconFor, ICON_FALLBACK_KEY } from '../js/icons.js';
import { normalizeAi } from '../js/plan.js';
import { MAP, EXISTING } from '../js/data.js';

/* Stored XSS through the plan's icon fields.

   iconFor() used to pass any string that began with "<svg" straight through,
   so a normalized plan (which held the resolved SVG in map[].ic and
   existing[].ico) kept its icons on a second pass. The report innerHTML'd
   both fields raw. A spaces row is its owner's to write, the share payload
   carries both fields verbatim, so `<svg onload=...>` in your own row ran in
   every visitor's browser.

   The fix makes the icon a KEY into the SVG table and the sink a table
   lookup: iconFor can only ever return one of this app's own strings. These
   tests pin the resolver; the browser half is in
   tests/e2e/shared-plan-view.spec.mjs. */

const HOSTILE = '<svg><image href="x" onerror="window.__xss=1"/></svg>';
const ours = new Set(Object.values(SVG));

test('markup that is not one of our own icons never comes back out', () => {
  for (const input of [HOSTILE, ' <svg><script>1</script></svg>', '<SVG onload=x>', '<svg viewBox="0 0 24 24"></svg>']) {
    const out = iconFor(input);
    assert.ok(ours.has(out), `iconFor passed foreign markup through: ${input}`);
    assert.doesNotMatch(out, /onerror|onload|script/i);
  }
});

test('normalizeAi stores a table key, and the key renders as one of our icons', () => {
  const out = normalizeAi({
    map: [{ level: 'Top', ic: HOSTILE, zone: 'z', why: 'w', shelfIndex: 0 }],
    existing: [{ ico: HOSTILE, ft: 'Bins', fd: 'Reuse them' }],
    geometry: { unit: 'in', width: 36, height: 72, depth: 16, shelfCount: 1, shelfYFracs: [0.1], estimated: false },
  });
  for (const [field, value] of [['map[].ic', out.map[0].ic], ['existing[].ico', out.existing[0].ico]]) {
    assert.ok(Object.prototype.hasOwnProperty.call(SVG, value), `${field} is not a key into the icon table: ${JSON.stringify(value)}`);
    assert.ok(ours.has(iconFor(value)), `${field} did not render as one of our icons`);
  }
});

test('a row saved with the resolved SVG keeps its icon, by exact match only', () => {
  // Rows written before the key contract hold the markup itself.
  assert.equal(iconKey(SVG.arrowUp), 'arrowUp');
  assert.equal(iconFor(SVG.arrowUp), SVG.arrowUp);
  // One byte off is not ours.
  assert.equal(iconKey(SVG.arrowUp.replace('<svg', '<svg onload="1"')), ICON_FALLBACK_KEY);
});

test('normalizeAi is idempotent on icons, so a share link renders what the owner saw', () => {
  const raw = {
    map: [{ level: 'Top', icon: 'up', zone: 'z', why: 'w', shelfIndex: 0 }, { level: 'Mid', icon: 'eye', zone: 'z', why: 'w', shelfIndex: 1 }],
    existing: [{ icon: 'basket', title: 'Baskets', detail: 'Two' }],
    geometry: { unit: 'in', width: 36, height: 72, depth: 16, shelfCount: 2, shelfYFracs: [0.1, 0.6], estimated: false },
  };
  const once = normalizeAi(raw);
  const twice = normalizeAi(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice.map.map((m) => m.ic), once.map.map((m) => m.ic));
  assert.deepEqual(twice.existing.map((e) => e.ico), once.existing.map((e) => e.ico));
  assert.equal(once.map[0].ic, 'arrowUp');
  assert.equal(once.map[1].ic, 'eye');
  assert.equal(once.existing[0].ico, 'shoppingBag');
});

test('every keyword the prompt names resolves to a real icon', () => {
  // supabase/functions/analyze-space/index.ts: map.icon list.
  const prompt = ['up', 'eye', 'middle', 'down', 'door', 'hook', 'rod', 'drawer'];
  for (const k of prompt) {
    assert.ok(Object.prototype.hasOwnProperty.call(SVG, iconKey(k)), `prompt keyword "${k}" has no icon`);
  }
  // Case and stray punctuation are the model's, not ours.
  assert.equal(iconKey('UP'), iconKey('up'));
  assert.equal(iconKey(' rod. '), iconKey('rod'));
});

test('a keyword that names an Object prototype member is just unknown', () => {
  for (const k of ['constructor', '__proto__', 'hasOwnProperty', 'toString']) {
    assert.equal(iconKey(k), ICON_FALLBACK_KEY, k);
    assert.equal(typeof iconFor(k), 'string');
    assert.ok(ours.has(iconFor(k)), k);
  }
  assert.equal(iconKey(undefined), ICON_FALLBACK_KEY);
  assert.equal(iconKey(null), ICON_FALLBACK_KEY);
  assert.equal(iconKey(''), ICON_FALLBACK_KEY);
});

test("the app's own sample plan follows the key contract", () => {
  for (const [name, rows, field] of [['MAP', MAP, 'ic'], ['EXISTING', EXISTING, 'ico']]) {
    for (const row of rows) {
      assert.equal(iconKey(row[field]), row[field], `${name} row "${row.lv || row.ft}" holds ${JSON.stringify(row[field]).slice(0, 40)}, not a key`);
    }
  }
});
