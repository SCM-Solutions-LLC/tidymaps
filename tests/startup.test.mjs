import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeRoute } from '../js/startup.js';
import { startPlanInstance } from '../js/state.js';

function deferred(){
  let resolve;
  const promise=new Promise((res)=>{ resolve=res; });
  return { promise, resolve };
}

function harness(overrides={}){
  const calls=[];
  let screen='landing';
  return {
    calls,
    setScreen(value){ screen=value; },
    deps:{
      setupAccount:async()=>{},
      getSession:()=>null,
      currentScreen:()=>screen,
      search:'',
      fetchSpace:async()=>({ data:{} }),
      applyLoadedSpace:(loaded)=>loaded.data,
      restoreGuestDraft:()=>null,
      buildResults:()=>calls.push('buildResults'),
      applySavedProgress:(steps)=>calls.push(['progress',steps]),
      getStepDone:()=>[],
      go:(route)=>calls.push(['go',route]),
      toast:(message)=>calls.push(['toast',message]),
      ...overrides,
    },
  };
}

test('does not overwrite navigation while account setup is pending', async()=>{
  const gate=deferred();
  const h=harness({ setupAccount:()=>gate.promise });
  const initializing=initializeRoute(h.deps);

  h.setScreen('viewer3d');
  gate.resolve();

  assert.deepEqual(await initializing, { status:'skipped-navigation' });
  assert.deepEqual(h.calls, []);
});

test('restores a ready guest draft when startup remains on landing', async()=>{
  const h=harness({
    restoreGuestDraft:()=>({ planReady:true }),
    getStepDone:()=>[true,false,true],
  });

  assert.deepEqual(await initializeRoute(h.deps), { status:'restored-draft' });
  assert.deepEqual(h.calls, [
    'buildResults',
    ['progress',[true,false,true]],
    ['go','results'],
    ['toast','Welcome back — we restored your last plan'],
  ]);
});

test('restores a signed-in deep link when startup remains on landing', async()=>{
  const loaded={ data:{ progress:{ stepsDone:[true,false] } } };
  const h=harness({
    getSession:()=>({ access_token:'test' }),
    search:'?space=space-123',
    fetchSpace:async(id)=>{
      h.calls.push(['fetch',id]);
      return loaded;
    },
    applyLoadedSpace:(value)=>{
      h.calls.push(['apply',value]);
      return value.data;
    },
  });

  assert.deepEqual(await initializeRoute(h.deps), { status:'restored-space' });
  assert.deepEqual(h.calls, [
    ['fetch','space-123'],
    ['apply',loaded],
    'buildResults',
    ['progress',[true,false]],
    ['go','results'],
  ]);
});

/* The share path had the saved-space path's guard on NAVIGATION but not on
   STATE: loadSharedPlan applied the payload itself, and applySharedSpace()
   begins by wiping every wizard answer. Someone who opened a share link and
   started their own plan while it was still in flight kept their screen and
   lost their answers. The fetch and the apply are separate deps now, and only
   the fetch may run before the route check. */
test('restores a shared plan when startup remains on landing', async()=>{
  const payload={ name:'someone else’s pantry' };
  const h=harness({
    search:'?share=abc-123',
    loadSharedPlan:async(id)=>{ h.calls.push(['fetchShared',id]); return payload; },
    applySharedPlan:(value)=>h.calls.push(['applyShared',value]),
  });

  assert.deepEqual(await initializeRoute(h.deps), { status:'shared-view' });
  assert.deepEqual(h.calls, [
    ['fetchShared','abc-123'],
    ['applyShared',payload],
    'buildResults',
    ['go','results'],
    ['toast','You’re viewing a shared plan — read-only'],
  ]);
});

test('does not apply a shared plan after navigation changes', async()=>{
  const gate=deferred();
  const h=harness({
    search:'?share=abc-123',
    loadSharedPlan:()=>gate.promise,
    applySharedPlan:()=>h.calls.push('applyShared'),
  });
  const initializing=initializeRoute(h.deps);

  // The visitor started answering the wizard while the share fetch was open.
  h.setScreen('goals');
  gate.resolve({ name:'someone else’s pantry' });

  assert.deepEqual(await initializing, { status:'skipped-navigation' });
  assert.deepEqual(h.calls, [], 'the shared payload must not touch state once they have moved on');
});

test('a failed share fetch says so and falls through', async()=>{
  const h=harness({
    search:'?share=abc-123',
    loadSharedPlan:async()=>{ const e=new Error('gone'); e.code='http_404'; throw e; },
    applySharedPlan:()=>h.calls.push('applyShared'),
  });

  assert.deepEqual(await initializeRoute(h.deps), { status:'unchanged' });
  assert.deepEqual(h.calls, [['toast','That share link is no longer active.']]);
});

test('does not apply a fetched space after navigation changes', async()=>{
  const gate=deferred();
  const h=harness({
    getSession:()=>({ access_token:'test' }),
    search:'?space=space-123',
    fetchSpace:()=>gate.promise,
    applyLoadedSpace:()=>h.calls.push('apply'),
  });
  const initializing=initializeRoute(h.deps);

  h.setScreen('viewer3d');
  gate.resolve({ data:{ id:'space-123' } });

  assert.deepEqual(await initializing, { status:'skipped-navigation' });
  assert.deepEqual(h.calls, []);
});

/* Navigation is not the only way a restore stops being wanted. Start over
   clears every answer and lands the user back on the LANDING page, which is
   exactly the screen the guard was looking for — so a deep link still in
   flight passed the check and dropped a saved plan on top of answers that had
   just been deliberately cleared. The plan instance is what tells those two
   landing pages apart. */
test('does not apply a fetched space after the user has started a different plan', async()=>{
  const gate=deferred();
  const h=harness({
    getSession:()=>({ access_token:'test' }),
    search:'?space=space-123',
    fetchSpace:()=>gate.promise,
    applyLoadedSpace:()=>h.calls.push('apply'),
  });
  const initializing=initializeRoute(h.deps);

  // Still on landing — but not on the same plan.
  startPlanInstance();
  gate.resolve({ data:{ id:'space-123' } });

  assert.deepEqual(await initializing, { status:'skipped-navigation' });
  assert.deepEqual(h.calls, []);
});

test('does not apply a shared plan after the user has started a different plan', async()=>{
  const gate=deferred();
  const h=harness({
    search:'?share=abc-123',
    loadSharedPlan:()=>gate.promise,
    applySharedPlan:()=>h.calls.push('applyShared'),
  });
  const initializing=initializeRoute(h.deps);

  startPlanInstance();
  gate.resolve({ name:'someone else’s pantry' });

  assert.deepEqual(await initializing, { status:'skipped-navigation' });
  assert.deepEqual(h.calls, [], 'the shared payload must not wipe the plan they started');
});
