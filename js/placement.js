/* ============================================================
   Placement: which wall a plan row sits on, and how high.

   A plan's map is a flat list of rows ordered top to bottom, which is the
   right shape for a cabinet and the wrong one for a walk-in. A walk-in has
   three walls and a floor, each wall with its own top shelf, and the flat
   list reads as one impossibly tall unit: six "shelves", the first on the
   left wall and the fourth on the back wall. The report had no way to say
   "Left wall" over two rows and "Back wall" over the next two, and the 3D
   viewer guessed walls round-robin from the row index.

   The evidence for a row's wall is scattered: the model may say it outright
   (row.wall), the layout's sections may group rows by place, the level text
   has carried it for years ("Left wall: eye level"), and a floor or door
   surface is a wall of sorts. This module reads all four in one priority
   order so the report, the 3D builders and the step-to-row links agree on
   where a row is, instead of each parsing the level text its own way.

   Pure: no DOM, no state import, never mutates its input.
   ============================================================ */

/** @typedef {'left'|'back'|'right'|'front'|'floor'} Wall */
/** @typedef {'row'|'section'|'level'|'surface'} WallSource */

/**
 * @typedef {object} RowPlacement
 * @property {Wall|null} wall
 * @property {number} tier       0 is the top row on that wall
 * @property {number} tiers      how many rows share that wall
 * @property {boolean} eye
 * @property {WallSource|null} source  which evidence placed the row
 */

/**
 * @typedef {object} Placement
 * @property {'room'|'unit'} kind
 * @property {{id: string, label: string, rows: number[]}[]} walls  non-empty groups, in wall order, rows top to bottom
 * @property {Map<number, RowPlacement>} byRow  keyed by shelfIndex
 */

/** @type {Wall[]} */
export const WALLS = ['left', 'back', 'right', 'front', 'floor'];

/** @type {Record<Wall, string>} */
export const WALL_LABEL = {
  left: 'Left wall',
  back: 'Back wall',
  right: 'Right wall',
  front: 'Front wall',
  floor: 'Floor',
};

/** @type {Set<string>} */
const WALL_SET = new Set(WALLS);

/* Walls that make a room when two of them are known. The floor does not
   count: a garage rack has a floor level and is still one unit. */
const ROOM_WALLS = new Set(['left', 'back', 'right', 'front']);

/* Archetypes that are rooms whatever the rows say. A walk-in whose rows all
   came back as "Top shelf" is still a walk-in; the report should offer its
   walls and the builders should not fall back to a single tall unit. */
const ROOM_ARCHETYPES = new Set(['walkin-u', 'l-run']);

/* The layout's `place` vocabulary (PLACES in layout.js) is per archetype:
   the L-run calls its two runs run-a and run-b, which the 3D builder draws
   on the back and the right. The other places (upper, lower, bench, wall)
   are heights or fixtures, not walls, and say nothing about where a row is. */
/** @type {Record<string, Wall>} */
const PLACE_WALL = { 'run-a': 'back', 'run-b': 'right' };

/** @param {unknown} place @returns {Wall|null} */
export function wallFromPlace(place) {
  if (typeof place !== 'string') return null;
  if (WALL_SET.has(place)) return /** @type {Wall} */ (place);
  return PLACE_WALL[place] || null;
}

/* Read from the head of the level text only, the part before the first
   colon. The tail describes height on that wall ("Left wall: eye level"),
   and reading it would turn "Hanging rod: left" into a left wall when it is
   a rod on the left of a reach-in.

   The anchored rules run first. The L-run closet template ends on
   "Floor / corner", and an unanchored /corner/ checked before /^floor/ put
   the floor on the back wall. "Front shelf" is the walk-in's door rack after
   SURFACE_PHRASES renames it (setupStructure.js), so it is a front row too. */
/** @type {[RegExp, Wall][]} */
const LEVEL_WALL_RULES = [
  [/^floor\b/,                       'floor'],
  [/^door\b|^front\b|\bdoor rack\b/, 'front'],
  [/\bleft wall\b|\bleft run\b/,     'left'],
  [/\bback wall\b|\blong run\b|\bcorner\b/, 'back'],
  [/\bright wall\b|\bshort run\b/,   'right'],
];

/** @param {unknown} text @returns {Wall|null} */
export function wallFromLevel(text) {
  if (typeof text !== 'string' || !text) return null;
  const head = text.split(':')[0].trim().toLowerCase();
  if (!head) return null;
  for (const [re, wall] of LEVEL_WALL_RULES) {
    if (re.test(head)) return wall;
  }
  return null;
}

/* Which wall each section puts its rows on. `place` is the model's own
   answer and wins; the id is read when place is missing, because the older
   plans and the demo scenarios name sections "left", "run-b" or "corner"
   with no place at all. A section nothing can read ("main") places nothing,
   so its rows fall through to the level text rather than being pinned to
   nowhere.
   @param {unknown} sections
   @param {number} rowCount
   @returns {Map<number, Wall>} shelfIndex -> wall, only where a wall is known */
