export const state = {
  // Three-step space selection (design contract): room → area → setup type.
  // The wizard preselects the design defaults so Continue is always valid.
  room:'kitchen',
  space:'pantry', goal:null, capture:null,
  setup:'cabinet', setupLabel:'Cabinet',
  goals:[],        // per-space goal texts ("What bugs you most?")
  styles:[],       // per-space organizing styles ("How do you like things kept?")
  shoppingPref:'Use what I have',   // 'Use what I have' | 'Open to a few ideas'
  detected:[],     // item labels surfaced on the photos step
  catsTouched:false, // user edited the contents step → their list is authoritative
  prefs:new Set(), budget:null, effort:'Weekend reset',
  upgrades:false,
  cats:[], features:[],
  afterMode:'Use existing containers',
  uploadedFiles:[], uploadedVideo:null, frames:[],
  dims:null,   // {w_in,h_in,d_in,shelves} from the measurements step (stored in inches)
  // Counts come from the "Who uses this space?" steppers; kids.present /
  // pets.present stay the canonical 'yes'/'no' strings derived from them
  // (never truthiness-check present — see docs/HANDOFF.md).
  household:{ adults:2, kidCount:1, petCount:0,
    kids:{present:'yes', ages:['Toddler']}, pets:{present:'no', types:[]}, mobility:[], notes:'' },
  ai:null, planMeta:null,
  activeSpaceId:null,   // set when a saved space is open (signed-in)
  shopping:null,        // chosen purchase items
  arrangement:null,     // 3D arrangement state
  shareView:false,      // viewing someone else's plan via a read-only share link
};

// Demo plans must never inherit a real user's media or saved-plan state.
// Keeping this reset DOM-free makes the transition deterministic and testable.
export function prepareDemoPlanState(target=state){
  target.room='kitchen';
  target.space='pantry';
  target.goal='find';
  target.capture='demo';
  target.setup='cabinet';
  target.setupLabel='Cabinet';
  target.goals=[];
  target.styles=[];
  target.shoppingPref='Use what I have';
  target.detected=[];
  target.catsTouched=false;
  target.upgrades=true;
  target.prefs=new Set();
  target.budget=null;
  target.effort=null;
  target.cats=[];
  target.features=[];
  target.afterMode='Use existing containers';
  target.uploadedFiles=[];
  target.uploadedVideo=null;
  target.frames=[];
  target.dims=null;
  target.household={ adults:2, kidCount:0, petCount:0, kids:{present:null, ages:[]}, pets:{present:null, types:[]}, mobility:[], notes:'' };
  target.ai=null;
  target.aiError=null;
  target.planMeta=null;
  target.activeSpaceId=null;
  target.shopping=null;
  target.arrangement=null;
  target.stepDone=[];
  target.upgradeChecked=null;
  target.beforePhotoUrl=null;
  target.afterRenderB64=null;
  target.afterRenderUrl=null;
  target.shareView=false;
  delete target.sharedName;
  delete target._beforeUrl;
  Object.keys(target).filter(k=>k.startsWith('detail_')).forEach(k=>{ delete target[k]; });
  return target;
}

export function householdAnswered(){
  const h=state.household;
  return h.kids.present!==null || h.pets.present!==null || h.mobility.length>0 || !!(h.notes||'').trim();
}

/* ---------- Guest persistence ----------
   Signed-out visitors keep their last plan in localStorage so a reload
   doesn't lose it. Media can't survive a reload (File objects), so only
   serializable state is stored. */
const DRAFT_KEY='tidymap_draft_v2';

export function persistGuestDraft(){
  try{
    // Never overwrite a visitor's own draft while they're just looking at
    // someone else's shared plan — the share view is read-only everywhere.
    if(state.shareView) return;
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
      room:state.room, setup:state.setup, setupLabel:state.setupLabel,
      goals:state.goals, styles:state.styles, shoppingPref:state.shoppingPref,
      catsTouched:state.catsTouched,
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
    if(d.room) state.room=d.room;
    if(d.setup){ state.setup=d.setup; state.setupLabel=d.setupLabel||state.setupLabel; }
    state.goals=d.goals||[]; state.styles=d.styles||[];
    if(d.shoppingPref) state.shoppingPref=d.shoppingPref;
    state.catsTouched=!!d.catsTouched;
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

/* ---------- Anonymous photo promise ----------
   The landing page promises that without an account, photos aren't kept
   after the analysis. Server-side that's already true (analyze-space stores
   nothing, and the guest draft above never serializes media). This drops the
   in-memory copies too, once the plan is finished, so a shared or long-lived
   browser tab isn't quietly holding someone's home photos. */
export function clearGuestMedia(target=state){
  target.uploadedFiles=[];
  target.uploadedVideo=null;
  target.frames=[];
  target.afterRenderB64=null;
  if(target._beforeUrl){ try{ URL.revokeObjectURL(target._beforeUrl); }catch(_){} }
  delete target._beforeUrl;
  target.beforePhotoUrl=null;
}

/* Apply a sanitized shared-space payload (see get-shared-space) for
   read-only viewing. Wipes any in-progress local state first so the shared
   plan can't mix with the visitor's own answers — and shareView blocks the
   draft writer above, so their own saved draft survives untouched. */
export function applySharedSpace(payload){
  prepareDemoPlanState(state);           // deterministic, media-free reset
  state.shareView=true;
  state.space=null; state.goal=payload.goal||null; state.capture=null;
  state.upgrades=false;                  // sanitized plans carry no product needs
  state.dims=payload.dims||null;
  state.sharedName=payload.name||'A TidyMap plan';
  return payload;
}
