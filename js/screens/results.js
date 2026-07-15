import { MAP, EXISTING, STEPS, AFTER_MODES, AFTER_PALETTE } from '../data.js';
import { SVG, ICON } from '../icons.js';
import { state, persistGuestDraft } from '../state.js';
import { escapeHtml, toast } from '../ui.js';
import { activeSafetyNotes, activeProductNeeds, buildGeminiBrief } from '../plan.js';
import { loadCatalog, matchProducts, fitBadge, searchLinks, priceAsOf, TYPE_LABEL } from '../catalog.js';
import { backendConfigured } from '../config.js';
import { renderAfter as renderAfterApi } from '../api.js';
import { fileToScaledB64 } from '../media.js';
import { getSession } from '../auth.js';
import { updateSpacePatch } from '../db.js';
import { buildReview } from './review.js';

/* ---------- Results ---------- */
export function buildResults(){
  buildReview();
  const A=state.ai;
  // AI badge on results title
  const badge=document.getElementById('res-ai-badge');
  if(badge) badge.style.display = A ? 'inline-flex' : 'none';

  // report masthead + byline
  const mastSpace=document.getElementById('mast-space');
  if(mastSpace) mastSpace.textContent = A ? A.spaceType : 'Pantry';
  const mastDate=document.getElementById('mast-date');
  if(mastDate) mastDate.textContent = new Date().toLocaleString('en-US',{month:'long',year:'numeric'});
  const byline=document.getElementById('res-byline');
  const model=(state.planMeta&&state.planMeta.model)||'';
  if(byline) byline.textContent = A
    ? 'Analyzed by Claude'+(model?' · '+model.replace('claude-','').replace(/-/g,' '):'')
    : 'Example plan · demo data';

  // summary
  document.getElementById('res-summary').textContent = A ? A.summary :
    'We detected snacks, canned goods, spices, baking supplies, breakfast items, paper goods, and overflow items. The main issue is that similar items are spread across multiple shelves, daily-use items are mixed with rarely used items, and vertical space is underused.';
  // kpis
  const kpis=[
    ['Space type', A?A.spaceType:'Pantry'],['Categories',state.cats.length+' found'],
    ['Time', A?A.time:'45–90 min'],['Cost', A?A.cost:'$0 / $45–85']
  ];
  document.getElementById('res-kpis').innerHTML=kpis.map(([k,v])=>`<div class="kpi"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`).join('');
  document.getElementById('res-cat-tags').innerHTML=state.cats.map(c=>`<span class="tag">${escapeHtml(c)}</span>`).join('');
  const problems = (A&&A.problems.length)?A.problems:[
    'Similar items are spread across multiple shelves','Frequently used snacks are too high',
    'Canned goods are hard to see','Loose packets are creating clutter',
    'Bulk items are taking up prime shelf space','Heavy items should be moved lower'];
  document.getElementById('res-problems').innerHTML=problems.map(p=>`<li>${escapeHtml(p)}</li>`).join('');
  const opps = (A&&A.opportunities.length)?A.opportunities:[
    'Existing baskets are underused','Unused vertical space above the cans',
    'Right-side open shelf space is free','Lower shelf can safely hold heavy items'];
  document.getElementById('res-opps').innerHTML=opps.map(p=>`<li>${escapeHtml(p)}</li>`).join('');

  // household safety notes (only present when the plan carries them)
  const notesWrap=document.getElementById('res-safety-notes');
  if(notesWrap){
    notesWrap.innerHTML=activeSafetyNotes().map(n=>
      `<div class="safety-note">${SVG.shield}<span>${escapeHtml(n)}</span></div>`).join('');
  }

  // map — v2 rows carry per-shelf safety flags
  const SAFETY_LABEL={'kid-safe':'kid safe','keep-high':'keep high','lock-or-latch':'lock or latch'};
  const mapData = (A&&A.map.length)?A.map:MAP;
  document.getElementById('res-map').innerHTML=mapData.map(m=>{
    const flag=m.safety&&m.safety.flag;
    const badge=flag?`<span class="tag ${flag==='kid-safe'?'green':'warn'}" style="margin-left:8px;vertical-align:2px">${SAFETY_LABEL[flag]}</span>`:'';
    const safetyWhy=(m.safety&&m.safety.why)?`<div class="why">${SVG.shield}<span>${escapeHtml(m.safety.why)}</span></div>`:'';
    return `
    <div class="shelf ${m.eye?'eye':''}">
      <div class="label"><span class="lv">${escapeHtml(m.lv)}</span><span class="ic">${m.ic}</span></div>
      <div class="body"><div class="zone">${escapeHtml(m.zone)}${badge}</div>
        <div class="why">${ICON.why}<span>${escapeHtml(m.why)}</span></div>${safetyWhy}</div>
    </div>`;
  }).join('');

  // existing first
  document.getElementById('res-existing-lede').textContent = (A&&A.existingLede) ? A.existingLede :
    'We noticed you already have two baskets, one deep bin, open shelf space on the right side, and unused vertical space above the cans. Put these to work before buying anything.';
  const existingData = (A&&A.existing.length)?A.existing:EXISTING;
  document.getElementById('res-existing').innerHTML=existingData.map(e=>`
    <div class="feat"><span class="fi">${e.ico}</span><div><span class="ft">${escapeHtml(e.ft)}</span><span class="fd">${escapeHtml(e.fd)}</span></div></div>`).join('');
  document.getElementById('res-dontbuy').textContent = (A&&A.dontBuy) ? A.dontBuy :
    'No new bins, racks, or organizers yet. Your two baskets and deep bin already cover snacks, breakfast, and overflow. Measure first if you decide to upgrade later.';

  // steps
  renderSteps((A&&A.steps.length)?A.steps:STEPS);

  // after tabs
  const at=document.getElementById('after-tabs'); at.innerHTML='';
  AFTER_MODES.forEach(m=>{
    const b=document.createElement('button'); b.className='after-tab'+(m===state.afterMode?' sel':''); b.textContent=m;
    b.onclick=()=>{ state.afterMode=m; at.querySelectorAll('.after-tab').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); renderAfter(m); };
    at.appendChild(b);
  });
  renderAfter(state.afterMode);

  // upgrades / shopping — catalog-matched, dimension-aware
  setUpgrades(state.upgrades);
  loadCatalog().then(()=>{ initShopping(); renderUpgrades(); });

  // photorealistic before/after (only when we have the user's photo)
  setupAfterPhoto();
}

