export const state = {
  space:null, goal:null, capture:null,
  prefs:new Set(), budget:null, effort:null,
  upgrades:false,
  cats:[], features:[],
  afterMode:'Use existing containers',
  uploadedFiles:[], uploadedVideo:null, frames:[],
  dims:null,   // {w_in,h_in,d_in,shelves} parsed from the details step
  household:{ kids:{present:null, ages:[]}, pets:{present:null, types:[]}, mobility:[], notes:'' },
  ai:null, planMeta:null
};

export function householdAnswered(){
  const h=state.household;
  return h.kids.present!==null || h.pets.present!==null || h.mobility.length>0 || !!h.notes.trim();
}
