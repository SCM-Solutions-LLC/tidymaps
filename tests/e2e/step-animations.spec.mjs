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
  /* results.js falls back with STEP_ART[action] || STEP_ART.done, so an action
     with no scene is invisible: it classifies correctly and still draws the
     fallback. That failure is silent, which is how five steps stayed identical
     without anything failing. */
  await page.goto('/index.html');
  const missing = await page.evaluate(async () => {
    const { ACTIONS } = await import('/js/stepMedia.js');
    const html = await (await fetch('/js/screens/results.js')).text();
    const block = html.match(/const STEP_ART\s*=\s*\{[\s\S]*?\n\};/)[0];
    const scenes = [...block.matchAll(/^\s{2}([a-zA-Z]+):A_WRAP/gm)].map((m) => m[1]);
    return ACTIONS.filter((a) => !scenes.includes(a));
  });
  expect(missing, `these actions silently render the "done" scene`).toEqual([]);
});

test('the plan renders more than a couple of distinct animations', async ({ page }) => {
  await openSamplePlan(page);
  const classes = await page.$$eval('#res-steps .sa', els => els.map(e => e.getAttribute('class')));
  expect(classes.length, 'no step animations rendered at all').toBeGreaterThan(3);
  const distinct = new Set(classes);
  /* Not a demand for uniqueness — two similar steps may honestly share a
     picture. The bar is that the checklist does not read as one image copied
     down the page. */
  expect(distinct.size, `${classes.length} steps drew only ${distinct.size} different scenes: ${[...distinct].join(', ')}`)
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
