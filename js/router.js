import { state, persistGuestDraft, clearGuestDraft, clearGuestMedia, resetPlanRecord } from './state.js';
import { track } from './telemetry.js';
import { setFootHeightVar, scrollToTop } from './ui.js';
import { getSession } from './auth.js';
import { buildAll, buildCustomize } from './screens/index.js';
import { runLoading } from './screens/loading.js';
import { buildDashboard } from './screens/dashboard.js';
import { buildFeedback } from './screens/feedback.js';
import { setArea, renderWizardScreen, wizardContextString, stepNumFor, WIZARD_STEPS } from './screens/wizard.js';
import { closeAuth } from './screens/account.js';

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

/* ============================================================
   Browser history

   There was none. Twelve steps of answers behind a Back button that left the
   site, on a phone, where Back is how people move — and the swipe gesture is
   the same action. Nothing was lost (the guest draft survives), but landing on
   a marketing page mid-wizard reads as having lost it, which is the same thing
   from the outside.

   Every screen change pushes an entry, so Back walks the flow in reverse. Two
   rules keep the stack honest:

   - A transient screen is REPLACED by whatever follows it, never pushed over.
     The loading screen exists for as long as an analysis takes and cannot be
     returned to; pushing it would put a dead screen behind the report, and
     Back from the report would re-enter a spinner that is not spinning.
   - popstate navigates without pushing, or every Back would append a new
     entry and the button would stop making progress.

   The URL carries the screen as a fragment so a mid-session reload is at least
   legible. Restoring a screen from the fragment is deliberately NOT done here:
   photos live in memory only and are gone after a reload, so a restored capture
   step would show an empty picker over answers that say otherwise. The reload
   path keeps its existing behaviour — the landing page, and a toast saying the
   answers are still there.
   ============================================================ */
const TRANSIENT=new Set(['loading']);
const canHistory=()=>typeof history!=='undefined' && typeof history.pushState==='function';
let popping=false;

function syncHistory(id, from, replace){
  if(!canHistory()) return;
  if(history.state && history.state.screen===id) return;
  const url=id==='landing' ? location.pathname+location.search : '#'+id;
  const entry={ screen:id };
  if(replace || TRANSIENT.has(from) || !history.state) history.replaceState(entry,'',url);
  else history.pushState(entry,'',url);
}

/* Called once at startup so the session's first entry names a screen. Without
   it the opening entry has null state, and the first Back would read as "no
   screen recorded" — indistinguishable from arriving from another site. */
export function initHistory(){
  if(!canHistory()) return;
  history.replaceState({ screen:current },'',location.pathname+location.search);
  addEventListener('popstate',(e)=>{
    /* An open modal is what Back should dismiss — on a phone it is the only
       gesture people use for "get me out of this". Dismiss it and put the entry
       straight back, so the press spends itself on the modal instead of
       navigating the screen behind it. pushState does not re-fire popstate, so
       this cannot loop. */
    const modal=document.getElementById('auth-modal');
    if(modal && !modal.classList.contains('hide')){
      closeAuth();
      history.pushState({ screen:current },'', location.hash || location.pathname+location.search);
      return;
    }
    const id=(e.state && e.state.screen) || 'landing';
    if(id===current) return;
    // An entry for a screen this build does not have (an old tab, a hand-edited
    // fragment) is left to the browser rather than throwing on a null element.
    if(!document.getElementById('screen-'+id)) return;
    popping=true;
    try{ go(id); } finally { popping=false; }
  });
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
export function go(id, opts={}){
  const from=current;
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
  if(!popping) syncHistory(id, from, opts.replace);
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
  /* Replaces rather than pushes: the answers behind that entry no longer exist,
     so an entry pointing back into the wizard would return the user to a step
     that has been reset under them. */
  go('landing', { replace:true });
}
