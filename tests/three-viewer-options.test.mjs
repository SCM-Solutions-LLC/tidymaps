import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evenShelfFracs,normalizeViewerGeometry,geometryWithShelfCount,
  geometryWithShelfHeight,mapForShelfCount,inferLSide,roomGeometryFor,roomShelfFracs,
} from '../js/three/viewerOptions.js';

/* A room's plan arrives with shelfCount equal to its row count, and the
   viewer now reads a room's count as boards per wall. The screen converts
   once and stamps the geometry so nothing converts it twice; the edits a
   user makes afterwards have to keep the stamp, or the next rebuild would
   re-derive the count over their slider. */
test('a room geometry carries its board count, the room spread and the boards stamp',()=>{
  const source={ width:72, height:96, depth:72, shelfCount:12, shelfYFracs:Array.from({length:12},(_,i)=>0.08+0.82*i/11), estimated:true, unit:'in' };
  const room=roomGeometryFor(source,5);
  assert.equal(room.shelfCount,5);
  assert.deepEqual(room.shelfYFracs,roomShelfFracs(5));
  assert.equal(room.levelsAre,'boards');
  assert.equal(room.estimated,true,'the count changing says nothing about the measurements');
  assert.equal(room.width,72);
  assert.equal(room.unit,'in','other fields pass through');
  assert.equal(source.shelfCount,12,'the input is not mutated');
  assert.equal(roomGeometryFor(source,14).shelfCount,12,'clamped to the twelve the viewer can draw');
  assert.equal(roomGeometryFor(source,0).shelfCount,1);

  assert.equal(geometryWithShelfCount(room,4).levelsAre,'boards','changing the count keeps the stamp');
  assert.equal(geometryWithShelfHeight(room,1,50).levelsAre,'boards','moving a board keeps the stamp');
  assert.equal(normalizeViewerGeometry(room,'walkin-u').levelsAre,'boards','normalizing keeps the stamp');
  assert.equal('levelsAre' in geometryWithShelfCount({ width:36, height:78, depth:18 },4),false,'a unit never grows one');
});

/* A room's lowest board is a shelf above the floor, not the floor. The even
   spread ends at 0.92, past the floor snap (0.86 in scene.js and in
   roomBoards.boardYsFromFracs), which is right for a unit, whose base is its
   bottom level, and wrong for a room, whose floor is drawn already: every
   wall's bottom row sat on the slab beside the floor rows, and an L's corner
   shelf ran through it. */
test('a room\'s boards all stay above the floor snap, through every helper that spaces them',()=>{
  for(let n=1;n<=12;n++){
    const fracs=roomShelfFracs(n);
    assert.equal(fracs.length,n);
    assert.ok(fracs[n-1]<0.86,`${n} boards: the lowest, ${fracs[n-1]}, would snap to the floor`);
    assert.ok(fracs.every((value,index)=>index===0||value>fracs[index-1]),'top to bottom');
    // n+1 equal compartments: the one under the lowest board is as tall as the others.
    const gaps=[fracs[0],...fracs.slice(1).map((value,index)=>value-fracs[index]),0.92-fracs[n-1]];
    assert.ok(gaps.every(gap=>Math.abs(gap-gaps[0])<1e-9),`${n} boards: uneven compartments ${gaps}`);
    assert.notDeepEqual(fracs,evenShelfFracs(n),`${n} boards: a room is not spaced like a unit`);
  }
  const room=roomGeometryFor({ width:72, height:96, depth:72 },5);
  assert.deepEqual(room.shelfYFracs,roomShelfFracs(5));
  assert.deepEqual(geometryWithShelfCount(room,4).shelfYFracs,roomShelfFracs(4),'the count slider on an untouched room keeps the room spread');
  assert.deepEqual(geometryWithShelfCount(room,4,{ preserveSpacing:false }).shelfYFracs,roomShelfFracs(4),'"Space evenly" on a room is the room spread');
  assert.deepEqual(normalizeViewerGeometry({ ...room, shelfYFracs:undefined },'walkin-u').shelfYFracs,roomShelfFracs(5),'a room geometry with no fractions gets the room spread');
  assert.deepEqual(normalizeViewerGeometry({ width:36, height:78, depth:18, shelfCount:5 },'cabinet').shelfYFracs,evenShelfFracs(5),'a unit keeps the even spread, floor included');
  // A board the reader moved survives a count change with its shape, as on a unit, and the lowest stays off the floor.
  const moved=geometryWithShelfHeight(room,2,40);
  const resized=geometryWithShelfCount(moved,6);
  assert.equal(resized.shelfYFracs.length,6);
  assert.notDeepEqual(resized.shelfYFracs,roomShelfFracs(6),'the moved board is kept, not reset');
  assert.ok(resized.shelfYFracs[5]<0.86,'resampling a moved room keeps its lowest board off the floor');
});

