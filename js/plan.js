import { state } from './state.js';
import { iconFor } from './icons.js';

/* ============================================================
   Plan contract: raw model JSON -> the exact shapes the UI renders.
   The edge function returns the model's JSON untouched; all
   validation and defaulting happens here.
   ============================================================ */

// Convert raw AI JSON into the exact shapes the UI render code expects
export function normalizeAi(j){
  const s = v => (v==null?'':String(v));
  return {
    spaceType: s(j.spaceType)||'Space',
    summary: s(j.summary),
    cats: (j.categories||[]).map(s).filter(Boolean),
    features: (j.features||[]).map(f=>({ico:iconFor(f.icon), ttl:s(f.title), sub:s(f.sub)})),
    problems: (j.problems||[]).map(s).filter(Boolean),
    opportunities: (j.opportunities||[]).map(s).filter(Boolean),
    map: (j.map||[]).map(m=>({lv:s(m.level), ic:iconFor(m.icon), zone:s(m.zone), why:s(m.why), eye:!!m.eye})),
    existingLede: s(j.existingLede),
    existing: (j.existing||[]).map(e=>({ico:iconFor(e.icon), ft:s(e.title), fd:s(e.detail)})),
    dontBuy: s(j.dontBuy),
    steps: (j.steps||[]).map(st=>({t:s(st.task), m:s(st.time)||'—', w:s(st.why)})),
    time: s(j.time)||'45–90 min',
    cost: s(j.cost)||'$0 / $45–85'
  };
}

// Assemble the context object the analyze-space edge function expects
export function buildAnalysisContext(){
  const toggles={};
  Object.keys(state).forEach(k=>{ if(k.startsWith('detail_')) toggles[k.slice(7)]=state[k]; });
  return {
    spaceType: state.space || 'pantry',
    goal: state.goal || null,
    prefs: [...(state.prefs||[])],
    budget: state.budget || null,
    effort: state.effort || null,
    toggles,
    dims: null,       // structured dimensions arrive with the household step
    household: null,  // household details arrive with the household step
  };
}
