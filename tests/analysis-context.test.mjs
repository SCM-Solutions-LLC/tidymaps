import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../js/state.js';
import { buildAnalysisContext } from '../js/plan.js';
import { SPACE_CFG } from '../js/wizard-data.js';

/* What the contents step tells the model, and whether it was the user talking.

   buildResults copies the plan's own categories into state.cats whenever the
   user did not edit the contents step, so a re-run sent the model its own
   previous list back under "This is their own edited list": the model was
   being quoted to itself as if it were the user, and a category it had
   guessed wrong was now something the user had confirmed. The list travels
   only when the user touched the step, and the flag travels with it so the
   prompt can say which it was.

   `categoriesOffered` is the chip list the wizard showed for this space and
   household. It lets the server tell "saw it, and the user never had a chip
   for it" from "saw it, and the user unticked it", which is the difference
   between adding something to the plan and respecting a choice to leave it
   out. The effort flag goes for the same reason the shopping and setup flags
   already do: the card arrives preselected, so the value alone cannot say
   whether anyone chose it. */

const quietHousehold = () => ({ adults: 2, kidCount: 0, petCount: 0,
  kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' });

test('categories travel only when the user edited the contents step', () => {
  state.space = 'pantry';
  state.household = quietHousehold();
  state.cats = ['Snacks', 'Baking'];

  state.catsTouched = false;
  let sent = buildAnalysisContext();
  assert.deepEqual(sent.categories, [], 'an untouched list is the plan\'s own, not the user\'s');
  assert.equal(sent.categoriesTouched, false);

  state.catsTouched = true;
  sent = buildAnalysisContext();
  assert.deepEqual(sent.categories, ['Snacks', 'Baking']);
  assert.equal(sent.categoriesTouched, true);
  assert.notEqual(sent.categories, state.cats, 'a copy, so the wizard cannot mutate what was sent');
});

test('categoriesOffered is the chip list the wizard showed for this space and household', () => {
  state.space = 'pantry';
  state.household = quietHousehold();
  let offered = buildAnalysisContext().categoriesOffered;
  assert.deepEqual(offered, SPACE_CFG.pantry.categories.filter((c) => !/kids/i.test(c)),
    'no kids in the household, so the kid chip was never shown');
  assert.equal(offered.includes("Kids' snacks"), false);

  state.household = { ...quietHousehold(), kidCount: 1, kids: { present: 'yes', ages: ['Toddler'] } };
  offered = buildAnalysisContext().categoriesOffered;
  assert.deepEqual(offered, SPACE_CFG.pantry.categories);
  assert.equal(offered.includes("Kids' snacks"), true);

  state.space = 'garage';
  assert.deepEqual(buildAnalysisContext().categoriesOffered, SPACE_CFG.garage.categories);
});

test('with no space chosen, the offered list is the pantry\'s, as the wizard shows', () => {
  state.space = null;
  state.household = quietHousehold();
  assert.deepEqual(buildAnalysisContext().categoriesOffered,
    SPACE_CFG.pantry.categories.filter((c) => !/kids/i.test(c)));
});

test('effortTouched says whether the effort card was chosen or merely left preselected', () => {
  state.effort = 'Weekend reset';
  state.effortTouched = false;
  let sent = buildAnalysisContext();
  assert.equal(sent.effort, 'Weekend reset', 'the value still travels either way');
  assert.equal(sent.effortTouched, false);

  state.effortTouched = true;
  sent = buildAnalysisContext();
  assert.equal(sent.effortTouched, true);
});
