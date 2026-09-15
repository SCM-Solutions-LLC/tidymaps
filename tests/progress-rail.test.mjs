import { test } from 'node:test';
import assert from 'node:assert/strict';
import { railPercent, FLOW } from '../js/router.js';
import { WIZARD_STEPS } from '../js/screens/wizard.js';

/* The progress rail under the running head measures the wizard. It read 100%
   at Review, then 75% on the loading screen and 81% on the report, because
   setRail switched formulas once the screen was no longer a wizard step and
   divided the screen's index in FLOW by FLOW's length instead. Building the
   plan looked like losing two steps. */

test('the rail never goes backwards along the flow', () => {
  let last = -1;
  for (const id of FLOW) {
    const pct = railPercent(id);
    assert.ok(pct >= last, `${id} reads ${pct}% after ${last}%`);
    last = pct;
  }
});

test('the rail is full from Review on, on every screen that carries a plan', () => {
  assert.equal(railPercent('review'), 100);
  for (const id of ['loading', 'results', 'customize', 'save', 'feedback', 'done', 'viewer3d']) {
    assert.equal(railPercent(id), 100, `${id} is not full`);
  }
});

test('the rail is empty before the wizard and advances a step at a time through it', () => {
  for (const id of ['landing', 'products', 'dashboard']) {
    assert.equal(railPercent(id), 0, `${id} is not empty`);
  }
  WIZARD_STEPS.forEach((id, i) => {
    assert.equal(railPercent(id), Math.round((i + 1) / WIZARD_STEPS.length * 100), `${id} is off its step`);
  });
});