export function placementFromSections(sections, rowCount) {
  /** @type {Map<number, Wall>} */
  const out = new Map();
  if (!Array.isArray(sections)) return out;
  for (const sec of sections) {
    if (!sec || !Array.isArray(sec.rows)) continue;
    const wall = wallFromPlace(sec.place) || wallFromPlace(sec.id) || wallFromLevel(sec.id);
    if (!wall) continue;
    for (const r of sec.rows) {
      if (!Number.isInteger(r) || r < 0 || r >= rowCount || out.has(r)) continue;
      out.set(r, wall);
    }
  }
  return out;
}

/**
 * @param {any} row
 * @param {number} shelfIndex
 * @param {Map<number, Wall>} sectionWall
 * @returns {[Wall|null, WallSource|null]}
 */
function wallForRow(row, shelfIndex, sectionWall) {
  if (typeof row.wall === 'string' && WALL_SET.has(row.wall)) return [row.wall, 'row'];
  const fromSection = sectionWall.get(shelfIndex);
  if (fromSection) return [fromSection, 'section'];
  const fromLevel = wallFromLevel(row.lv || row.level);
  if (fromLevel) return [fromLevel, 'level'];
  if (row.surface === 'floor') return ['floor', 'surface'];
  if (row.surface === 'door') return ['front', 'surface'];
  return [null, null];
}

/* Tier numbers within one wall. The model's own `tier` decides the order
   when every row on the wall has one and no two agree, because a
   half-numbered wall (tiers 0, 2 and nothing) is a wall the model only half
   placed. Otherwise the plan's top-to-bottom order stands in, which is right
   for the rows the templates produce. A floor row is the bottom of its wall
   whatever its tier says: "Left wall: floor" with tier 0 and a shelf with
   tier 1 is the model mislabelling, not a floor above a shelf.

   The numbers themselves survive only when they already run 0, 1, 2 down
   the sorted wall. A consumer reads `tier` against `tiers`, the count of
   rows on that wall, so tiers 0 and 2 on a two-row wall handed it a row at
   tier 2 of 2: a gap the model skipped became a shelf that is not there.
   A wall with a gap keeps the model's order and is renumbered from 0.
   @param {{idx: number, row: any}[]} entries
   @returns {{idx: number, row: any, tier: number}[]} in tier order */
function tierRows(entries) {
  const explicit = entries.every(e => Number.isInteger(e.row.tier) && e.row.tier >= 0)
    && new Set(entries.map(e => e.row.tier)).size === entries.length;
  const isFloor = e => e.row.surface === 'floor' ? 1 : 0;
  const key = e => (explicit ? e.row.tier : e.idx);
  const ordered = entries.slice().sort((a, b) => (isFloor(a) - isFloor(b)) || (key(a) - key(b)));
  const keepExplicit = explicit && ordered.every((e, k) => e.row.tier === k);
  return ordered.map((e, k) => ({ idx: e.idx, row: e.row, tier: keepExplicit ? e.row.tier : k }));
}

/**
 * @param {any[]|null|undefined} map  raw rows ({level}) or normalized rows ({lv}); either is read
 * @param {{layout?: any, archetype?: string|null}} [opts]
 * @returns {Placement}
 */
export function placementFor(map, { layout, archetype } = {}) {
  const rows = Array.isArray(map) ? map.filter(r => r && typeof r === 'object') : [];
  const sectionWall = placementFromSections(layout && layout.sections, rows.length);

  /** @type {Map<string, {idx: number, row: any, source: WallSource|null}[]>} */
  const groups = new Map();
  const seen = new Set();
  rows.forEach((row, i) => {
    const idx = Number.isInteger(row.shelfIndex) ? row.shelfIndex : i;
    // Two rows on one shelfIndex are one shelf in the viewer; the first says where it is.
    if (seen.has(idx)) return;
    seen.add(idx);
    const [wall, source] = wallForRow(row, idx, sectionWall);
    const id = wall || 'other';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push({ idx, row, source });
  });

  /** @type {Placement['walls']} */
  const walls = [];
  /** @type {Map<number, RowPlacement>} */
  const byRow = new Map();
  for (const id of [...WALLS, 'other']) {
    const entries = groups.get(id);
    if (!entries || !entries.length) continue;
    const tiered = tierRows(entries);
    const wall = id === 'other' ? null : /** @type {Wall} */ (id);
    let label = wall ? WALL_LABEL[wall] : 'Other';
    // A front made only of door surfaces is the door; the label says so,
    // because "Front" on a cabinet reads as the cabinet's face.
    if (id === 'front' && entries.every(e => e.row.surface === 'door')) label = 'Door';
    walls.push({ id, label, rows: tiered.map(e => e.idx) });
    for (const e of tiered) {
      byRow.set(e.idx, {
        wall,
        tier: e.tier,
        tiers: tiered.length,
        eye: !!e.row.eye,
        source: entries.find(x => x.idx === e.idx).source,
      });
    }
  }

  const knownWalls = new Set([...groups.keys()].filter(id => ROOM_WALLS.has(id)));
  const kind = ROOM_ARCHETYPES.has(archetype) || knownWalls.size >= 2 ? 'room' : 'unit';

  return { kind, walls, byRow };
}

