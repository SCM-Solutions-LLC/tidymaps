import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupMismatch } from '../js/setupMismatch.js';
import { validatePlan, ARCHETYPES } from '../supabase/functions/_shared/planSchema.js';
import { SETUP_TYPES } from '../js/wizard-data.js';
import { SETUP_ARCHETYPE } from '../js/layout.js';

/* #3: photos that show a different setup from the card the user picked.
   The prompt's words and its triggers live in js/setupMismatch.js; the
   loading screen only renders what it returns (tests/e2e/setup-mismatch). */

const ask = (o) => setupMismatch({ space: 'closet', setup: 'reachinC', setupTouched: true, seenLayout: 'walkin-u', ...o });

test('walk-in photos under a picked reach-in ask to switch to the walk-in card', () => {
  assert.deepEqual(ask({}), {
    fromId: 'reachinC', toId: 'walkinC',
    question: 'Your photos look like a walk-in. Switch?',
    switchLabel: 'Switch', keepLabel: 'Keep reach-in',
  });
  const pantry = ask({ space: 'pantry', setup: 'reachin' });
  assert.equal(pantry.toId, 'walkin');
});

test('nothing is asked when there is nothing to question', () => {
  assert.equal(ask({ setupTouched: false }), null, 'an untouched preselection already yields to the photos');
  assert.equal(ask({ seenLayout: null }), null, 'the photos did not show enough');
  assert.equal(ask({ seenLayout: undefined }), null, 'an older function version sends no seenLayout');
  assert.equal(ask({ seenLayout: 'closet-rod' }), null, 'the photos agree with the card');
  assert.equal(ask({ setup: 'wardrobe', seenLayout: 'closet-rod' }), null, 'a wardrobe and a reach-in are drawn alike');
  assert.equal(ask({ seenLayout: 'fridge' }), null, 'no closet card is a fridge, so there is nothing to switch to');
  assert.equal(ask({ seenLayout: 'not-an-archetype' }), null);
});

test('the question reads as a sentence for every archetype a space can switch to', () => {
  for (const [space, cards] of Object.entries(SETUP_TYPES)) {
    for (const from of cards) {
      for (const seen of ARCHETYPES) {
        const m = setupMismatch({ space, setup: from.id, setupTouched: true, seenLayout: seen });
        if (!m) continue;
        assert.match(m.question, /^Your photos look like (a|an) [a-zA-Z][^.]*\. Switch\?$/, m.question);
        assert.doesNotMatch(m.question, /\ba [aeiou]|\ba L-/i, `article: ${m.question}`);
        assert.doesNotMatch(m.question + m.keepLabel, /—/, 'no em dash in copy');
        assert.equal(SETUP_ARCHETYPE[m.toId], seen, `${space}: switching to ${m.toId} does not draw ${seen}`);
        assert.ok(cards.some((c) => c.id === m.toId), `${m.toId} is not a ${space} card`);
      }
    }
  }
  assert.equal(setupMismatch({ space: 'pantry', setup: 'cabinet', setupTouched: true, seenLayout: 'l-run' }).question,
    'Your photos look like an L-shaped run. Switch?');
});

test('seenLayout passes the validator when valid and is dropped, never rejected, when not', () => {
  const base = () => ({
    spaceType: 'Closet', summary: 'A closet.',
    map: [{ level: 'Top shelf', icon: 'up', zone: 'Bins', why: 'Rare.', shelfIndex: 0, safety: { flag: null, why: null } }],
    geometry: { unit: 'in', width: 60, height: 96, depth: 72, shelfCount: 1, shelfYFracs: [0], estimated: true },
    steps: Array.from({ length: 7 }, (_, i) => ({ task: `Do step ${i + 1}`, time: '5 min', why: 'It helps.' })),
    productNeeds: [],
  });
  const ctx = { effort: 'Weekend project', household: { kids: { present: false, ages: [] } } };
  const good = validatePlan({ ...base(), seenLayout: 'walkin-u' }, ctx);
  assert.equal(good.ok, true, good.errors && good.errors.join('; '));
  assert.equal(good.value.seenLayout, 'walkin-u');
  for (const bad of ['walk-in', 7, null, '']) {
    const v = validatePlan({ ...base(), seenLayout: bad }, ctx);
    assert.equal(v.ok, true, `seenLayout ${JSON.stringify(bad)} rejected the plan`);
    assert.equal('seenLayout' in v.value, false, `seenLayout ${JSON.stringify(bad)} survived`);
  }
});

test('the prompt asks for seenLayout from the photos alone and calls it optional', () => {
  const fn = readFileSync(new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');
  assert.match(fn, /"seenLayout": \$\{ARCHETYPES\.map/, 'the JSON shape does not list seenLayout from the validator\'s own ARCHETYPES');
  assert.match(fn, /judged from the photos alone/);
  assert.match(fn, /- optional fields: [^\n]*"seenLayout"[^\n]* are optional/);
  assert.match(fn, /set seenLayout to the archetype the photos show/, 'the picked-setup rule must not tell the model to hide what it sees');
});
