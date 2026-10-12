/* ============================================================
   Room boards: how a walk-in or an L-shaped room is shelved.

   A unit (a cabinet, a bank of drawers) is one stack of levels, so the plan's
   rows and the drawing's boards are the same list: row 3 sits on board 3. A
   room is not. It has three walls, each with its own top shelf, and the
   plan's flat list of rows is spread across them. The builders used to draw
   one board per ROW on every wall, so a 12-row pantry became 12 boards
   stacked on each of three walls, and rows were dealt onto walls round-robin
   by their index, with no regard for the wall the plan named.

   This module decides, for a room, how many boards each wall carries (the
   same N on every wall, at the same heights, because a fitted room is one
   system), which wall each row is on (the same answer the report's wall tabs
   give, from placementFor), and which board of its wall a row sits on. The
   builders draw from it; the screen derives a room's board count from it;
   the sidebar counts walls with it. One copy of each piece of arithmetic
   the room drawing depends on lives here, so the run length a board is drawn
   at and the run length a product is judged against cannot drift apart.

   Pure: no DOM, no three.js, never mutates its input.
   ============================================================ */

import { placementFor, placementFromSections } from '../placement.js';
import { normalizeViewerGeometry, roomGeometryFor } from './viewerOptions.js';

export const ROOM_TYPES = ['walkin-u', 'l-run'];

/** @param {unknown} type */
export function isRoomLayout(type){
  return ROOM_TYPES.includes(/** @type {string} */ (type));
}

/* The least a board can be from the one above it and still hold something:
   a can is 5 inches, a cereal box 12, and the board itself is three quarters
   of an inch. Nine is the pitch of the tightest pantry shelving sold. */
export const MIN_BOARD_PITCH = 9;

/* Saved arrangements. Version 2 stored a room's shelfCount as the number of
   plan rows (tiers), which is what the builders drew then; version 3 stores
   boards per wall. See arrangementGeometryFor. */
export const ARRANGEMENT_VERSION = 3;

/* The board thickness every builder uses. */
const T = 0.75;

/* The drawn walls of each room, in the order rows are dealt onto them when
   the plan does not say, and the order the plan lists them. A walk-in wraps
   three walls; an L has its long back run and one side run. */
const DRAWN_WALLS = {
  'walkin-u': ['left', 'back', 'right'],
  'l-run': ['back', 'side'],
};

/* Where a placement wall lands in the drawing. The L-run draws its short
   run on whichever side the layout says (lSide), so a plan that puts rows
   on the left and a plan that puts them on the right both mean "the side
   run". front and other are not drawn anywhere and go to the emptiest wall. */
function drawnWallFor(type, placementWall){
  if(type==='l-run'){
    if(placementWall==='left'||placementWall==='right') return 'side';
    if(placementWall==='back') return 'back';
    return null;
  }
  if(placementWall==='left'||placementWall==='back'||placementWall==='right') return placementWall;
  return null;
}

/* Boards per wall. The most rows any one wall carries sets the count, since
   every wall draws the same boards and the fullest wall needs one per row.
   Fewer than three reads as a bare room rather than a shelved one, and the
   height caps it: one board per MIN_BOARD_PITCH of height, two inches off
   for the floor slab and the top board's own thickness, so a room is never
   drawn denser than that. It is a density guard, not a pitch guarantee:
   the room spread (viewerOptions.roomShelfFracs) puts N boards in N+1
   compartments of 0.92h/(N+1), which in an 8-foot room falls under nine
   inches from nine boards (8.8) to the cap of ten (8.0); one row per board
   was judged worth more than the last inch, since two rows on one board
   draw their items on top of each other. Twelve is the schema's row
   ceiling. A room too low for three boards gets what fits, never fewer
   than one.
   @param {number[]} rowsPerWall  row counts of the drawn walls, floor rows excluded
   @param {number} height  inches */
export function boardCountFor(rowsPerWall, height){
  const rows=Array.isArray(rowsPerWall)?rowsPerWall.map(n=>Number(n)||0):[];
  const most=rows.length?Math.max(...rows):0;
  const h=Number(height)||0;
  const cap=Math.max(1,Math.min(12,Math.floor((h-2)/MIN_BOARD_PITCH)));
  const least=Math.min(3,cap);
  return Math.max(least,Math.min(cap,most));
}

