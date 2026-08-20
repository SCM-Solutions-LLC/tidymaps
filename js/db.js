import { supa, getUser, getSession } from './auth.js';
import { submitForm, ApiError } from './api.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { state, wizardAnswers, applyWizardAnswers, resetPlanRecord,
         currentPlanInstance, planInstanceIsCurrent } from './state.js';
import { toast } from './ui.js';
import { areaFor, roomFor } from './wizard-data.js';
import { track } from './telemetry.js';

/* Saved spaces: one row per organized area, media in the private
   space-media bucket under {user_id}/{space_id}/. */

function requireClient(){
  const c=supa(); const u=getUser();
  if(!c || !u) throw new Error('Sign in to save your spaces.');
  return { c, u };
}

/* The `prefs` column: every wizard answer, in the one serialized form
   js/state.js defines.

   Its own function because two things write it now. A full save writes it as
   part of the row, and every incremental write carries it along — see
   updateSpacePatch, and the reason it has to.

   `answers` is canonical. The flat keys beside it are the shape rows were
   written in before it existed: still written so a client running the previous
   build can read a row this one saved, still read on the way back in so a row
   saved by that build loads here. Derived from `answers`, never typed out a
   second time. */
function answersBlob(){
  const answers = wizardAnswers(state);
  return { answers,
           prefs:answers.prefs, budget:answers.budget, effort:answers.effort,
           setup:answers.setup, setupLabel:answers.setupLabel, setupTouched:answers.setupTouched,
           shoppingPref:answers.shoppingPref,
           effortTouched:answers.effortTouched, shoppingTouched:answers.shoppingTouched,
           toggles:answers.toggles };
}

/* Exported so a test can drive the full round trip — rowFromState() out,
   applyLoadedSpace() back in. Two hand-maintained halves of one contract is
   how the shopping answer came to be written by neither. */
