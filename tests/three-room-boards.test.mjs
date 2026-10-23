import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROOM_TYPES, isRoomLayout, MIN_BOARD_PITCH, ARRANGEMENT_VERSION,
  boardCountFor, boardCountForMap, roomPlanFor, runLength, roomShelfDepth, roomFloorRun,
  boardYsFor, boardYsFromFracs, arrangementGeometryFor,
  gapsAboveFor, plainBoardClearance, rowHeadroomFor, rodClosetDepth, CLOSET_SHELF_IN,
  roomBoardGeometry, roomRowRun, hangsDoorRows, cabinetShelfGeometry,
} from '../js/three/roomBoards.js';
import { shelfDepthFor } from '../js/catalog.js';
import { normalizeViewerGeometry } from '../js/three/viewerOptions.js';

/* The 12-row walk-in results-3d-entry.spec.mjs drives through the real
   flow: five rows on the left wall, five on the back, two in a "corner"
   section the model placed on the right. The largest room the viewer is
   asked to build, and the shape the per-wall drawing was written for. */
const ROWS=12;
const walkIn={
  map:Array.from({length:ROWS},(_,i)=>({
    lv:`Shelf ${i+1}`,zone:`Zone ${i+1}`,shelfIndex:i,surface:'shelf',items:[{name:'Canned goods',size:'m'}],
  })),
  layout:{
    type:'walkin-u',
    sections:[
      { id:'left', label:'Left wall', place:'left', rows:[0,1,2,3,4] },
      { id:'back', label:'Back wall', place:'back', rows:[5,6,7,8,9] },
      { id:'corner', label:'Corner and floor', place:'right', rows:[10,11] },
    ],
  },
  geometry:{ width:72, height:96, depth:72 },
};

test('room types are the walk-in and the L, and nothing else',()=>{
  assert.deepEqual(ROOM_TYPES,['walkin-u','l-run']);
  assert.equal(isRoomLayout('walkin-u'),true);
  assert.equal(isRoomLayout('l-run'),true);
  for(const type of ['cabinet','shelves','closet-system','garage-rack',undefined,null,'']) assert.equal(isRoomLayout(type),false,`${type}`);
  assert.equal(ARRANGEMENT_VERSION,3);
});

/* The fullest wall sets the count; three is the fewest that reads as a
   shelved room; the height caps it at one board per MIN_BOARD_PITCH after
   the floor slab and the top board; twelve is the schema's row ceiling. */
test('boards per wall: the most rows on one wall, held between 3 and what the height holds',()=>{
  assert.equal(boardCountFor([5,5,2],96),5,'the fullest wall sets the count');
  assert.equal(boardCountFor([2,1],96),3,'two rows still draw three boards');
  assert.equal(boardCountFor([14],120),12,'never more than the schema\'s twelve rows');
  assert.equal(boardCountFor([14],96),Math.floor(94/MIN_BOARD_PITCH),'a 96-inch room holds fewer than twelve at the minimum pitch');
  assert.equal(boardCountFor([5],30),3,'a 30-inch-high room caps at floor(28/9)=3');
  // The boundary itself: two inches come off before the pitch divides, so 29 is the first height for three.
  assert.equal(boardCountFor([5],29),3,'29 inches: floor(27/9)=3');
  assert.equal(boardCountFor([5],28),2,'28 inches: floor(26/9)=2');
  assert.equal(boardCountFor([5],20),2,'below three only when the height cannot hold three');
  assert.equal(boardCountFor([5],10),1,'never below one');
  assert.equal(boardCountFor([],96),3,'no rows at all still draws a shelved room');
  assert.equal(boardCountForMap(walkIn.map,walkIn.layout,96),5);
  assert.equal(boardCountForMap(walkIn.map,{type:'cabinet'},96),null,'a unit has no boards-per-wall count');
});

test('the 12-row walk-in: five boards, each wall spread over them, a two-row wall on top and bottom',()=>{
  const N=boardCountForMap(walkIn.map,walkIn.layout,96);
  assert.equal(N,5);
  const boardYs=boardYsFor({...walkIn.geometry,shelfCount:N});
  assert.equal(boardYs.length,5);
  assert.ok(boardYs.every((y,i)=>i===0||y<boardYs[i-1]),'top board first');
  const plan=roomPlanFor({ map:walkIn.map, layout:walkIn.layout, N, boardYs });
  assert.equal(plan.type,'walkin-u');
  assert.deepEqual(plan.walls.map(w=>w.id),['left','back','right']);
  assert.deepEqual(plan.walls.map(w=>w.rows),[[0,1,2,3,4],[5,6,7,8,9],[10,11]]);
  assert.equal(plan.wallCount,3);
  for(let i=0;i<5;i++) assert.equal(plan.boardOf.get(i),i,`left row ${i} on board ${i}`);
  for(let i=5;i<10;i++) assert.equal(plan.boardOf.get(i),i-5,`back row ${i} on board ${i-5}`);
  assert.equal(plan.boardOf.get(10),0,'the right wall\'s first row takes the top board');
  assert.equal(plan.boardOf.get(11),4,'and its second the bottom one');
  assert.deepEqual(plan.floorRows,[]);
  assert.equal(plan.wallOf.size,ROWS);
  // Two walls on a two-board spread, seen through a wall with more rows than boards: shared boards, never one past the end.
  const tight=roomPlanFor({ map:walkIn.map, layout:walkIn.layout, N:3, boardYs:boardYs.slice(0,3) });
  assert.ok([...tight.boardOf.values()].every(b=>b>=0&&b<3),'every row lands on a drawn board');
  assert.deepEqual([0,1,2,3,4].map(i=>tight.boardOf.get(i)),[0,1,1,2,2]);
});

