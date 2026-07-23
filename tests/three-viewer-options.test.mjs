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
