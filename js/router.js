import { state, persistGuestDraft, clearGuestDraft, clearGuestMedia, resetPlanRecord } from './state.js';
import { track } from './telemetry.js';
import { setFootHeightVar, scrollToTop } from './ui.js';
import { getSession } from './auth.js';
import { buildAll, buildCustomize } from './screens/index.js';
import { runLoading } from './screens/loading.js';
import { buildDashboard } from './screens/dashboard.js';
import { buildFeedback } from './screens/feedback.js';
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
// Screens that keep the marketing chrome (site nav, "Plan my space" CTA).
const SITE_SCREENS=new Set(['landing','products']);
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
  // the Adjust options depend on the household answer, which comes long after
  // buildAll() ran at startup
  if(id==='customize') buildCustomize();
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById('screen-'+id);
  el.classList.add('active');
  current=id;
  // the appbar shows site navigation on the landing page and
  // workflow controls (Start over, My spaces) everywhere else
  document.body.dataset.screen=id;
  // Landing and the product library are site pages: they keep the marketing
  // nav and CTA in the appbar, where flow and report screens show workflow
  // controls instead.
  document.body.dataset.site=SITE_SCREENS.has(id)?'1':'';
  if(!SITE_SCREENS.has(id)) document.body.classList.remove('nav-open');
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
      // Also clear the text: `.step-counter:not(:empty) ~ .restart` hides
      // "Start over" whenever the counter holds anything, so stale "Step 12
      // of 12" text kept the button hidden for the rest of the session.
      stepEl.textContent='';
    }
  }
  // footer
  const foot=document.getElementById('flow-foot');
  // Flow screens own the bottom of the viewport with their sticky nav, so the
  // marketing footer is suppressed there — otherwise it lands mid-page on short
  // steps and reads as a false end-of-page above the Back/Continue bar.
  document.body.dataset.flow=FLOW_SCREENS[id]?'1':'';
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
  // Rebuilt on entry, not once at startup: whether to ask at all depends on
  // whether the report's inline ask was already answered, which is decided
  // long after buildAll() runs.
  if(id==='feedback') buildFeedback();
  // The plan is finished at 'done'. For signed-out visitors this is where the
  // landing page's photo promise is enforced: photos were only ever held in
  // memory for the analysis, and they're dropped here.
  if(id==='done' && !getSession()) clearGuestMedia();
  if(!getSession()) persistGuestDraft();
  if(id!=='landing'){
    const heading=el.querySelector('h1,h2');
    if(heading){ heading.tabIndex=-1; heading.focus({preventScroll:true}); }
  }
  scrollToTop();
}
export function goNext(){
  const cfg=FLOW_SCREENS[current];
  if(!cfg)return;
  if(current==='capture'){
    // capture mode follows what the user actually provided
    state.capture = state.uploadedFiles.length ? 'photos'
      : (state.uploadedVideo ? 'video' : 'demo');
  }
  if(current==='review'){ state.returnToReview=false; go('loading'); runLoading(); return; }
  // Came here from a Review "Edit" link? Go straight back rather than marching
  // the user through every remaining step to reach the button they came from.
  if(state.returnToReview){ state.returnToReview=false; go('review'); return; }
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
  state.cats=[]; state.features=[];
  state.goals=[]; state.styles=[]; state.detected=[]; state.catsTouched=false;
  state.shoppingPref='Use what I have';
  state.effort='Weekend reset';
  state.uploadedFiles=[]; state.uploadedVideo=null; state.frames=[];
  state.dims=null; state.dimsFt=null;
  state.household={ adults:2, kidCount:0, petCount:0, kids:{present:'no', ages:[]}, pets:{present:'no', types:[]}, mobility:[], notes:'' };
  state.afterMode='Use existing containers';
  state.setupTouched=false;
  resetPlanRecord(state);
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
