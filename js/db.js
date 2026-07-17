import { supa, getUser } from './auth.js';
import { state } from './state.js';

/* Saved spaces: one row per organized area, media in the private
   space-media bucket under {user_id}/{space_id}/. */

function requireClient(){
  const c=supa(); const u=getUser();
  if(!c || !u) throw new Error('Sign in to save your spaces.');
  return { c, u };
}

function rowFromState(name){
  return {
    name: name || defaultSpaceName(),
    space_type: state.space,
    goal: state.goal,
    dims: state.dims,
    household: state.household,
    prefs: { prefs:[...(state.prefs||[])], budget:state.budget, effort:state.effort,
             toggles:Object.fromEntries(Object.keys(state).filter(k=>k.startsWith('detail_')).map(k=>[k.slice(7),state[k]])) },
    plan: state.ai,
    plan_meta: state.planMeta,
    shopping: state.shopping || null,
    progress: { stepsDone: state.stepDone || [] },
    arrangement: state.arrangement || null,
  };
}

export function defaultSpaceName(){
  const names={pantry:'Pantry',cabinet:'Kitchen cabinet',closet:'Closet',garage:'Garage shelf',attic:'Attic storage',laundry:'Laundry room',kids:'Kids’ storage',other:'My space'};
  return names[state.space]||'My space';
}

export async function saveSpace(name){
  const { c, u } = requireClient();
  const row = rowFromState(name);
  let spaceId = state.activeSpaceId;
  if(spaceId){
    const { error } = await c.from('spaces').update(row).eq('id', spaceId);
    if(error) throw new Error('Saving failed — please try again.');
  }else{
    const { data, error } = await c.from('spaces').insert({ ...row, user_id:u.id }).select('id').single();
    if(error) throw new Error('Saving failed — please try again.');
    spaceId = data.id;
    state.activeSpaceId = spaceId;
  }
  await uploadPendingMedia(spaceId);
  return spaceId;
}

async function uploadPendingMedia(spaceId){
  const { c, u } = requireClient();
  const uploads=[];
  (state.uploadedFiles||[]).forEach((file,i)=>uploads.push({ blobPromise:Promise.resolve(file), kind:'photo', sort:i, ext:'jpg', type:file.type||'image/jpeg' }));
  (state.frames||[]).forEach((fr,i)=>uploads.push({
    blobPromise:fetch('data:image/jpeg;base64,'+fr.data).then(r=>r.blob()),
    kind:'frame', sort:i, ext:'jpg', type:'image/jpeg',
  }));
  if(!uploads.length) return;
  // skip if this space already has media rows (re-saves shouldn't duplicate)
  const { count } = await c.from('space_media').select('id',{count:'exact',head:true}).eq('space_id',spaceId);
  if(count) return;
  for(const up of uploads){
    const blob = await up.blobPromise;
    const path = `${u.id}/${spaceId}/${crypto.randomUUID()}.${up.ext}`;
    const { error } = await c.storage.from('space-media').upload(path, blob, { contentType:up.type });
    if(error) continue; // a failed thumbnail shouldn't sink the save
    await c.from('space_media').insert({ space_id:spaceId, user_id:u.id, kind:up.kind, storage_path:path, sort:up.sort });
  }
}

export async function listSpaces(){
  const { c } = requireClient();
  const { data, error } = await c.from('spaces')
    .select('id,name,space_type,plan_meta,progress,updated_at')
    .order('updated_at',{ascending:false});
  if(error) throw new Error('Could not load your spaces.');
  return data||[];
}

export async function coverUrl(spaceId){
  const { c } = requireClient();
  const { data } = await c.from('space_media')
    .select('storage_path').eq('space_id',spaceId).order('sort').limit(1);
  if(!data || !data.length) return null;
  const { data:signed } = await c.storage.from('space-media').createSignedUrl(data[0].storage_path, 3600);
  return signed ? signed.signedUrl : null;
}

export async function fetchSpace(id){
  const { c } = requireClient();
  const { data, error } = await c.from('spaces').select('*').eq('id',id).single();
  if(error || !data) throw new Error('Could not open that space.');
  const beforePhotoUrl = await coverUrl(data.id).catch(()=>null);
  let afterRenderUrl = null;
  if(data.after_render_path){
    const { data:signed } = await c.storage.from('space-media').createSignedUrl(data.after_render_path, 3600);
    afterRenderUrl = signed ? signed.signedUrl : null;
  }
  return { data, beforePhotoUrl, afterRenderUrl };
}

export function applyLoadedSpace({ data, beforePhotoUrl, afterRenderUrl }){
  state.activeSpaceId = data.id;
  state.space = data.space_type;
  state.goal = data.goal;
  state.dims = data.dims;
  if(data.household) state.household = data.household;
  if(data.prefs){
    state.prefs = new Set(data.prefs.prefs||[]);
    state.budget = data.prefs.budget||null;
    state.effort = data.prefs.effort||null;
    Object.entries(data.prefs.toggles||{}).forEach(([k,v])=>{ state['detail_'+k]=v; });
  }
  state.ai = data.plan;
  state.planMeta = data.plan_meta;
  state.shopping = data.shopping;
  state.stepDone = (data.progress && data.progress.stepsDone) || [];
  state.arrangement = data.arrangement;
  state.upgrades = !!(data.shopping && data.shopping.length);
  state.beforePhotoUrl = beforePhotoUrl;
  state.afterRenderUrl = afterRenderUrl;
  return data;
}

export async function loadSpace(id){
  return applyLoadedSpace(await fetchSpace(id));
}

// Debounced incremental writes for progress / shopping / arrangement
let patchTimer=null, pendingPatch={};
export function updateSpacePatch(patch){
  const c=supa(); const u=getUser();
  if(!c || !u || !state.activeSpaceId) return;   // guests persist via localStorage instead
  Object.assign(pendingPatch, patch);
  clearTimeout(patchTimer);
  patchTimer=setTimeout(async ()=>{
    const body=pendingPatch; pendingPatch={};
    await c.from('spaces').update(body).eq('id', state.activeSpaceId);
  }, 800);
}

export async function deleteSpace(id){
  const { c } = requireClient();
  await c.from('spaces').delete().eq('id', id);
}

export async function submitFeedbackRow(row){
  const c=supa();
  if(!c) return false;
  const u=getUser();
  const { error } = await c.from('feedback').insert({ ...row, user_id: u?u.id:null });
  return !error;
}

// Founding Circle: store the request where the owner can see it.
// A duplicate email means "already on the list", which is success for the user.
export async function submitInviteRequest(email){
  const c=supa();
  if(!c) return false;
  const u=getUser();
  const { error } = await c.from('invite_requests').insert({ email, user_id: u?u.id:null });
  return !error || error.code==='23505';
}
