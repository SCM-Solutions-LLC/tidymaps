import { getUser, signOut } from '../auth.js';
import { listSpaces, coverUrl, loadSpace, deleteSpace } from '../db.js';
import { escapeHtml, toast } from '../ui.js';
import { go, restart } from '../router.js';
import { buildResults, applySavedProgress } from './results.js';

const TYPE_NAMES={pantry:'Pantry',cabinet:'Cabinet',closet:'Closet',garage:'Garage',attic:'Attic',laundry:'Laundry',kids:'Kids',other:'Space'};

export async function buildDashboard(){
  const user=getUser();
  if(!user){ go('landing'); return; }
  document.getElementById('dash-email').textContent=user.email||'';
  const grid=document.getElementById('dash-grid');
  grid.innerHTML='<div class="dash-empty">Loading your spaces…</div>';
  let spaces=[];
  try{ spaces=await listSpaces(); }
  catch(e){ grid.innerHTML=`<div class="dash-empty">${escapeHtml(e.message)}</div>`; return; }
  document.getElementById('dash-count').textContent=spaces.length===1?'1 space':spaces.length+' spaces';

  grid.innerHTML='';
  spaces.forEach(sp=>{
    const done=(sp.progress&&sp.progress.stepsDone||[]).filter(Boolean).length;
    const total=(sp.progress&&sp.progress.stepsDone||[]).length;
    const pct=total?Math.round(done/total*100):0;
    const when=new Date(sp.updated_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const card=document.createElement('div'); card.className='dash-card';
    card.innerHTML=`
      <div class="dash-cover"><span class="dc-type">${escapeHtml(TYPE_NAMES[sp.space_type]||'Space')}</span></div>
      <div class="dash-body">
        <h4>${escapeHtml(sp.name)}</h4>
        <div class="dash-meta"><span>Updated ${escapeHtml(when)}</span>${total?`<span>${done}/${total} steps</span>`:''}</div>
        <div class="dash-prog"><i style="width:${pct}%"></i></div>
        <div class="dash-acts">
          <button class="btn btn-primary btn-sm" data-open>Open plan</button>
          <button class="del" data-del title="Delete this space">Delete</button>
        </div>
      </div>`;
    card.querySelector('[data-open]').onclick=async ()=>{
      try{
        toast('Opening '+sp.name+'…');
        const data=await loadSpace(sp.id);
        buildResults();
        applySavedProgress((data.progress&&data.progress.stepsDone)||[]);
        go('results');
      }catch(e){ toast(e.message); }
    };
    card.querySelector('[data-del]').onclick=async ()=>{
      if(!confirm('Delete "'+sp.name+'" and its plan? This cannot be undone.')) return;
      await deleteSpace(sp.id);
      buildDashboard();
    };
    grid.appendChild(card);
    coverUrl(sp.id).then(url=>{
      if(url){ const img=document.createElement('img'); img.src=url; img.alt=''; card.querySelector('.dash-cover').appendChild(img); }
    });
  });

  const add=document.createElement('button');
  add.className='dash-new'; add.textContent='+ Organize a new space';
  add.onclick=()=>restart();
  grid.appendChild(add);

  if(!spaces.length){
    const empty=document.createElement('div'); empty.className='dash-empty';
    empty.textContent='No saved spaces yet — organize one and tap Save.';
    grid.prepend(empty);
  }
}

export async function dashSignOut(){
  await signOut();
  toast('Signed out');
  go('landing');
}
