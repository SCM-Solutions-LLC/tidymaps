import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSpaceName } from '../js/db.js';
import { state } from '../js/state.js';
import { AREAS } from '../js/wizard-data.js';

/* A saved space has to be recognizable in the dashboard. The old name map
   covered eight legacy space ids, so every area added by the room → area
   wizard (drawers, dresser, vanity, linen, workbench) saved as "My space".
   These pin the name to something the user actually saw. */

const ALL_AREAS = Object.values(AREAS).flat();

test('every wizard area produces a real name, never a placeholder', () => {
  for (const area of ALL_AREAS) {
    state.space = area.id;
    state.ai = null;
    const name = defaultSpaceName();
    assert.equal(name, area.label, `${area.id} should fall back to its area label`);
    assert.notEqual(name, 'My space', `${area.id} must not save as a placeholder`);
  }
});

test('a named plan wins over the area label, so the card matches the report', () => {
  state.space = 'cabinet';
  state.ai = { spaceType: 'Kitchen cabinet' };
  assert.equal(defaultSpaceName(), 'Kitchen cabinet');
});

test('the plan engine placeholder "Space" does not become the name', () => {
  state.space = 'linen';
  state.ai = { spaceType: 'Space' };
  assert.equal(defaultSpaceName(), 'Linen closet');
});

test('a runaway name from the model is trimmed, not stored whole', () => {
  state.space = 'pantry';
  state.ai = { spaceType: '  ' + 'Extremely Verbose Pantry '.repeat(10) };
  const name = defaultSpaceName();
  assert.ok(name.length <= 60, `got ${name.length} chars`);
  assert.ok(name.startsWith('Extremely Verbose Pantry'));
});

test('a blank name from the model falls through to the area label', () => {
  state.space = 'workbench';
  state.ai = { spaceType: '   ' };
  assert.equal(defaultSpaceName(), 'Workbench');
});

test('with nothing chosen at all it is still a sentence, not empty', () => {
  state.space = null;
  state.ai = null;
  assert.equal(defaultSpaceName(), 'My space');
});
