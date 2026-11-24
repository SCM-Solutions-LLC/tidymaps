import test from 'node:test';
import assert from 'node:assert/strict';
import { state, resetPlanRecord } from '../js/state.js';
import { restoreProductNeeds } from '../js/screens/customize.js';

/* Audit 11-24 (open item 24): Adjust's "Add storage product recommendations"
   awaits the demo-scenario module and then wrote state.ai. A plan opened
   during that await received the first plan's products and cost. */
test('products restored after an await land only on the plan that asked', async () => {
  resetPlanRecord(state);
  state.space = 'pantry'; state.setup = null;
  state.ai = { productNeeds: [], cost: '$0', steps: [] };
  let release;
  const gate = new Promise((r) => { release = r; });
  const pending = restoreProductNeeds(async () => { await gate; return import('../js/demo-scenarios.js'); });

  resetPlanRecord(state);                       // the user opens another plan
  const other = { productNeeds: [], cost: '$0', steps: [] };
  state.ai = other;
  release();
  await pending;
  assert.deepEqual(other.productNeeds, [], 'the plan opened meanwhile gained products it never asked for');
  assert.equal(other.cost, '$0');
});

test('with no plan switch, the products are restored', async () => {
  resetPlanRecord(state);
  state.space = 'pantry'; state.setup = null;
  state.ai = { productNeeds: [], cost: '$0', steps: [] };
  await restoreProductNeeds();
  assert.ok(state.ai.productNeeds.length > 0);
});