test('a wall with one row takes the board nearest eye level',()=>{
  const map=[
    {shelfIndex:0,lv:'Left wall: high shelf'},
    {shelfIndex:1,lv:'Back wall: top'},{shelfIndex:2,lv:'Back wall: eye level'},{shelfIndex:3,lv:'Back wall: low'},
  ];
  const layout={type:'walkin-u',sections:[]};
  const tall=roomPlanFor({ map, layout, N:3, boardYs:[78,60.5,43] });
  assert.equal(tall.boardOf.get(0),1,'60.5 is nearest 60');
  const low=roomPlanFor({ map, layout, N:3, boardYs:[50,28,0.75] });
  assert.equal(low.boardOf.get(0),1,'all boards under 60: nearest 0.6 of the top board, 30, is the 28-inch board');
  assert.deepEqual([1,2,3].map(i=>tall.boardOf.get(i)),[0,1,2],'the three-row wall still uses all three boards');
});

/* The plan did not say, so the drawing has to choose, and an empty wall
   beside a crowded one is the worse guess. The sidebar lists these rows
   under "Other", which is the honest heading; the drawing still needs a
   wall for them. */
test('rows with no wall, and front rows, go to the emptiest wall in left, back, right order',()=>{
  const map=[0,1,2,3].map(i=>({shelfIndex:i,lv:`Shelf ${i+1}`,zone:`Zone ${i+1}`}));
  const plan=roomPlanFor({ map, layout:{type:'walkin-u',sections:[{id:'main',rows:[0,1,2,3]}]}, N:3, boardYs:[70,40,0.75] });
  assert.deepEqual(plan.walls.map(w=>[w.id,w.rows]),[['left',[0,3]],['back',[1]],['right',[2]]]);
  assert.equal(plan.wallCount,3);
  assert.equal(boardCountForMap(map,{type:'walkin-u',sections:[]},96),3);

  const front=roomPlanFor({
    map:[{shelfIndex:0,lv:'Left wall: top'},{shelfIndex:1,lv:'Left wall: low'},{shelfIndex:2,lv:'Door rack',surface:'door'},{shelfIndex:3,lv:'Back wall: top'}],
    layout:{type:'walkin-u',sections:[]}, N:3, boardYs:[70,40,0.75],
  });
  assert.equal(front.wallOf.get(2),'right','a front row lands on the wall with the fewest rows');
  assert.equal(front.wallOf.get(0),'left');
  assert.equal(front.wallOf.get(3),'back');

  // Many unplaced rows are dealt round the room, fullest wall never more than one ahead.
  const many=roomPlanFor({ map:Array.from({length:7},(_,i)=>({shelfIndex:i,lv:`Row ${i}`})), layout:{type:'walkin-u'}, N:3, boardYs:[70,40,0.75] });
  assert.deepEqual(many.walls.map(w=>w.rows.length),[3,2,2]);
  /* And the board count sees the rows where they land, not where the plan
     put them: ten rows with no wall are dealt 4, 3, 3, so the room needs four
     boards, where counting placement's walls (none) would give the floor of
     three and put two rows on one board of the fullest wall. */
  const ten=Array.from({length:10},(_,i)=>({shelfIndex:i,lv:`Row ${i}`}));
  assert.equal(boardCountForMap(ten,{type:'walkin-u'},96),4);
});

test('floor rows are drawn on the floor and sit on no wall',()=>{
  const map=[
    {shelfIndex:0,lv:'Left wall: top'},{shelfIndex:1,lv:'Floor',surface:'floor'},
    {shelfIndex:2,lv:'Back wall: top'},{shelfIndex:3,lv:'Bins',surface:'floor'},
  ];
  const plan=roomPlanFor({ map, layout:{type:'walkin-u',sections:[]}, N:3, boardYs:[70,40,0.75] });
  assert.deepEqual(plan.floorRows,[1,3]);
  assert.equal(plan.wallOf.has(1),false);
  assert.equal(plan.wallOf.has(3),false);
  assert.equal(plan.boardOf.has(1),false);
  assert.deepEqual(plan.walls.map(w=>w.id),['left','back']);
  assert.equal(plan.wallCount,2,'the floor is not a wall');
  assert.equal(boardCountForMap(map,{type:'walkin-u',sections:[]},96),3);
});

/* Three rows on the side against one on the back. With one side row and
   two back rows the old fixture passed with the side rule gone: an
   unplaced right-wall row was dealt to the emptier wall, which was the
   side. Here a side row that lost its wall would be dealt to the back. */
