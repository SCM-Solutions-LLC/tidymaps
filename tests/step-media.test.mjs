import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  ACTIONS, MOTIFS, GLYPHS,
  classifyAction, motifForSpace, glyphForStep, mediaKeyFor, parseMediaKey, playableClip,
} from '../js/stepMedia.js';

// Build-time guard + unit tests for the step-media pipeline. The manifest
// (data/step-media.json) declares produced clips under the strict
// {action}-{motif}-{glyph} key contract; this suite fails CI on unknown
// vocabulary, a ready clip missing from disk, or a pending entry whose file
// already landed — so clip production problems surface at build time.

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('data/step-media.json', root), 'utf8'));

/* ---------- manifest guard ---------- */

test('manifest is versioned and shaped correctly', () => {
  assert.equal(typeof manifest.version, 'number');
  assert.equal(typeof manifest.clips, 'object');
});

test('every declared clip key parses into known action/motif/glyph vocabulary', () => {
  for (const key of Object.keys(manifest.clips)) {
    assert.ok(parseMediaKey(key), `clip key outside the vocabulary: ${key}`);
  }
});

test('every declared clip entry has a valid file path, status, and license', () => {
  for (const [key, c] of Object.entries(manifest.clips)) {
    assert.match(c.file || '', /^media\/steps\/.+\.(mp4|webm|json)$/, `${key}: file must live at media/steps/*.(mp4|webm|json)`);
    assert.ok(['ready', 'pending'].includes(c.status), `${key}: status must be ready|pending`);
    assert.ok(c.license && typeof c.license.type === 'string', `${key}: license.type is required`);
  }
});

test('ready clips exist on disk; pending clips do not', () => {
  for (const [key, c] of Object.entries(manifest.clips)) {
    if (c.status === 'ready') {
      assert.ok(existsSync(new URL(c.file, root)), `${key}: ready clip missing on disk: ${c.file}`);
    } else {
      assert.ok(!existsSync(new URL(c.file, root)), `${key}: file exists but status is still "pending" — mark it "ready": ${c.file}`);
    }
  }
});

/* ---------- classification: the media key mirrors the SVG scene ---------- */

test('action classification matches the scene the step describes', () => {
  const cases = [
    [{ t: 'Remove expired or duplicate items first', w: '' }, 'purge'],
    [{ t: 'Empty the shelves', w: 'Start from a clean slate.' }, 'unload'],
    [{ t: 'Wipe down surfaces', w: '' }, 'wipe'],
    [{ t: 'Add labels if available', w: '' }, 'label'],
    [{ t: 'Hang long items on the rod', w: '' }, 'hang'],
    [{ t: 'Fold sweaters into flat stacks', w: '' }, 'fold'],
    [{ t: 'Take a final photo', w: '' }, 'photo'],
    [{ t: 'Corral loose packets in a basket', w: '' }, 'contain'],
    [{ t: 'Pull similar items into groups', w: '' }, 'group'],
    [{ t: 'Move bulk and backup items to the top shelf', w: '' }, 'moveUp'],
    [{ t: 'Put heavy items on the lowest shelf', w: '' }, 'moveDown'],
    [{ t: 'Give every item a clear home', w: '' }, 'zones'],
    [{ t: 'Celebrate', w: '' }, 'done'],
  ];
  for (const [step, want] of cases) {
    assert.equal(classifyAction(step), want, `"${step.t}" should classify as ${want}`);
  }
});

test('every classifiable action is in the vocabulary', () => {
  for (const a of ['purge','unload','wipe','label','hang','fold','photo','contain','group','moveUp','moveDown','zones','done']) {
    assert.ok(ACTIONS.includes(a), `action missing from vocabulary: ${a}`);
  }
});

