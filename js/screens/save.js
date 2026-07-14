import { SAVE_OPTS } from '../data.js';
import { toast } from '../ui.js';
import { go, restart } from '../router.js';

/* ---------- Save ---------- */
export function buildSave(){
  const wrap=document.getElementById('save-opts'); wrap.innerHTML='';
  SAVE_OPTS.forEach(([ico,t])=>{
    const b=document.createElement('button'); b.className='opt';
    b.innerHTML=`<span class="ico">${ico}</span><span class="ttl">${t}</span>`;
    b.onclick=()=>{
      if(t==='Start another space'){ restart(); return; }
      if(t==='Compare before &amp; after'){ go('results'); setTimeout(()=>document.getElementById('after-tabs').scrollIntoView({behavior:'smooth'}),200); return; }
      toast(t.replace('&amp;','&')+' — mocked');
    };
    wrap.appendChild(b);
  });
}