test('an L-run has a back and a side; placement left and right both land on the side',()=>{
  const rightWall=[{shelfIndex:0,lv:'Back wall: top'},{shelfIndex:1,lv:'Right wall: top'},{shelfIndex:2,lv:'Right wall: eye level'},{shelfIndex:3,lv:'Right wall: low'}];
  const plan=roomPlanFor({ map:rightWall, layout:{type:'l-run',sections:[],lSide:'right'}, N:3, boardYs:[80,55,30] });
  assert.deepEqual(plan.walls.map(w=>[w.id,w.rows]),[['back',[0]],['side',[1,2,3]]]);
  assert.deepEqual([1,2,3].map(i=>plan.boardOf.get(i)),[0,1,2],'the side\'s three rows take the three boards top to bottom');
  assert.equal(plan.boardOf.get(0),1,'the back\'s one row sits on the board nearest 60 inches, the one at 55');

  const leftWall=rightWall.map(row=>({...row,lv:row.lv.replace('Right wall','Left wall')}));
  const left=roomPlanFor({ map:leftWall, layout:{type:'l-run',sections:[],lSide:'left'}, N:3, boardYs:[80,55,30] });
  assert.deepEqual(left.walls.map(w=>[w.id,w.rows]),[['back',[0]],['side',[1,2,3]]],'a left-wall plan is the side run too');

  // A plan that names both sides in an L has one side run for them both, whichever side the layout draws it on.
  const both=[{shelfIndex:0,lv:'Back wall: top'},{shelfIndex:1,lv:'Left wall: top'},{shelfIndex:2,lv:'Right wall: top'},{shelfIndex:3,lv:'Right wall: low'}];
  const mixed=roomPlanFor({ map:both, layout:{type:'l-run',sections:[],lSide:'right'}, N:3, boardYs:[80,55,30] });
  assert.deepEqual(mixed.walls.map(w=>w.id),['back','side']);
  assert.deepEqual([...mixed.walls[1].rows].sort(),[1,2,3]);
  assert.equal(mixed.wallCount,2);

  const leftSection=roomPlanFor({
    map:[{shelfIndex:0,lv:'Top'},{shelfIndex:1,lv:'Low'},{shelfIndex:2,lv:'Boots'},{shelfIndex:3,lv:'Bags'}],
    layout:{type:'l-run',sections:[{id:'run-a',rows:[0]},{id:'left',rows:[1,2,3]}],lSide:'left'}, N:3, boardYs:[80,55,30],
  });
  assert.deepEqual(leftSection.walls.map(w=>[w.id,w.rows]),[['back',[0]],['side',[1,2,3]]],'a left section is the side run too');

  // Unplaced rows: back first, then side.
  const dealt=roomPlanFor({ map:[0,1,2].map(i=>({shelfIndex:i,lv:`Row ${i}`})), layout:{type:'l-run'}, N:3, boardYs:[70,40,0.75] });
  assert.deepEqual(dealt.walls.map(w=>[w.id,w.rows]),[['back',[0,2]],['side',[1]]]);
});

test('a unit layout has no room plan',()=>{
  assert.equal(roomPlanFor({ map:walkIn.map, layout:{type:'cabinet',sections:[]}, N:5, boardYs:[70,40,0.75] }),null);
  assert.equal(roomPlanFor({ map:walkIn.map, layout:{type:'shelves'}, N:5, boardYs:[70,40,0.75] }),null);
  assert.equal(roomPlanFor({ map:walkIn.map, layout:{}, N:5, boardYs:[70,40,0.75] }),null);
});

/* three-layout-surfaces.spec.mjs calls the builders with no map at all:
   sections, a row count and an empty rowsByShelf. The rows are then 0..N-1
   and the sections are the only word on where they go. */
test('with no map, rows are 0..N-1 placed by the sections alone',()=>{
  const plan=roomPlanFor({
    map:undefined,
    layout:{type:'walkin-u',sections:[{id:'left',rows:[0]},{id:'back',rows:[1]},{id:'right',rows:[2]}]},
    N:3, boardYs:[70,40,10], rowsByShelf:new Map(),
  });
  assert.deepEqual(Object.fromEntries(plan.wallOf),{0:'left',1:'back',2:'right'});
  assert.deepEqual(Object.fromEntries(plan.boardOf),{0:0,1:0,2:0},'one row per wall, each at the board nearest 60');
  assert.equal(plan.wallCount,3);

  // A floor row in rowsByShelf is the floor, and a row no section names is dealt out.
  const withFloor=roomPlanFor({
    layout:{type:'walkin-u',sections:[{id:'back',rows:[0,1]}]},
    N:4, boardYs:[70,50,30,0.75], rowsByShelf:new Map([[3,{surface:'floor'}]]),
  });
  assert.deepEqual(withFloor.floorRows,[3]);
  assert.deepEqual(withFloor.walls.map(w=>[w.id,w.rows]),[['left',[2]],['back',[0,1]]]);
});

/* The length a board is drawn at is the width an organizer on it has, and
   the run arithmetic used to live in each builder with nothing holding
   roomBoards to it. It is computed here from the formula's constants, and
   the builders are read as text to confirm they import it instead of
   carrying their own. */
