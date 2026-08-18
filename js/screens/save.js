import { SAVE_OPTS } from '../data.js';
import { toast, scrollIntoViewSafely } from '../ui.js';
import { downloadChecklist, sendShoppingList } from '../planExport.js';
import { go, restart } from '../router.js';
import { backendConfigured } from '../config.js';
import { getSession } from '../auth.js';
import { saveSpace, defaultSpaceName, setShareEnabled, shareUrlFor } from '../db.js';
import { openAuth, registerAuthIntent } from './account.js';
import { track } from '../telemetry.js';

async function doSave(){
  try{
    toast('Saving…');
    await saveSpace(defaultSpaceName());
    toast('Saved. Find it under “My spaces”.');
  }catch(e){
    toast(e.message);
  }
}

/* Share = save (if needed) + mint a read-only link + copy it. The link shows
   the plan only — never household details, progress, or photos.

   "Not your details" was a promise about a database column, and the plan is
   written from those details: the analysis is asked to name a child's age in
   a safety note and to answer the household's free-text note, and offline the
   note is quoted back verbatim. get-shared-space now removes all of it —
   safety notes wholesale, and any remaining sentence that names this
   household — so the sentence below is finally about what the visitor sees
   rather than about which columns were selected. */
async function doShare(){
  try{
    toast('Creating your share link…');
    // The id this save wrote, handed straight to the link — not read back out
    // of state, which may by then describe a different plan.
    const spaceId=await saveSpace(defaultSpaceName());
    const shareId=await setShareEnabled(true, spaceId);
    track('share_link_created', {});
    const url=shareUrlFor(shareId);
    try{
      await navigator.clipboard.writeText(url);
      toast('Read-only link copied. It shows the plan for this space — no photos, and nothing about your household or its safety notes.');
    }catch(_){
      prompt('Copy this read-only link:', url);
    }
  }catch(e){
    toast(e.message);
  }
}

/* ---------- Save ---------- */
export function buildSave(){
  registerAuthIntent('save', doSave);
  registerAuthIntent('share', doShare);
  const wrap=document.getElementById('save-opts'); wrap.innerHTML='';
  SAVE_OPTS.forEach(([ico,t])=>{
    const b=document.createElement('button'); b.className='opt';
    b.innerHTML=`<span class="ico">${ico}</span><span class="ttl">${t}</span>`;
    b.onclick=()=>{
      if(t==='Save plan'){
        if(!backendConfigured()){ toast('Saving is not available yet'); return; }
        if(!getSession()){ openAuth('save'); return; }
        doSave();
        return;
      }
      if(t==='Share with family / roommate'){
        if(!backendConfigured()){ toast('Sharing is not available yet'); return; }
        if(!getSession()){ openAuth('share'); return; }
        doShare();
        return;
      }
      if(t==='Start another space'){ restart(); return; }
      if(t==='Compare before &amp; after'){ go('results'); setTimeout(()=>scrollIntoViewSafely(document.getElementById('after-tabs')),200); return; }
      /* These two answered "coming soon" for a plan already sitting complete
         in memory. Everything either one needs is on the client. */
      if(t==='Download checklist'){ downloadChecklist(); return; }
      if(t==='Send shopping list'){ sendShoppingList(); return; }
      toast(t.replace('&amp;','&')+' is coming soon');
    };
    wrap.appendChild(b);
  });
}
