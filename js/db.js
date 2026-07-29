import { supa, getUser } from './auth.js';
import { submitForm } from './api.js';
import { state } from './state.js';
import { toast } from './ui.js';
import { areaFor } from './wizard-data.js';

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
    // setup/setupLabel ride in the prefs blob because the spaces table has no
    // column for them. Without them a reopened space lost its setup type, and
    // resolveLayout() keys the 3D archetype off exactly that — so a saved
    // walk-in came back rendered as whatever setup happened to be in memory.
    // The guest draft has always kept these (js/state.js); this closes the gap
    // for signed-in spaces.
    prefs: { prefs:[...(state.prefs||[])], budget:state.budget, effort:state.effort,
             setup:state.setup, setupLabel:state.setupLabel, setupTouched:!!state.setupTouched,
             toggles:Object.fromEntries(Object.keys(state).filter(k=>k.startsWith('detail_')).map(k=>[k.slice(7),state[k]])) },
    plan: state.ai,
    plan_meta: state.planMeta,
    shopping: state.shopping || null,
    progress: { stepsDone: state.stepDone || [] },
    arrangement: state.arrangement || null,
  };
}

/* The report masthead already names this space in the user's own terms, so a
   saved space carries the same name. The area label is the fallback for a
   plan that never named itself — hardcoding a list here went stale the moment
   the wizard grew from 8 spaces to a room → area tree. */
export function defaultSpaceName(){
  // spaceType can come from the model, where nothing bounds its length; a
  // dashboard card is not the place to find that out.
  const planName=String((state.ai && state.ai.spaceType) || '').trim().slice(0,60);
  if(planName && planName!=='Space') return planName;
  return state.space ? areaFor(state.space).label : 'My space';
}

export async function saveSpace(name, { media=true }={}){
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
  if(media) await uploadPendingMedia(spaceId);
  return spaceId;
}

/* A signed-out visitor's plan survives a reload in localStorage; a signed-in
   one used to survive nothing at all unless they found the Save button two
   screens past the plan, because updateSpacePatch needs an activeSpaceId
   before it will write anything. So the row is created the moment the plan
   is, which also turns on incremental writes for progress, shopping, and the
   3D arrangement. Photos are deliberately NOT uploaded here: the privacy page
   ties photo storage to an explicit save or share, and that stays true.
   Failure is silent — a plan on screen must never depend on the network. */
export async function autoSaveSpace(){
  if(!supa() || !getUser()) return null;
  if(state.shareView || !state.ai) return null;
  const isNew = !state.activeSpaceId;
  try{
    const id = await saveSpace(defaultSpaceName(), { media:false });
    // Say it once, when the space starts existing. Re-planning an open space
    // updates it quietly.
    if(isNew) toast('Saved to “My spaces”.');
    return id;
  }catch(_){
    return null;
  }
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
  // Resume interrupted cross-service cleanup, and never show a tombstone as
  // a usable saved space while it is being recovered.
  await resumeDeletionTombstones(c);
  const { data, error } = await c.from('spaces')
    .select('id,name,space_type,plan_meta,progress,updated_at')
    .is('deleting_at',null)
    .order('updated_at',{ascending:false});
  if(error) throw new Error('Could not load your spaces.');
  return data||[];
}

