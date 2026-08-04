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