test('runLength is the builders\' board length, and the builders read it and the depth from roomBoards',()=>{
  const T=0.75;
  const walk={ width:72, height:96, depth:72 };
  const walkDepth=Math.max(8,Math.min(18,Math.max(14,72*0.2),72*0.5));
  assert.ok(Math.abs(walkDepth-14.4)<1e-9);
  assert.ok(Math.abs(roomShelfDepth('walkin-u',walk)-walkDepth)<1e-9);
  assert.ok(Math.abs(runLength('walkin-u','back',walk)-(72-2*walkDepth-2*T-2))<1e-9);
  assert.ok(Math.abs(runLength('walkin-u','left',walk)-(72-walkDepth-2*T-6))<1e-9);
  assert.equal(runLength('walkin-u','right',walk),runLength('walkin-u','left',walk));

  const ell={ width:72, height:84, depth:60 };
  const ellDepth=Math.max(8,Math.min(18,Math.max(14,60*0.22),60*0.5));
  assert.ok(Math.abs(roomShelfDepth('l-run',ell)-ellDepth)<1e-9);
  assert.ok(Math.abs(runLength('l-run','back',ell)-(72-ellDepth-2*T-2))<1e-9);
  assert.ok(Math.abs(runLength('l-run','side',ell)-(60-ellDepth-2*T-2))<1e-9);

  // Never shorter than the 8 inches the builders floor their boards at.
  assert.equal(runLength('walkin-u','back',{ width:20, height:60, depth:20 }),8);

  // One depth formula on every side (the catalog's is the server's, by plan-schema.test.mjs).
  for(const dims of [walk,ell,{width:48,depth:48},{width:120,depth:120},{width:24,depth:24},{width:96,depth:48}]){
    for(const type of ['walkin-u','l-run']){
      assert.equal(roomShelfDepth(type,dims),shelfDepthFor({w_in:dims.width,d_in:dims.depth},type),`${type} ${JSON.stringify(dims)}`);
    }
  }

  for(const file of ['walkin-u','l-run']){
    const src=readFileSync(new URL(`../js/three/layouts/${file}.js`,import.meta.url),'utf8');
    assert.match(src,/import \{[^}]*\brunLength\b[^}]*\} from '\.\.\/roomBoards\.js'/,`${file}.js imports runLength from roomBoards`);
    assert.match(src,/import \{[^}]*\broomShelfDepth\b[^}]*\} from '\.\.\/roomBoards\.js'/,`${file}.js imports roomShelfDepth from roomBoards`);
    assert.doesNotMatch(src,/Math\.max\(14,/,`${file}.js carries its own depth arithmetic`);
    assert.doesNotMatch(src,/2\*shelfDepth-2\*T|shelfDepth-2\*T-2/,`${file}.js carries its own run arithmetic`);
    assert.match(src,/\baddRod\b[^\n]*from '\.\/helpers\.js'/,`${file}.js imports addRod from helpers`);
    assert.doesNotMatch(src,/new THREE\.CylinderGeometry/,`${file}.js draws its own rod`);
  }
});

/* A room's floor row is drawn along a run with the space up to the lowest
   board over it, and an organizer added to one from the 3D view is sized by
   the same two numbers. The walk-in drew its floor with a fixed 10 inches
   and the L with the gap above its lowest board; both are read as text so
   neither comes back. viewer3d-add-organizer.spec.mjs holds the added
   organizer to the live scene's floor. */
test('roomFloorRun: a room floor runs under its lowest board, and both builders draw it from here',()=>{
  const T=0.75;
  const walk={ width:72, height:96, depth:72 };
  assert.deepEqual(roomFloorRun('walkin-u',walk,[80,50,25]),{ length:72-2*T-2, gap:25-T });
  const ell={ width:72, height:84, depth:60 };
  assert.deepEqual(roomFloorRun('l-run',ell,[70,40,20]),{ length:runLength('l-run','back',ell), gap:20-T });
  // A floor row the plan filed under the L's side run is laid along that run.
  assert.deepEqual(roomFloorRun('l-run',ell,[70,40,20],'side'),{ length:runLength('l-run','side',ell), gap:20-T });
  assert.equal(roomFloorRun('walkin-u',walk,[80,50,25],'left').length,72-2*T-2,'a walk-in floor is the room\'s');
  // Board order does not matter; the lowest is the one over the floor.
  assert.equal(roomFloorRun('l-run',ell,[20,70,40]).gap,20-T);
  // A board on the floor is the floor, not a lid over it.
  assert.equal(roomFloorRun('walkin-u',walk,[60,T]).gap,60-T);
  assert.equal(roomFloorRun('walkin-u',walk,[]).gap,96-2*T,'no board: up to the ceiling');
  assert.equal(roomFloorRun('walkin-u',walk,[1.5]).gap,2.2,'never less than 2.2 inches');

  for(const file of ['walkin-u','l-run']){
    const src=readFileSync(new URL(`../js/three/layouts/${file}.js`,import.meta.url),'utf8');
    assert.match(src,/import \{[^}]*\broomFloorRun\b[^}]*\} from '\.\.\/roomBoards\.js'/,`${file}.js imports roomFloorRun`);
    assert.match(src,/kind:'floor'[^}]*length:floorRun\.length,gap:floorRun\.gap\b/s,`${file}.js draws its floor from it`);
    assert.doesNotMatch(src,/gap:10\b|gapAbove\[NSH-1\]/,`${file}.js carries its own floor headroom`);
  }
  // A walk-in's floor is the strip under its shelving, judged as deep as the shelving, the way the card and the server judge it.
  const walkSrc=readFileSync(new URL('../js/three/layouts/walkin-u.js',import.meta.url),'utf8');
  assert.match(walkSrc,/kind:'floor'[^}]*\bdepth:shelfDepth,/s,'the walk-in floor is as deep as its shelving');
  assert.doesNotMatch(walkSrc,/kind:'floor'[^}]*\bdepth:D\b/s,'the walk-in floor is judged by the room\'s depth');
  const ellSrc=readFileSync(new URL('../js/three/layouts/l-run.js',import.meta.url),'utf8');
  assert.match(ellSrc,/const gap=floor\?roomFloorRun\('l-run',geometry,shelfYs,side\)\.gap:gapAbove\[board\];/,
    'the L draws a floor row filed under a wall with the floor\'s headroom');
});

