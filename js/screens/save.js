import { SAVE_OPTS } from '../data.js';
import { toast } from '../ui.js';
import { go, restart } from '../router.js';
import { backendConfigured } from '../config.js';
import { getSession } from '../auth.js';
import { saveSpace, defaultSpaceName } from '../db.js';
import { openAuth, registerAuthIntent } from './account.js';

async function doSave(){
  try{
    toast('Saving…');
    await saveSpace(defaultSpaceName());
    toast('Saved — find it under “My spaces”');
  }catch(e){
    toast(e.message);
  }
}

/* ---------- Save ---------- */
export function buildSave(){
  registerAuthIntent('save', doSave);
  const wrap=document.getElementById('save-opts'); wrap.innerHTML='';
  SAVE_OPTS.forEach(([ico,t])=>{
    const b=document.createElement('button'); b.className='opt';
    b.innerHTML=`<span class="ico">${ico}</span><span class="ttl">${t}</span>`;
    b.onclick=()=>{
      if(t==='Save plan'){
        if(!backendConfigured()){ toast('Saving needs the backend — not connected yet'); return; }
        if(!getSession()){ openAuth('save'); return; }
        doSave();
        return;
      }
      if(t==='Start another space'){ restart(); return; }
      if(t==='Compare before &amp; after'){ go('results'); setTimeout(()=>document.getElementById('after-tabs').scrollIntoView({behavior:'smooth'}),200); return; }
      toast(t.replace('&amp;','&')+' — coming soon');
    };
    wrap.appendChild(b);
  });
}
