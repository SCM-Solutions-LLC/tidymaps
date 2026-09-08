import test from 'node:test';
import assert from 'node:assert/strict';
import {organizerSpecFor,ORGANIZER_TYPES,selectedProductNeeds,targetScore,surfaceAcceptsOrganizer,isMountedOrganizer} from '../js/three/organizerKinds.js';

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

/* "Middle shelf" scored 1 against a "Top shelf" row on the word shelf alone,
   and rows are offered in order, so the sample pantry's can rack was placed on
   the top shelf (4 inches of headroom for a 13.75-inch rack) before the middle
   shelf was ever reached, and the viewer warned that it did not fit. Words
   every level name shares say nothing about WHICH level. */
test('a need for one level is not placed on another because both say shelf',()=>{
  const needs=[{type:'can-riser',targetZone:'Middle shelf'}];
  assert.equal(organizerSpecFor({...base,row:{lv:'Top shelf',zone:'Bulk overflow · Rarely used'},productNeeds:needs}),null);
  assert.equal(organizerSpecFor({...base,row:{lv:'Middle shelf',zone:'Canned goods · Pasta'},productNeeds:needs}).type,'riser');
  assert.equal(organizerSpecFor({...base,row:{lv:'Back wall: eye level',zone:'Folded knits'},productNeeds:[{type:'basket',targetZone:'Left wall: high shelf'}]}),null);
});

/* The scene ranks a need's rows before any row is offered it, and it needs
   the same scorer the matcher uses. "Below the bench" against a "Bench
   drawers" row is a partial match; against the row that IS "Below the bench"
   it is exact, and the exact one has to outscore it. */
test('the row a target names outscores a row that merely overlaps it',()=>{
  const exact=targetScore('Below the bench',{lv:'Below the bench',zone:'Safety gear · Cords'});
  const partial=targetScore('Below the bench',{lv:'Bench drawers',zone:'Screws & fasteners'});
  assert.ok(exact>partial&&partial>0,`exact ${exact} should beat partial ${partial}`);
  assert.equal(targetScore('Every drawer',{lv:'Third drawer',zone:'Towels'}),1);
});

test('racks hang on doors and pegboards; nothing else goes there, and rods take nothing',()=>{
  assert.equal(surfaceAcceptsOrganizer('door','door-rack'),true);
  assert.equal(surfaceAcceptsOrganizer('shelf','door-rack'),false);
  assert.equal(surfaceAcceptsOrganizer('pegboard','hook-rack'),true);
  assert.equal(surfaceAcceptsOrganizer('door','hook-rack'),true);
  assert.equal(surfaceAcceptsOrganizer('floor','hook-rack'),false);
  assert.equal(surfaceAcceptsOrganizer('pegboard','clear-bin'),false);
  assert.equal(surfaceAcceptsOrganizer('rod','basket'),false);
  assert.equal(surfaceAcceptsOrganizer('drawer','divider'),true);
  assert.equal(isMountedOrganizer('hook-rack'),true);
  assert.equal(isMountedOrganizer('basket'),false);
});
