import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDemoPlanState } from '../js/state.js';

test('demo plan clears real-plan media and saved state', ()=>{
  const target={
    uploadedFiles:[{ name:'private-room.jpg' }],
    uploadedVideo:{ name:'private-room.mov' },
    frames:[{ data:'old-frame' }],
    beforePhotoUrl:'https://example.test/private-room.jpg',
    afterRenderB64:'old-render',
    afterRenderUrl:'https://example.test/old-render.png',
    _beforeUrl:'blob:old-photo',
    ai:{ summary:'old plan' },
    planMeta:{ model:'old-model' },
    activeSpaceId:'old-space',
    shopping:[{ checked:true }],
    arrangement:{ shelves:[] },
    stepDone:[true],
    upgradeChecked:[true],
    detail_kids:true,
  };

  prepareDemoPlanState(target);

  assert.equal(target.capture, 'demo');
  assert.equal(target.space, 'pantry');
  assert.equal(target.upgrades, true);
  assert.deepEqual(target.uploadedFiles, []);
  assert.deepEqual(target.frames, []);
  assert.equal(target.beforePhotoUrl, null);
  assert.equal(target.afterRenderB64, null);
  assert.equal(target.afterRenderUrl, null);
  assert.equal('_beforeUrl' in target, false);
  assert.equal(target.ai, null);
  assert.equal(target.activeSpaceId, null);
  assert.equal(target.shopping, null);
  assert.equal('detail_kids' in target, false);
});
