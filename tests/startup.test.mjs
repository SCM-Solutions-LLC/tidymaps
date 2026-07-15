import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeRoute } from '../js/startup.js';

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