/* The level text without its wall. "Back wall: eye level" says two things,
   and once the report groups rows under a wall tab the first of them is
   said already; the row then reads "Eye level". Only a head that IS a wall
   comes off, and only when a colon separates it from the rest: "Hanging
   rod: left" keeps its rod, and a bare "Floor" keeps its name. A unit never
   calls this (its "Unit 2: middle shelf" is not a wall and stays whole), so
   the rule is the same one whereFor reads below.
   @param {unknown} text @returns {string} */
export function levelLabel(text) {
  if (typeof text !== 'string') return '';
  const i = text.indexOf(':');
  if (i < 0 || !wallFromLevel(text)) return text.trim();
  const rest = text.slice(i + 1).trim();
  if (!rest) return text.trim();
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/* The row a shelfIndex names, read the way placementFor keys its rows: a
   row's own shelfIndex when it has one, its position otherwise. A step's
   `rows` list is in shelfIndex terms, so a map whose rows carry shelfIndex
   out of order still finds the right row.
   @param {any[]} rows @param {number} idx @returns {any|null} */
function rowAt(rows, idx) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || typeof r !== 'object') continue;
    const key = Number.isInteger(r.shelfIndex) ? r.shelfIndex : i;
    if (key === idx) return r;
  }
  return null;
}

/* Where a step happens, for the line under its task. Rooms name the wall;
   units the level. "Back wall · Eye level" for a walk-in, "Drawer 3 of 4"
   for a chest, and nothing at all when the step's rows name no row the map
   has, because a where-line that says "" is worse than no line. A row in
   the "Other" group of a room has no wall to name and gives its level
   alone. Three places at most are spelled out; past that the line counts
   the rest, since a step touching every shelf is a step about the whole
   space. Repeats collapse: two rows on one wall at one level are one place.
   @param {unknown} rows  shelfIndex list from the step
   @param {any[]|null|undefined} map
   @param {Placement|null|undefined} placement
   @returns {string} */
export function whereFor(rows, map, placement) {
  if (!Array.isArray(rows) || !Array.isArray(map)) return '';
  const room = !!(placement && placement.kind === 'room');
  const walls = (placement && Array.isArray(placement.walls)) ? placement.walls : [];
  /** @type {string[]} */
  const labels = [];
  for (const idx of rows) {
    if (!Number.isInteger(idx)) continue;
    const row = rowAt(map, idx);
    if (!row) continue;
    const text = typeof row.lv === 'string' ? row.lv : (typeof row.level === 'string' ? row.level : '');
    const lvl = room ? levelLabel(text) : text.trim();
    const wall = room ? walls.find(w => w && w.id !== 'other' && Array.isArray(w.rows) && w.rows.includes(idx)) : null;
    const label = [wall ? wall.label : '', lvl].filter(Boolean).join(' · ');
    if (label && !labels.includes(label)) labels.push(label);
  }
  if (!labels.length) return '';
  if (labels.length <= 3) return labels.join(', ');
  return `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`;
}

/* The walls worth heading a list with: a room's walls when at least one row
   resolved to a real wall. A walk-in whose rows all came back "Top shelf" is
   still a room, but one "Other" heading over every row says nothing, so the
   export and the after-drawing print the flat list instead. */
export function wallGroups(placement){
  if(!placement||placement.kind!=='room'||!Array.isArray(placement.walls)) return null;
  return placement.walls.some(w=>w.id!=='other')?placement.walls:null;
}

/* How many of a plan's zones name a wall. The report can only offer wall
   tabs when the rows resolve to walls, so this is the count that says whether
   a walk-in came back as a room or as one tall unit. Counted per map row, the
   way the privacy page describes it, from the same placement the report reads:
   the level text and the layout's sections are enough, because the archetype
   only decides room against unit, not which rows have a wall. */
export function wallsPlaced(plan){
  const rows=(plan&&Array.isArray(plan.map))?plan.map.filter(r=>r&&typeof r==='object'):[];
  const placement=placementFor(rows, { layout: plan&&plan.layout });
  return rows.reduce((n,row,i)=>{
    const idx=Number.isInteger(row.shelfIndex)?row.shelfIndex:i;
    const at=placement.byRow.get(idx);
    return n+(at&&at.wall?1:0);
  }, 0);
}
