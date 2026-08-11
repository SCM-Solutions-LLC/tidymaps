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

/* A "quick version" is five moves. Kept as a constant so the checklist, the
   Time KPI and the copy that promises it can never drift apart. */
const SHORT_PLAN_STEPS = 5;
// A step's own upper estimate, so "quickest" means quickest at worst.
function stepMinutes(s){
  const m=String((s&&(s.m||s.time))||'').match(/(\d+)(?:\s*[–-]\s*(\d+))?/);
  return m ? Number(m[2]||m[1]) : 0;
}
function shortPlanTime(steps){
  // sum the per-step minute ranges the checklist itself shows
  let lo=0, hi=0;
  for(const s of steps){
    const m=String(s.m||s.time||'').match(/(\d+)(?:\s*[–-]\s*(\d+))?/);
    if(!m) continue;
    lo+=Number(m[1]); hi+=Number(m[2]||m[1]);
  }
  if(!lo) return state.ai.time;
  return lo===hi ? `${lo} min` : `${lo}–${hi} min`;
}

/* The report's "Use $0 plan instead" button only hid the panel, so the Cost KPI
   above it went on quoting a range for products the plan no longer recommended.
   It now does exactly what the Adjust screen's "Remove storage product
   recommendations" does. */
export function useZeroPlan(){
  dropProductNeeds();
  setUpgrades(false);
  buildResults();
  setUpgrades(false);          // buildResults re-reads state.upgrades
  if(getSession()) updateSpacePatch({ plan: state.ai, shopping: state.shopping });
  else persistGuestDraft();
  toast('Switched to the $0 plan');
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
  /* "Already on" is not a revision. Turning the upgrade plan on when it is
     already on rebuilt an identical report under the banner "Plan revised:
     Add storage product recommendations" — the screen has an "Already applied"
     state for exactly this and this path never reached it. */
  let shoppingChanged=false, shoppingNoop=false;
  if(id==='addprod'){
    if(state.upgrades && (state.ai&&(state.ai.productNeeds||[]).length)) shoppingNoop=true;
    else { restoreProductNeeds(); setUpgrades(true); shoppingChanged=true; }
  }
  if(id==='rmprod'||id==='own'||id==='budget'){
    if(id==='rmprod' && !state.upgrades) shoppingNoop=true;
    else { dropProductNeeds(); setUpgrades(false); shoppingChanged=true; }
  }
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
  let revised=false, alreadyDone=shoppingNoop;
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
    /* These two used to only re-render the checklist: state.ai was never
       touched, nothing was saved, and the very next adjustment called
       buildResults() and silently brought all the steps back. The Time KPI and
       the effort chip went on quoting the full plan the whole time, directly
       under a banner promising a 30-minute version. Commit the change instead. */
    if(state.ai && baseSteps.length>SHORT_PLAN_STEPS){
      /* "Reduce the number of steps" keeps the first five, which are ordered by
         effect. "Make it faster" keeps the five quickest, in their original
         order — otherwise the two buttons do the same thing and only one of
         them says so. */
      state.ai.steps = id==='faster'
        ? baseSteps.map((s,i)=>({s,i}))
            .sort((a,b)=>stepMinutes(a.s)-stepMinutes(b.s)||a.i-b.i)
            .slice(0,SHORT_PLAN_STEPS)
            .sort((a,b)=>a.i-b.i).map(x=>x.s)
        : baseSteps.slice(0,SHORT_PLAN_STEPS);
      state.ai.time=shortPlanTime(state.ai.steps);
      state.ai.revisions=[...(state.ai.revisions||[]), id];
      buildResults();
      if(getSession()) updateSpacePatch({ plan: state.ai });
      else persistGuestDraft();
    }else{
      // already short — say so rather than claiming a revision
      alreadyDone=true;
    }
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