test('board heights: the scene\'s clamp, with a fraction past 0.86 on the floor',()=>{
  assert.deepEqual(boardYsFromFracs([0.1,0.5,0.9],96),[Math.min(96*0.9,96-0.75-3.2),48,0.75]);
  assert.deepEqual(boardYsFromFracs([0.001],96),[96-0.75-3.2],'never within 3.2 inches of the ceiling');
  const even=boardYsFor({ width:72, height:96, depth:72, shelfCount:5 });
  assert.equal(even.length,5);
  assert.equal(even[4],0.75,'the bottom of a unit\'s even spread is the floor');
  assert.ok(even.every((y,i)=>i===0||y<even[i-1]));
  // A room's boards are shelves above the floor: the lowest clears the slab by a full compartment.
  const boards=boardYsFor({ width:72, height:96, depth:72, shelfCount:5, levelsAre:'boards' });
  assert.equal(boards.length,5);
  assert.ok(boards[4]>MIN_BOARD_PITCH,`a room's lowest board sits at ${boards[4]} inches, on or near the floor`);
  assert.ok(boards.every((y,i)=>i===0||Math.abs((boards[i-1]-y)-(boards[0]-boards[1]))<1e-6),'equal pitch between boards');
});

/* A version 2 arrangement saved a room's shelfCount as its row count, which
   the viewer now reads as boards per wall. The user's sizes survive; the
   count is re-derived from the plan. */
test('saved arrangements: a v2 room keeps its sizes only, v3 and units pass through, nothing gives null',()=>{
  const roomV2={ version:2, geometry:{ width:72, height:96, depth:72, shelfCount:12, shelfYFracs:[0.1,0.5,0.9] } };
  assert.deepEqual(arrangementGeometryFor(roomV2,true),{ width:72, height:96, depth:72 });
  assert.equal('shelfCount' in roomV2.geometry,true,'the input is not mutated');
  const roomV3={ version:3, geometry:{ width:72, height:96, depth:72, shelfCount:5, shelfYFracs:[0.2,0.4,0.6,0.8,0.92], levelsAre:'boards' } };
  assert.deepEqual(arrangementGeometryFor(roomV3,true),roomV3.geometry);
  assert.notEqual(arrangementGeometryFor(roomV3,true),roomV3.geometry,'a copy, not the saved object');
  const unitV2={ version:2, geometry:{ width:36, height:78, depth:18, shelfCount:5, shelfYFracs:[0.2,0.4,0.6,0.8,0.92] } };
  assert.deepEqual(arrangementGeometryFor(unitV2,false),unitV2.geometry);
  assert.equal(arrangementGeometryFor(null,true),null);
  assert.equal(arrangementGeometryFor({ version:3 },true),null,'no geometry saved');
  assert.equal(arrangementGeometryFor({ version:1, geometry:{ width:72 } },true),null,'version 1 never carried a geometry the viewer reads');
});

/* The headroom a product is drawn under and the headroom the card judges it
   against have to be one number, so the scene takes its gaps from here and
   carries no copy. */
test('gapsAboveFor is the scene\'s headroom: to the next board up, or to the top panel',()=>{
  const T=0.75;
  assert.deepEqual(gapsAboveFor([80,50,T],96),[96-T-80,30,50-T]);
  assert.deepEqual(gapsAboveFor([95,T],96),[2.2,95-T],'never less than 2.2 inches');
  assert.deepEqual(gapsAboveFor([],96),[]);
  assert.equal(plainBoardClearance(30),30-T,'the board above takes its own thickness');

  const scene=readFileSync(new URL('../js/three/scene.js',import.meta.url),'utf8');
  assert.match(scene,/import \{[^}]*\bgapsAboveFor\b[^}]*\} from '\.\/roomBoards\.js'/,'scene.js imports gapsAboveFor');
  assert.match(scene,/const gapAbove=gapsAboveFor\(shelfYs, H\);/,'scene.js draws from it');
  assert.doesNotMatch(scene,/Math\.max\(2\.2,/,'scene.js carries its own gap arithmetic');
});

