import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* The save screen offered seven things to do with a finished plan. Three of
   them — Download checklist, Send shopping list, Schedule a session — answered
   "coming soon" for a plan already sitting complete in the browser. The first
   two needed no backend at all; the third had no service behind it and was
   removed rather than left advertising itself. */

const save = readFileSync(new URL('../js/screens/save.js', import.meta.url), 'utf8');
const data = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');

// Every label in SAVE_OPTS, in source order.
const labels = [...data.matchAll(/\[SVG\.\w+,'([^']+)'\]/g)].map((m) => m[1]);

test('every save option is handled — none of them answer "coming soon"', () => {
  assert.ok(labels.length >= 5, `expected a real option list, parsed ${labels.length}`);
  for (const label of labels) {
    assert.ok(save.includes(`'${label}'`),
      `"${label.replace('&amp;', '&')}" is offered on the save screen but nothing handles it`);
  }
});

test('the scheduling option is gone rather than promising a service that does not exist', () => {
  // The comment explaining why it left still names it, so the check is on the
  // offered list, not the file.
  assert.ok(!labels.includes('Schedule a session'));
  assert.ok(!save.includes("'Schedule a session'"), 'the save screen still handles a removed option');
});

test('the checklist and shopping list are built client-side, from the plan already in memory', () => {
  const exporter = readFileSync(new URL('../js/planExport.js', import.meta.url), 'utf8');
  for (const fn of ['checklistText', 'shoppingListText', 'downloadText', 'planFileName']) {
    assert.match(exporter, new RegExp(`export function ${fn}`), `${fn} is missing`);
  }
  // No network: these must work offline, on a plan that was never saved.
  assert.doesNotMatch(exporter, /fetch\(|supabase|callFn/);

  assert.match(save, /downloadChecklist\(\)/);
  assert.match(save, /sendShoppingList\(\)/);
  // A mailto that runs past what browsers accept arrives truncated, so long
  // lists have to take another route rather than silently losing half.
  assert.match(exporter, /MAILTO_LIMIT/);
  assert.match(exporter, /clipboard\.writeText/);
});

/* The report's shopping card offered the same two things as the save screen
   and faked both: "Save shopping list" toasted a save it never performed and
   "Send list" toasted a send. That is the defect PR #46 removed from the save
   screen, still live one screen earlier. */
test('the report shopping card does the thing its buttons claim', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const card = html.slice(html.indexOf('id="res-shopping"'), html.indexOf('</section>', html.indexOf('id="res-shopping"')));
  assert.doesNotMatch(card, /toast\('Shopping list saved'\)/);
  assert.doesNotMatch(card, /toast\('List sent'\)/);
  assert.match(card, /onclick="downloadShoppingList\(\)"/);
  assert.match(card, /onclick="sendShoppingList\(\)"/);

  // Both actions have to be reachable from an inline handler.
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /downloadShoppingList, sendShoppingList/);
});

/* ---------- the exporter runs on the NORMALIZED plan ----------
   state.ai holds normalizeAi's output: steps are {t,m,w}, map rows carry lv.
   The source-grep tests above passed for months while the produced file had
   no STEPS section and "- undefined:" on every zone, because the exporter
   read the raw names. These tests run the exporter for real. */

const { state } = await import('../js/state.js');
const { normalizeAi, activeProductNeeds } = await import('../js/plan.js');
const { getDemoScenario } = await import('../js/demo-scenarios.js');
const { checklistText, shoppingListText } = await import('../js/planExport.js');

const NO_KIDS = { kids: { present: 'no', ages: [] }, pets: { present: null, types: [] }, mobility: [], notes: '' };

test('checklistText carries every step and every zone of a normalized plan', () => {
  state.space = 'workbench';
  state.dims = null;
  state.ai = normalizeAi(getDemoScenario('workbench', 'find', NO_KIDS));
  state.stepDone = state.ai.steps.map((_, i) => i === 0);
  const txt = checklistText();
  assert.ok(!txt.includes('undefined'), `exported text contains "undefined":\n${txt}`);
  assert.match(txt, /\nSTEPS\n/, 'the STEPS section is missing');
  for (const s of state.ai.steps) assert.ok(txt.includes(s.t), `step missing from export: ${s.t}`);
  for (const m of state.ai.map) assert.ok(txt.includes(`- ${m.lv}: ${m.zone}`), `zone missing or unnamed: ${m.lv}`);
  assert.match(txt, /\[x\] 1\./, 'on-screen progress should carry into the export');
});

