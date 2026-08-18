import test from 'node:test';
import assert from 'node:assert/strict';
import { state, resetPlanRecord, currentPlanInstance, startPlanInstance,
         planInstanceIsCurrent } from '../js/state.js';
import { snapshotSave, persistSpace, openSavedSpace } from '../js/db.js';

/* The plan instance is the app's answer to "is this still the same plan the
   user is working on?", and every asynchronous writer checks it before
   touching state. These pin the rule at the level where it is decided, so a
   future writer that re-reads `state` after an await fails here rather than in
   somebody's account.

   The scenario throughout is the one that costs the most: plan A is mid-save
   (or mid-load) when the user starts plan B. */

/* A row shaped like the one the client actually saves. persistSpace updates
   with `.update(row).eq('id',id).select('id').maybeSingle()` and inserts with
   `.select('id').single()`, so the stub answers exactly those chains — an
   update that matches no row is a real outcome the caller has to see. */
function fakeClient({ onUpdate=(_body,id)=>({ data:{ id }, error:null }), insertId='new-space-id' }={}){
  const calls=[];
  return {
    calls,
    from(table){
      if(table==='spaces') return {
        update:(body)=>({ eq:(_col,id)=>({ select:()=>({ maybeSingle:async ()=>{
          calls.push(['update',id,body]); return onUpdate(body,id);
        } }) }) }),
        insert:(body)=>({ select:()=>({ single:async ()=>{ calls.push(['insert',body]); return { data:{ id:insertId }, error:null }; } }) }),
      };
      if(table==='space_media') return {
        select:()=>({ eq:async ()=>({ data:[], error:null }) }),
        insert:async (row)=>{ calls.push(['media-row',row]); return { error:null }; },
      };
      throw new Error('unexpected table '+table);
    },
    storage:{ from:()=>({
      upload:async (path,blob,opts)=>{ calls.push(['upload',path,blob,opts]); return { error:null }; },
      remove:async (paths)=>{ calls.push(['remove',paths]); return { error:null }; },
    }) },
  };
}

test('a plan record reset moves the instance, so every in-flight write is orphaned', () => {
  const before=currentPlanInstance();
  resetPlanRecord(state);
  assert.notEqual(currentPlanInstance(), before);
  assert.equal(planInstanceIsCurrent(before), false);
});

test('resetting a scratch object is not the user switching plans', () => {
  const before=currentPlanInstance();
  resetPlanRecord({});
  assert.equal(currentPlanInstance(), before,
    'only the live state describes the plan the user is on');
});

test('an insert that lands after the user starts another plan does not stamp its row', async () => {
  resetPlanRecord(state);
  state.space='pantry';
  state.activeSpaceId=null;                    // plan A has never been saved
  const snapshot=snapshotSave('Plan A', { media:false });

  // Plan B begins while the insert is in the air — Start over, a saved space
  // opened from the dashboard, a share link.
  startPlanInstance();

  const c=fakeClient({ insertId:'plan-a-row' });
  const id=await persistSpace(c, 'user-1', snapshot);

  assert.equal(id, 'plan-a-row', 'plan A is still saved — the row is real and theirs');
  assert.equal(state.activeSpaceId, null,
    'plan B was handed plan A’s row, so plan B’s next save would overwrite it');
});

test('an insert the user is still waiting on does stamp its row', async () => {
  resetPlanRecord(state);
  state.space='pantry';
  state.activeSpaceId=null;
  const snapshot=snapshotSave('Plan A', { media:false });

  const c=fakeClient({ insertId:'plan-a-row' });
  await persistSpace(c, 'user-1', snapshot);

  assert.equal(state.activeSpaceId, 'plan-a-row');
});

test('a save writes the row it was asked for, not the one open when it finishes', async () => {
  resetPlanRecord(state);
  state.activeSpaceId='space-A';
  const snapshot=snapshotSave('Plan A', { media:false });

  // The user opens a different saved space while the update is in flight.
  state.activeSpaceId='space-B';
  startPlanInstance();

  const c=fakeClient();
  await persistSpace(c, 'user-1', snapshot);

  const updates=c.calls.filter(([kind])=>kind==='update');
  assert.equal(updates.length, 1);
  assert.equal(updates[0][1], 'space-A', 'plan A’s save landed on space B’s row');
  assert.equal(state.activeSpaceId, 'space-B', 'the open space must not be disturbed');
});

test('the photos uploaded are the ones the save was asked to keep', async () => {
  resetPlanRecord(state);
  state.activeSpaceId='space-A';
  state.uploadedFiles=[{ name:'plan-a.jpg', type:'image/jpeg' }];
  state.frames=[];
  const snapshot=snapshotSave('Plan A');

  // Plan B's photos replace plan A's in memory before the upload starts. Read
  // live, they would be uploaded into plan A's space — someone else's photos
  // in a space they can share.
  state.uploadedFiles=[{ name:'plan-b.jpg', type:'image/jpeg' }];
  startPlanInstance();

  const c=fakeClient();
  await persistSpace(c, 'user-1', snapshot);

  const uploaded=c.calls.filter(([kind])=>kind==='upload').map(([,, blob])=>blob.name);
  assert.deepEqual(uploaded, ['plan-a.jpg']);
});

test('a saved space that loads after another is opened applies nothing', async () => {
  resetPlanRecord(state);
  state.activeSpaceId='space-B';
  state.space='closet';

  // The dashboard claims the switch at the click, then the row for the FIRST
  // card arrives late.
  const stale=startPlanInstance();
  startPlanInstance();                          // a second card was tapped

  const applied=await openSavedSpace('space-A', stale, async ()=>({
    data:{ id:'space-A', space_type:'pantry', goal:'find', dims:null, household:null,
           prefs:{}, plan:{ steps:[] }, plan_meta:null, shopping:null, progress:null, arrangement:null },
    beforePhotoUrl:null, afterRenderUrl:null,
  }));

  assert.equal(applied, null, 'the caller must render nothing and navigate nowhere');
  assert.equal(state.activeSpaceId, 'space-B', 'the plan tapped last was replaced by the one that loaded first');
  assert.equal(state.space, 'closet');
});

test('the saved space the user is waiting for is applied', async () => {
  resetPlanRecord(state);
  const instance=startPlanInstance();

  const applied=await openSavedSpace('space-A', instance, async ()=>({
    data:{ id:'space-A', space_type:'pantry', goal:'find', dims:null, household:null,
           prefs:{}, plan:{ steps:[] }, plan_meta:null, shopping:null, progress:null, arrangement:null },
    beforePhotoUrl:null, afterRenderUrl:null,
  }));

  assert.ok(applied, 'the row the user asked for has to reach the screen');
  assert.equal(state.activeSpaceId, 'space-A');
  assert.equal(state.space, 'pantry');
});