/* ---------- Photorealistic after-render (Gemini via edge function) ---------- */
function beforePhotoSrc(){
  if(state.uploadedFiles && state.uploadedFiles.length) return URL.createObjectURL(state.uploadedFiles[0]);
  if(state.frames && state.frames.length) return 'data:image/jpeg;base64,'+state.frames[0].data;
  return state.beforePhotoUrl || null;
}

function setupAfterPhoto(){
  const wrap=document.getElementById('after-photo'); if(!wrap) return;
  const beforeUrl=beforePhotoSrc();
  state._beforeUrl=beforeUrl;
  const hero=document.getElementById('report-hero');
  if(hero){ hero.classList.toggle('hide',!beforeUrl); if(beforeUrl) hero.querySelector('img').src=beforeUrl; }
  const afterUrl=state.afterRenderB64 ? 'data:image/png;base64,'+state.afterRenderB64 : (state.afterRenderUrl||null);
  wrap.classList.toggle('hide', !beforeUrl);
  if(!beforeUrl) return;
  const slider=document.getElementById('ba-slider');
  const genRow=document.getElementById('after-gen-row');
  const disclaimer=document.getElementById('ba-disclaimer');
  if(afterUrl){
    document.getElementById('ba-before-img').src=beforeUrl;
    document.getElementById('ba-after-img').src=afterUrl;
    slider.classList.remove('hide');
    disclaimer.classList.remove('hide');
    genRow.classList.add('hide');
  }else{
    slider.classList.add('hide');
    disclaimer.classList.add('hide');
    genRow.classList.toggle('hide', !backendConfigured());
  }
}