export async function resumeDeletionTombstones(c, now=new Date()){
  const cutoff=new Date(now.getTime()-5*60*1000).toISOString();
  const { data, error } = await c.from('spaces').select('id')
    .not('deleting_at','is',null).lt('deleting_at',cutoff);
  if(error) return;
  for(const row of data||[]){
    try{ await deleteSpaceData(c, row.id); }
    catch{ /* Leave the tombstone hidden; a later dashboard load retries it. */ }
  }
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
  const { data, error } = await c.from('spaces')
    .select('*').eq('id',id).is('deleting_at',null).single();
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
    if(data.prefs.setup){
      state.setup = data.prefs.setup;
      state.setupLabel = data.prefs.setupLabel || state.setupLabel;
      state.setupTouched = !!data.prefs.setupTouched;
    }
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
let patchTimer=null, pendingPatch={}, patchTargetId=null;
export function updateSpacePatch(patch){
  const c=supa(); const u=getUser();
  if(!c || !u || !state.activeSpaceId) return;   // guests persist via localStorage instead
  const targetId=state.activeSpaceId;
  if(patchTargetId && patchTargetId!==targetId){ flushPatch(); }
  patchTargetId=targetId;
  Object.assign(pendingPatch, patch);
  clearTimeout(patchTimer);
  patchTimer=setTimeout(flushPatch, 800);
}
async function flushPatch(){
  clearTimeout(patchTimer);
  const c=supa();
  const body=pendingPatch; const id=patchTargetId;
  pendingPatch={}; patchTargetId=null;
  if(!c || !id || !Object.keys(body).length) return;
  await c.from('spaces').update(body).eq('id', id);
}

export async function deleteSpaceData(c, id){
  const { error:markError } = await c.from('spaces')
    .update({ deleting_at:new Date().toISOString(), deletion_files_removed:false }).eq('id', id);
  if(markError) throw new Error('Could not start deleting this space — please try again.');

  try{
    const { data:space, error:spaceError } = await c.from('spaces')
      .select('after_render_path').eq('id', id).maybeSingle();
    if(spaceError) throw new Error('Could not inspect this space’s saved render.');

    const { data:media, error:mediaError } = await c.from('space_media')
      .select('storage_path').eq('space_id', id);
    if(mediaError) throw new Error('Could not inspect this space’s uploaded files.');

    const paths=[...new Set([
      ...(media||[]).map(row=>row.storage_path),
      space&&space.after_render_path,
    ].filter(Boolean))];
    if(paths.length){
      const { error:storageError } = await c.storage.from('space-media').remove(paths);
      if(storageError) throw new Error('Could not delete uploaded files — please try again.');
    }
  }catch(error){
    // Storage is still intact, so make the space visible and usable again.
    await c.from('spaces').update({ deleting_at:null, deletion_files_removed:false }).eq('id', id);
    throw error;
  }

  await c.from('spaces')
    .update({ deletion_files_removed:true }).eq('id', id);
  const { error:deleteError } = await c.from('spaces').delete().eq('id', id);
  if(deleteError){
    throw new Error('Your files were deleted. We’ll finish removing this space automatically.');
  }
}

export async function deleteSpace(id){
  const { c } = requireClient();
  await deleteSpaceData(c, id);
}

/* ---------- Read-only share links ----------
   Enabling generates an unguessable share_id; anyone with the link can view
   the sanitized plan via the get-shared-space edge function. Disabling nulls
   the id, which revokes every copy of the link instantly. */
export async function setShareEnabled(on){
  const { c } = requireClient();
  if(!state.activeSpaceId) throw new Error('Save this space first, then share it.');
  const shareId = on ? crypto.randomUUID() : null;
  const { error } = await c.from('spaces').update({ share_id: shareId }).eq('id', state.activeSpaceId);
  if(error) throw new Error('Sharing failed — please try again.');
  return shareId;
}

export function shareUrlFor(shareId){
  return `${location.origin}${location.pathname}?share=${shareId}`;
}

/* Both of these used to insert straight into their table through PostgREST.
   That path had no rate limit — the limiter lives in the edge functions, not
   in RLS — so anyone with the public anon key could fill either table, and
   user_id was whatever the browser put in the body. They now go through
   submit-form, which applies the same ceilings as every other function and
   takes user_id from the verified caller. */
export async function submitFeedbackRow(row){
  if(!supa()) return false;
  try{ await submitForm({ kind:'feedback', ...row }); return true; }
  catch(_){ return false; }
}

// Founding Circle: store the request where the owner can see it. An address
// already on the list is success for the person asking, and the function
// answers it identically to a fresh signup so the response cannot be used to
// test whether an address is registered.
export async function submitInviteRequest(email){
  if(!supa()) return false;
  try{ await submitForm({ kind:'invite', email }); return true; }
  catch(_){ return false; }
}
