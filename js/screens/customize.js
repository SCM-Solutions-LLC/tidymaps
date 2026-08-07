import { CUSTOMIZE, STEPS } from '../data.js';
import { optionsForHousehold } from '../wizard-data.js';
import { ICON } from '../icons.js';
import { state, persistGuestDraft } from '../state.js';
import { toast } from '../ui.js';
import { go } from '../router.js';
import { getSession } from '../auth.js';
import { updateSpacePatch } from '../db.js';
import { REVISIONS, applyRevision } from '../personalize.js';
import { getDemoScenario } from '../demo-scenarios.js';
import { scenarioKeyFor } from '../wizard-data.js';
import { normalizeAi } from '../plan.js';
import { renderSteps, setUpgrades, applySavedProgress, buildResults } from './results.js';

/* "Use what I have" (the wizard default) legitimately empties productNeeds,
   so turning upgrades back on used to reveal an empty card under a "we've
   turned on optional upgrades" banner. Re-derive the space's own product
   needs instead — the same scenario the plan came from, asked without the
   $0 answer. AI plans keep their productNeeds (applyAnswers never runs on
   them), so this only ever has to rebuild the deterministic path. */
function restoreProductNeeds(){
  if(!state.ai || (state.ai.productNeeds||[]).length) return;
  const scenario=getDemoScenario(scenarioKeyFor(state.space, state.setup), state.goal, state.household, null, state.setup);
  state.ai.productNeeds=normalizeAi(scenario).productNeeds;
  state.ai.cost=scenario.cost||state.ai.cost;
  state.shopping=null;   // rebuilt by initShopping against the new needs
}

/* The mirror: dropping the upsell must zero the list and the cost, not just
   hide the panel — otherwise the Cost KPI keeps quoting a range for products
   the plan no longer recommends, and the next save writes them back. */
function dropProductNeeds(){
  if(!state.ai) return;
  state.ai.productNeeds=[];
  state.ai.cost='$0';
  state.shopping=[];
}

/* ---------- Customize ---------- */
export function buildCustomize(){
  const wrap=document.getElementById('customize-opts'); wrap.innerHTML='';
  /* "Make it more kid-friendly" was still on offer after the household step
     answered no kids — the same contradiction already fixed for the contents
     chips, the goals, and the after-preview tabs. The option text is what
     identifies it, so the shared filter works here unchanged. */
  optionsForHousehold(CUSTOMIZE, state.household).forEach(([id,t,d])=>{
    const b=document.createElement('button'); b.className='opt';
    b.innerHTML=`<span><span class="ttl">${t}</span><span class="sub">${d}</span></span><span class="tick">${ICON.check}</span>`;
    b.onclick=()=>applyCustomize(id,t,d,b,wrap);
    wrap.appendChild(b);
  });
}
export function applyCustomize(id,t,d,b,wrap){
  wrap.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel')); b.classList.add('sel');
  const savedProgress=state.stepDone?state.stepDone.slice():[];
  /* The four shopping options change the plan's own productNeeds and cost,
     so the report has to be rebuilt for the Cost KPI and the upgrade list to
     agree with the panel that just appeared or vanished. */
  let shoppingChanged=false;
  if(id==='addprod'){ restoreProductNeeds(); setUpgrades(true); shoppingChanged=true; }
  if(id==='rmprod'||id==='own'||id==='budget'){ dropProductNeeds(); setUpgrades(false); shoppingChanged=true; }
  if(shoppingChanged){
    buildResults();
    setUpgrades(id==='addprod');   // buildResults re-reads state.upgrades
    applySavedProgress(savedProgress);
    if(getSession()) updateSpacePatch({ plan: state.ai, shopping: state.shopping });
    else persistGuestDraft();
  }

  /* minimal / kid / capacity / hide / labels each have a preference handler
     that does the thing their copy describes. They used to skip it entirely
     and re-render the same steps under a "Plan revised" banner. */
  let revised=false, alreadyDone=false;
  if(id in REVISIONS){
    revised=applyRevision(state.ai, id);
    alreadyDone=!revised;
    if(revised){
      // the handlers reach the zones, the summary and the shopping list, not
      // just the checklist, so the whole report is rebuilt
      buildResults();
      if(getSession()) updateSpacePatch({ plan: state.ai });
      else persistGuestDraft();
    }
  }

  const baseSteps=(state.ai&&state.ai.steps.length)?state.ai.steps:STEPS;
  if(id==='fewer'||id==='faster'){
    renderSteps(baseSteps.slice(0,5));
  }else if(!revised&&!shoppingChanged){
    renderSteps(baseSteps);
  }
  applySavedProgress(savedProgress);
  const r=document.getElementById('customize-result'); r.classList.remove('hide');
  r.innerHTML=`<div class="card pad" style="background:var(--primary-bg);border-color:var(--primary-line)">
    <div style="font-weight:600">${alreadyDone?`Already applied: ${t}`:`Plan revised: ${t}`}</div>
    <p class="small" style="margin:6px 0 14px;color:var(--ink-2)">${alreadyDone
      ?'Your plan already reflects this, so nothing changed.'
      :`${d} We’ve updated your move-by-move plan${state.upgrades?' and turned on optional upgrades':''}.`}</p>
    <button class="btn btn-primary btn-sm" onclick="go('results')">View updated plan</button>
  </div>`;
  toast(alreadyDone?'Already applied':'Plan updated');
}