async function beforePhotoB64(){
  if(state.uploadedFiles && state.uploadedFiles.length){
    return { media_type:'image/jpeg', data: await fileToScaledB64(state.uploadedFiles[0]) };
  }
  if(state.frames && state.frames.length){
    return { media_type:'image/jpeg', data: state.frames[0].data };
  }
  if(state._beforeUrl){
    const blob=await (await fetch(state._beforeUrl)).blob();
    const data=await new Promise((res,rej)=>{
      const fr=new FileReader();
      fr.onload=()=>res(String(fr.result).split(',')[1]);
      fr.onerror=rej;
      fr.readAsDataURL(blob);
    });
    return { media_type: blob.type||'image/jpeg', data };
  }
  throw new Error('No photo to work from.');
}

export async function generateAfter(){
  const btn=document.getElementById('after-gen-btn');
  const note=document.getElementById('after-gen-note');
  btn.disabled=true;
  btn.innerHTML='Rendering&hellip; <span class="spin-ring" style="border-color:rgba(255,255,255,.5);border-right-color:transparent"></span>';
  note.textContent='This usually takes ten seconds or so.';
  try{
    const image=await beforePhotoB64();
    const res=await renderAfterApi(image, buildGeminiBrief(), state.activeSpaceId);
    state.afterRenderB64=res.image.data;
    setupAfterPhoto();
    toast('Photo preview ready — drag the slider');
  }catch(e){
    note.textContent=(e && e.code==='rate_limited')
      ? e.message
      : 'Photo preview unavailable right now — the illustrated layout below still shows the full plan.';
  }finally{
    btn.disabled=false;
    btn.textContent='Generate photo preview';
  }
}

const TYPE_ICON={
  'clear-bin':'box','basket':'shoppingBag','turntable':'refreshCw','can-riser':'barChart',
  'shelf-riser':'trendingUp','door-rack':'layoutGrid','airtight-container':'lock',
  'drawer-organizer':'columns','hook-rack':'tag','label-set':'tag','safety-latch':'lock',
};

// Build (or keep a restored) shopping selection: one entry per product need
function initShopping(){
  const needs=activeProductNeeds();
  const valid=state.shopping && state.shopping.length===needs.length &&
    state.shopping.every(s=>s && typeof s.needIdx==='number');
  if(valid) return;
  state.shopping=needs.map((need,i)=>{
    const top=matchProducts(need).filter(m=>m.fit!=='no-fit')[0];
    return {
      needIdx:i, checked:true, qty:need.qty,
      productId: top?top.product.id:null,
      name: top?top.product.name:TYPE_LABEL[need.type],
      price_usd: top?top.product.price_usd:null,
      url: top?top.product.url:null,
      retailer: top?top.product.retailer:null,
      fit: top?top.fit:'unknown',
    };
  });
}

function persistShopping(){
  if(getSession()) updateSpacePatch({shopping:state.shopping});
  else persistGuestDraft();
}

export function renderUpgrades(){
  const needs=activeProductNeeds();
  document.getElementById('res-upgrades').innerHTML=needs.map((need,i)=>{
    const sel=state.shopping[i];
    const options=matchProducts(need).filter(m=>m.fit!=='no-fit').slice(0,4);
    const badge=fitBadge(sel.fit);
    const links=searchLinks(need).map(l=>
      `<a href="${l.url}" target="_blank" rel="noopener" style="text-decoration:underline">${escapeHtml(l.retailer)}</a>`).join(' · ');
    const picker=options.length>1?`
      <select onchange="pickProduct(${i},this.value)" style="width:auto;max-width:100%;padding:7px 10px;font-size:13px;margin-top:8px">
        ${options.map(o=>`<option value="${o.product.id}" ${o.product.id===sel.productId?'selected':''}>${escapeHtml(o.product.name.length>60?o.product.name.slice(0,57)+'…':o.product.name)} — $${o.product.price_usd}</option>`).join('')}
      </select>`:'';
    const chosen=sel.productId?`
      <div class="pchoice">
        <a href="${sel.url}" target="_blank" rel="noopener">${escapeHtml(sel.name)}</a>
        <span class="muted">at ${escapeHtml(sel.retailer)}</span>
        ${badge.txt?`<span class="tag ${badge.cls}">${escapeHtml(badge.txt)}</span>`:''}
      </div>${picker}`:
      `<div style="margin-top:8px;font-size:13px" class="muted">No catalog match for this space — use the search links below.</div>`;
    return `
    <div class="prod${sel.checked?'':' excluded'}">
      <input type="checkbox" ${sel.checked?'checked':''} onchange="toggleUpgrade(${i})" aria-label="Include ${escapeHtml(TYPE_LABEL[need.type])} in shopping list">
      <span class="pic">${SVG[TYPE_ICON[need.type]]||SVG.box}</span>
      <div>
        <h4>${need.qty>1?need.qty+' × ':''}${escapeHtml(TYPE_LABEL[need.type])}${need.priority==='high'?'<span class="tag green">recommended</span>':''}</h4>
        <div class="pwhy">${escapeHtml(need.purpose)}</div>
        ${chosen}
        <div class="pmeta">
          <span>${SVG.mapPin} ${escapeHtml(need.targetZone||'Anywhere')}</span>
          ${need.maxDims?`<span>${SVG.ruler} Max ${need.maxDims.w_in}″w × ${need.maxDims.h_in}″h × ${need.maxDims.d_in}″d</span>`:''}
        </div>
        <div class="small muted" style="margin-top:8px">Search instead: ${links}</div>
      </div>
      <span class="cost">${sel.price_usd!=null?'$'+Math.round(sel.price_usd*sel.qty):'—'}</span>
    </div>`;
  }).join('');
  renderShopping();
}

