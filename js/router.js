import { state } from './state.js';
import { buildAll } from './screens/index.js';
import { runLoading } from './screens/loading.js';
import { syncCategoriesToResults } from './screens/results.js';

/* ============================================================
   Flow / routing
   ============================================================ */
export const FLOW = ['landing','space','capture','details','prefs','loading','review','results','customize','save','feedback','done'];
// screens that show the sticky Back/Continue footer
export const FLOW_SCREENS = {
  space:{next:'capture',back:'landing',label:'Continue'},
  capture:{next:'details',back:'space',label:'Continue'},
  details:{next:'prefs',back:'capture',label:'Continue · or skip'},
  prefs:{next:'loading',back:'details',label:'Analyze my space'},
  review:{next:'results',back:null,label:'Build my plan'}
};
let current='landing';

export function setRail(){
  const idx=Math.max(0,FLOW.indexOf(current));
  const pct=Math.round(idx/(FLOW.length-2)*100);
  document.getElementById('rail').style.width=Math.min(100,pct)+'%';
}
export function go(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById('screen-'+id);
  el.classList.add('active');
  current=id;
  setRail();
  // footer
  const foot=document.getElementById('flow-foot');
  if(FLOW_SCREENS[id]){
    foot.classList.remove('hide');
    const cfg=FLOW_SCREENS[id];
    document.getElementById('flow-back').style.visibility=cfg.back?'visible':'hidden';
    document.getElementById('flow-next').textContent=cfg.label;
    updateGate();
  }else{
    foot.classList.add('hide');
  }
  window.scrollTo({top:0,behavior:'smooth'});
}
export function goNext(){
  const cfg=FLOW_SCREENS[current];
  if(!cfg)return;
  if(current==='prefs'){ go('loading'); runLoading(); return; }
  if(current==='review'){ syncCategoriesToResults(); }
  go(cfg.next);
}
export function goBack(){
  const cfg=FLOW_SCREENS[current];
  if(cfg&&cfg.back) go(cfg.back);
}
export function updateGate(){
  // gate Continue on minimal required selection
  const btn=document.getElementById('flow-next');
  let ok=true;
  if(current==='space') ok=!!state.space && !!state.goal;
  if(current==='capture') ok=!!state.capture;
  btn.disabled=!ok;
}
export function restart(){
  state.space=state.goal=state.capture=state.budget=state.effort=null;
  state.prefs=new Set(); state.upgrades=false;
  state.cats=[]; state.features=[];
  state.uploadedFiles=[]; state.uploadedVideo=null;
  state.ai=null; state.aiError=null; state.afterMode='Use existing containers';
  document.querySelectorAll('.sel').forEach(e=>e.classList.remove('sel'));
  document.getElementById('goal-block').classList.add('hide');
  document.getElementById('capture-detail').classList.add('hide');
  document.getElementById('customize-result').classList.add('hide');
  buildAll();
  go('landing');
}
