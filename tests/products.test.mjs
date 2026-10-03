import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AREAS, ROOMS, SETUP_TYPES } from '../js/wizard-data.js';
import { getDemoScenario } from '../js/demo-scenarios.js';
import { hasProductArt, productArt } from '../js/product-art.js';

// The product library page is an index of the same catalog the planner draws
// from, grouped by space. It has no product data of its own: the catalog
// supplies the items, and each space's own plan supplies the categories. These
// tests pin that, so the page can't quietly drift into a second source of
// truth — a hand-maintained shop page that disagrees with the plans.

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../js/screens/products.js', import.meta.url), 'utf8');

const AREA_IDS = ROOMS.flatMap(r => (AREAS[r.id] || []).map(a => a.id));
const KID_HOUSEHOLD = { kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: 'yes' } };
const typesFor = id => new Set((getDemoScenario(id, null, KID_HOUSEHOLD).productNeeds || []).map(n => n.type));

test('the page carries no product data of its own', () => {
  assert.match(js, /loadCatalog/, 'products page no longer reads the shared catalog');
  assert.match(js, /getDemoScenario/, 'product categories are no longer derived from the plans');
  assert.ok(!/https?:\/\/(www\.)?(amazon|target|walmart|containerstore|ikea)/i.test(js),
    'a retailer URL is hardcoded on the products page; links must come from the catalog');
  assert.ok(!/price_usd\s*[:=]\s*\d/.test(js), 'a price is hardcoded on the products page');
});

test('every product in the catalog has a space that asks for it', () => {
  const asked = new Set(AREA_IDS.flatMap(id => [...typesFor(id)]));
  const orphans = [...new Set(catalog.products.map(p => p.type))].filter(t => !asked.has(t));
  assert.deepEqual(orphans, [], `catalog types no space asks for: ${orphans.join(', ')}`);
});

// Cards need a visual whether or not a retailer photo exists — and none does
// yet, since displaying retailer photography needs an image API or a hotlink.
test('every catalog category has an illustration to fall back on', () => {
  const missing = [...new Set(catalog.products.map(p => p.type))].filter(t => !hasProductArt(t));
  assert.deepEqual(missing, [], `categories with no drawing: ${missing.join(', ')}`);
  for (const type of new Set(catalog.products.map(p => p.type))) {
    assert.match(productArt(type), /^<svg[\s\S]*<\/svg>$/, `${type}: art is not an svg`);
  }
});

test('a real product photo takes over when the catalog has one', () => {
  assert.match(js, /if\(!p\.img\)/, 'product cards no longer prefer a real photo over the drawing');
  assert.match(js, /onerror=[^>]*has-photo/, 'a broken photo no longer falls back to the drawing');
});

/* A plan that links to a listing nobody can buy from loses the reader's trust
   in every other suggestion. Each product says when it was last looked at and
   whether it was still sold; the matcher skips the ones that were not. */
test('every product records when it was last checked and whether it is still sold', () => {
  for (const p of catalog.products) {
    assert.match(String(p.checked), /^\d{4}-\d{2}(-\d{2})?$/, `${p.id}: no checked date`);
    assert.equal(typeof p.available, 'boolean', `${p.id}: no available flag`);
    assert.ok('img' in p, `${p.id}: no img field (null until a licensed photo exists)`);
    if (p.img != null) assert.match(p.img, /^https:\/\//, `${p.id}: img is not an https URL`);
  }
});

test('the plan draws the product category, hides nothing behind a generic glyph, and escapes catalog URLs', () => {
  const results = readFileSync(new URL('../js/screens/results.js', import.meta.url), 'utf8');
  assert.match(results, /productArt\(need\.type\)/, 'the shopping card no longer draws the category');
  assert.ok(!/SVG\[TYPE_ICON/.test(results), 'the generic type glyph is back on the shopping card');
  assert.match(results, /src="\$\{escapeHtml\(sel\.img\)\}"/, 'the product image URL is interpolated unescaped');
  assert.match(results, /href="\$\{escapeHtml\(withAffiliate\(sel\.url/, 'the product URL is interpolated unescaped');
  // The branch itself, not the name: a comment two lines up mentions the call too.
  assert.match(results, /if\s*\(catalogFailed\(\)\)\s*\{\s*showUpgradesFailed\(\);\s*return;/, 'a catalog that fails to load no longer reaches the failed state');
  // Two guards in renderUpgrades: a failed load keeps the failed state, and a
  // load still in flight leaves the skeleton (tests/e2e/product-unavailable.spec.mjs drives both).
  assert.match(results, /if\s*\(catalogFailed\(\)\)\s*\{\s*showUpgradesFailed\(\);\s*renderShopping\(\);\s*return;/,
    'a re-render after a failed load (say, "Remove all upgrades") builds rows the catalog never confirmed');
  assert.match(results, /if\s*\(!Array\.isArray\(state\.shopping\)\)\s*\{\s*renderShopping\(\);\s*return;/,
    'a re-render before the catalog has loaded reads state.shopping[i] off null');
});

test('the library hides products that are no longer sold, in the list and in the category chips', () => {
  assert.match(js, /catalog\.products\.filter\(p => p\.type === n\.type && p\.available !== false\)/, 'areaBlock lists products that are no longer sold');
  assert.match(js, /catalog\.products\.filter\(p => p\.available !== false\)\.map\(p => p\.type\)/, 'the type chips offer a category whose only products are gone');
});

test('every space that asks for a category has products to show for it', () => {
  const stocked = new Set(catalog.products.filter(p => p.available !== false).map(p => p.type));
  const gaps = [];
  for (const id of AREA_IDS) {
    for (const type of typesFor(id)) if (!stocked.has(type)) gaps.push(`${id}:${type}`);
  }
  assert.deepEqual(gaps, [], `spaces asking for categories the catalog can't fill: ${gaps.join(', ')}`);
});

test('every area names the setups it covers, so the page can group by setup', () => {
  for (const id of AREA_IDS) {
    assert.ok((SETUP_TYPES[id] || []).length > 0, `area has no setup types: ${id}`);
  }
});

test('the screen and its slots exist, and the site chrome covers it', () => {
  for (const slot of ['id="screen-products"', 'id="prod-room-filter"', 'id="prod-type-filter"', 'id="prod-groups"']) {
    assert.ok(html.includes(slot), `products screen slot missing: ${slot}`);
  }
  const router = readFileSync(new URL('../js/router.js', import.meta.url), 'utf8');
  assert.match(router, /SITE_SCREENS\s*=\s*new Set\(\['landing','products'\]\)/,
    'the products screen no longer counts as a site page (it would lose the marketing nav)');
  const base = readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');
  assert.match(base, /body\[data-site="1"\]\s*\.site-nav\{display:flex\}/, 'site nav is no longer driven by data-site');
});

test('purchases stay optional: the page says so and offers the $0 route', () => {
  const page = html.slice(html.indexOf('id="screen-products"'), html.indexOf('id="screen-space"'));
  assert.match(page, /\$0/, 'the products page no longer mentions the $0 plan');
  assert.ok(page.includes("go('space')"), 'the products page no longer offers to plan the space');
});