test('under-sink viewer uses normal vanity height',()=>{
  assert.equal(normalizeViewerGeometry({width:30,height:96,depth:20,shelfCount:3},'under-sink').height,42);
  assert.equal(normalizeViewerGeometry({width:30,height:34,depth:20,shelfCount:3},'under-sink').height,34);
});

test('shelf count and uneven heights stay ordered and editable',()=>{
  const base=geometryWithShelfCount({width:48,height:72,depth:14},4);
  assert.deepEqual(base.shelfYFracs,evenShelfFracs(4));
  const custom=geometryWithShelfHeight(base,1,50);
  assert.equal(Math.round(custom.height*(1-custom.shelfYFracs[1])),50);
  assert.ok(custom.shelfYFracs.every((value,index,all)=>index===0||value>all[index-1]));
});

test('multiple plan zones can share one physical shelf',()=>{
  const rows=Array.from({length:5},(_,index)=>({
    shelfIndex:index,lv:`Level ${index}`,zone:`Zone ${index}`,items:[{name:`Item ${index}`}],
  }));
  const mapped=mapForShelfCount(rows,2);
  assert.equal(mapped.length,2);
  assert.equal(mapped.flatMap(row=>row.items).length,5);
  assert.match(mapped[0].zone,/Zone 0/);
  assert.match(mapped[0].zone,/Zone 1/);
});

/* A merged row used to spread its first row over the result, so a left-wall
   row folded with a back-wall row came out wall:'left', tier:0, and the
   renumbered shelfIndex left steps[].rows and spotted[].row (which index the
   unmerged plan) pointing at the wrong shelf. */
test('a merged row keeps a wall only when every row in it agrees, and says which plan rows it came from',()=>{
  const rows=[
    {shelfIndex:0,lv:'Left wall: high shelf',zone:'A',wall:'left',tier:0,items:[{name:'a'}]},
    {shelfIndex:1,lv:'Back wall: eye level',zone:'B',wall:'back',tier:0,items:[{name:'b'}]},
    {shelfIndex:2,lv:'Back wall: lower shelves',zone:'C',wall:'back',tier:1,items:[{name:'c'}]},
    {shelfIndex:3,lv:'Right wall: full run',zone:'D',wall:'right',tier:0,items:[{name:'d'}]},
  ];
  const mapped=mapForShelfCount(rows,2);
  assert.equal(mapped.length,2);
  // Bucket 0 mixes the left and back walls: no wall, no tier.
  assert.equal('wall' in mapped[0],false,`mixed bucket kept wall ${mapped[0].wall}`);
  assert.equal('tier' in mapped[0],false,`mixed bucket kept tier ${mapped[0].tier}`);
  assert.deepEqual(mapped[0].srcRows,[0,1]);
  assert.equal(mapped[0].shelfIndex,0);
  // Bucket 1 mixes back and right: same rule.
  assert.equal('wall' in mapped[1],false);
  assert.deepEqual(mapped[1].srcRows,[2,3]);
  assert.equal(mapped[1].shelfIndex,1);
  // Every other field is still the merge it was.
  assert.equal(mapped[0].lv,'Left wall: high shelf + Back wall: eye level');
  assert.equal(mapped[0].zone,'A + B');
  assert.deepEqual(mapped[0].items.map(i=>i.name),['a','b']);

  // A bucket whose rows share a wall keeps it, and sits where its top row sat.
  const sameWall=mapForShelfCount([
    {shelfIndex:0,lv:'Back wall: top',zone:'A',wall:'back',tier:0,items:[]},
    {shelfIndex:1,lv:'Back wall: eye level',zone:'B',wall:'back',tier:1,items:[]},
    {shelfIndex:2,lv:'Right wall: full run',zone:'C',wall:'right',tier:0,items:[]},
  ],2);
  assert.equal(sameWall[0].wall,'back');
  assert.equal(sameWall[0].tier,0);
  assert.deepEqual(sameWall[0].srcRows,[0,1]);
  assert.equal(sameWall[1].wall,'right');
  assert.equal(sameWall[1].tier,0);
  assert.deepEqual(sameWall[1].srcRows,[2]);

  // Rows that never had a wall do not grow one.
  const unwalled=mapForShelfCount([{shelfIndex:0,lv:'A',items:[]},{shelfIndex:1,lv:'B',items:[]}],1);
  assert.equal('wall' in unwalled[0],false);
  assert.equal('tier' in unwalled[0],false);
  assert.deepEqual(unwalled[0].srcRows,[0,1]);
});