/* The heights of a geometry's boards, in inches, index 0 the top board. The
   same clamp the scene applies to every layout: a board is never drawn in
   the floor slab or within 3.2 inches of the ceiling, and a fraction past
   0.86 means "on the floor" and snaps there, so a unit's bottom level (the
   last of an even spread) IS the floor, while a room's boards
   (viewerOptions.roomShelfFracs) all stay above it. Exported so the screen's
   size arithmetic (how tall an organizer may be on a given board) reads the
   heights the drawing uses.
   @param {number[]} fracs  measured from the top, strictly increasing
   @param {number} height */
export function boardYsFromFracs(fracs, height){
  const H=Number(height)||0;
  return (Array.isArray(fracs)?fracs:[]).map(frac=>{
    const f=Number(frac);
    let y=Math.max(T, Math.min(H*(1-f), H-T-3.2));
    if(f>=0.86) y=T;
    return y;
  });
}

/** @param {any} geometry  a viewer geometry ({height, shelfCount, shelfYFracs}) */
export function boardYsFor(geometry){
  const g=normalizeViewerGeometry(geometry);
  return boardYsFromFracs(g.shelfYFracs, g.height);
}

/* The space over each board: up to the next board above it, or to the
   underside of the top panel for the highest one. scene.js draws from this,
   and the product card reads it (js/catalog.js rowHeadroomFor), so the
   headroom a pick is drawn under and the headroom it is judged against are
   one number.
   @param {number[]} boardYs @param {number} height */
export function gapsAboveFor(boardYs, height){
  const H=Number(height)||0;
  const ys=Array.isArray(boardYs)?boardYs:[];
  return ys.map(y=>{
    const above=ys.filter(o=>o>y+0.5);
    const ceil=above.length?Math.min(...above):H-T;
    return Math.max(2.2, ceil-y);
  });
}

/* What an organizer may stand as tall as on a plain board: the gap above it
   less the board over it. scene.js surfaceClearance is this for every
   surface whose builder publishes `gap: gapAbove[i]` and nothing else. */
export function plainBoardClearance(gap){
  return Number(gap)-T;
}

/* The layouts whose shelf and floor rows are plain boards in that sense.
   Drawers publish their own box height, a rod carries no organizer, and a
   floating shelf and a rack's top shelf are open above, so none of those is
   answered here. A room's boards are plain too, but which one a row sits on
   is the room plan's to say (roomRowRun). */
const PLAIN_BOARD_LAYOUTS = new Set(['cabinet', 'closet-rod', 'closet-system']);

/* The headroom the drawing gives one row of a plain-board layout or a room,
   or null when this module cannot say (see PLAIN_BOARD_LAYOUTS). Null means
   "do not judge height by the row", never "it fits". A room needs the plan
   (`map`, `layout`) to place the row, and is null without one.
   @param {string} type  the layout drawn
   @param {string} surface  the row's surface kind
   @param {any} geometry  a viewer geometry
   @param {number} index  the row's shelfIndex
   @param {{map?: any[], layout?: any}} [plan]  the plan, for a room */
export function rowHeadroomFor(type, surface, geometry, index, plan){
  if(surface!=='shelf'&&surface!=='floor') return null;
  if(isRoomLayout(type)){
    if(!plan||!Array.isArray(plan.map)) return null;
    const run=roomRowRun({ type, geometry, map:plan.map, layout:plan.layout, index });
    return run&&(run.kind==='shelf'||run.kind==='floor')?plainBoardClearance(run.gap):null;
  }
  if(!PLAIN_BOARD_LAYOUTS.has(type)) return null;
  const g=normalizeViewerGeometry(geometry, type);
  if(!Number.isInteger(index)||index<0||index>=g.shelfCount) return null;
  const gaps=gapsAboveFor(boardYsFromFracs(g.shelfYFracs, g.height), g.height);
  return plainBoardClearance(gaps[index]);
}

/* A closet with a hanging rod (a reach-in, a wardrobe) is measured door to
   back wall, and most of that is hanging space. The shelf over the rod is 12
   to 16 inches deep however deep the closet is: 14, the same floor the room
   formula below uses, or the closet's own depth when it is shallower. The
   floor under the clothes is the whole closet. The closet-rod builder draws
   from this, js/catalog.js shelfDepthFor judges by it, and the server's
   usableShelfDepth is the same rule; tests hold the three equal.
   @param {number} depth  the closet, door to back wall
   @param {string} [surface]  'floor' for the floor, anything else is a shelf */
