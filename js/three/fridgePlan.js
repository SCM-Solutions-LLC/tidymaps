/* ============================================================
   Fridge plan: where each row of a fridge plan sits in the drawing.

   Every other unit is one stack of levels, so row 3 sits on board 3. A
   fridge is not. Its rows are shelves, crisper drawers, door bins and
   freezer baskets, and the first real fridge plan (2026-10-23, a French
   door with twelve rows) was drawn as twelve glass shelves stacked in one
   box: the door bins and the freezer baskets became shelves inside it.

   This module decides, from the card the user picked (top freezer, bottom
   freezer, side-by-side, French door) and the plan's rows, which part of
   the fridge each row is (fresh shelf, drawer, door bin, freezer) and the
   box it occupies. The builder draws from it, and the size arithmetic (how
   tall a bin may stand on a fresh shelf) reads the same answer, so the
   drawing and the card cannot disagree.

   Coordinates match the builders: x across the front, centred on 0; y up
   from the floor; z from the back wall (-D/2) to the front (+D/2). Inches.

   Pure: no DOM, no three.js, never mutates its input.
   ============================================================ */

import { surfaceFromLevelText } from '../layout.js';
import { openDoor, binOf, doorSlot } from './doorBins.js';

export const FRIDGE_T = 0.75;

/** The cards, by setup id. A plan with no card reads as a bottom freezer
    when it has freezer rows and as a fresh-only fridge when it has none. */
export const FRIDGE_CARDS = ['topfreezer', 'bottomfreezer', 'sidebyside', 'frenchdoor'];

const MAX_LEVELS = 6;
const CRISPER_H = 8;
const DRAWER_H = 5;
const CRISPER_WORDS = /\bcrispers?\b|\bproduce\b|\bveg|\bfruit|\bsalad|\bgreens\b/i;
const FREEZER_WORDS = /\bfreez|\bice\b/i;
const DOOR_WORDS = /\bdoors?\b/i;

function rowText(row) {
  return [row && (row.lv || row.level), row && row.zone].filter(Boolean).join(' ');
}

/* The part of the fridge a row belongs to: 'door', 'freezer', 'drawer'
   (a crisper or a deli drawer in the fresh compartment) or 'shelf'. A row
   the plan filed under a freezer or door section is that part whatever its
   own words say, and a freezer door bin is a door.
   @param {any} row @param {string|null} surface @param {string} sectionText */
function partOf(row, surface, sectionText) {
  const lv = String((row && (row.lv || row.level)) || '');
  const door = surface === 'door' || DOOR_WORDS.test(lv) || /\bdoor/i.test(sectionText);
  if (door) return 'door';
  if (FREEZER_WORDS.test(lv) || /freez/i.test(sectionText)) return 'freezer';
  if (surface === 'drawer' || /\bdrawers?\b|\bcrispers?\b|\bdeli\b/i.test(lv)) return 'drawer';
  return 'shelf';
}

/* The section text each row index was filed under, joined id and label. */
function sectionTextByRow(layout) {
  /** @type {Map<number, string>} */
  const out = new Map();
  const sections = layout && Array.isArray(layout.sections) ? layout.sections : [];
  for (const sec of sections) {
    const text = `${sec && sec.id || ''} ${sec && sec.label || ''}`;
    for (const r of (sec && Array.isArray(sec.rows) ? sec.rows : [])) {
      if (Number.isInteger(r) && !out.has(r)) out.set(r, text);
    }
  }
  return out;
}

/* Each row's part, keyed by the row's shelfIndex (its position when it has
   none). Exported for the zone list, which counts rows by part.
   @param {any[]} map @param {any} [layout]
   @returns {{index: number, row: any, part: 'shelf'|'drawer'|'door'|'freezer'}[]} */
export function fridgeParts(map, layout) {
  const rows = Array.isArray(map) ? map : [];
  const filed = sectionTextByRow(layout);
  const surfaceFor = layout && typeof layout.surfaceFor === 'function' ? layout.surfaceFor : null;
  return rows.map((row, i) => {
    const index = Number.isInteger(row && row.shelfIndex) ? row.shelfIndex : i;
    const surface = (row && row.surface) || (surfaceFor ? surfaceFor(index) : null)
      || surfaceFromLevelText(row && (row.lv || row.level));
    return { index, row, part: partOf(row, surface, filed.get(index) || '') };
  });
}