test('a $0 plan exports "nothing to buy" — never the demo pantry list', () => {
  state.space = 'workbench';
  state.dims = null;
  state.ai = normalizeAi(getDemoScenario('workbench', null, NO_KIDS,
    { prefs: ['Use only what I already own'], budget: '$0' }));
  state.shopping = null;
  assert.deepEqual(activeProductNeeds(), [], 'an empty productNeeds list is an answer, not missing data');
  const txt = shoppingListText();
  assert.match(txt, /Nothing to buy/);
  assert.ok(!/snack|can rack|lazy susan/i.test(txt), `pantry demo products leaked into a workbench $0 list:\n${txt}`);
});

/* A saved plan can point at a product that has since stopped being sold.
   reconcileSelection then labels the row by its type; the list people send
   themselves must not tell them to buy the thing the screen says is gone.
   The row is built by reconcileSelection itself, so the test covers the
   whole path from the saved selection to the exported line. */
test('a product nobody can buy is not on the list to buy', async () => {
  const { reconcileSelection, TYPE_LABEL } = await import('../js/catalog.js');
  state.space = 'pantry';
  state.dims = null;
  state.ai = normalizeAi(getDemoScenario('pantry', null, NO_KIDS));
  const needs = activeProductNeeds();
  assert.ok(needs.length > 1);
  const product = { id: 'old-thing', type: needs[0].type, name: 'Old thing', brand: 'Acme', dims_in: { w: 10, h: 6, d: 10 }, price_usd: 9, retailer: 'Target', url: 'https://www.target.com/p/old', tags: [], img: null, checked: '2026-10-03', available: false };
  const saved = { needIdx: 0, checked: true, qty: 1, type: needs[0].type, productId: 'old-thing', name: 'Old thing', price_usd: 9, url: product.url, retailer: 'Target', img: null, fit: 'fits', dims_in: { w: 10, h: 6, d: 10 } };
  state.shopping = needs.map((n, i) => i === 0
    ? reconcileSelection(saved, n, [product])
    : { needIdx: i, checked: false, qty: 1, type: n.type, productId: null, name: TYPE_LABEL[n.type] });
  const txt = shoppingListText();
  assert.ok(!/Old thing/.test(txt), `the retired product is still on the list:\n${txt}`);
  assert.match(txt, new RegExp(`1 x ${TYPE_LABEL[needs[0].type]}\\n {4}no product picked yet: the one we suggested is no longer sold`));
  state.shopping = null;
});

test('with no plan at all, the demo needs still back the sample report', () => {
  state.ai = null;
  assert.ok(activeProductNeeds().length > 0);
});

/* ---------- a room's zones are grouped by wall ----------
   A walk-in pantry's six rows printed as one flat list read as a single tall
   unit: nothing on the page said rows one and two were the left wall and
   three and four the back. The checklist gets a heading per wall, in the
   placement's order, and every row line keeps its full level text so a line
   read on its own still says where it is. */

test('a walk-in plan prints a heading per wall over that wall\'s rows', () => {
  state.space = 'pantry';
  state.setup = 'walkin';
  state.setupTouched = true;
  state.dims = null;
  state.arrangement = null;
  state.ai = normalizeAi(getDemoScenario('walkin', null, NO_KIDS, null, 'walkin'));
  state.stepDone = null;
  const txt = checklistText();
  const lines = txt.split('\n');
  for (const heading of ['Left wall:', 'Back wall:', 'Right wall:', 'Floor:']) {
    assert.equal(lines.filter((l) => l === heading).length, 1, `expected exactly one "${heading}" line:\n${txt}`);
  }
  // Headings come in wall order, and each one sits directly over its own rows.
  const at = (heading) => lines.indexOf(heading);
  assert.ok(at('Left wall:') < at('Back wall:') && at('Back wall:') < at('Right wall:') && at('Right wall:') < at('Floor:'),
    `walls out of order:\n${txt}`);
  assert.match(lines[at('Left wall:') + 1], /^- Left wall: /, 'the left wall heading should be followed by a left wall row');
  assert.match(lines[at('Back wall:') + 1], /^- Back wall: /, 'the back wall heading should be followed by a back wall row');
  assert.match(lines[at('Floor:') + 1], /^- Floor: /, 'the floor heading should be followed by the floor row');
  // Grouping must not lose a row, and the level text stays whole.
  for (const m of state.ai.map) assert.ok(txt.includes(`- ${m.lv}: ${m.zone}`), `zone missing or unnamed: ${m.lv}`);
  assert.ok(!txt.includes('undefined'), `exported text contains "undefined":\n${txt}`);
});

/* A walk-in whose rows name no wall (a server plan that came back "Top shelf",
   "Eye level", "Lower shelf") is still a room, but the only group it has is
   "Other", and a checklist headed "Other:" over every zone reads as a bug. */