export const CLOSET_SHELF_IN = 14;
export function rodClosetDepth(depth, surface){
  const D=Number(depth)||0;
  return surface==='floor'?D:Math.min(D, CLOSET_SHELF_IN);
}

/* How deep the shelving along a room's walls is. A fifth of the smaller room
   dimension for a walk-in (0.22 for an L), held between 14 and 18 inches
   wherever the room can hold a 14-inch shelf: 14 is the shallowest closet
   shelf sold, and in a 4-foot linen closet it leaves a 20-inch aisle. A room
   shallower than 28 inches is not a walk-in whatever the card said, and a
   shelf deeper than half of it would stand outside the measured footprint,
   so there the proportion holds with a floor of 8. The server's
   usableShelfDepth and catalog.js shelfDepthFor are this expression, and
   tests hold the three equal (catalog-fit, plan-schema).
   @param {string} type @param {{width?: number, depth?: number}} geometry */
export function roomShelfDepth(type, geometry){
  const W=Math.max(8, Number(geometry&&geometry.width)||30);
  const D=Math.max(4, Number(geometry&&geometry.depth)||14);
  const factor=type==='l-run'?0.22:0.2;
  const smallest=Math.min(W,D);
  return Math.max(8,Math.min(18,Math.max(14,smallest*factor),smallest*0.5));
}

/* The usable run of a wall in inches: the length a board is drawn at, and
   so the width an organizer on it has. The back run of a walk-in loses a
   shelf depth at each end to the side runs and an inch of clearance; each
   side run loses the back run's depth plus six inches at the open end. The
   L's two runs meet at one corner and lose one shelf depth each. The
   builders draw from this function rather than their own copy.
   @param {string} type @param {string} wallId @param {{width?: number, depth?: number}} geometry */
export function runLength(type, wallId, geometry){
  const W=Math.max(8, Number(geometry&&geometry.width)||30);
  const D=Math.max(4, Number(geometry&&geometry.depth)||14);
  const depth=roomShelfDepth(type, geometry);
  if(type==='l-run'){
    return wallId==='back'?Math.max(8,W-depth-2*T-2):Math.max(8,D-depth-2*T-2);
  }
  return wallId==='back'?Math.max(8,W-2*depth-2*T-2):Math.max(8,D-depth-2*T-6);
}

/* A room's floor rows: the run one is laid along and the space over it,
   measured the way gapsAboveFor measures a board's (from the surface an
   item stands on to the top of the board over it). The walk-in lays every
   floor row across the room. The L lays one along its back run, or along
   the run of the wall the plan put it on: a row whose surface is the floor
   is drawn on the floor wherever the sections file it. The space is the
   floor to the lowest board either way, because floor storage in a fitted
   room goes under the shelving along its walls. The builders draw from
   this and an organizer added to a floor row is sized by it
   (js/screens/viewer3d.js shelfMaxDims). The walk-in drew its floor with a
   fixed 10 inches and the L with the gap ABOVE a board, and an organizer
   added to either was given a board gap picked by its row number, so the
   scene's verdict and the printed limit were three numbers.
   @param {string} type @param {{width?: number, height?: number, depth?: number}} geometry
   @param {number[]} boardYs  the room's boards, as boardYsFromFracs gives them
   @param {string} [wallId]  the L's run the row is on, when the plan put it on one */
export function roomFloorRun(type, geometry, boardYs, wallId){
  const W=Math.max(8, Number(geometry&&geometry.width)||30);
  const H=Number(geometry&&geometry.height)||0;
  const above=(Array.isArray(boardYs)?boardYs:[]).filter(y=>y>T+0.5);
  const lowest=above.length?Math.min(...above):H-T;
  return {
    length:type==='l-run'?runLength('l-run',wallId||'back',geometry):W-2*T-2,
    gap:Math.max(2.2, lowest-T),
  };
}

/* The geometry a room is drawn with: its shelfCount read as boards per wall.
   A plan's own geometry counts rows, one per plan row, and the screen
   converts it when it opens (js/screens/viewer3d.js currentSceneInput) to
   the board count the plan needs (boardCountForMap). One already converted
   (`levelsAre: 'boards'`: a version 3 arrangement, or a count set on the
   slider) is kept. Anything else comes back normalized.
   @param {any} geometry @param {any[]} map @param {any} layout */
export function roomBoardGeometry(geometry, map, layout){
  const type=layout&&layout.type;
  const g=normalizeViewerGeometry(geometry, type);
  if(!isRoomLayout(type)||g.levelsAre==='boards') return g;
  return normalizeViewerGeometry(roomGeometryFor(g, boardCountForMap(map, layout, g.height)), type);
}