test('rowHeadroomFor answers for a plain board and says nothing about the rest',()=>{
  const geometry={ width:60, height:96, depth:30, shelfCount:3, shelfYFracs:[0.25,0.5,0.92] };
  // 96 x 0.75 = 72, the top panel's underside is 95.25: 23.25 over the board, less the panel-thick board the scene counts.
  assert.ok(Math.abs(rowHeadroomFor('closet-rod','shelf',geometry,0)-(95.25-72-0.75))<1e-9);
  assert.ok(Math.abs(rowHeadroomFor('cabinet','shelf',geometry,1)-(72-48-0.75))<1e-9);
  assert.ok(Math.abs(rowHeadroomFor('closet-rod','floor',geometry,2)-(48-0.75-0.75))<1e-9,'the floor row sits on the base panel');
  for(const [type,surface,index,why] of [
    ['closet-rod','rod',1,'a rod carries no organizer'],
    ['drawer-bank','drawer',0,'a drawer publishes its own box height'],
    ['shelves','shelf',0,'a floating shelf can be open above'],
    ['garage-rack','shelf',0,'a rack\'s top shelf is open above'],
    ['walkin-u','shelf',0,'a room handed no plan cannot place the row'],
    ['cabinet','shelf',3,'a row the geometry does not have'],
    ['cabinet','shelf',-1,'a row the geometry does not have'],
  ]) assert.equal(rowHeadroomFor(type,surface,geometry,index),null,why);
});

/* A room's row is on one wall's board, or on the floor, and which is the
   room plan's to say. The card had no row check for a room at all, so a
   walk-in floor need was judged by its own maxDims while the 3D view judged
   it under the lowest shelf. Six rows, two to a wall, the last a floor row
   the plan files under the right wall (the case part 3 of 2026-10-12 found
   the builders draw on the floor anyway). */
test('rowHeadroomFor reads a room row from its room plan: its board on its wall, or the floor under the lowest board',()=>{
  const T=0.75;
  const near=(got,want,why)=>assert.ok(got!==null&&Math.abs(got-want)<1e-9,`${why}: ${got} against ${want}`);
  const row=(i,zone,surface='shelf')=>({ lv:surface==='floor'?'Floor':`Shelf ${i+1}`, zone, shelfIndex:i, surface, items:[{ name:'Rice' }] });
  const map=[row(0,'Paper towels'),row(1,'Cereal'),row(2,'Baking'),row(3,'Soup'),row(4,'Snacks'),row(5,'Bulk rice','floor')];
  const layout={ type:'walkin-u', sections:[
    { id:'left', place:'left', rows:[0,1] }, { id:'back', place:'back', rows:[2,3] }, { id:'right', place:'right', rows:[4,5] },
  ] };
  const plan={ map, layout };
  // The plan's geometry counts six rows; the room is drawn with three boards a wall, 0.23, 0.46 and 0.69 down.
  const geometry={ width:72, height:96, depth:72, shelfCount:6 };
  const drawn=roomBoardGeometry(geometry,map,layout);
  assert.equal(drawn.shelfCount,3);
  assert.equal(drawn.levelsAre,'boards');
  assert.deepEqual(boardYsFromFracs(drawn.shelfYFracs,96).map(y=>Math.round(y*100)/100),[73.92,51.84,29.76]);

  near(rowHeadroomFor('walkin-u','shelf',geometry,0,plan),96-T-73.92-T,'a wall\'s first row is on its top board');
  near(rowHeadroomFor('walkin-u','shelf',geometry,1,plan),51.84-29.76-T,'its second on its lowest');
  near(rowHeadroomFor('walkin-u','shelf',geometry,2,plan),96-T-73.92-T,'every wall shares the boards');
  near(rowHeadroomFor('walkin-u','floor',geometry,5,plan),29.76-T-T,'a floor row filed under a wall is the floor, up to the lowest board');
  near(rowHeadroomFor('walkin-u','shelf',geometry,5,plan),29.76-T-T,'judged by the row the scene draws, not the surface the card guessed');
  // The size an added organizer is given and the card's check read the same run.
  const floor=roomRowRun({ type:'walkin-u', geometry, map, layout, index:5 });
  assert.deepEqual({ ...floor, gap:null },{ wall:'right', kind:'floor', length:72-2*T-2, gap:null });
  near(floor.gap,29.76-T,'the floor run\'s gap');
  assert.equal(roomRowRun({ type:'walkin-u', geometry, map, layout, index:0 }).wall,'left');
  assert.equal(roomRowRun({ type:'walkin-u', geometry, map, layout, index:0 }).length,runLength('walkin-u','left',geometry));

  // A converted geometry (a version 3 arrangement, or boards moved on the slider) is the user's and is read as it stands.
  const moved={ ...drawn, shelfYFracs:[0.1,0.5,0.8] };
  assert.deepEqual(roomBoardGeometry(moved,map,layout).shelfYFracs,moved.shelfYFracs);
  near(rowHeadroomFor('walkin-u','floor',moved,5,plan),96*0.2-T-T,'the floor under a board moved down to 19.2 inches');
  near(rowHeadroomFor('walkin-u','shelf',moved,0,plan),96-T-96*0.9-T,'the top board moved up to 86.4');

  // The L: its floor runs along the back unless the plan files it under the side wall, under the lowest of four boards either way.
  const ellMap=[0,1,2,3,4,5,6].map(i=>row(i,`Zone ${i}`)).concat(row(7,'Bulk','floor'));
  const ellGeometry={ width:72, height:84, depth:60, shelfCount:8 };
  const lowest=84*(1-0.736);
  for(const [sections,wall] of [
    [[{ id:'back', place:'back', rows:[0,1,2,3] },{ id:'right', place:'right', rows:[4,5,6] },{ id:'floor', place:'floor', rows:[7] }],null],
    [[{ id:'back', place:'back', rows:[0,1,2,3] },{ id:'right', place:'right', rows:[4,5,6,7] }],'side'],
  ]){
    const ell={ map:ellMap, layout:{ type:'l-run', sections } };
    near(rowHeadroomFor('l-run','floor',ellGeometry,7,ell),lowest-T-T,`the L's floor (${wall||'floor section'})`);
    const run=roomRowRun({ type:'l-run', geometry:ellGeometry, ...ell, index:7 });
    assert.equal(run.wall,wall);
    assert.equal(run.length,runLength('l-run',wall||'back',ellGeometry));
    near(rowHeadroomFor('l-run','shelf',ellGeometry,0,ell),84-T-84*(1-0.184)-T,'the L\'s top board');
  }

  for(const [type,surface,index,p,why] of [
    ['walkin-u','rod',0,plan,'a rod carries no organizer'],
    ['walkin-u','shelf',0,{ layout },'no rows to place it by'],
    ['walkin-u','shelf',9,plan,'a row the plan does not have'],
    ['walkin-u','drawer',0,plan,'a surface this does not judge'],
  ]) assert.equal(rowHeadroomFor(type,surface,geometry,index,p),null,why);
  const rodded={ map:map.map(r=>r.shelfIndex===0?{ ...r, surface:'rod' }:r), layout };
  assert.equal(rowHeadroomFor('walkin-u','shelf',geometry,0,rodded),null,'the scene draws a rod there whatever the card guessed');

  // A unit's geometry passes through, normalized and unconverted.
  assert.equal(roomBoardGeometry({ width:36, height:78, depth:18, shelfCount:5 },[],{ type:'cabinet' }).shelfCount,5);
  assert.equal(roomRowRun({ type:'cabinet', geometry, map, layout, index:0 }),null);
});

