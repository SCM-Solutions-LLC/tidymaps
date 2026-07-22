import { state, persistGuestDraft, clearGuestDraft, clearGuestMedia } from './state.js';
import { track } from './telemetry.js';
import { setFootHeightVar } from './ui.js';
import { getSession } from './auth.js';
import { buildAll } from './screens/index.js';
import { runLoading } from './screens/loading.js';
import { buildDashboard } from './screens/dashboard.js';
import { setArea, renderWizardScreen, wizardContextString, stepNumFor, WIZARD_STEPS } from './screens/wizard.js';

/* ============================================================
   Flow / routing — the design-contract 12-step wizard:
   room → area → setup → measurements → photos → household →
   contents → goals → style → effort → shopping → review → plan
   ============================================================ */
export const FLOW = ['landing','space','area','setup','measure','capture','household','contents','goals','style','effort','shopping','review','loading','results','customize','save','feedback','done'];
// screens that show the sticky Back/Continue footer
export const FLOW_SCREENS = {
  space:{next:'area',back:null,label:'Continue'},
  area:{next:'setup',back:'space',label:'Continue'},
  setup:{next:'measure',back:'area',label:'Continue'},
  measure:{next:'capture',back:'setup',label:'Continue'},
  capture:{next:'household',back:'measure',label:'Continue'},
  household:{next:'contents',back:'capture',label:'Continue'},
  contents:{next:'goals',back:'household',label:'Continue'},
  goals:{next:'style',back:'contents',label:'Continue'},
  style:{next:'effort',back:'goals',label:'Continue'},
  effort:{next:'shopping',back:'style',label:'Continue'},
  shopping:{next:'review',back:'effort',label:'Continue'},
  review:{next:'loading',back:'shopping',label:'Build my plan'}
};
let current='landing';

export function getCurrentScreen(){
  return current;
}

export function setRail(){
  const rail=document.getElementById('rail');
  if(!rail) return;
  const stepNum=stepNumFor(current);
  if(stepNum>0){
    rail.style.width=Math.round(stepNum/WIZARD_STEPS.length*100)+'%';
    return;
  }
  const idx=Math.max(0,FLOW.indexOf(current));
  const pct=Math.round(idx/(FLOW.length-2)*100);
  rail.style.width=Math.min(100,pct)+'%';
}
export function go(id){
  if(current==='viewer3d' && id!=='viewer3d'){
    // free WebGL resources when leaving the 3D screen
    import('./screens/viewer3d.js').then(m=>m.disposeViewer3d());
  }
  // per-space screens re-render on entry so they always reflect the answers
  renderWizardScreen(id);
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById('screen-'+id);
  el.classList.add('active');
  current=id;
  // the appbar shows site navigation on the landing page and
  // workflow controls (Start over, My spaces) everywhere else
  document.body.dataset.screen=id;
  track('screen_viewed', { screen:id });   // wizard funnel / drop-off
  setRail();
  // step counter in appbar for wizard screens
  const stepEl=document.getElementById('appbar-step');
  const stepScreen=document.querySelector('#screen-'+id+' .step-num');
  if(stepEl){
    if(stepScreen){
      stepEl.textContent=stepScreen.textContent;
      stepEl.style.display='inline';
    } else {
      stepEl.style.display='none';
    }
  }
  // footer
  const foot=document.getElementById('flow-foot');
  if(FLOW_SCREENS[id]){
    foot.classList.remove('hide');
    const cfg=FLOW_SCREENS[id];
    document.getElementById('flow-back').style.visibility=cfg.back?'visible':'hidden';
    document.getElementById('flow-next').innerHTML=cfg.label
      +' <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    const ctx=document.getElementById('flow-ctx');
    if(ctx) ctx.textContent=wizardContextString(id);
    updateGate();
  }else{
    foot.classList.add('hide');
  }
  setFootHeightVar();
  if(id==='dashboard') buildDashboard();
  // The plan is finished at 'done'. For signed-out visitors this is where the
  // landing page's photo promise is enforced: photos were only ever held in
  // memory for the analysis, and they're dropped here.
  if(id==='done' && !getSession()) clearGuestMedia();
  if(!getSession()) persistGuestDraft();
  window.scrollTo({top:0,behavior:'smooth'});
}
export function goNext(){
  const cfg=FLOW_SCREENS[current];
  if(!cfg)return;
  if(current==='capture'){
    // capture mode follows what the user actually provided
    state.capture = state.uploadedFiles.length ? 'photos'
      : (state.uploadedVideo ? 'video' : 'demo');
  }
  if(current==='review'){ go('loading'); runLoading(); return; }
  go(cfg.next);
}
export function goBack(){
  const cfg=FLOW_SCREENS[current];
  if(cfg&&cfg.back) go(cfg.back);
}
export function updateGate(){
  // The wizard preselects a valid default at every step (design contract),
  // so Continue is enabled whenever the minimal selection exists.
  const btn=document.getElementById('flow-next');
  let ok=true;
  if(current==='space'||current==='area') ok=!!state.space;
  if(current==='setup') ok=!!state.setup;
  btn.disabled=!ok;
}

export function restart(){
  const hasProgress = current!=='landing' && (state.ai || state.uploadedFiles.length || WIZARD_STEPS.indexOf(current)>0);
  if(hasProgress && !confirm('Start over? Your current answers will be cleared.')) return;
  state.goal=state.capture=state.budget=null;
  state.prefs=new Set(); state.upgrades=false;
  state.shareView=false; delete state.sharedName;
  state.cats=[]; state.features=[];
  state.goals=[]; state.styles=[]; state.detected=[]; state.catsTouched=false;
  state.shoppingPref='Use what I have';
  state.effort='Weekend reset';
  state.uploadedFiles=[]; state.uploadedVideo=null; state.frames=[];
  state.dims=null; state.dimsFt=null;
  state.household={ adults:2, kidCount:1, petCount:0, kids:{present:'yes', ages:['Toddler']}, pets:{present:'no', types:[]}, mobility:[], notes:'' };
  state.ai=null; state.aiError=null; state.planMeta=null; state.afterMode='Use existing containers';
  state.activeSpaceId=null; state.shopping=null; state.arrangement=null;
  state.stepDone=[]; state.upgradeChecked=null;
  state.afterRenderB64=null; state.afterRenderUrl=null; state.beforePhotoUrl=null;
  delete state._beforeUrl;
  Object.keys(state).filter(k=>k.startsWith('detail_')).forEach(k=>{ delete state[k]; });
  // back to the design defaults: Kitchen → Pantry → Cabinet
  state.room='kitchen';
  setArea('kitchen','pantry');
  clearGuestDraft();
  const custom=document.getElementById('customize-result');
  if(custom) custom.classList.add('hide');
  buildAll();
  go('landing');
}
