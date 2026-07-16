import { DEMO_FEATURES, DEMO_CATS } from '../data.js';
import { state } from '../state.js';
import { escapeHtml, toast } from '../ui.js';
import { iconFor } from '../icons.js';
import { activeGeometry } from '../plan.js';

/* ---------- Review ---------- */

// icon choices offered in the feature edit dropdown
const ICON_CHOICES = [
  ['shelf','Shelves'],['basket','Basket'],['bin','Bin / container'],['drawer','Drawer'],
  ['vertical','Vertical space'],['horizontal','Open side space'],['up','Top / high spot'],
  ['down','Low / floor spot'],['door','Door / panel'],['hook','Hanging rod / hooks'],
  ['missing','Missing feature'],['empty','Empty zone'],['label','Labels']
];

export function buildReview(){
  const A=state.ai;
  state.features=((A&&A.features.length)?A.features:DEMO_FEATURES).slice();
  state.cats=((A&&A.cats.length)?A.cats:DEMO_CATS).slice();
  renderRevGeometry();
  const fwrap=document.getElementById('rev-features'); fwrap.innerHTML='';
  state.features.forEach((f,i)=>{
    const card=document.createElement('div'); card.className='feat'; card.id='rf-'+i;
    card.style.flexDirection='column'; card.style.gap='10px';
    card.innerHTML=`
      <div style="display:flex;gap:13px;align-items:flex-start;width:100%">
        <span class="fi" id="rf-ico-${i}">${f.ico}</span>
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

/* Estimated size & shelf count — shown so users can confirm or fix them */
function renderRevGeometry(){
  const el=document.getElementById('rev-geo');
  if(!el) return;
  const g=activeGeometry();
  const est=g.estimated;
  el.innerHTML=`
    <div class="rg-head">
      <span class="eyebrow" style="font-size:13px">Size &amp; shelves</span>
      <span class="tag ${est?'':'green'}">${est?'Estimated from your photos':'Your measurements'}</span>
    </div>
    <div class="rg-dims">
      <span><b>${g.width}&Prime;</b> wide</span>
      <span><b>${g.height}&Prime;</b> tall</span>
      <span><b>${g.depth}&Prime;</b> deep</span>
      <span><b>${g.shelfCount}</b> ${g.shelfCount===1?'level':'levels'}</span>
    </div>
    ${est?`<div class="rg-foot">
      <span class="small muted">Close enough is fine &mdash; correct anything and we&rsquo;ll rebuild the plan around your numbers.</span>
      <button class="btn btn-ghost btn-sm" onclick="go('details')" style="white-space:nowrap">Fix measurements</button>
    </div>`:''}`;
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
    <label class="field" style="margin-bottom:0"><span>Feature name</span>
      <input type="text" id="rf-edit-ttl-${i}" value="${escapeHtml(f.ttl)}" placeholder="e.g. 5 shelves"></label>
    <label class="field" style="margin-bottom:0"><span>Details</span>
      <textarea id="rf-edit-sub-${i}" rows="2" placeholder="What should we know about it?">${escapeHtml(f.sub)}</textarea></label>
    <label class="field" style="margin-bottom:0"><span>Type of feature</span>
      <select id="rf-edit-ico-${i}">
        <option value="">Keep current icon</option>
        ${ICON_CHOICES.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
      </select></label>
    <div style="display:flex;gap:8px;margin-top:2px">
      <button class="btn btn-sm btn-primary" onclick="saveFeatEdit(${i})">Save changes</button>
      <button class="btn btn-sm btn-ghost" onclick="cancelFeatEdit(${i})">Cancel</button>
    </div>`;
  card.appendChild(form);
  form.querySelector('input').focus();
}

export function saveFeatEdit(i){
  const ttl=document.getElementById('rf-edit-ttl-'+i).value.trim();
  const sub=document.getElementById('rf-edit-sub-'+i).value.trim();
  const ico=document.getElementById('rf-edit-ico-'+i).value;
  if(!ttl){ toast('Name cannot be empty'); return; }
  state.features[i].ttl=ttl;
  state.features[i].sub=sub;
  if(ico) state.features[i].ico=iconFor(ico);
  document.getElementById('rf-ttl-'+i).textContent=ttl;
  document.getElementById('rf-sub-'+i).textContent=sub;
  if(ico) document.getElementById('rf-ico-'+i).innerHTML=state.features[i].ico;
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