test('motif derivation: rails for closets, drawers for drawer banks and dressers, bench for the workbench, a fridge, cabinet and vanity of their own, shelves otherwise', () => {
  assert.equal(motifForSpace('closet'), 'rail');
  assert.equal(motifForSpace('walkin'), 'rail');
  assert.equal(motifForSpace('drawers'), 'drawers');
  assert.equal(motifForSpace('junk'), 'drawers');
  assert.equal(motifForSpace('dresser'), 'drawers');
  // Garage shelving is a rack of shelves; the bench belongs to the workbench.
  // The two were swapped, so a garage rack drew a workbench and a workbench
  // drew an open bookcase.
  assert.equal(motifForSpace('garage'), 'shelves');
  assert.equal(motifForSpace('workbench'), 'bench');
  assert.equal(motifForSpace('pantry'), 'shelves');
  assert.equal(motifForSpace('linen'), 'shelves');
  // These three drew the open bookcase until 10-23.
  assert.equal(motifForSpace('fridge'), 'fridge');
  assert.equal(motifForSpace('cabinet'), 'cabinet');
  assert.equal(motifForSpace('bathroom'), 'undersink');
  assert.equal(motifForSpace('unknown-space'), 'shelves');
  for (const s of ['closet','drawers','garage','pantry','fridge','cabinet','bathroom']) {
    assert.ok(MOTIFS.includes(motifForSpace(s)));
  }
});

test('glyph derivation: step text wins, space default fills in', () => {
  assert.equal(glyphForStep({ t: 'Line up shoes toe-out', w: '' }, 'closet'), 'shoe');
  assert.equal(glyphForStep({ t: 'Stack cans by type', w: '' }, 'pantry'), 'can');
  assert.equal(glyphForStep({ t: 'Straighten things up', w: '' }, 'pantry'), 'can');   // space default
  assert.equal(glyphForStep({ t: 'Straighten things up', w: '' }, 'workbench'), 'tool');  // space default
  assert.equal(glyphForStep({ t: 'Straighten things up', w: '' }, 'garage'), 'tote');
  assert.ok(GLYPHS.includes(glyphForStep({ t: 'anything', w: '' }, 'nowhere')));       // global default
});

test('mediaKeyFor produces a parseable in-vocabulary key for arbitrary steps', () => {
  const steps = [
    { t: 'Remove expired or duplicate items first', w: '' },
    { t: 'Hang long items on the rod', w: '' },
    { t: 'Some totally novel instruction', w: 'with no keywords at all' },
  ];
  for (const spaceId of ['pantry', 'closet', 'drawers', 'garage', undefined]) {
    for (const s of steps) {
      const key = mediaKeyFor(s, spaceId);
      assert.ok(parseMediaKey(key), `unparseable key: ${key} (space=${spaceId})`);
    }
  }
});

test('parseMediaKey rejects out-of-vocabulary keys', () => {
  for (const bad of ['sparkle-shelves-can', 'purge-closet-can', 'purge-shelves-sock', 'purge-shelves', '', 'a-b-c-d']) {
    assert.equal(parseMediaKey(bad), null, `should reject: ${bad}`);
  }
});

/* ---------- runtime resolution ---------- */

test('playableClip only accepts ready clips in playable formats', () => {
  const man = { clips: {
    'purge-shelves-can':  { file: 'media/steps/purge-shelves-can.mp4',  status: 'ready',   license: { type: 'first-party' } },
    'wipe-shelves-can':   { file: 'media/steps/wipe-shelves-can.webm',  status: 'ready',   license: { type: 'first-party' } },
    'hang-rail-hanger':   { file: 'media/steps/hang-rail-hanger.mp4',   status: 'pending', license: { type: 'first-party' } },
    'fold-rail-foldedclothes': { file: 'media/steps/fold-rail-foldedclothes.json', status: 'ready', license: { type: 'first-party' } },
  } };
  assert.ok(playableClip(man, 'purge-shelves-can'), 'ready mp4 should play');
  assert.ok(playableClip(man, 'wipe-shelves-can'), 'ready webm should play');
  assert.equal(playableClip(man, 'hang-rail-hanger'), null, 'pending clip must not be requested');
  assert.equal(playableClip(man, 'fold-rail-foldedclothes'), null, 'lottie json without a vendored player must fall back');
  assert.equal(playableClip(man, 'zones-shelves-can'), null, 'undeclared key must fall back');
  assert.equal(playableClip(null, 'purge-shelves-can'), null, 'missing manifest must fall back');
});

/* ---------- the pictures fit the space (2026-10-23) ----------
   The first real fridge plan drew a crisper step as dresses on hangers:
   "p-rod-uce" matched the closet rod rule, and the same substring picked the
   hanger item. These are that plan's steps, word for word, and the pictures
   they must get. */
