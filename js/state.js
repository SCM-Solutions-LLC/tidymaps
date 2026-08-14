export const state = {
  // Three-step space selection (design contract): room → area → setup type.
  // The wizard preselects the design defaults so Continue is always valid.
  room:'kitchen',
  space:'pantry', goal:null, capture:null,
  setup:'cabinet', setupLabel:'Cabinet',
  // true once the user actually picks a setup card; setArea() only preselects
  // one, and a preselection must not outrank what the photos show
  setupTouched:false,
  // set when a Review "Edit" link sends you back to a step, so Continue can
  // return you to Review instead of walking the rest of the wizard again
  returnToReview:false,
  goals:[],        // per-space goal texts ("What bugs you most?")
  styles:[],       // per-space organizing styles ("How do you like things kept?")
  shoppingPref:'Use what I have',   // 'Use what I have' | 'Open to a few ideas'
  /* Two steps ship an answer already filled in: effort defaults to a weekend
     reset and products to "Use what I have". Both are reasonable defaults and
     both were indistinguishable from something the user chose — the card
     arrived pre-ticked and Review listed it under "Here's what we heard".
     The products one is the consequential half: it is the answer that empties
     productNeeds and pins the budget to $0, so a plan could end up with no
     recommendations on the strength of an answer nobody gave.
     Same shape as setupTouched/catsTouched: keep the default, remember that
     it is ours. */
  effortTouched:false, shoppingTouched:false,
  detected:[],     // item labels surfaced on the photos step
  catsTouched:false, // user edited the contents step → their list is authoritative
  prefs:new Set(), budget:null, effort:'Weekend reset',
  /* Reader preference, not plan data — see getUnits() below. Seeded from
     localStorage at startup so it is right on the first render rather than
     after a toggle. */
  units:'imperial',
  upgrades:false,
  cats:[], features:[],
  afterMode:'Use existing containers',
  uploadedFiles:[], uploadedVideo:null, frames:[],
  dims:null,   // {w_in,h_in,d_in,shelves} from the measurements step (stored in inches)
  // Counts come from the "Who uses this space?" steppers; kids.present /
  // pets.present stay the canonical 'yes'/'no' strings derived from them
  // (never truthiness-check present — see docs/HANDOFF.md).
  household:{ adults:2, kidCount:0, petCount:0,
    kids:{present:'no', ages:[]}, pets:{present:'no', types:[]}, mobility:[], notes:'' },
  ai:null, planMeta:null,
  activeSpaceId:null,   // set when a saved space is open (signed-in)
  shopping:null,        // chosen purchase items
  arrangement:null,     // 3D arrangement state
  shareView:false,      // viewing someone else's plan via a read-only share link
  // Feedback answers, shared by the inline ask on the report and the dedicated
  // feedback screen. fbRated gates the telemetry event (fire once per plan),
  // fbSent gates the database row (one submission per plan).
  fbUseful:null, fbVs:null, fbNext:null, fbRated:false, fbSent:false,
};

/* Everything that belongs to ONE plan of ONE space: the analysis, the saved
   row it writes to, the 3D arrangement, the shopping list, the progress ticks,
   and the rendered before/after images.

   This has to be cleared whenever the user starts on a different space, and
   the reason is not cosmetic. `activeSpaceId` is what saveSpace() branches on
   (js/db.js): still set from the previous space, it turns the save of the new
   plan into an UPDATE of the old space's row, overwriting every column — the
   first space is silently destroyed with no prompt and no toast. `arrangement`
   and `shareView` cause quieter versions of the same bleed: the old space's
   dimensions and item placements get imposed on the new plan's 3D view, and a
   visitor who arrived on a share link stays flagged read-only, so the plan
   they then build for themselves is refused by both the signed-in saver and
   the guest-draft writer and is lost on reload.

   restart(), prepareDemoPlanState(), and setArea() all need exactly this set,
   so it lives in one place — three hand-maintained copies is how the gap
   opened in the first place. */
export function resetPlanRecord(target=state){
  target.ai=null;
  target.aiError=null;
  target.planMeta=null;
  target.activeSpaceId=null;
  target.shopping=null;
  target.arrangement=null;
  target.stepDone=[];
  target.upgradeChecked=null;
  target.shareView=false;
  target.afterRenderB64=null;
  target.afterRenderUrl=null;
  target.beforePhotoUrl=null;
  // Feedback is about a specific plan, so a new plan gets a fresh ask rather
  // than showing the previous space's rating back to the user.
  target.fbUseful=null;
  target.fbVs=null;
  target.fbNext=null;
  target.fbRated=false;
  target.fbSent=false;
  delete target.sharedName;
  delete target._beforeUrl;
  return target;
}

