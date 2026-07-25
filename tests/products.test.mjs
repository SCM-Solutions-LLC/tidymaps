import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AREAS, ROOMS, SETUP_TYPES } from '../js/wizard-data.js';
import { getDemoScenario } from '../js/demo-scenarios.js';

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

test('every space that asks for a category has products to show for it', () => {
  const stocked = new Set(catalog.products.map(p => p.type));
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