/* Where a room draws one row, and the space over it: the wall it is on, the
   kind of surface the builder makes of it, the run that surface is laid
   along, and the gap from it to the board over it (gapsAboveFor, or
   roomFloorRun's for a floor row). A row whose surface is the floor is drawn
   on the floor wherever the plan files it, so that is read off the row as
   well as the plan. The card's row check (rowHeadroomFor) and the size an
   organizer added from the 3D view is given (js/screens/viewer3d.js
   shelfMaxDims) both read this, so the badge, the printed limit and the
   scene's verdict are one number. Null for a unit, or for a row the plan
   puts on no board.
   @param {{type: string, geometry: any, map: any[], layout: any, index: number}} args
   @returns {null|{wall: string|null, kind: string, length: number, gap: number}} */
export function roomRowRun({ type, geometry, map, layout, index }){
  if(!isRoomLayout(type)) return null;
  const rows=Array.isArray(map)?map:[];
  const roomLayout={...(layout||{}), type};
  const g=roomBoardGeometry(geometry, rows, roomLayout);
  const boardYs=boardYsFromFracs(g.shelfYFracs, g.height);
  /** @type {Map<number, any>} */
  const rowsByShelf=new Map();
  rows.forEach(row=>{ if(row) rowsByShelf.set(row.shelfIndex, row); });
  const plan=roomPlanFor({ map:rows, layout:roomLayout, N:g.shelfCount, boardYs, rowsByShelf });
  if(!plan) return null;
  const row=rowsByShelf.get(index)||null;
  const wall=plan.wallOf.get(index)||null;
  if(plan.floorRows.includes(index)||(row&&row.surface)==='floor'){
    const floor=roomFloorRun(type, g, boardYs, wall||undefined);
    return { wall, kind:'floor', length:floor.length, gap:floor.gap };
  }
  const board=plan.boardOf.get(index);
  if(!wall||!Number.isInteger(board)||board>=boardYs.length) return null;
  return {
    wall,
    kind:(row&&row.surface)||'shelf',
    length:runLength(type, wall, g),
    gap:gapsAboveFor(boardYs, g.height)[board],
  };
}

/* Which wall each row is on, before any board is chosen. Shared by the room
   plan and the board count, because the count depends on how the rows fall
   once the ones the plan did not place have been dealt out.

   With a map, placementFor reads the plan the way the report does (row.wall,
   the layout's sections, the level text, the surface) and this keeps its
   per-wall order. Without one (a builder called directly, as the layout
   spec does) the rows are 0..N-1 and only the sections can say where they
   go. A row placementFor could not place, or put on the front wall that
   neither room draws, goes to the wall with the fewest rows so far, ties in
   drawn order: the plan did not say, and an empty wall beside a crowded one
   is the worse guess. A floor row is drawn on the floor and counts on no
   wall. */
/** @param {{map: any, layout: any, N: any, rowsByShelf?: any}} args */
function assignWalls({ map, layout, N, rowsByShelf }){
  const type=layout&&layout.type;
  if(!isRoomLayout(type)) return null;
  const order=DRAWN_WALLS[type];
  /** @type {Map<string, number[]>} */
  const rowsOf=new Map(order.map(id=>[id,[]]));
  /** @type {Map<number, string>} */
  const wallOf=new Map();
  /** @type {number[]} */
  const floorRows=[];
  /** @type {number[]} */
  const unplaced=[];

  if(Array.isArray(map)){
    const placement=placementFor(map, { layout, archetype:type });
    for(const wall of placement.walls){
      if(wall.id==='floor'){ floorRows.push(...wall.rows); continue; }
      const drawn=drawnWallFor(type, wall.id);
      for(const idx of wall.rows){
        if(drawn){ rowsOf.get(drawn).push(idx); wallOf.set(idx, drawn); }
        else unplaced.push(idx);
      }
    }
  }else{
    const count=Math.max(0, Math.round(Number(N))||0);
    const bySection=placementFromSections(layout&&layout.sections, count);
    for(let idx=0; idx<count; idx++){
      const row=rowsByShelf&&rowsByShelf.get?rowsByShelf.get(idx):null;
      if(row&&row.surface==='floor'){ floorRows.push(idx); continue; }
      const placed=bySection.get(idx);
      if(placed==='floor'){ floorRows.push(idx); continue; }
      const drawn=drawnWallFor(type, placed);
      if(drawn){ rowsOf.get(drawn).push(idx); wallOf.set(idx, drawn); }
      else unplaced.push(idx);
    }
  }

  for(const idx of unplaced){
    let target=order[0];
    for(const id of order){
      if(rowsOf.get(id).length<rowsOf.get(target).length) target=id;
    }
    rowsOf.get(target).push(idx);
    wallOf.set(idx, target);
  }

  const walls=order.filter(id=>rowsOf.get(id).length).map(id=>({ id, rows:rowsOf.get(id) }));
  return { type, walls, wallOf, floorRows };
}

