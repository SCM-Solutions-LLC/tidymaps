import test from 'node:test';
import assert from 'node:assert/strict';
import { fridgePlan, fridgeParts, fridgeRowRun, FRIDGE_CARDS } from '../js/three/fridgePlan.js';
import { rowHeadroomFor, plainBoardClearance } from '../js/three/roomBoards.js';
import { MAP_1023, LAYOUT_1023 } from './fixtures/fridge-1023.mjs';

/* A fridge's rows are shelves, drawers, door bins and freezer baskets, and
   the 3D view drew every one of them as a glass shelf in one box: the first
   real French-door plan (2026-10-23) showed twelve shelves. fridgePlan says
   which part of which card each row is; these hold it to the card. */

const SIZE = { width: 36, height: 69, depth: 18 };
const plan = (setup, map = MAP_1023, layout = LAYOUT_1023) => fridgePlan({ setup, map, layout, ...SIZE });
const slotOf = (p, lv) => p.slots.get(MAP_1023.find(r => r.lv === lv).shelfIndex);

test('the 10-23 rows read as three shelves, three drawers, two door bins and four freezer parts', () => {
  const count = { shelf: 0, drawer: 0, door: 0, freezer: 0 };
  for (const { part } of fridgeParts(MAP_1023, LAYOUT_1023)) count[part]++;
  assert.deepEqual(count, { shelf: 3, drawer: 3, door: 2, freezer: 4 });
});

test('every card gives every row a place, and only the shelf rows a shelf', () => {
  for (const card of FRIDGE_CARDS) {
    const p = plan(card);
    assert.equal(p.slots.size, MAP_1023.length, `${card}: a row with nowhere to go`);
    const shelves = [...p.slots.values()].filter(s => s.part === 'shelf');
    assert.equal(shelves.length, 3, `${card}: fresh shelves`);
    assert.equal(new Set(shelves.map(s => s.y)).size, 3, `${card}: three shelves at three heights`);
    for (const s of shelves) {
      assert.ok(s.y >= p.fresh.y0 && s.y < p.fresh.y1, `${card}: a shelf outside the fresh compartment`);
    }
    for (const lv of ['Left door', 'Right door']) {
      assert.equal(slotOf(p, lv).kind, 'door', `${card}: ${lv} is not on a door`);
    }
  }
});

test('the French door hangs each door row on its own side', () => {
  const p = plan('frenchdoor');
  assert.equal(p.doors.length, 2);
  assert.equal(slotOf(p, 'Left door').hinge, 'left');
  assert.equal(slotOf(p, 'Right door').hinge, 'right');
});

test('the freezer is where each card keeps it', () => {
  const freezerSlots = (p) => [...p.slots.values()].filter(s => s.part === 'freezer');
  for (const card of ['frenchdoor', 'bottomfreezer']) {
    const p = plan(card);
    assert.equal(p.freezer.kind, 'drawer', card);
    for (const s of freezerSlots(p)) assert.ok(s.y < p.fresh.y0, `${card}: a freezer basket above the fresh shelves`);
  }
  const top = plan('topfreezer');
  for (const s of freezerSlots(top)) assert.ok(s.y > top.fresh.y1, 'top freezer: a freezer row below the fresh shelves');
  const side = plan('sidebyside');
  for (const s of freezerSlots(side)) assert.ok(s.x < side.freezer.x1, 'side-by-side: a freezer row on the fresh side');
  for (const s of [...side.slots.values()].filter(s => s.part === 'shelf')) {
    assert.ok(s.x > side.freezer.x1, 'side-by-side: a fresh shelf in the freezer column');
  }
});

test('a fridge with no card and no freezer rows is drawn fresh only', () => {
  const map = MAP_1023.filter(r => !/freez|ice/i.test(r.lv)).map((r, i) => ({ ...r, shelfIndex: i }));
  const p = fridgePlan({ setup: null, map, layout: null, ...SIZE });
  assert.equal(p.card, 'fresh');
  assert.equal(p.freezer, null);
});

test('one "Crisper drawers" row still draws two crisper fronts, and spans both', () => {
  const map = [
    { lv: 'Top shelf', zone: 'Drinks', shelfIndex: 0, surface: 'shelf' },
    { lv: 'Crisper drawers', zone: 'Leafy greens · Fruit', shelfIndex: 1, surface: 'drawer' },
  ];
  const p = fridgePlan({ setup: 'bottomfreezer', map, layout: null, ...SIZE });
  assert.equal(p.drawers.length, 2);
  assert.ok(p.slots.get(1).length > (p.fresh.x1 - p.fresh.x0) * 0.9, 'the one row spans the whole drawer level');
});

test('the card judges a fridge shelf by the shelf the drawing gives it', () => {
  /* The size arithmetic used to have no answer for a fridge, so a bin was
     never judged against its shelf; now it is the same fridgePlan answer. */
  const geometry = { ...SIZE, shelfCount: 12 };
  const layout = { ...LAYOUT_1023, setup: 'frenchdoor' };
  const run = fridgeRowRun({ setup: 'frenchdoor', map: MAP_1023, layout, geometry, index: 0 });
  assert.ok(run && run.gap > 8 && run.gap < 20, `top shelf gap ${run && run.gap}`);
  assert.equal(rowHeadroomFor('fridge', 'shelf', geometry, 0, { map: MAP_1023, layout }), plainBoardClearance(run.gap));
  assert.equal(rowHeadroomFor('fridge', 'shelf', geometry, 6, { map: MAP_1023, layout }), null, 'a door bin is not judged as a shelf');
});