/* Rows dealt onto at most `max` levels, top to bottom, in plan order: the
   first levels take one more row each when the rows do not divide evenly,
   so twelve shelf rows read as six shelves of two, side by side.
   @template T @param {T[]} rows @param {number} max @returns {T[][]} */
function dealLevels(rows, max) {
  const levels = Math.min(rows.length, max);
  if (!levels) return [];
  const base = Math.floor(rows.length / levels);
  let extra = rows.length % levels;
  const out = [];
  let at = 0;
  for (let k = 0; k < levels; k++) {
    const take = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    out.push(rows.slice(at, at + take));
    at += take;
  }
  return out;
}

/* Drawer rows in plan order, two crispers side by side on one level, every
   other drawer full width on its own. */
function drawerLevels(rows) {
  const out = [];
  for (const entry of rows) {
    const last = out[out.length - 1];
    const crisper = CRISPER_WORDS.test(rowText(entry.row));
    if (crisper && last && last.crisper && last.rows.length < 2) last.rows.push(entry);
    else out.push({ crisper, rows: [entry] });
  }
  return out;
}

/* Side-by-side slots across one span. */
function across(entries, x0, x1) {
  const w = (x1 - x0) / Math.max(1, entries.length);
  return entries.map((entry, k) => ({ entry, x: x0 + w * (k + 0.5), w }));
}

/**
 * The whole fridge, laid out.
 * @param {{ setup?: string|null, map: any[], layout?: any, width: number, height: number, depth: number }} input
 */