export function pickProduct(i, productId){
  const need=activeProductNeeds()[i];
  const m=matchProducts(need).find(x=>x.product.id===productId);
  if(!m) return;
  Object.assign(state.shopping[i],{
    productId:m.product.id, name:m.product.name, price_usd:m.product.price_usd,
    url:m.product.url, retailer:m.product.retailer, fit:m.fit,
  });
  renderUpgrades();
  persistShopping();
}

export function toggleUpgrade(i){
  state.shopping[i].checked=!state.shopping[i].checked;
  document.querySelectorAll('#res-upgrades .prod')[i].classList.toggle('excluded',!state.shopping[i].checked);
  renderShopping();
  persistShopping();
}
export function uncheckAllUpgrades(){
  (state.shopping||[]).forEach(s=>{ s.checked=false; });
  renderUpgrades();
  persistShopping();
  toast('All upgrades removed — you\'re on the $0 plan');
}
export function renderShopping(){
  const picked=(state.shopping||[]).filter(s=>s.checked);
  const list=document.getElementById('res-shopping');
  list.innerHTML=picked.length?picked.map(s=>
    `<li><span>${s.qty>1?s.qty+' × ':''}${escapeHtml(s.name)}</span><span class="qcost">${s.price_usd!=null?'$'+Math.round(s.price_usd*s.qty):'—'}</span></li>`).join(''):
    '<li><span class="muted">No items selected — you\'re on the $0 plan.</span></li>';
  const total=picked.reduce((sum,s)=>sum+(s.price_usd!=null?s.price_usd*s.qty:0),0);
  const unpriced=picked.some(s=>s.price_usd==null);
  document.getElementById('res-shop-total').textContent=(total?'$'+Math.round(total):'$0')+(unpriced?'+':'');
  const asOf=priceAsOf();
  const note=document.getElementById('res-price-asof');
  if(note) note.textContent=asOf?`Prices approximate, checked ${asOf}. Links open the retailer's page.`:'';
}
export function renderSteps(list){
  const wrap=document.getElementById('res-steps'); wrap.innerHTML='';
  state.stepDone=new Array(list.length).fill(false);
  list.forEach((s,i)=>{
    const t=document.createElement('div'); t.className='task'; t.id='task-'+i;
    t.innerHTML=`
      <button class="check" onclick="toggleStep(${i})">${ICON.check}</button>
      <div>
        <div class="num">Step ${i+1}</div>
        <div class="tname">${escapeHtml(s.t)}</div>
        <div class="meta"><span class="time">${SVG.clock} ${escapeHtml(s.m)}</span></div>
        <div class="why2"><strong>Why:</strong> ${escapeHtml(s.w)}</div>
        <div class="acts">
          <button class="mark" onclick="toggleStep(${i})">Mark complete</button>
          <button onclick="skipStep(${i})">Skip</button>
          <button onclick="toast('Help is mocked — a tip would appear here')">Need help?</button>
        </div>
      </div>`;
    wrap.appendChild(t);
  });
  state.stepCount=list.length;
  updateProgress();
}
export function toggleStep(i){
  state.stepDone[i]=!state.stepDone[i];
  document.getElementById('task-'+i).classList.toggle('done',state.stepDone[i]);
  document.querySelector('#task-'+i+' .mark').textContent=state.stepDone[i]?'Completed':'Mark complete';
  updateProgress();
  if(getSession()) updateSpacePatch({progress:{stepsDone:state.stepDone}});
  else persistGuestDraft();
}

