import { DEMO_FEATURES, DEMO_CATS } from '../data.js';
import { state } from '../state.js';
import { escapeHtml, toast } from '../ui.js';

/* ---------- Review ---------- */
export function buildReview(){
  const A=state.ai;
  state.features=((A&&A.features.length)?A.features:DEMO_FEATURES).slice();
  state.cats=((A&&A.cats.length)?A.cats:DEMO_CATS).slice();
  const fwrap=document.getElementById('rev-features'); fwrap.innerHTML='';
  state.features.forEach((f,i)=>{
    const card=document.createElement('div'); card.className='feat'; card.id='rf-'+i;
    card.style.flexDirection='column'; card.style.gap='10px';
    card.innerHTML=`
      <div style="display:flex;gap:11px;align-items:flex-start;width:100%">
        <span class="fi">${f.ico}</span>
        <span><span class="ft">${f.ttl}</span><span class="fd">${f.sub}</span></span>
      </div>
      <div style="display:flex;gap:6px;margin-left:auto">
        <button class="btn btn-sm btn-ghost" data-act="ok" onclick="markFeat(${i},'ok',this)" style="padding:6px 12px;font-size:12px">Correct</button>
        <button class="btn btn-sm btn-ghost" onclick="toast('Edit is mocked in this prototype')" style="padding:6px 12px;font-size:12px">Edit</button>
        <button class="btn btn-sm btn-ghost" onclick="removeFeat(${i})" style="padding:6px 12px;font-size:12px">Remove</button>
      </div>`;
    fwrap.appendChild(card);
  });
  renderRevCats();
}
export function markFeat(i,act,btn){
  const card=document.getElementById('rf-'+i);
  card.style.borderColor='var(--primary)'; card.style.background='var(--primary-bg)';
  btn.classList.add('mark'); btn.style.background='var(--primary)'; btn.style.color='#fff'; btn.style.borderColor='var(--primary)';
}
export function removeFeat(i){
  const card=document.getElementById('rf-'+i);
  card.style.transition='.25s'; card.style.opacity='0'; card.style.transform='scale(.96)';
  setTimeout(()=>card.classList.add('hide'),240);
}
export function renderRevCats(){
  const cw=document.getElementById('rev-cats'); cw.innerHTML='';
  state.cats.forEach((c,i)=>{
    const chip=document.createElement('button'); chip.className='chip sel';
    chip.innerHTML=escapeHtml(c)+' &times;';
    chip.onclick=()=>{ state.cats.splice(i,1); renderRevCats(); };
    cw.appendChild(chip);
  });
}
export function addCategory(){
  const inp=document.getElementById('add-cat');
  const v=inp.value.trim();
  if(!v)return;
  state.cats.push(v); inp.value=''; renderRevCats();
}
