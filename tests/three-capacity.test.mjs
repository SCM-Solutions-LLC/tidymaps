import test from 'node:test';
import assert from 'node:assert/strict';
import {
  measuredCapacityProfile,naturalItemWidth,naturalOrganizerWidth,visualUnitCount,
} from '../js/three/capacity.js';

test('representative item quantity grows with measured surface width',()=>{
  const compact=visualUnitCount({availableWidth:10,kind:'garment',size:'m',surface:'rod'});
  const spacious=visualUnitCount({availableWidth:40,kind:'garment',size:'m',surface:'rod'});
  assert.equal(compact,1);
  assert.equal(spacious,4);
});

test('physical item and organizer widths stay realistic',()=>{
  assert.equal(naturalItemWidth('bottle','m'),4.25);
  assert.equal(naturalItemWidth('shoe','l'),11);
  assert.equal(naturalOrganizerWidth('clear-bin',{w_in:10}),10);
  assert.equal(naturalOrganizerWidth('basket',{w_in:30}),18,'oversize recommendation is capped');
});

test('measured dimensions classify component and room capacity',()=>{
  assert.equal(measuredCapacityProfile({width:12,height:12,depth:6}),'compact');
  assert.equal(measuredCapacityProfile({width:36,height:72,depth:18}),'standard');
  assert.equal(measuredCapacityProfile({width:96,height:96,depth:48}),'spacious');
});
