import test from 'node:test';
import assert from 'node:assert/strict';
import {organizerSpecFor,ORGANIZER_TYPES,selectedProductNeeds} from '../js/three/organizerKinds.js';

const base={surface:'shelf',row:{lv:'Eye level',zone:'Snacks'},itemKind:'food',space:'pantry',styles:[],prefs:[],existingText:''};

test('3D organizers follow zone-specific product recommendations',()=>{
  const clear=organizerSpecFor({...base,productNeeds:[{type:'clear-bin',targetZone:'Eye level',purpose:'Visible snacks'}]});
  assert.equal(clear.type,'clear-bin');
  assert.equal(clear.source,'plan');
  const turntable=organizerSpecFor({...base,row:{lv:'Middle shelf',zone:'Oils'},productNeeds:[{type:'turntable',targetZone:'Middle shelf'}]});
  assert.equal(turntable.type,'turntable');
});

test('style and reuse choices produce baskets, clear bins, and dividers',()=>{
  assert.equal(organizerSpecFor({...base,styles:['Woven baskets'],productNeeds:[]}).type,'basket');
  assert.equal(organizerSpecFor({...base,styles:['Clear containers'],productNeeds:[]}).type,'clear-bin');
  assert.equal(organizerSpecFor({...base,surface:'drawer',productNeeds:[]}).type,'divider');
  assert.equal(organizerSpecFor({...base,productNeeds:[],existingText:'Reuse: 2 baskets'}).type,'basket');
});

test('rods and pegboards stay open and every returned type is renderable',()=>{
  assert.equal(organizerSpecFor({...base,surface:'rod',productNeeds:[{type:'basket',targetZone:'Every zone'}]}),null);
  for(const type of ORGANIZER_TYPES) assert.ok(['clear-bin','basket','divider','turntable','riser','door-rack','hook-rack'].includes(type));
});

test('checked shopping choices drive exact 3D product dimensions and quantity',()=>{
  const needs=[{type:'clear-bin',qty:1,targetZone:'Snacks',maxDims:{w_in:12,h_in:8,d_in:14}}];
  const selected=selectedProductNeeds(needs,[{
    needIdx:0,checked:true,qty:3,productId:'bin-10',name:'Ten inch bin',fit:'fits',
    dims_in:{w:10,h:6,d:13},
  }]);
  assert.equal(selected.length,1);
  assert.equal(selected[0].qty,3);
  assert.deepEqual(selected[0].productDims,{w:10,h:6,d:13});
  const spec=organizerSpecFor({...base,productNeeds:selected});
  assert.equal(spec.productId,'bin-10');
  assert.deepEqual(spec.productDims,{w:10,h:6,d:13});
});

test('unchecked products disappear from 3D product plan',()=>{
  const needs=[{type:'basket',qty:2,targetZone:'Snacks'}];
  assert.deepEqual(selectedProductNeeds(needs,[{needIdx:0,checked:false,qty:2}]),[]);
});