test('the first real fridge plan gets fridge pictures, not closet ones', () => {
  const steps = [
    ['Empty the fridge onto the shelf', 'A full view shows what you really have.', 'unload-fridge-carton'],
    ['Toss expired food and old leftovers', 'Frees space and removes hidden spoilage.', 'purge-fridge-leftovers'],
    ['Wipe shelves, drawers and door bins', 'A clean start keeps it easy to maintain.', 'wipe-fridge-carton'],
    ['Set a clear leftovers bin at eye level', 'Leftovers stay in sight and get eaten.', 'contain-fridge-leftovers'],
    ['Move produce into the crisper drawers', 'Drawer humidity slows spoilage.', 'zones-fridge-produce'],
    ['Put raw meat in a tray below', 'Lowest spot prevents drips onto food.', 'moveDown-fridge-meat'],
    ['Group dairy, bread and spreads on top shelf', 'Daily staples sit together.', 'moveUp-fridge-carton'],
    ['Sort condiments by use into door shelves', 'Door bins hold sauces and jars neatly.', 'zones-fridge-jar'],
    ['Empty the freezer and toss freezer-burned food', 'Reveals the mystery pile and frees space.', 'purge-fridge-carton'],
    ['Sort freezer into bins: meat, veg, meals', 'Each food type has one home.', 'contain-fridge-meat'],
    ['Label bins and date every leftover', 'Dates show what to eat first.', 'label-fridge-leftovers'],
    ['Do a weekly five-minute fridge check', 'Small checks keep the system working.', 'done-fridge-carton'],
  ];
  for (const [t, w, want] of steps) assert.equal(mediaKeyFor({ t, w }, 'fridge'), want, t);
});

test('a word inside another word is not that word', () => {
  // change is not hang, cabinet is not a bin, folder is not folding,
  // products are not a hanger, a baking sheet is not linen, "you can" is not cans.
  assert.notEqual(classifyAction({ t: 'Change the water filter', w: '' }, 'closet'), 'hang');
  assert.notEqual(classifyAction({ t: 'Clear the cabinet under the sink', w: '' }, 'bathroom'), 'contain');
  assert.notEqual(classifyAction({ t: 'File papers into folders', w: '' }, 'closet'), 'fold');
  assert.notEqual(glyphForStep({ t: 'Check products for expiration', w: '' }, 'dresser'), 'hanger');
  assert.notEqual(glyphForStep({ t: 'Stand baking sheets upright', w: '' }, 'cabinet'), 'towel');
  assert.notEqual(glyphForStep({ t: 'Put away what you can reach', w: '' }, 'bathroom'), 'can');
  assert.notEqual(classifyAction({ t: 'Group cleaning supplies together', w: '' }, 'bathroom'), 'wipe');
});

test('the title picks the picture; the reason only breaks a tie', () => {
  // The why mentioned expired products, and used to turn an emptying step
  // into a purge with a hanger in it.
  const step = { t: 'Empty the vanity onto a towel', w: 'Expired products hide at the back.' };
  assert.equal(classifyAction(step, 'bathroom'), 'unload');
  // A title with no keywords still borrows the reason's.
  assert.equal(classifyAction({ t: 'Start here', w: 'Toss anything expired.' }, 'pantry'), 'purge');
});

test('no demo plan draws clothes outside a space that holds clothes', async () => {
  const { getDemoScenario } = await import('../js/demo-scenarios.js');
  const { SETUP_TYPES } = await import('../js/wizard-data.js');
  const clothes = new Set(['closet', 'walkin', 'dresser', 'kids', 'laundry']);
  const wrong = [];
  for (const [space, setups] of Object.entries(SETUP_TYPES)) {
    for (const { id } of setups) {
      const plan = getDemoScenario(space, 'find', { kids: { present: 'no' }, pets: { present: 'no' }, mobility: [] }, null, id);
      for (const s of plan.steps || []) {
        const key = mediaKeyFor({ t: s.task || s.t || '', w: s.why || s.w || '' }, space);
        const { action, glyph } = parseMediaKey(key);
        const foldOk = clothes.has(space) || space === 'linen';
        if ((action === 'hang' || glyph === 'hanger') && !clothes.has(space)) wrong.push(`${space}/${id}: ${key} "${s.task || s.t}"`);
        if ((action === 'fold' || glyph === 'foldedclothes') && !foldOk) wrong.push(`${space}/${id}: ${key} "${s.task || s.t}"`);
      }
    }
  }
  assert.deepEqual(wrong, []);
});


