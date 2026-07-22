import { CUSTOMIZE, STEPS } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';
import { toast } from '../ui.js';
import { go } from '../router.js';
import { renderSteps, setUpgrades, applySavedProgress } from './results.js';

/* ---------- Customize ---------- */
export function buildCustomize(){
  const wrap=document.getElementById('customize-opts'); wrap.innerHTML='';
  CUSTOMIZE.forEach(([id,t,d])=>{
    const b=document.createElement('button'); b.className='opt';
    b.innerHTML=`<span><span class="ttl">${t}</span><span class="sub">${d}</span></span><span class="tick">${ICON.check}</span>`;
    b.onclick=()=>applyCustomize(id,t,d,b,wrap);
    wrap.appendChild(b);
  });
}
export function applyCustomize(id,t,d,b,wrap){
  wrap.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel')); b.classList.add('sel');
  if(id==='addprod'){ setUpgrades(true); }
  if(id==='rmprod'||id==='own'||id==='budget'){ setUpgrades(false); }
  const savedProgress=state.stepDone?state.stepDone.slice():[];
  const baseSteps=(state.ai&&state.ai.steps.length)?state.ai.steps:STEPS;
  if(id==='fewer'||id==='faster'){
    renderSteps(baseSteps.slice(0,5));
  }else{
    renderSteps(baseSteps);
  }
  applySavedProgress(savedProgress);
  const r=document.getElementById('customize-result'); r.classList.remove('hide');
  r.innerHTML=`<div class="card pad" style="background:var(--primary-bg);border-color:var(--primary-line)">
    <div style="font-weight:600">Plan revised: ${t}</div>
    <p class="small" style="margin:6px 0 14px;color:var(--ink-2)">${d} We’ve updated your move-by-move plan${state.upgrades?' and turned on optional upgrades':''}.</p>
    <button class="btn btn-primary btn-sm" onclick="go('results')">View updated plan</button>
  </div>`;
  toast('Plan updated');
}
