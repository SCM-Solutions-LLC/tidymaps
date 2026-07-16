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
      <div style="display:flex;gap:13px;align-items:flex-start;width:100%">
        <span class="fi">${f.ico}</span>
        <div style="flex:1;min-width:0">
          <span class="ft" id="rf-ttl-${i}">${f.ttl}</span>
          <span class="fd" id="rf-sub-${i}">${f.sub}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-left:auto">
        <button class="btn btn-sm btn-ghost" data-act="ok" onclick="markFeat(${i},'ok',this)" style="padding:7px 14px;font-size:13px">Correct</button>
        <button class="btn btn-sm btn-ghost" onclick="editFeat(${i})" style="padding:7px 14px;font-size:13px">Edit</button>
        <button class="btn btn-sm btn-ghost" onclick="removeFeat(${i})" style="padding:7px 14px;font-size:13px">Remove</button>
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
export function editFeat(i){
  const card=document.getElementById('rf-'+i);
  if(card.querySelector('.feat-edit-form')) return;
  const f=state.features[i];
  const form=document.createElement('div');
  form.className='feat-edit-form';
  form.innerHTML=`
    <input type="text" id="rf-edit-ttl-${i}" value="${escapeHtml(f.ttl)}" placeholder="Feature name">
    <input type="text" id="rf-edit-sub-${i}" value="${escapeHtml(f.sub)}" placeholder="Description">
    <div style="display:flex;gap:6px">
      <button class="btn btn-sm btn-primary" onclick="saveFeatEdit(${i})" style="padding:6px 14px;font-size:12px">Save</button>
      <button class="btn btn-sm btn-ghost" onclick="cancelFeatEdit(${i})" style="padding:6px 14px;font-size:12px">Cancel</button>
    </div>`;
  card.appendChild(form);
  form.querySelector('input').focus();
}
export function saveFeatEdit(i){
  const ttl=document.getElementById('rf-edit-ttl-'+i).value.trim();
  const sub=document.getElementById('rf-edit-sub-'+i).value.trim();
  if(!ttl){ toast('Name cannot be empty'); return; }
  state.features[i].ttl=ttl;
  state.features[i].sub=sub;
  document.getElementById('rf-ttl-'+i).textContent=ttl;
  document.getElementById('rf-sub-'+i).textContent=sub;
  cancelFeatEdit(i);
  toast('Feature updated');
}
export function cancelFeatEdit(i){
  const card=document.getElementById('rf-'+i);
  const form=card.querySelector('.feat-edit-form');
  if(form) form.remove();
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
