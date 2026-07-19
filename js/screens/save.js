import { SAVE_OPTS } from '../data.js';
import { toast } from '../ui.js';
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
      toast(t.replace('&amp;','&')+' is coming soon');
    };
    wrap.appendChild(b);
  });
}
