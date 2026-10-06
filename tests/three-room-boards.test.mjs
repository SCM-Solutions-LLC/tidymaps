import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROOM_TYPES, isRoomLayout, MIN_BOARD_PITCH, ARRANGEMENT_VERSION,
  boardCountFor, boardCountForMap, roomPlanFor, runLength, roomShelfDepth,
  boardYsFor, boardYsFromFracs, arrangementGeometryFor,
} from '../js/three/roomBoards.js';
import { shelfDepthFor } from '../js/catalog.js';

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