test('fridge food is drawn as fridge food, and the container a step names still wins', () => {
  const g = (t) => glyphForStep({ t, w: '' }, 'fridge');
  assert.equal(g('Move berries and greens to the crisper'), 'produce');
  assert.equal(g('Keep milk and eggs on the middle shelf'), 'carton');
  assert.equal(g('Date every leftover'), 'leftovers');
  assert.equal(g('Thaw chicken on the bottom shelf'), 'meat');
  // the named container beats the food it holds
  assert.equal(g('Line up juice bottles in the door'), 'bottle');
  assert.equal(g('Group condiment jars in a bin'), 'jar');
  // words inside other words are not food
  assert.notEqual(g('Remove the vegan label'), 'produce');
  assert.notEqual(g('Fishing gear goes elsewhere'), 'meat');
});

/* ---------- one vocabulary, five places ----------
   The vocabulary lives in stepMedia.js, but each furniture and each item is
   drawn twice (the Remotion clip and the inline fallback) and placed by
   per-furniture tables in the scenes. Every lookup falls back silently, to
   the bookcase or the tote or a shelf's coordinates, so a motif added in one
   place and not another renders a plausible wrong picture and nothing fails.
   Remotion is not built in CI; these read its source. */
const src = (p) => readFileSync(new URL(p, root), 'utf8');
const keysOf = (text, start, indent = '  ') => {
  const body = text.slice(text.indexOf(start));
  const block = body.slice(0, body.search(/\n\};/));
  return [...block.matchAll(new RegExp(`^${indent}(\\w+):`, 'gm'))].map((m) => m[1]);
};
const enumOf = (text, field) => JSON.parse(text.match(new RegExp(`${field}: z\\.enum\\((\\[[^\\]]*\\])\\)`))[1].replace(/'/g, '"'));
const same = (got, want, what) => assert.deepEqual([...got].sort(), [...want].sort(), what);

test('the clip renderer accepts exactly the vocabulary stepMedia speaks', () => {
  const clip = src('remotion/src/StepClip.tsx');
  same(enumOf(clip, 'action'), ACTIONS, 'remotion/src/StepClip.tsx actions');
  same(enumOf(clip, 'motif'), MOTIFS, 'remotion/src/StepClip.tsx motifs');
  same(enumOf(clip, 'glyph'), GLYPHS, 'remotion/src/StepClip.tsx glyphs');
});

test('every motif is drawn, placed and staged in the clips and in the fallback', () => {
  const motifs = src('remotion/src/motifs.tsx');
  same(keysOf(motifs, 'export const MOTIF_GEO'), MOTIFS, 'MOTIF_GEO in remotion/src/motifs.tsx');
  const drawn = [...motifs.matchAll(/case '(\w+)': return </g)].map((m) => m[1]);
  same([...drawn, 'shelves'], MOTIFS, 'the Motif switch in remotion/src/motifs.tsx (shelves is its default)');
  same(keysOf(src('remotion/src/scenes/label.tsx'), 'const TAG_SPOT'), MOTIFS, 'TAG_SPOT in scenes/label.tsx');
  same(keysOf(src('remotion/src/scenes/zones.tsx'), 'const BANDS'), MOTIFS, 'BANDS in scenes/zones.tsx');
  for (const f of ['moveUp', 'moveDown']) {
    const arrows = src(`remotion/src/scenes/${f}.tsx`).match(/const ARROW_X[^{]*\{([^}]*)\}/)[1];
    same([...arrows.matchAll(/(\w+):/g)].map((m) => m[1]), MOTIFS, `ARROW_X in scenes/${f}.tsx`);
  }
  same(keysOf(src('js/screens/results.js'), 'const MOTIF_ART'), MOTIFS, 'MOTIF_ART in js/screens/results.js');
});

test('every glyph is drawn in the clips and in the fallback', () => {
  same(keysOf(src('remotion/src/glyphs.tsx'), 'const BODIES'), GLYPHS, 'BODIES in remotion/src/glyphs.tsx');
  same(keysOf(src('js/screens/results.js'), 'const GLYPH_ART'), GLYPHS, 'GLYPH_ART in js/screens/results.js');
});
