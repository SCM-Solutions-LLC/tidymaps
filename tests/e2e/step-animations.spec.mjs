import { test, expect } from 'playwright/test';
import { expandChapters } from './helpers.mjs';

/* A real twelve-step plan came back with five steps sharing one animation and a
   sixth animating the opposite of what it said: "Arrange appliances and bulk
   items on floor" showed things travelling upward, because /bulk/ was tested
   before /floor/.

   Both are the same underlying gap. The action vocabulary had no word for the
   commonest instruction in a plan — putting things onto the shelf — so those
   steps fell through every rule to `done`, the scene meant for the last step.
   Repetition is a polish problem; a clip that contradicts its own instruction
   is a correctness one. */

async function openSamplePlan(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
  await expandChapters(page);
}

test('every action in the vocabulary has a scene of its own', async ({ page }) => {
  /* stepScene falls back with SCENES[action] || SCENES.done, so an action with
     no scene is invisible: it classifies correctly and still draws the
     fallback. That failure is silent, which is how five steps stayed identical
     without anything failing.

     Asserted on the rendered output rather than the source text, so it holds
     however the scene table is written. */
  await page.goto('/index.html');
  const collisions = await page.evaluate(async () => {
    const { ACTIONS } = await import('/js/stepMedia.js');
    const { stepScene } = await import('/js/screens/results.js');
    /* One step text per action, chosen to classify as that action. The scene a
       real `done` step draws is the yardstick: any other action drawing the
       same markup is silently falling through to it. */
    const SAMPLE = {
      purge: 'Check every item for expiration dates',
      unload: 'Pull everything out, wall by wall',
      wipe: 'Wipe down every shelf',
      label: 'Label every bin and shelf edge',
      hang: 'Hang coats on the rod',
      fold: 'Fold the sweaters',
      photo: 'Take a photo of the finished shelf',
      contain: 'Transfer dry goods into airtight containers',
      group: 'Sort items into the nine categories',
      moveUp: 'Move backup items to the top shelf',
      moveDown: 'Put heavy items on the lowest shelf',
      zones: 'Assign each category to its wall zone',
      stock: 'Load the back wall shelves first',
      done: 'Add a running low list inside the front edge',
    };
    const missing = ACTIONS.filter((a) => !SAMPLE[a]);
    const doneScene = stepScene({ t: SAMPLE.done, w: '' }, 'pantry');
    const shadowed = ACTIONS.filter((a) => a !== 'done' && SAMPLE[a]
      && stepScene({ t: SAMPLE[a], w: '' }, 'pantry') === doneScene);
    return { missing, shadowed };
  });
  expect(collisions.missing, 'this test has no sample step for these actions').toEqual([]);
  expect(collisions.shadowed, 'these actions silently render the "done" scene').toEqual([]);
});

test('every scene actually moves', async ({ page }) => {
  /* The scenes are CSS-animated, and the CSS selects on a class the scene
     builder writes. Rename one without the other and the step renders a
     perfectly good still picture: nothing throws, nothing looks broken, and
     the animation is simply gone. That is exactly what happened to moveUp and
     moveDown — .sa-up / .sa-down against a wrapper that had started emitting
     the action verbatim — and a round of keyframe tuning went into rules that
     could no longer match anything.

     Checked through the browser's own computed styles, so it holds for any
     class name either side chooses. */
  await page.goto('/index.html');
  const still = await page.evaluate(async () => {
    const { ACTIONS } = await import('/js/stepMedia.js');
    const { stepScene } = await import('/js/screens/results.js');
    const SAMPLE = {
      purge: 'Check every item for expiration dates',
      unload: 'Pull everything out, wall by wall',
      wipe: 'Wipe down every shelf',
      label: 'Label every bin and shelf edge',
      hang: 'Hang coats on the rod',
      fold: 'Fold the sweaters',
      photo: 'Take a photo of the finished shelf',
      contain: 'Transfer dry goods into airtight containers',
      group: 'Sort items into the nine categories',
      moveUp: 'Move backup items to the top shelf',
      moveDown: 'Put heavy items on the lowest shelf',
      zones: 'Assign each category to its wall zone',
      stock: 'Load the back wall shelves first',
      done: 'Add a running low list inside the front edge',
    };
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(host);
    const dead = [];
    for (const action of ACTIONS) {
      host.innerHTML = stepScene({ t: SAMPLE[action], w: '' }, 'pantry');
      const animated = [...host.querySelectorAll('*')]
        .some((el) => getComputedStyle(el).animationName !== 'none');
      if (!animated) dead.push(action);
    }
    host.remove();
    return dead;
  });
  expect(still, 'these scenes render a still picture — their keyframes match nothing').toEqual([]);
});

