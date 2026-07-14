import { state } from './state.js';
import { setFootHeightVar } from './ui.js';
import { buildAll } from './screens/index.js';
import { runLoading } from './screens/loading.js';
import { syncCategoriesToResults } from './screens/results.js';

/* ============================================================
   Flow / routing
   ============================================================ */
export const FLOW = ['landing','space','household','capture','details','prefs','loading','review','results','customize','save','feedback','done'];
// screens that show the sticky Back/Continue footer
export const FLOW_SCREENS = {
  space:{next:'household',back:'landing',label:'Continue'},
  household:{next:'capture',back:'space',label:'Continue'},
  capture:{next:'details',back:'household',label:'Continue'},
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
  setFootHeightVar();
  fillRailSummaries();
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
  fillRailSummaries();
}
// "Your answers so far" panel in the wizard context rail
const SPACE_NAMES={pantry:'Pantry',cabinet:'Kitchen cabinet',closet:'Closet',garage:'Garage shelf',attic:'Attic / storage',laundry:'Laundry room',kids:'Kids’ storage',other:'Other'};
const GOAL_NAMES={find:'Easier to find',clutter:'Less clutter',own:'Use what I own',capacity:'More capacity',kid:'Kid-friendly',minimal:'Minimal look',shop:'Product recs',unsure:'Best plan'};
const CAPTURE_NAMES={photos:'Photos',video:'Video',demo:'Demo example'};
export function fillRailSummaries(){
  const rows=[];
  if(state.space) rows.push(['Space', SPACE_NAMES[state.space]||state.space]);
  if(state.goal) rows.push(['Goal', GOAL_NAMES[state.goal]||state.goal]);
  const h=state.household;
  if(h.kids.present==='yes') rows.push(['Kids', h.kids.ages.length?h.kids.ages.join(', '):'yes']);
  else if(h.kids.present==='no') rows.push(['Kids', 'no']);
  if(h.pets.present==='yes') rows.push(['Pets', h.pets.types.length?h.pets.types.join(', '):'yes']);
  if(h.mobility.length && !(h.mobility.length===1 && h.mobility[0]==='None')) rows.push(['Mobility', h.mobility.join(', ')]);
  if(state.capture) rows.push(['Capture', CAPTURE_NAMES[state.capture]||state.capture]);
  if(state.uploadedFiles && state.uploadedFiles.length) rows.push(['Photos', state.uploadedFiles.length+' selected']);
  if(state.dims && (state.dims.w_in||state.dims.d_in)) rows.push(['Size', [state.dims.w_in&&state.dims.w_in+'w', state.dims.h_in&&state.dims.h_in+'h', state.dims.d_in&&state.dims.d_in+'d'].filter(Boolean).join(' × ')+' in']);
  if(state.prefs && state.prefs.size) rows.push(['Priorities', state.prefs.size+' picked']);
  if(state.budget) rows.push(['Budget', state.budget]);
  if(state.effort) rows.push(['Effort', state.effort]);
  const html=rows.length
    ? rows.map(([k,v])=>`<div class="rs-row"><dt>${k}</dt><dd>${String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</dd></div>`).join('')
    : '<span class="rs-empty">Nothing yet — your choices will collect here.</span>';
  document.querySelectorAll('[data-rail-sum]').forEach(dl=>{ dl.innerHTML=html; });
}

export function restart(){
  state.space=state.goal=state.capture=state.budget=state.effort=null;
  state.prefs=new Set(); state.upgrades=false;
  state.cats=[]; state.features=[];
  state.uploadedFiles=[]; state.uploadedVideo=null; state.frames=[];
  state.dims=null;
  state.household={ kids:{present:null, ages:[]}, pets:{present:null, types:[]}, mobility:[], notes:'' };
  state.ai=null; state.aiError=null; state.planMeta=null; state.afterMode='Use existing containers';
  document.querySelectorAll('.sel').forEach(e=>e.classList.remove('sel'));
  document.getElementById('goal-block').classList.add('hide');
  document.getElementById('capture-detail').classList.add('hide');
  document.getElementById('customize-result').classList.add('hide');
  document.getElementById('hh-kid-ages').classList.add('hide');
  document.getElementById('hh-pet-types').classList.add('hide');
  buildAll();
  go('landing');
}