export function rowFromState(name){
  /* One serializer for both storage backends — see js/state.js. The signed-in
     row used to keep its own shorter list than the guest draft did, so goals,
     styles, categories, catsTouched, detected, room and afterMode were saved
     for signed-OUT visitors and dropped for signed-in ones. The whole answer
     set rides in the prefs blob because the spaces table has no column per
     answer; the named columns below stay as they are because queries and the
     dashboard select them. */
  return {
    name: name || defaultSpaceName(),
    space_type: state.space,
    goal: state.goal,
    dims: state.dims,
    household: state.household,
    prefs: answersBlob(),
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

/* Everything a save needs, read out of `state` in one synchronous pass before
   any of it is awaited: the row, which space it is for, which photos belong
   to it, and which plan asked. A save takes as long as an upload takes, and
   the user can start another plan inside that window — see the plan instance
   note in js/state.js. Reading any of this back out of `state` afterwards is
   how plan B ended up owning plan A's row and A's space ended up holding B's
   photos. */
export function snapshotSave(name, { media=true }={}){
  return {
    row: rowFromState(name),
    spaceId: state.activeSpaceId,
    uploads: media ? pendingMedia() : [],
    space: String(state.space||''),
    planInstance: currentPlanInstance(),
  };
}

/* Takes its client the way deleteSpaceData and uploadMissingMedia do, so a
   test can drive the ownership rules without a live project. */
export async function persistSpace(c, userId, snapshot, { auto=false }={}){
  let spaceId = snapshot.spaceId;
  if(spaceId){
    /* The returned row is checked, not just the error. An UPDATE that matches
       nothing is not an error — it is a success that wrote nothing — so a
       stale activeSpaceId (the space was deleted on another device, or RLS no
       longer admits it) reported "Saved" over a save that never happened.
       The id it matches on is the snapshot's, so what gets checked is that
       THIS plan's row was written, not that some row was. */
    const { data, error } = await c.from('spaces')
      .update(snapshot.row).eq('id', spaceId).select('id').maybeSingle();
    if(error || !data) throw new Error('Saving failed — please try again.');
  }else{
    const { data, error } = await c.from('spaces').insert({ ...snapshot.row, user_id:userId }).select('id').single();
    if(error) throw new Error('Saving failed — please try again.');
    spaceId = data.id;
    /* The id belongs to the plan that asked for the insert, not to whatever
       is on screen when it lands. Stamping it unconditionally handed the new
       plan the previous one's row: every later save of the new plan UPDATEd
       it, so the space the user had just saved was overwritten column by
       column with a different space's answers. The row itself is still
       written and still theirs — it is only the in-memory pointer that is
       withheld, because the plan it pointed at is gone. */
    if(planInstanceIsCurrent(snapshot.planInstance)) state.activeSpaceId = spaceId;
    // Only the insert is reported. An update is a re-save of a space that has
    // already been counted, and counting it again would make one diligent user
    // look like a growing funnel.
    track('space_saved', { auto:!!auto, space:snapshot.space });
  }
  // The snapshot's photos, never the ones in state now: media collected after
  // the request uploaded the next plan's photos into this plan's space.
  if(snapshot.uploads.length) await uploadMissingMedia(c, userId, spaceId, snapshot.uploads);
  return spaceId;
}

export async function saveSpace(name, { media=true, auto=false }={}){
  const { c, u } = requireClient();
  return persistSpace(c, u.id, snapshotSave(name, { media }), { auto });
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
  const instance = currentPlanInstance();
  try{
    const id = await saveSpace(defaultSpaceName(), { media:false, auto:true });
    // Say it once, when the space starts existing. Re-planning an open space
    // updates it quietly. And say it only about the plan the user is still on:
    // "Saved to My spaces" landing after they moved to another plan names the
    // wrong space, and points at a row this one does not own.
    if(isNew && planInstanceIsCurrent(instance)) toast('Saved to “My spaces”.');
    return id;
  }catch(_){
    return null;
  }
}

/* The photos and video frames held in memory right now, captured as a list
   rather than read live. Called from snapshotSave, before the save's first
   await. */
function pendingMedia(target=state){
  const uploads=[];
  (target.uploadedFiles||[]).forEach((file,i)=>uploads.push({ blobPromise:Promise.resolve(file), kind:'photo', sort:i, ext:'jpg', type:file.type||'image/jpeg' }));
  (target.frames||[]).forEach((fr,i)=>uploads.push({
    blobPromise:fetch('data:image/jpeg;base64,'+fr.data).then(r=>r.blob()),
    kind:'frame', sort:i, ext:'jpg', type:'image/jpeg',
  }));
  return uploads;
}

/* Takes its client the way deleteSpaceData does, so a test can drive the
   resume and compensation paths without a live project. */
export async function uploadMissingMedia(c, userId, spaceId, uploads){
  if(!uploads.length) return;
  /* Which items are already up, not merely whether ANY of them is.
     "Does this space have media rows?" answered yes as soon as the first photo
     of six landed, so a save that failed partway through skipped the other
     five on every later attempt — permanently, from the app's point of view,
     since the only retry window is the session that still holds the files.
     (kind, sort) is what identifies an item, so it is what gets compared. */
  const { data:existing, error:listError } = await c.from('space_media')
    .select('kind,sort').eq('space_id',spaceId);
  /* An unreadable list is NOT an empty one. This destructured only `count`, so
     a failed query read as "nothing here yet" and re-uploaded the whole batch,
     duplicating every object and row — the same missing check as the skip
     above, failing the opposite way. */
  if(listError) return;
  const already=new Set((existing||[]).map(r=>`${r.kind}:${r.sort}`));
  for(const up of uploads){
    if(already.has(`${up.kind}:${up.sort}`)) continue;
    const blob = await up.blobPromise;
    const path = `${userId}/${spaceId}/${crypto.randomUUID()}.${up.ext}`;
    const { error } = await c.storage.from('space-media').upload(path, blob, { contentType:up.type });
    if(error) continue; // a failed thumbnail shouldn't sink the save
    const { error:metadataError } = await c.from('space_media')
      .insert({ space_id:spaceId, user_id:userId, kind:up.kind, storage_path:path, sort:up.sort });
    /* The object and its row are one thing in two services, so a half-written
       pair is undone rather than left. An object with no row is invisible to
       deleteSpaceData — which builds its delete list FROM those rows — so it
       would outlive the space itself, against a privacy page that ties photo
       storage to an explicit save. render-after does the same compensation. */
    if(metadataError){
      await c.storage.from('space-media').remove([path]);
      continue;
    }
    already.add(`${up.kind}:${up.sort}`);
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

/* The space's own photo, for the dashboard card and for the "before" half of
   the photo comparison.

   It used to take the lowest-sorted row of space_media whatever its kind, and
   render-after writes its OUTPUT back into that same table as
   kind:'after_render'. autoSaveSpace saves with {media:false} on purpose, so a
   signed-in user who generated a preview without pressing Save had exactly one
   media row: the render. Reopening that space then loaded the AI image as the
   photo of their space today, and setupAfterPhoto put the identical file on
   both sides of the slider — a "before" that was not their before, the same
   defect as the drawn pane removed from the report.

   Kind is filtered here rather than sorted around, because 'photo' and 'frame'
   both start at sort 0 and would otherwise tie unpredictably. */
export async function coverUrl(spaceId){
  const { c } = requireClient();
  const { data } = await c.from('space_media')
    .select('storage_path').eq('space_id',spaceId)
    .in('kind',['photo','frame'])
    .order('kind').order('sort').limit(1);
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
  /* Reset BEFORE hydrating, both halves of the state. Without this, opening a
     second saved space kept whatever the first one left behind in any field
     the row did not carry — stale goals, styles, categories and detail_
     toggles reached buildAnalysisContext(), so the screen showed one plan
     while a re-analysis was built from another's answers. resetPlanRecord
     covers the same hole on the plan side: shareView in particular survived
     into an owned space and made it unsaveable. */
  /* Feedback is about a specific plan, and resetPlanRecord clears it so a
     different space asks fresh rather than showing the previous space's rating
     back. Reopening the space you are already on is not a different plan
     though, and fbSent is what holds "one submission per plan" — losing it
     there re-asks someone who already answered, and takes a second row. */
  const sameSpace = data.id && data.id===state.activeSpaceId;
  const feedback = sameSpace
    ? { fbUseful:state.fbUseful, fbVs:state.fbVs, fbNext:state.fbNext,
        fbRated:state.fbRated, fbSent:state.fbSent }
    : null;
  resetPlanRecord(state);
  if(feedback) Object.assign(state, feedback);
  const prefs = data.prefs || {};
  /* `prefs.answers` is canonical; a row written before it existed carries the
     same answers flattened across prefs and the named columns. `room` is the
     one answer no older row carries in any form, and it cannot be left to the
     default: the wizard's own heading reads "Where in the <room>?", so a
     reopened garage workbench asked the user where in the kitchen it was, over
     a list of kitchen areas that does not contain it. The area implies the
     room, so it is derived rather than guessed. */
  const legacy = {
    ...prefs,
    space: data.space_type, goal: data.goal,
    dims: data.dims, household: data.household,
  };
  // roomFor returns the room record; state.room holds its id.
  if(!prefs.answers && data.space_type) legacy.room = roomFor(data.space_type).id;
  applyWizardAnswers(prefs.answers || legacy, state);
  // The named columns are the source of truth for the answers they duplicate:
  // the dashboard and share payload read them, so a row edited elsewhere lands
  // here rather than in the blob.
  state.activeSpaceId = data.id;
  state.space = data.space_type;
  state.goal = data.goal;
  state.dims = data.dims;
  // Same contract as restoreGuestDraft: the measure screen renders from
  // dimsFt, so reopening a saved space must rehydrate it or "Edit answers"
  // shows the startup defaults against this plan's real measurements.
  state.dimsFt = data.dims && data.dims.w_in
    ? { w: data.dims.w_in/12, h: data.dims.h_in/12, d: data.dims.d_in/12 } : null;
  if(data.household) state.household = data.household;
  state.ai = data.plan;
  state.planMeta = data.plan_meta;
  state.shopping = data.shopping;
  state.stepDone = (data.progress && data.progress.stepsDone) || [];
  state.arrangement = data.arrangement;
  /* `upgrades` is an answer again, for rows new enough to have kept it fresh.

     It could not be trusted while only a full save wrote the prefs column: the
     report's products switch and the Adjust screen change it long after that
     save, so the stored value was stale and turning products on from Adjust
     then reopening the space hid the section with the cost tile reading $0.
     Re-deriving it from the shopping list was the honest reading of a row
     whose answers were older than its plan.

     updateSpacePatch carries the answers on every incremental write now, so a
     v2 row's answers are as current as its plan and the derivation would be
     the thing losing information — someone who turns the section on without
     ticking anything means it. Rows written before that keep the old reading,
     because for them it is still the true one. */
  const answers = prefs.answers;
  state.upgrades = (answers && answers.v >= 2)
    ? !!answers.upgrades
    : !!(data.shopping && data.shopping.length);
  state.beforePhotoUrl = beforePhotoUrl;
  state.afterRenderUrl = afterRenderUrl;
  return data;
}

/* Opening a saved plan, in the two halves every async writer here is now split
   into: fetch without touching state, then apply only if this is still the
   plan the user asked for.

   This replaces loadSpace(), which was fetch-and-apply in one call and so had
   nowhere to put the check. It is gone rather than kept beside this: an
   unguarded convenience wrapper is how the next caller reintroduces the race.

   The caller claims the switch with startPlanInstance() at the CLICK and
   passes the id it got. That ordering is the point. Guarding on "has anything
   changed since the response came back" would let the row that loads first
   win; two cards tapped in quick succession would leave the user on whichever
   plan the network happened to return sooner, and the second tap — the one
   they meant — could be the one thrown away. Claiming at the click means the
   last tap owns the screen and every earlier load lands on a stale id and
   stops. Returns null when it was superseded, so the caller renders nothing
   and navigates nowhere.

   The fetch is a parameter for the same reason deleteSpaceData takes its
   client: the rule worth testing is what happens to state when a switch lands
   mid-request, and that should be testable without a live project. */
export async function openSavedSpace(id, instance, fetch=fetchSpace){
  const fetched = await fetch(id);
  if(!planInstanceIsCurrent(instance)) return null;
  return applyLoadedSpace(fetched);
}

// Debounced incremental writes for progress / shopping / arrangement
let patchTimer=null, pendingPatch={}, patchTargetId=null;
export function updateSpacePatch(patch){
  const c=supa(); const u=getUser();
  if(!c || !u || !state.activeSpaceId) return;   // guests persist via localStorage instead
  const targetId=state.activeSpaceId;
  if(patchTargetId && patchTargetId!==targetId){ flushPatch(); }
  patchTargetId=targetId;
  /* The answers ride along with every incremental write.

     Only a FULL save used to write the prefs column, and the report's products
     switch and the whole Adjust screen change answers long after the last full
     save — so the row's copy of them was whatever it happened to be at that
     save, and reopening the space handed back stale answers. `upgrades` is the
     one that showed: turn products on from Adjust, reopen, and the section was
     hidden with the cost tile reading $0 over a plan full of products. The
     workaround was to stop trusting the stored value and re-derive it from the
     shopping list, which is applyLoadedSpace's job below and was always a
     patch over this.

     Snapshotted HERE, synchronously, rather than read at flush time 800ms
     later: `patchTargetId` names the space this write is for, and by the time
     the timer fires `state` may hold a different space's answers. Reading it
     then is how one space's columns end up written to another's row — the
     same mistake snapshotSave exists to prevent on the save path.

     It goes UNDER `patch` so an explicit caller can still override it. */
  Object.assign(pendingPatch, { prefs: answersBlob() }, patch);
  clearTimeout(patchTimer);
  patchTimer=setTimeout(flushPatch, 800);
}

/* For a change that touches nothing but the answers. Every current caller
   changes something else too and so patches anyway, but "the answers moved and
   no other column did" is a real state and it should not depend on a sibling
   write happening to exist. */
export function persistAnswers(){
  updateSpacePatch({});
}
/* Writes are chained rather than fired off in parallel. Two overlapping PATCHes
   of the same row can land in either order, and the loser silently wins. Each
   key is written as a whole value (the full stepsDone array, the whole
   arrangement), so a later write of the SAME key repairs an earlier one — but
   only if it lands later, which is exactly what nothing here guaranteed. */
let patchChain=Promise.resolve();

async function flushPatch(){
  clearTimeout(patchTimer);
  const c=supa();
  const body=pendingPatch; const id=patchTargetId;
  pendingPatch={}; patchTargetId=null;
  if(!c || !id || !Object.keys(body).length) return patchChain;
  patchChain = patchChain.then(()=>writePatch(c, id, body), ()=>writePatch(c, id, body));
  return patchChain;
}

/* ---------- The last write ----------

   Everything above assumes the page is still there when the timer fires. It
   often is not. A write waits 800ms to be batched, and a failed one waits
   4000ms to be retried, and the whole of that is spent on a page the user may
   close, background, or navigate away from — on a phone, switching apps is
   enough for the tab to be discarded outright. Ticking the last step of a plan
   and closing the tab is not an unusual way to finish; it is the normal one.

   Nothing recovers a write lost that way. The queue is in memory, so it goes
   with the page, and the next visit loads the row as the server has it: the
   step comes back unticked, and the only person who knows is the user who
   ticked it.

   `visibilitychange` to hidden is the event to use, not `beforeunload` —
   that one does not fire reliably on mobile, which is where tabs are killed
   most aggressively. `pagehide` covers the bfcache path alongside it. */
function flushBeforeUnload(){
  clearTimeout(patchTimer);
  const body=pendingPatch; const id=patchTargetId;
  pendingPatch={}; patchTargetId=null;
  if(!id || !Object.keys(body).length) return;

  /* Sent as a raw request rather than through supabase-js, for one reason:
     `keepalive`. A normal fetch is cancelled when the document goes away, so
     flushing here without it would only move the moment the write is lost.
     keepalive hands the request to the browser to finish on its own.

     supabase-js takes a custom fetch when the client is CREATED and not per
     call, so there is no way to ask it for this on one request. What it would
     have built is small and stable — a PostgREST PATCH filtered by id — and
     RLS still applies, because the user's own token goes in the header.

     sendBeacon is the usual answer for this and cannot be used: it posts, and
     it cannot set apikey or authorization. */
  const session=getSession();
  const token=(session && session.access_token) || SUPABASE_ANON_KEY;
  try{
    fetch(`${SUPABASE_URL}/rest/v1/spaces?id=eq.${encodeURIComponent(id)}`, {
      method:'PATCH',
      keepalive:true,
      headers:{
        'content-type':'application/json',
        apikey:SUPABASE_ANON_KEY,
        authorization:`Bearer ${token}`,
        // Nothing is left to read the response, so do not ask for a body.
        Prefer:'return=minimal',
      },
      body:JSON.stringify(body),
    }).catch(()=>{ /* the page is going; there is nobody to tell */ });
  }catch(_){ /* same */ }
}

/* Registered here rather than wired from main.js: a persistence guarantee that
   depends on somebody remembering to install it is the shape of half the bugs
   this file has already had. Guarded because the Node suite imports this
   module and has no document. */
if(typeof document!=='undefined' && typeof document.addEventListener==='function'){
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='hidden') flushBeforeUnload();
  });
  if(typeof addEventListener==='function') addEventListener('pagehide', flushBeforeUnload);
}

/* Drains the retry queue and hands it back. A dropped write and a saved one
   look identical from the call site, so the test needs to see what is still
   owed; draining it is what test isolation needs anyway. */
export function takePendingPatch(){
  const out={ patch:pendingPatch, targetId:patchTargetId };
  pendingPatch={}; patchTargetId=null;
  clearTimeout(patchTimer);
  return out;
}

/* Takes its client the way deleteSpaceData and uploadMissingMedia do. */
export async function writePatch(c, id, body){
  const { error } = await c.from('spaces').update(body).eq('id', id);
  if(!error) return;
  /* The error was never read, and `pendingPatch` is emptied before the await —
     so one failed request dropped that progress tick, shopping edit or 3D
     arrangement on the floor, with no retry and nothing on screen to say so.
     The user ticks a step off, it looks saved, and it is gone.

     The keys go back so the next flush carries them again. They go back
     UNDERNEATH whatever has accumulated since: anything the user has done in
     the meantime is newer than this failed attempt and must not be undone by
     it. And only if the pending patch still belongs to the same space —
     re-applying one space's columns to another is worse than losing them. */
  if(patchTargetId && patchTargetId!==id) return;
  pendingPatch={ ...body, ...pendingPatch };
  patchTargetId=id;
  clearTimeout(patchTimer);
  patchTimer=setTimeout(flushPatch, 4000);
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
/* `spaceId` is explicit because the caller always knows it better than the
   global does: doShare() has just been handed the id its own save wrote, and
   re-reading state.activeSpaceId after that await is how a share link for the
   plan the user had moved on to could be minted from the plan they were
   looking at. */
export async function setShareEnabled(on, spaceId=state.activeSpaceId){
  const { c } = requireClient();
  if(!spaceId) throw new Error('Save this space first, then share it.');
  const shareId = on ? crypto.randomUUID() : null;
  const { error } = await c.from('spaces').update({ share_id: shareId }).eq('id', spaceId);
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
/* Both of these used to answer `false` instead of failing, and both callers
   were written as though they threw: the feedback screen attaches a `.catch`
   that rolls back `fbSent` and says the answer did not arrive, and that catch
   could never run. So a 500, a rate limit, or no connection at all still
   collapsed the card to "Thanks — that's genuinely useful" over a row nobody
   wrote, and the screen went on saying "you already sent this" for the rest
   of the session. Someone who took the trouble to answer was told it landed.

   They throw now, and the `supa()` guard is gone with the swallow: it was
   standing in for "is the backend configured", which callFn already answers
   properly, while actually testing whether auth had finished initializing —
   so a fast click was reported to the user as a delivered submission.

   `send` is a parameter for the same reason deleteSpaceData takes its client:
   the behaviour worth testing is what happens on each kind of failure. */
export async function submitFeedbackRow(row, send=submitForm){
  confirmSubmitted(await send({ kind:'feedback', ...row }));
}

// Founding Circle: store the request where the owner can see it. An address
// already on the list is success for the person asking, and the function
// answers it identically to a fresh signup so the response cannot be used to
// test whether an address is registered.
export async function submitInviteRequest(email, send=submitForm){
  confirmSubmitted(await send({ kind:'invite', email }));
}

/* submit-form answers `{ok:true}` and nothing else, so anything else is not a
   confirmation. A 2xx that is not JSON leaves callFn returning null — a
   captive-portal login page and a proxy's error page both arrive that way —
   and "no error" is not the same as "stored". */
function confirmSubmitted(result){
  if(!result || result.ok !== true){
    throw new ApiError('That did not reach us.', { code:'unconfirmed' });
  }
}