test('the same instruction is drawn differently in a different space', async ({ page }) => {
  /* The point of the scene is that it looks like YOUR space. stepMedia already
     derives the furniture from the space and the item from the step's words —
     the SVG keyed on the verb alone, so "Sort items into categories" was the
     same four circles in a pantry and in a garage. */
  await page.goto('/index.html');
  const { bySpace, byItem } = await page.evaluate(async () => {
    const { stepScene } = await import('/js/screens/results.js');
    const one = 'Sort everything into the nine categories';
    const spaces = ['pantry', 'garage', 'closet', 'drawers'];
    return {
      bySpace: new Set(spaces.map((s) => stepScene({ t: one, w: '' }, s))).size,
      byItem: new Set([
        'Load the shelves with canned goods',
        'Load the shelves with spice jars',
        'Load the shelves with dry goods and pasta',
      ].map((t) => stepScene({ t, w: '' }, 'pantry'))).size,
    };
  });
  expect(bySpace, 'one instruction draws the same scene in every space').toBe(4);
  expect(byItem, 'three different items in one space draw the same scene').toBe(3);
});

test('a scene names its motif and its item where CSS and tests can see them', async ({ page }) => {
  await page.goto('/index.html');
  const cls = await page.evaluate(async () => {
    const { stepScene } = await import('/js/screens/results.js');
    const svg = stepScene({ t: 'Load the shelves with canned goods', w: '' }, 'pantry');
    return (svg.match(/class="([^"]+)"/) || [])[1];
  });
  expect(cls).toContain('sa-stock');
  expect(cls).toContain('sa-m-shelves');
  expect(cls).toContain('sa-g-can');
});

test('the plan renders more than a couple of distinct animations', async ({ page }) => {
  await openSamplePlan(page);
  const classes = await page.$$eval('#res-steps .sa', els => els.map(e => e.getAttribute('class')));
  expect(classes.length, 'no step animations rendered at all').toBeGreaterThan(3);
  /* Measured on the ACTION alone. The class also carries the motif and the
     glyph now, and counting the whole string would let a plan pass on twelve
     copies of one motion holding twelve different jars — which is the bug this
     file exists for, wearing a costume. */
  const actions = classes.map(c => (c.match(/\bsa-([a-zA-Z]+)\b(?!-)/) || [])[1]);
  const distinct = new Set(actions);
  /* Not a demand for uniqueness — two similar steps may honestly share a
     picture. The bar is that the checklist does not read as one image copied
     down the page. */
  expect(distinct.size, `${classes.length} steps drew only ${distinct.size} different motions: ${[...distinct].join(', ')}`)
    .toBeGreaterThan(Math.min(4, classes.length - 1));
});

test('a step that says "on the floor" never animates upward', async ({ page }) => {
  /* The regression that motivated this file. Checked through the real
     classifier rather than the rendered page, so it holds for any plan text
     and not just the sample's. */
  await page.goto('/index.html');
  const results = await page.evaluate(async () => {
    const { classifyAction } = await import('/js/stepMedia.js');
    const down = [
      'Arrange appliances and bulk items on floor',
      'Move bulk bins to the floor',
      'Put heavy items on the lowest shelf',
    ].map(t => [t, classifyAction({ t, w: '' })]);
    const up = [
      'Move bulk and backup items to the top shelf',
      'Store rarely used items up high',
    ].map(t => [t, classifyAction({ t, w: '' })]);
    return { down, up };
  });
  for (const [text, action] of results.down) {
    expect(action, `"${text}" animates as ${action}`).toBe('moveDown');
  }
  for (const [text, action] of results.up) {
    expect(action, `"${text}" animates as ${action}`).toBe('moveUp');
  }
});

test('the verbs a real plan uses do not all collapse into one scene', async ({ page }) => {
  /* The twelve steps from the live run that surfaced this. Before the fix they
     produced 7 distinct animation keys, five of them the `done` fallback. */
  await page.goto('/index.html');
  const { keys, fallbacks } = await page.evaluate(async () => {
    const { mediaKeyFor, classifyAction } = await import('/js/stepMedia.js');
    const steps = [
      'Pull everything out, wall by wall',
      'Check every item for expiration dates',
      'Sort items into the nine categories',
      'Assign each category to its wall zone',
      'Transfer dry goods into airtight containers',
      'Load back wall shelves first',
      'Place turntables and load spices and condiments',
      'Set up can risers and stock canned goods',
      'Load left and right wall shelves by zone',
      'Arrange appliances and bulk items on floor',
      'Label every bin, basket, and shelf edge',
      'Add a running low list inside the front edge',
    ].map(t => ({ t, w: '' }));
    return {
      keys: steps.map(s => mediaKeyFor(s, 'pantry')),
      fallbacks: steps.filter(s => classifyAction(s) === 'done').length,
    };
  });
  expect(new Set(keys).size, `only ${new Set(keys).size} distinct scenes across 12 steps`).toBeGreaterThanOrEqual(10);
  expect(fallbacks, 'steps still falling through to the "done" scene').toBeLessThanOrEqual(1);
});
