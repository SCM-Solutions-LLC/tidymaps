import { SAVE_OPTS } from '../data.js';
import { toast } from '../ui.js';
import { checklistText, shoppingListText, planFileName, downloadText } from '../planExport.js';
import { go, restart } from '../router.js';
import { backendConfigured } from '../config.js';
import { getSession } from '../auth.js';
import { state } from '../state.js';
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

// Share = save (if needed) + mint a read-only link + copy it. The link shows
// the plan only — never household details, progress, or photos.
async function doShare(){
  try{
    toast('Creating your share link…');
    await saveSpace(defaultSpaceName());
    const shareId=await setShareEnabled(true);
    track('share_link_created', {});
    const url=shareUrlFor(shareId);
    try{
      await navigator.clipboard.writeText(url);
      toast('Read-only link copied. Anyone with it can view this plan — not your photos or details.');
    }catch(_){
      prompt('Copy this read-only link:', url);
    }
  }catch(e){
    toast(e.message);
  }
}

function doDownloadChecklist(){
  if(!state.ai){ toast('Build a plan first.'); return; }
  downloadText(planFileName('checklist','txt'), checklistText());
  toast('Checklist downloaded.');
}

/* "Send" without a mail backend means handing it to the mail client the person
   already uses. mailto has a practical length limit and silently truncates
   past it, so anything long goes to the clipboard instead of arriving cut in
   half — and the clipboard is the fallback again if no mail client answers. */
const MAILTO_LIMIT = 1800;

async function doSendShoppingList(){
  if(!state.ai){ toast('Build a plan first.'); return; }
  const body=shoppingListText();
  const subject=`TidyMap shopping list`;
  const href=`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if(href.length<=MAILTO_LIMIT){
    location.href=href;
    toast('Opening your email with the list.');
    return;
  }
  try{
    await navigator.clipboard.writeText(body);
    toast('Shopping list copied — too long to email directly, so paste it wherever you like.');
  }catch(_){
    downloadText(planFileName('shopping-list','txt'), body);
    toast('Shopping list downloaded.');
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
      if(t==='Compare before &amp; after'){ go('results'); setTimeout(()=>document.getElementById('after-tabs').scrollIntoView({behavior:'smooth'}),200); return; }
      /* These two answered "coming soon" for a plan already sitting complete
         in memory. Everything either one needs is on the client. */
      if(t==='Download checklist'){ doDownloadChecklist(); return; }
      if(t==='Send shopping list'){ doSendShoppingList(); return; }
      toast(t.replace('&amp;','&')+' is coming soon');
    };
    wrap.appendChild(b);
  });
}