test('an unmerged map comes back unchanged apart from srcRows',()=>{
  const rows=[
    {shelfIndex:0,lv:'Left wall: high shelf',zone:'A',wall:'left',tier:0,eye:false,items:[{name:'a'}],safety:{flag:null,why:null}},
    {shelfIndex:1,lv:'Back wall: eye level',zone:'B',wall:'back',tier:0,eye:true,items:[{name:'b'}],safety:{flag:'keep-high',why:'w'}},
  ];
  const mapped=mapForShelfCount(rows,2);
  assert.deepEqual(mapped,rows.map((row,i)=>({...row,srcRows:[i]})));
  // Rows without a shelfIndex are numbered by position.
  const bare=mapForShelfCount([{lv:'A'},{lv:'B'}],5);
  assert.deepEqual(bare.map(r=>r.srcRows),[[0],[1]]);
});

test('L side auto follows explicit left section and otherwise uses right',()=>{
  assert.equal(inferLSide({sections:[{id:'left',rows:[0]}]}),'left');
  assert.equal(inferLSide({sections:[{id:'run-b',rows:[1]}]}),'right');
});

/* Dragging individual shelf heights and then nudging the count slider by one
   used to replace every position with even spacing, with no warning and no
   undo. The count now applies on top of the spacing the user set; "Space
   evenly" is the control that deliberately resets it. */
test('changing the shelf count keeps hand-set heights instead of discarding them',()=>{
  const base=geometryWithShelfCount({width:48,height:72,depth:14},4);
  // Push shelf 1 well away from where even spacing would put it.
  const custom=geometryWithShelfHeight(base,1,50);
  const customFracs=custom.shelfYFracs.slice();
  assert.notDeepEqual(customFracs,evenShelfFracs(4));

  // Same count: untouched.
  assert.deepEqual(geometryWithShelfCount(custom,4).shelfYFracs,customFracs);

  for(const count of [1,2,3,5,8,12]){
    const resized=geometryWithShelfCount(custom,count);
    assert.equal(resized.shelfCount,count);
    assert.equal(resized.shelfYFracs.length,count);
    assert.ok(resized.shelfYFracs.every(v=>Number.isFinite(v)&&v>=0&&v<=1),
      `count ${count}: positions left the 0-1 range`);
    assert.ok(resized.shelfYFracs.every((v,i,all)=>i===0||v>all[i-1]),
      `count ${count}: positions are no longer strictly increasing`);
    if(count>1){
      assert.notDeepEqual(resized.shelfYFracs,evenShelfFracs(count),
        `count ${count}: hand-set spacing was flattened back to even`);
    }
  }

  // And the escape hatch still works.
  const evened=geometryWithShelfCount(custom,4,{ preserveSpacing:false });
  assert.deepEqual(evened.shelfYFracs,evenShelfFracs(4));
});

/* The regenerated spacing ran 0.08 to 0.90 and made the top compartment a
   sliver: three inches in a 30-inch wall cabinet, with the other two
   compartments sharing the remaining 27. Every projected plan's "Top shelf"
   was that sliver, and a wide sideboard drawn as two drawers got a 3-inch top
   drawer over a 31-inch one. n levels are n compartments of one height, with
   the bottom board on the floor. */
test('even shelf spacing gives every compartment the same height, top one included',()=>{
  for(const n of [2,3,4,5,6,8]){
    const fracs=evenShelfFracs(n);
    assert.equal(fracs.length,n);
    const pitch=fracs[0];   // the top compartment: from the top down to the first board
    for(let i=1;i<n;i++) assert.ok(Math.abs((fracs[i]-fracs[i-1])-pitch)<1e-9,`n=${n}: compartment ${i} is not the same height as the top one`);
    assert.ok(fracs[n-1]>=0.86,`n=${n}: the bottom board is not on the floor`);
    assert.ok(fracs.every((v,i)=>i===0||v>fracs[i-1]));
  }
  assert.deepEqual(evenShelfFracs(1),[0.5]);
});