// Demo plans must never inherit a real user's media or saved-plan state.
// Keeping this reset DOM-free makes the transition deterministic and testable.
export function prepareDemoPlanState(target=state){
  target.room='kitchen';
  target.space='pantry';
  target.goal='find';
  target.capture='demo';
  target.setup='cabinet';
  target.setupLabel='Cabinet';
  target.setupTouched=false;
  target.goals=[];
  target.styles=[];
  target.shoppingPref='Use what I have';
  target.effortTouched=false;
  target.shoppingTouched=false;
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
  resetPlanRecord(target);
  Object.keys(target).filter(k=>k.startsWith('detail_')).forEach(k=>{ delete target[k]; });
  return target;
}

export function householdAnswered(){
  const h=state.household;
  return h.kids.present!==null || h.pets.present!==null || h.mobility.length>0 || !!(h.notes||'').trim();
}

/* ---------- Units ----------
   The app measures in feet and inches everywhere and offers no way out, which
   makes it unusable for most of the world — a metric reader has to convert
   their own tape measure before they can answer the first question.

   This is deliberately NOT part of the plan or the guest draft. A plan
   describes a space; units describe the person reading it. Storing the choice
   on the plan would mean a shared link renders in the author's units on the
   recipient's screen, which is the same bug the other way round. It lives in
   its own key so it survives clearing a draft, and so a shared plan is read in
   the units of whoever opened it. */
const UNITS_KEY = 'tidymap_units';
export const UNITS = ['imperial', 'metric'];

export function getUnits(){
  /* Same guard as the draft reader below: localStorage THROWS rather than
     returning null when site data is blocked, and units are not worth failing
     a page load over. */
  try{
    const v = localStorage.getItem(UNITS_KEY);
    return UNITS.includes(v) ? v : 'imperial';
  }catch{ return 'imperial'; }
}

export function setUnits(u){
  if(!UNITS.includes(u)) return;
  state.units = u;
  try{ localStorage.setItem(UNITS_KEY, u); }catch{ /* private mode: session-only */ }
}

export function isMetric(){ return state.units === 'metric'; }

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
      setupTouched:!!state.setupTouched,
      goals:state.goals, styles:state.styles, shoppingPref:state.shoppingPref,
      catsTouched:state.catsTouched,
      effortTouched:!!state.effortTouched, shoppingTouched:!!state.shoppingTouched,
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
    state.setupTouched=!!d.setupTouched;
    state.goals=d.goals||[]; state.styles=d.styles||[];
    if(d.shoppingPref) state.shoppingPref=d.shoppingPref;
    state.catsTouched=!!d.catsTouched;
    state.effortTouched=!!d.effortTouched;
    state.shoppingTouched=!!d.shoppingTouched;
    state.prefs=new Set(d.prefs||[]); state.budget=d.budget; state.effort=d.effort;
    state.upgrades=!!d.upgrades; state.cats=d.cats||[]; state.afterMode=d.afterMode||state.afterMode;
    state.dims=d.dims||null;
    // The measure screen renders from dimsFt, not dims. Restoring dims alone
    // left dimsFt at buildAll()'s pantry-cabinet defaults, so after a reload
    // the Review row showed 3′ against a 12′ plan — and focusing any measure
    // field wrote the stale default back over the real measurement on blur.
    state.dimsFt=d.dims?{w:d.dims.w_in/12, h:d.dims.h_in/12, d:d.dims.d_in/12}:null;
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
  /* The setup goes with it. prepareDemoPlanState leaves the demo's own default
     behind — 'cabinet' / "Cabinet" — and the report prints that chip as the
     answer this plan was built from, so a garage shelving plan arrived at the
     visitor labelled "Cabinet · 3′ × 6′" and the 3D view announced "Shown as
     your cabinet". Nobody chose it. Cleared, the shared plan's own layout is
     what the viewer resolves from, which is the only setup information a
     sanitized payload actually carries. */
  state.setup=null; state.setupLabel=null; state.setupTouched=false;
  /* space stays null on purpose — it gates the wizard and must not read as the
     visitor's own answer. But the report still needs to know which kind of
     space this plan is for: areaFor(null) falls through to the first kitchen
     area, so every shared plan was illustrated with a pantry regardless of what
     it was actually about. Keep the type separately, for display only. */
  state.sharedSpaceId=payload.space_type||null;
  state.upgrades=false;                  // sanitized plans carry no product needs
  state.dims=payload.dims||null;
  state.sharedName=payload.name||'A TidyMap plan';
  /* A shared payload carries no household, and it never will — that is the
     first thing the allowlist strips. But prepareDemoPlanState leaves the
     wizard's default of two adults behind, and the report's masthead renders
     whatever household it finds: a visitor was shown "2 adults" on someone
     else's plan, which is not a leak of the owner's answer but is a plain
     statement of something nobody said. Blank means blank — the chip hides,
     and kid-only options stay filtered out because present is null, not 'no'. */
  state.household={ adults:0, kidCount:0, petCount:0,
    kids:{present:null, ages:[]}, pets:{present:null, types:[]}, mobility:[], notes:'' };
  return payload;
}
