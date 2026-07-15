export const state = {
  space:null, goal:null, capture:null,
  prefs:new Set(), budget:null, effort:null,
  upgrades:false,
  cats:[], features:[],
  afterMode:'Use existing containers',
  uploadedFiles:[], uploadedVideo:null, frames:[],
  dims:null,   // {w_in,h_in,d_in,shelves} parsed from the details step
  household:{ kids:{present:null, ages:[]}, pets:{present:null, types:[]}, mobility:[], notes:'' },
  ai:null, planMeta:null,
  activeSpaceId:null,   // set when a saved space is open (signed-in)
  shopping:null,        // chosen purchase items
  arrangement:null,     // 3D arrangement state
};

export function householdAnswered(){
  const h=state.household;
  return h.kids.present!==null || h.pets.present!==null || h.mobility.length>0 || !!h.notes.trim();
}

/* ---------- Guest persistence ----------
   Signed-out visitors keep their last plan in localStorage so a reload
   doesn't lose it. Media can't survive a reload (File objects), so only
   serializable state is stored. */
const DRAFT_KEY='tidymap_draft_v2';

export function persistGuestDraft(){
  try{
    // nothing worth keeping -> drop any stale draft instead of writing an empty one
    if(!state.space && !state.ai && !(state.stepDone||[]).length){
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    const toggles={};
    Object.keys(state).forEach(k=>{ if(k.startsWith('detail_')) toggles[k]=state[k]; });
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      v:2, savedAt:Date.now(),
      planReady: !!state.ai || !!(state.stepDone && state.stepDone.length),
      space:state.space, goal:state.goal, capture:state.capture,
      prefs:[...state.prefs], budget:state.budget, effort:state.effort,
      upgrades:state.upgrades, cats:state.cats, afterMode:state.afterMode,
      dims:state.dims, household:state.household, toggles,
      ai:state.ai, planMeta:state.planMeta,
      stepDone:state.stepDone||[], upgradeChecked:state.upgradeChecked||null,
      shopping:state.shopping, arrangement:state.arrangement,
    }));
  }catch(_){ /* storage full/blocked — losing the draft is acceptable */ }
}

export function restoreGuestDraft(){
  try{
    const raw=localStorage.getItem(DRAFT_KEY);
    if(!raw) return false;
    const d=JSON.parse(raw);
    if(!d || d.v!==2) return false;
    state.space=d.space; state.goal=d.goal; state.capture=d.capture;
    state.prefs=new Set(d.prefs||[]); state.budget=d.budget; state.effort=d.effort;
    state.upgrades=!!d.upgrades; state.cats=d.cats||[]; state.afterMode=d.afterMode||state.afterMode;
    state.dims=d.dims||null;
    if(d.household) state.household=d.household;
    Object.entries(d.toggles||{}).forEach(([k,v])=>{ state[k]=v; });
    state.ai=d.ai||null; state.planMeta=d.planMeta||null;
    state.stepDone=d.stepDone||[]; state.upgradeChecked=d.upgradeChecked||null;
    state.shopping=d.shopping||null; state.arrangement=d.arrangement||null;
    return { restored:true, planReady: !!d.planReady };
  }catch(_){ return false; }
}

export function clearGuestDraft(){
  try{ localStorage.removeItem(DRAFT_KEY); }catch(_){}
}