/* One rule for the shelf over a hanging rod, on all three sides: what the
   builder draws, what the card judges by, and (plan-schema.test.mjs) what the
   server tells the model and trims to. */
test('a rod closet\'s shelf is 14 inches or the closet, its floor is the closet, and the builder draws from the rule',()=>{
  assert.equal(CLOSET_SHELF_IN,14);
  assert.equal(rodClosetDepth(30),14);
  assert.equal(rodClosetDepth(30,'shelf'),14);
  assert.equal(rodClosetDepth(30,'floor'),30);
  assert.equal(rodClosetDepth(12),12,'a closet shallower than the shelf keeps its own depth');
  assert.equal(rodClosetDepth(12,'floor'),12);
  for(const d_in of [10,12,14,20,24,30,36]){
    for(const surface of [undefined,'shelf','floor','rod']){
      assert.equal(shelfDepthFor({w_in:60,d_in},'closet-rod',surface),rodClosetDepth(d_in,surface),`${d_in} ${surface}`);
    }
  }
  const src=readFileSync(new URL('../js/three/layouts/closet-rod.js',import.meta.url),'utf8');
  assert.match(src,/import \{[^}]*\brodClosetDepth\b[^}]*\} from '\.\.\/roomBoards\.js'/,'closet-rod.js imports rodClosetDepth');
  assert.match(src,/const shelfD=rodClosetDepth\(D\);/,'closet-rod.js draws its shelf from it');
  assert.match(src,/depth:rowD/,'and publishes the depth each row is judged against');
  const catalog=readFileSync(new URL('../js/catalog.js',import.meta.url),'utf8');
  assert.doesNotMatch(catalog,/CLOSET_SHELF_IN\s*=/,'catalog.js carries its own copy of the shelf depth');
});

/* A cabinet with a row on its door. The sample pantry is one: its "Door /
   side" row was drawn as a fifth board at the cabinet's floor, a shelf the
   cabinet does not have. The boards are its other rows now, converted once
   and marked so the controls move real boards. */
const doorCabinet={
  map:[
    { lv:'Top shelf', shelfIndex:0, surface:'shelf' },
    { lv:'Eye level', shelfIndex:1, surface:'shelf' },
    { lv:'Middle shelf', shelfIndex:2, surface:'shelf' },
    { lv:'Lower shelf', shelfIndex:3, surface:'shelf' },
    { lv:'Door / side', shelfIndex:4, surface:'door' },
  ],
  layout:{ type:'cabinet' },
  geometry:{ width:36, height:78, depth:18, shelfCount:5, shelfYFracs:[0.1,0.3,0.5,0.7,0.92] },
};

