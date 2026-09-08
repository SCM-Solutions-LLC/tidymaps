import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evenShelfFracs,normalizeViewerGeometry,geometryWithShelfCount,
  geometryWithShelfHeight,mapForShelfCount,inferLSide,
} from '../js/three/viewerOptions.js';

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