test('a walk-in whose rows name no wall prints its zones as one list', () => {
  state.space = 'pantry';
  state.setup = 'walkin';
  state.setupTouched = true;
  state.ai = normalizeAi({ ...getDemoScenario('pantry', null, NO_KIDS), layout: null });
  // Every row a plain shelf: no wall, and no door or floor surface to read one from.
  state.ai.map = state.ai.map.map((row, i) => ({ ...row, lv: ['Top shelf', 'Eye level', 'Lower shelf'][i % 3], wall: null, surface: 'shelf' }));
  const txt = checklistText();
  const headings = txt.split('\n').filter((l) => /^(Left wall|Back wall|Right wall|Front wall|Door|Floor|Other):$/.test(l));
  assert.deepEqual(headings, [], `a nameless room was headed anyway:\n${txt}`);
  for (const row of state.ai.map) assert.ok(txt.includes(`- ${row.lv}: ${row.zone}`), `row "${row.lv}" is missing from the list`);
  state.setup = null;
  state.setupTouched = false;
});

/* The walls can come from the layout's sections rather than the level text
   (a server plan says "High shelf" and puts the row in a left-wall section),
   and whether a one-wall plan is a room at all comes from the setup's
   archetype. The export resolves both the way the report does, so these pin
   the layout and archetype plumbing that level-prefixed fixtures never touch. */
test('wall headings come from the layout sections and the setup archetype too', () => {
  state.space = 'pantry';
  state.setup = 'walkin';
  state.setupTouched = true;
  const base = normalizeAi({ ...getDemoScenario('pantry', null, NO_KIDS), layout: null });
  const rows = base.map.slice(0, 3).map((row, i) => ({ ...row, lv: ['High shelf', 'Eye level', 'Lower shelf'][i], wall: null, surface: 'shelf', shelfIndex: i }));
  state.ai = { ...base, map: rows, layout: { type: 'walkin-u', sections: [
    { id: 'left-wall', label: 'Left wall', place: 'left', rows: [0] },
    { id: 'back-wall', label: 'Back wall', place: 'back', rows: [1, 2] },
  ] } };
  let txt = checklistText();
  let headings = txt.split('\n').filter((l) => /^(Left wall|Back wall|Right wall|Front wall|Door|Floor|Other):$/.test(l));
  assert.deepEqual(headings, ['Left wall:', 'Back wall:'], `sections did not place the rows:\n${txt}`);
  assert.ok(txt.indexOf('- High shelf:') < txt.indexOf('Back wall:'), 'the left-wall row is not under its heading');

  // One section only: a walk-in is still a room, headed by that wall; a cabinet with the same rows is not.
  state.ai = { ...state.ai, layout: { type: 'walkin-u', sections: [{ id: 'back-wall', label: 'Back wall', place: 'back', rows: [0, 1, 2] }] } };
  txt = checklistText();
  headings = txt.split('\n').filter((l) => /^(Left wall|Back wall|Right wall|Front wall|Door|Floor|Other):$/.test(l));
  assert.deepEqual(headings, ['Back wall:'], `a one-wall walk-in lost its heading:\n${txt}`);
  state.setup = 'cabinet';
  txt = checklistText();
  headings = txt.split('\n').filter((l) => /^(Left wall|Back wall|Right wall|Front wall|Door|Floor|Other):$/.test(l));
  assert.deepEqual(headings, [], `a cabinet was headed by a wall:\n${txt}`);
  state.setup = null;
  state.setupTouched = false;
});

test('a cabinet plan prints its zones as one list, with no wall headings', () => {
  state.space = 'kitchen';
  state.setup = 'cabinet';
  state.setupTouched = true;
  state.dims = null;
  state.arrangement = null;
  state.ai = normalizeAi(getDemoScenario('cabinet', null, NO_KIDS, null, 'cabinet'));
  state.stepDone = null;
  const txt = checklistText();
  const lines = txt.split('\n');
  const headings = lines.filter((l) => /^(Left wall|Back wall|Right wall|Front wall|Door|Floor|Other):$/.test(l));
  assert.deepEqual(headings, [], `a unit should carry no wall headings:\n${txt}`);
  // Rows follow in map order, directly under ZONES (the section ends at the blank line).
  const start = lines.indexOf('ZONES') + 2;
  const zones = lines.slice(start, lines.indexOf('', start));
  assert.deepEqual(zones.filter((l) => l.startsWith('- ')), state.ai.map.map((m) => `- ${m.lv}: ${m.zone}`));
  state.setup = null;
  state.setupTouched = false;
});