test('a cabinet counts its boards without the rows on its door, once', async () => {
  const { cabinetShelfGeometry, shelfRowsOf, doorRowsOf } = await import('../js/three/roomBoards.js');
  const { map, layout, geometry } = doorCabinet;
  assert.deepEqual([...doorRowsOf(map, layout)], [4]);
  assert.deepEqual(shelfRowsOf(map, layout), [0, 1, 2, 3]);
  const c=cabinetShelfGeometry(geometry, map, layout);
  assert.equal(c.shelfCount, 4);
  assert.equal(c.levelsAre, 'shelves');
  // The lowest shelf row takes the floor the door row used to stand on.
  assert.equal(boardYsFromFracs(c.shelfYFracs, c.height).at(-1), boardYsFromFracs(geometry.shelfYFracs, geometry.height).at(-1));
  assert.deepEqual(cabinetShelfGeometry(c, map, layout), c, 'converting twice changes nothing');
  const plain=cabinetShelfGeometry(geometry, map.slice(0, 4), layout);
  assert.equal(plain.shelfCount, 5, 'a cabinet with nothing on its door is left as it came');
  assert.equal(plain.levelsAre, undefined);
});

test('the card judges a cabinet shelf by the board it is drawn on, not by its row number', () => {
  const { map, layout, geometry } = doorCabinet;
  const withPlan=rowHeadroomFor('cabinet', 'shelf', geometry, 3, { map, layout });
  const byRow=rowHeadroomFor('cabinet', 'shelf', geometry, 3);
  assert.ok(withPlan > byRow + 3, `the lower shelf sits on the floor now, with more over it: ${withPlan} vs ${byRow}`);
  assert.equal(rowHeadroomFor('cabinet', 'door', geometry, 4, { map, layout }), null);
});

/* A reach-in pantry or linen closet is drawn as shelves and stands behind a
   door, so its door rows hang on the door and are not boards, as a cabinet's
   are. Open and wall shelving have no door: a door row there stays a board. */
test('a reach-in hangs its door rows on its door; open shelving has none to hang them on', () => {
  assert.equal(hangsDoorRows({ type: 'cabinet', setup: null }), true);
  assert.equal(hangsDoorRows({ type: 'shelves', setup: 'reachin' }), true);
  assert.equal(hangsDoorRows({ type: 'shelves', setup: 'reachinL' }), true);
  for (const setup of ['openshelf', 'wallshelf', null]) {
    assert.equal(hangsDoorRows({ type: 'shelves', setup }), false, String(setup));
  }
  assert.equal(hangsDoorRows({ type: 'closet-rod', setup: 'reachinC' }), true);
  assert.equal(hangsDoorRows({ type: 'closet-rod', setup: 'wardrobe' }), false);
  assert.equal(hangsDoorRows({ type: 'walkin-u', setup: 'reachin' }), false);
  assert.equal(hangsDoorRows({ type: 'fridge', setup: 'frenchdoor' }), false, 'a fridge draws its own doors');
  assert.equal(hangsDoorRows(null), false);
  // Five rows, one on the door: four boards, as the builder draws them.
  const map = ['Top shelf', 'Eye level', 'Middle shelf', 'Lower shelf', 'Door rack']
    .map((lv, i) => ({ lv, shelfIndex: i, surface: i === 4 ? 'door' : 'shelf' }));
  const g = cabinetShelfGeometry({ width: 30, height: 84, depth: 16, shelfCount: 5 }, map, { type: 'shelves', setup: 'reachin' });
  assert.equal(g.shelfCount, 4);
  assert.equal(g.levelsAre, 'shelves');
});

/* A closet's rows are judged on boards (PLAIN_BOARD_LAYOUTS). With a row on
   a reach-in closet's door, the floor row under it sits on the last board,
   not on a board the door row used to take. */
test("a reach-in closet's rows are judged on the boards left once the door row is out", () => {
  const map = [
    { lv: 'Top shelf', shelfIndex: 0, surface: 'shelf' },
    { lv: 'Door rack', shelfIndex: 1, surface: 'door' },
    { lv: 'Hanging rod', shelfIndex: 2, surface: 'rod' },
    { lv: 'Floor', shelfIndex: 3, surface: 'floor' },
  ];
  const geometry = { width: 48, height: 96, depth: 24, shelfCount: 4 };
  const layout = { type: 'closet-rod', setup: 'reachinC' };
  const boards = cabinetShelfGeometry(geometry, map, layout);
  assert.equal(boards.shelfCount, 3);
  const floor = rowHeadroomFor('closet-rod', 'floor', geometry, 3, { map, layout });
  const lastGap = gapsAboveFor(boardYsFromFracs(boards.shelfYFracs, boards.height), boards.height)[2];
  assert.equal(floor, plainBoardClearance(lastGap));
  // A wardrobe has no such door: its four rows are four boards, as before.
  const g = normalizeViewerGeometry(geometry, 'closet-rod');
  assert.equal(rowHeadroomFor('closet-rod', 'floor', geometry, 3, { map, layout: { type: 'closet-rod', setup: 'wardrobe' } }),
    plainBoardClearance(gapsAboveFor(boardYsFromFracs(g.shelfYFracs, g.height), g.height)[3]));
});