/* The board a wall's one row sits on: the one nearest eye level. Sixty
   inches is where a standing adult looks; in a room whose boards all sit
   below that, the one nearest six tenths of the way up the top board keeps
   the row off the top shelf without putting it on the floor. */
function nearestBoard(boardYs, target){
  let best=0;
  for(let b=1; b<boardYs.length; b++){
    if(Math.abs(boardYs[b]-target)<Math.abs(boardYs[best]-target)) best=b;
  }
  return best;
}

/* The room plan a builder draws from, or null for a unit.

   Every wall draws the same N boards at the same heights (boardYs, top
   first). A wall with k rows spreads them over its boards top to bottom,
   tier t on board round(t (N-1) / (k-1)), so a two-row wall uses its top and
   bottom boards and a five-row wall in a five-board room uses them all. A
   wall with one row puts it near eye level (nearestBoard).

   @param {{ map?: any[]|null, layout: any, N: number, boardYs: number[], rowsByShelf?: Map<number, any> }} input
   @returns {null|{ type: string, walls: {id: string, rows: number[]}[], wallOf: Map<number, string>,
             boardOf: Map<number, number>, floorRows: number[], wallCount: number }} */
export function roomPlanFor({ map, layout, N, boardYs, rowsByShelf }){
  const assigned=assignWalls({ map, layout, N, rowsByShelf });
  if(!assigned) return null;
  const ys=Array.isArray(boardYs)?boardYs.map(Number):[];
  const boards=Math.max(1, ys.length||Math.round(Number(N))||1);
  const top=ys.length?ys[0]:0;
  const eye=ys.some(y=>y>=60)?60:0.6*top;
  /** @type {Map<number, number>} */
  const boardOf=new Map();
  for(const wall of assigned.walls){
    const k=wall.rows.length;
    wall.rows.forEach((idx, t)=>{
      const board=k>=2
        ?Math.round(t*(boards-1)/(k-1))
        :(ys.length?nearestBoard(ys, eye):0);
      boardOf.set(idx, Math.min(boards-1, Math.max(0, board)));
    });
  }
  return {
    type:assigned.type,
    walls:assigned.walls,
    wallOf:assigned.wallOf,
    boardOf,
    floorRows:assigned.floorRows,
    wallCount:assigned.walls.length,
  };
}

/* The board count a fresh room geometry should carry for this plan: the
   rows per drawn wall once the unplaced ones have been dealt out, through
   boardCountFor. Null for a unit, whose count is its row count already.
   @param {any[]} map @param {any} layout @param {number} height */
export function boardCountForMap(map, layout, height){
  const assigned=assignWalls({ map:Array.isArray(map)?map:[], layout, N:0 });
  if(!assigned) return null;
  return boardCountFor(assigned.walls.map(w=>w.rows.length), height);
}

/* The geometry a saved arrangement asks the viewer to show, or null when it
   saved none. A unit's arrangement means the same thing at every version. A
   room's arrangement from before version 3 stored shelfCount and shelfYFracs
   as tiers, one per plan row, which the viewer now reads as boards per wall:
   kept, a 12-row pantry would open with 12 boards on every wall. Its sizes
   are still the user's and stay; the count and spacing are re-derived from
   the plan (the screen does that when levelsAre is missing).
   @param {any} arrangement @param {boolean} isRoom */
export function arrangementGeometryFor(arrangement, isRoom){
  if(!arrangement||!(Number(arrangement.version)>=2)||!arrangement.geometry||typeof arrangement.geometry!=='object') return null;
  const geometry={...arrangement.geometry};
  if(!isRoom||Number(arrangement.version)>=ARRANGEMENT_VERSION) return geometry;
  delete geometry.shelfCount;
  delete geometry.shelfYFracs;
  delete geometry.levelsAre;
  return geometry;
}
