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

test('motif derivation: rails for closets, drawers for drawer banks, bench for garage, shelves otherwise', () => {
  assert.equal(motifForSpace('closet'), 'rail');
  assert.equal(motifForSpace('walkin'), 'rail');
  assert.equal(motifForSpace('drawers'), 'drawers');
  assert.equal(motifForSpace('junk'), 'drawers');
  assert.equal(motifForSpace('garage'), 'bench');
  assert.equal(motifForSpace('pantry'), 'shelves');
  assert.equal(motifForSpace('unknown-space'), 'shelves');
  for (const s of ['closet','drawers','garage','pantry']) {
    assert.ok(MOTIFS.includes(motifForSpace(s)));
  }
});

test('glyph derivation: step text wins, space default fills in', () => {
  assert.equal(glyphForStep({ t: 'Line up shoes toe-out', w: '' }, 'closet'), 'shoe');
  assert.equal(glyphForStep({ t: 'Stack cans by type', w: '' }, 'pantry'), 'can');
  assert.equal(glyphForStep({ t: 'Straighten things up', w: '' }, 'pantry'), 'can');   // space default
  assert.equal(glyphForStep({ t: 'Straighten things up', w: '' }, 'garage'), 'tool');  // space default
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