// Re-apply a saved checklist (from a saved space or a guest draft) after renderSteps reset it
export function applySavedProgress(saved){
  (saved||[]).forEach((v,i)=>{
    if(v && state.stepDone && i<state.stepDone.length && !state.stepDone[i]) toggleStep(i);
  });
}
export function skipStep(i){
  if(!state.stepDone[i]) toggleStep(i);
  toast('Step skipped');
}
export function updateProgress(){
  const done=state.stepDone.filter(Boolean).length;
  const n=state.stepCount;
  const pct=Math.round(done/n*100);
  document.getElementById('prog-text').textContent=`Step ${done} of ${n} complete`;
  document.getElementById('prog-pct').textContent=pct+'%';
  document.getElementById('prog-bar').style.width=pct+'%';
}
export function activeMap(){ return (state.ai && state.ai.map && state.ai.map.length) ? state.ai.map : MAP; }
export function parseZone(z){ return String(z||'').split(/[·•,;]|\s\/\s/).map(s=>s.trim()).filter(Boolean); }
export function renderAfter(mode){
  document.getElementById('after-h').textContent='After · '+mode;
  const cab=document.getElementById('after-cabinet');
  const map=activeMap();
  let colorI=0;
  cab.innerHTML=map.map((m,ri)=>{
    let items=parseZone(m.zone);
    const isLast=ri===map.length-1;
    let shelfCls='', tag='';
    if(m.eye){ shelfCls=' eye'; tag='<span class="cab-tag eyet">eye level</span>'; }
    if(mode==='Minimal look') items=items.slice(0,2);
    if(mode==='Kid-friendly setup' && isLast){ shelfCls=' kid'; tag='<span class="cab-tag kidt">kid reach</span>'; }
    let row;
    if(mode==='Hidden storage'){
      const n=Math.max(1,Math.ceil(items.length/2));
      row=Array.from({length:n}).map(()=>`<span class="cab-item bin">${SVG.shoppingBag}<span class="nm">Basket</span></span>`).join('');
    }else{
      row=items.map(it=>{
        const c=AFTER_PALETTE[(colorI++)%AFTER_PALETTE.length];
        const bin=(mode==='More bins');
        const label=(mode==='More labels')?`<span class="lbl">${escapeHtml(it).slice(0,10)}</span>`:'';
        const lead=bin?SVG.archive:`<span class="sw" style="background:${c}"></span>`;
        return `<span class="cab-item${bin?' bin':''}">${lead}<span class="nm">${escapeHtml(it)}</span>${label}</span>`;
      }).join('');
    }
    if(!row) row='<span class="cab-item"><span class="nm" style="color:var(--ink-3)">&mdash;</span></span>';
    return `<div class="cab-shelf${shelfCls}"><div class="cab-lv"><span>${escapeHtml(m.lv)}</span>${tag}</div><div class="cab-row">${row}</div></div>`;
  }).join('');
}
export function setUpgrades(on){
  state.upgrades=on;
  document.getElementById('res-upgrades-wrap').classList.toggle('hide',!on);
  const tocShop=document.getElementById('toc-shop');
  if(tocShop) tocShop.classList.toggle('hide',!on);
}

/* Called from goNext() when leaving the review screen */
export function syncCategoriesToResults(){
  document.getElementById('res-cat-tags').innerHTML=state.cats.map(c=>`<span class="tag">${escapeHtml(c)}</span>`).join('');
  const catKpi=document.querySelector('#res-kpis .kpi:nth-child(2) .v');
  if(catKpi) catKpi.textContent=state.cats.length+' found';
}