export function fridgePlan({ setup, map, layout, width, height, depth }) {
  const T = FRIDGE_T;
  const W = Math.max(8, Number(width) || 30);
  const H = Math.max(10, Number(height) || 60);
  const D = Math.max(4, Number(depth) || 14);
  const parts = fridgeParts(map, layout);
  const by = (p) => parts.filter(e => e.part === p);
  const freezerRows = by('freezer');
  const card = FRIDGE_CARDS.includes(String(setup)) ? String(setup)
    : freezerRows.length ? 'bottomfreezer' : 'fresh';

  const inX0 = -W / 2 + T, inX1 = W / 2 - T;
  const top = H - T, floor = T;
  /** @type {{x0:number,x1:number,y0:number,y1:number}} */
  let fresh = { x0: inX0, x1: inX1, y0: floor, y1: top };
  /** @type {{x0:number,x1:number,y0:number,y1:number, kind:'drawer'|'compartment'|'column'}|null} */
  let freezer = null;
  const dividers = [];
  if (card === 'bottomfreezer' || card === 'frenchdoor') {
    const fh = Math.max(12, Math.min(26, H * 0.3));
    freezer = { x0: inX0, x1: inX1, y0: floor, y1: floor + fh, kind: 'drawer' };
    fresh = { x0: inX0, x1: inX1, y0: floor + fh + T, y1: top };
    dividers.push({ axis: 'y', at: floor + fh + T / 2 });
  } else if (card === 'topfreezer') {
    const fh = Math.max(10, Math.min(22, H * 0.27));
    freezer = { x0: inX0, x1: inX1, y0: top - fh, y1: top, kind: 'compartment' };
    fresh = { x0: inX0, x1: inX1, y0: floor, y1: top - fh - T };
    dividers.push({ axis: 'y', at: top - fh - T / 2 });
  } else if (card === 'sidebyside') {
    const fw = (W - 2 * T) * 0.4;
    freezer = { x0: inX0, x1: inX0 + fw, y0: floor, y1: top, kind: 'column' };
    fresh = { x0: inX0 + fw + T, x1: inX1, y0: floor, y1: top };
    dividers.push({ axis: 'x', at: inX0 + fw + T / 2 });
  }

  /** @type {Map<number, any>} */
  const slots = new Map();
  const boards = [];        // glass shelves: { x0, x1, y, z0, z1 }
  const drawers = [];       // drawer boxes: { x, w, y, h, crisper }

  /* The fresh compartment, bottom up: drawer levels, then shelves. */
  const levelsOfDrawers = drawerLevels(by('drawer'));
  let y = fresh.y0;
  for (const level of levelsOfDrawers.slice().reverse()) {
    const h = level.crisper ? CRISPER_H : DRAWER_H;
    const fronts = level.crisper && level.rows.length === 1 && (fresh.x1 - fresh.x0) > 22 ? 2 : level.rows.length;
    for (const s of across(Array.from({ length: fronts }), fresh.x0, fresh.x1)) {
      drawers.push({ x: s.x, w: s.w, y, h, crisper: level.crisper });
    }
    for (const s of across(level.rows, fresh.x0, fresh.x1)) {
      slots.set(s.entry.index, {
        index: s.entry.index, part: 'drawer', kind: 'drawer', x: s.x, y, z: 0,
        length: s.w - 1, gap: h - 0.5, depth: D - T, drawn: { pull: 0 },
      });
    }
    y += h;
  }
  const drawerTop = y;
  if (levelsOfDrawers.length) boards.push({ x0: fresh.x0, x1: fresh.x1, y: drawerTop, cover: true });

  /* Doors are dealt before the shelves so a fridge with no shelf rows still
     knows its door bins. */
  const shelfLevels = dealLevels(by('shelf'), MAX_LEVELS);
  const L = shelfLevels.length;
  const pitch = L ? (fresh.y1 - drawerTop) / L : 0;
  shelfLevels.forEach((level, k) => {
    const by_ = drawerTop + (L - 1 - k) * pitch;
    if (k < L - 1 || !levelsOfDrawers.length) {
      if (by_ > fresh.y0 + 0.5) boards.push({ x0: fresh.x0, x1: fresh.x1, y: by_ });
    }
    for (const s of across(level, fresh.x0, fresh.x1)) {
      slots.set(s.entry.index, {
        index: s.entry.index, part: 'shelf', kind: 'shelf', x: s.x, y: by_, z: 0,
        length: s.w - 1, gap: pitch, depth: D - T, level: k,
      });
    }
  });

  /* The freezer. A drawer (bottom freezer, French door) pulls out with an
     upper tray and a deep basket split side by side; a compartment (top
     freezer) has one shelf over its floor; a column (side-by-side) is
     shelved like the fresh side. */
  const freezerBaskets = [];
  if (freezer) {
    const fz = freezer;
    if (fz.kind === 'drawer') {
      const pull = D * 0.5;
      const trayH = 4;
      const basketH = Math.max(4, fz.y1 - fz.y0 - trayH - 1.5);
      const tray = freezerRows.length > 1 ? freezerRows.slice(0, 1) : [];
      const deep = freezerRows.length > 1 ? freezerRows.slice(1) : freezerRows;
      const trayY = fz.y0 + basketH + 1;
      for (const s of across(tray, fz.x0, fz.x1)) {
        slots.set(s.entry.index, { index: s.entry.index, part: 'freezer', kind: 'drawer', x: s.x, y: trayY, z: pull, length: s.w - 1, gap: trayH - 0.5, depth: D * 0.55 });
      }
      for (const s of across(deep, fz.x0, fz.x1)) {
        slots.set(s.entry.index, { index: s.entry.index, part: 'freezer', kind: 'drawer', x: s.x, y: fz.y0 + 0.5, z: pull, length: s.w - 1, gap: basketH - 0.5, depth: D * 0.7 });
      }
      freezerBaskets.push({ x0: fz.x0, x1: fz.x1, y: fz.y0 + 0.5, h: basketH, pull, splits: Math.max(1, deep.length) });
      if (tray.length) freezerBaskets.push({ x0: fz.x0, x1: fz.x1, y: trayY, h: trayH, pull, splits: 1, tray: true });
    } else {
      const max = fz.kind === 'compartment' ? 2 : MAX_LEVELS;
      const levels = fz.kind === 'compartment' && freezerRows.length > 1
        ? [freezerRows.slice(0, 1), freezerRows.slice(1)]
        : dealLevels(freezerRows, max);
      const n = Math.max(1, levels.length);
      const fp = (fz.y1 - fz.y0) / n;
      levels.forEach((level, k) => {
        const ly = fz.y0 + (n - 1 - k) * fp;
        if (k < n - 1) boards.push({ x0: fz.x0, x1: fz.x1, y: ly, freezer: true });
        for (const s of across(level, fz.x0, fz.x1)) {
          slots.set(s.entry.index, { index: s.entry.index, part: 'freezer', kind: 'shelf', x: s.x, y: ly, z: 0, length: s.w - 1, gap: fp, depth: D - T });
        }
      });
      if (!levels.length && fz.kind === 'column') {
        for (let k = 1; k < 4; k++) boards.push({ x0: fz.x0, x1: fz.x1, y: fz.y0 + k * (fz.y1 - fz.y0) / 4, freezer: true });
      }
    }
  }

  /* Doors, by card, each drawn swung open so its bins face the camera
     (js/three/doorBins.js). */
  /** @type {{ role: string, hinge: 'left'|'right', x0: number, x1: number, y0: number, y1: number, bins: number, rows: any[] }[]} */
  const specs = [];
  const door = (role, hinge, x0, x1, y0, y1, bins) => {
    specs.push({ role, hinge, x0, x1, y0, y1, bins, rows: [] });
  };
  const fullX0 = -W / 2, fullX1 = W / 2;
  const tall = (y0, y1) => (y1 - y0 > 30 ? 3 : 2);
  if (card === 'frenchdoor') {
    door('fresh', 'left', fullX0, 0, fresh.y0 - T, H, tall(fresh.y0, H));
    door('fresh', 'right', 0, fullX1, fresh.y0 - T, H, tall(fresh.y0, H));
  } else if (card === 'bottomfreezer') {
    door('fresh', 'right', fullX0, fullX1, fresh.y0 - T, H, tall(fresh.y0, H));
  } else if (card === 'topfreezer') {
    door('freezer', 'right', fullX0, fullX1, (freezer ? freezer.y0 : H) - T, H, 2);
    door('fresh', 'right', fullX0, fullX1, 0, fresh.y1 + T, tall(0, fresh.y1));
  } else if (card === 'sidebyside') {
    const split = freezer ? freezer.x1 + T / 2 : 0;
    door('freezer', 'left', fullX0, split, 0, H, 3);
    door('fresh', 'right', split, fullX1, 0, H, 3);
  } else {
    door('fresh', 'right', fullX0, fullX1, 0, H, tall(0, H));
  }

  /* Door rows onto doors: a row that names the freezer goes on the freezer
     door when there is one, a row that names a side goes on that side's
     door, and the rest are dealt across the fresh doors in turn. */
  const doorRows = by('door');
  const fz = specs.filter(d => d.role === 'freezer');
  const fr = specs.filter(d => d.role === 'fresh');
  let turn = 0;
  for (const entry of doorRows) {
    const text = rowText(entry.row);
    let target = null;
    if (FREEZER_WORDS.test(text) && fz.length) target = fz[0];
    else if (fr.length > 1 && /\bleft\b/i.test(text)) target = fr.find(d => d.hinge === 'left') || null;
    else if (fr.length > 1 && /\bright\b/i.test(text)) target = fr.find(d => d.hinge === 'right') || null;
    if (!target) target = fr[turn++ % Math.max(1, fr.length)] || specs[0];
    target.rows.push(entry);
  }
  const doors = specs.map(spec => openDoor({ ...spec, bins: Math.min(5, Math.max(spec.bins, spec.rows.length)) }));
  for (const d of doors) {
    d.rows.forEach((entry, t) => {
      slots.set(entry.index, doorSlot(entry.index, d, binOf(t, d.rows.length, d.bins), D / 2));
    });
  }

  /* Any row not placed above (none should be) still gets a slot: the
     zone list names every row, so the drawing must have somewhere for it. */
  for (const entry of parts) {
    if (!slots.has(entry.index)) {
      slots.set(entry.index, { index: entry.index, part: entry.part, kind: 'shelf', x: 0, y: fresh.y0, z: 0, length: fresh.x1 - fresh.x0 - 1, gap: 6, depth: D - T });
    }
  }

  return { card, W, H, D, T, fresh, freezer, dividers, boards, drawers, freezerBaskets, doors, slots, parts };
}

/* The run and headroom one fridge row is drawn with, for the size
   arithmetic, or null for a row that is not a plain shelf (drawers and
   door bins publish their own box and are not judged by a board).
   @param {{ setup?: string|null, map: any[], layout?: any, geometry: any, index: number }} input */
export function fridgeRowRun({ setup, map, layout, geometry, index }) {
  const g = geometry || {};
  const plan = fridgePlan({ setup, map, layout, width: g.width, height: g.height, depth: g.depth });
  const slot = plan.slots.get(index);
  if (!slot || slot.kind !== 'shelf') return null;
  return { kind: 'shelf', length: slot.length, gap: slot.gap };
}
