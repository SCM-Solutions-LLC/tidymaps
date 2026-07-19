import { MAP, EXISTING, STEPS, AFTER_MODES, AFTER_PALETTE } from '../data.js';
import { SVG, ICON } from '../icons.js';
import { state, persistGuestDraft } from '../state.js';
import { escapeHtml, toast } from '../ui.js';
import { activeSafetyNotes, activeProductNeeds, buildGeminiBrief } from '../plan.js';
import { loadCatalog, matchProducts, fitBadge, searchLinks, priceAsOf, TYPE_LABEL } from '../catalog.js';
import { withAffiliate, affiliatesConfigured, AFFILIATE_DISCLOSURE } from '../affiliates.js';
import { backendConfigured } from '../config.js';
import { renderAfter as renderAfterApi, renderAfterErrorMessage } from '../api.js';
import { fileToScaledB64 } from '../media.js';
import { getSession } from '../auth.js';
import { updateSpacePatch } from '../db.js';
import { classifyAction, mediaKeyFor, hydrateStepMedia } from '../stepMedia.js';
import { buildReview } from './review.js';

/* ---------- Results ---------- */
export function buildResults(){
  buildReview();
  const A=state.ai;
  const isRealAi = A && state.planMeta && state.planMeta.source==='ai';
  // AI badge on results title
  const badge=document.getElementById('res-ai-badge');
  if(badge) badge.style.display = isRealAi ? 'inline-flex' : 'none';

  // report masthead + byline
  const mastSpace=document.getElementById('mast-space');
  if(mastSpace) mastSpace.textContent = A ? A.spaceType : 'Pantry';
  const mastDate=document.getElementById('mast-date');
  if(mastDate) mastDate.textContent = new Date().toLocaleString('en-US',{month:'long',year:'numeric'});
  const byline=document.getElementById('res-byline');
  const model=(state.planMeta&&state.planMeta.model)||'';
  if(byline) byline.textContent = isRealAi
    ? 'Analyzed by Claude'+(model?' · '+model.replace('claude-','').replace(/-/g,' '):'')
    : 'Personalized plan · based on your selections';

  // analysis-failed banner: their photo may be up top, but the plan used demo fallback
  const fb=document.getElementById('res-fallback-note');
  if(fb){
    const showFallback = state.aiError && state.planMeta && state.planMeta.source==='demo-fallback';
    fb.classList.toggle('hide', !showFallback);
    if(showFallback) fb.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
      <div><strong>We couldn't analyze your photos this time.</strong> ${escapeHtml(state.aiError)}
      The plan below is based on your selections, not your photos.
      <a href="#" onclick="restart();return false" style="text-decoration:underline;font-weight:600">Try again</a></div>`;
  }

  // summary: first sentence as the lede, the rest as scannable bullets
  const sumText = A ? A.summary :
    'We detected snacks, canned goods, spices, baking supplies, breakfast items, paper goods, and overflow items. The main issue is that similar items are spread across multiple shelves, daily-use items are mixed with rarely used items, and vertical space is underused.';
  const sents=sumText.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
  const sumPoints=document.getElementById('res-summary-points');
  if(sents.length>=3){
    document.getElementById('res-summary').textContent=sents[0];
    if(sumPoints) sumPoints.innerHTML=sents.slice(1).map(s=>`<li>${escapeHtml(s)}</li>`).join('');
  }else{
    document.getElementById('res-summary').textContent=sumText;
    if(sumPoints) sumPoints.innerHTML='';
  }
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
    const notes=activeSafetyNotes();
    notesWrap.innerHTML=notes.length?
      `<div class="sn-head">${SVG.shield}<div><strong>Safety notes for your household</strong>
        <span>The green notes below are placements chosen for safety, based on what you told us about kids, pets, and reach. The plan already follows them.</span></div></div>`
      + notes.map(n=>`<div class="safety-note">${SVG.shield}<span>${escapeHtml(n)}</span></div>`).join('')
      :'';
  }

  // map — v2 rows carry per-shelf safety flags
  const SAFETY_LABEL={'kid-safe':'kid safe','keep-high':'keep high','lock-or-latch':'lock or latch'};
  const mapData = (A&&A.map.length)?A.map:MAP;
  document.getElementById('res-map').innerHTML=mapData.map(m=>{
    const flag=m.safety&&m.safety.flag;
    const badge=flag?`<span class="tag ${flag==='kid-safe'?'green':'warn'}" style="margin-left:8px;vertical-align:2px">${SAFETY_LABEL[flag]}</span>`:'';
    const safetyWhy=(m.safety&&m.safety.why)?`<div class="why">${SVG.shield}<span>${escapeHtml(m.safety.why)}</span></div>`:'';
    // "Left wall: eye level shelf" reads as a wall chip + a level name
    const parts=String(m.lv||'').split(/:\s*/);
    const wall=parts.length>1?parts[0]:null;
    const lvl=parts.length>1?parts.slice(1).join(': '):m.lv;
    return `
    <div class="shelf ${m.eye?'eye':''}">
      <div class="label">
        ${wall?`<span class="lv-wall">${escapeHtml(wall)}</span>`:''}
        <span class="lv">${escapeHtml(lvl)}</span><span class="ic">${m.ic}</span></div>
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
    note.textContent=renderAfterErrorMessage(e);
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
      img: top?(top.product.img||null):null,
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
    const img=sel.img
      ?`<img src="${sel.img}" alt="" loading="lazy" onerror="this.parentElement.classList.add('noimg');this.remove()">`
      :'';
    const picker=options.length>1?`
      <label class="field" style="margin:10px 0 0"><span>Swap for a different product</span>
      <select onchange="pickProduct(${i},this.value)" style="padding:9px 11px;font-size:13px">
        ${options.map(o=>`<option value="${o.product.id}" ${o.product.id===sel.productId?'selected':''}>${escapeHtml(o.product.name.length>60?o.product.name.slice(0,57)+'…':o.product.name)} · $${o.product.price_usd}</option>`).join('')}
      </select></label>`:'';
    const main=sel.productId?`
      <a class="pname" href="${withAffiliate(sel.url, sel.retailer)}" target="_blank" rel="noopener">${escapeHtml(sel.name)}</a>
      <div class="pretail">at ${escapeHtml(sel.retailer)}${badge.txt?` <span class="tag ${badge.cls}">${escapeHtml(badge.txt)}</span>`:''}</div>`:
      `<div class="pretail">No exact match in our catalog. Search: ${links}</div>`;
    return `
    <div class="prod${sel.checked?'':' excluded'}">
      <input type="checkbox" ${sel.checked?'checked':''} onchange="toggleUpgrade(${i})" aria-label="Include ${escapeHtml(TYPE_LABEL[need.type])} in shopping list">
      <span class="pic${img?'':' noimg'}">${img}<span class="pic-ico">${SVG[TYPE_ICON[need.type]]||SVG.box}</span></span>
      <div>
        <h4>${need.qty>1?need.qty+' × ':''}${escapeHtml(TYPE_LABEL[need.type])}${need.priority==='high'?'<span class="tag green">recommended</span>':''}</h4>
        <div class="pwhy">${escapeHtml(need.purpose)}</div>
        ${main}
        <details class="pmore">
          <summary>Details &amp; other options</summary>
          <div class="pmeta">
            <span>${SVG.mapPin} ${escapeHtml(need.targetZone||'Anywhere')}</span>
            ${need.maxDims?`<span>${SVG.ruler} Max ${need.maxDims.w_in}″w × ${need.maxDims.h_in}″h × ${need.maxDims.d_in}″d</span>`:''}
          </div>
          ${picker}
          <div class="small muted" style="margin-top:10px">Search instead: ${links}</div>
        </details>
      </div>
      <span class="cost">${sel.price_usd!=null?'$'+Math.round(sel.price_usd*sel.qty):'–'}</span>
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
    url:m.product.url, retailer:m.product.retailer, img:m.product.img||null, fit:m.fit,
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
    `<li><span>${s.qty>1?s.qty+' × ':''}${escapeHtml(s.name)}</span><span class="qcost">${s.price_usd!=null?'$'+Math.round(s.price_usd*s.qty):'–'}</span></li>`).join(''):
    '<li><span class="muted">No items selected — you\'re on the $0 plan.</span></li>';
  const total=picked.reduce((sum,s)=>sum+(s.price_usd!=null?s.price_usd*s.qty:0),0);
  const unpriced=picked.some(s=>s.price_usd==null);
  document.getElementById('res-shop-total').textContent=(total?'$'+Math.round(total):'$0')+(unpriced?'+':'');
  const asOf=priceAsOf();
  const note=document.getElementById('res-price-asof');
  if(note) note.textContent=(asOf?`Prices approximate, checked ${asOf}. Links open the retailer's page.`:'')
    +(affiliatesConfigured()?' '+AFFILIATE_DISCLOSURE:'');
}
/* Practical, real tips matched to what each step asks the user to do */
const TIP_RULES=[
  [/expired|duplicate|donate|toss|purge|trash|edit/i,'Use three piles: keep, donate, trash. Set a 10 minute timer. Decisions get faster after the first few items.'],
  [/empty|pull everything|dump|unload|one wall at a time|one zone at a time/i,'Lay a towel or sheet on the floor first and unload onto it. The mess stays contained and easy to sort.'],
  [/group|sort|similar|categor/i,'Do not aim for perfect categories. If two things get used together, store them together. You can refine later.'],
  [/heavy/i,'Keep heavy items between knee and waist height, and slide them along the shelf instead of lifting when you can.'],
  [/label/i,'Masking tape and a marker work as well as a label maker. Label the shelf edge, not the container, so swaps stay easy.'],
  [/basket|bin|container|tray|caddy/i,'Measure shelf depth before assigning a bin, and leave a finger of space so it slides out easily.'],
  [/top shelf|bulk|overflow|up high|rarely/i,'Use the step stool rule: anything you need a stool for should be something you use less than once a month.'],
  [/rod|hang/i,'Hang items by length. Short items together free up the floor or shelf space underneath them.'],
  [/shoe/i,'Store one of each pair toe out and heel out. You see both the front and the size at a glance.'],
  [/fold/i,'Fold on a flat surface, not in the air. Stacks come out even and stay standing.'],
  [/photo/i,'Take it from the same angle as your before photo. The comparison is worth it, and it helps the system stick.'],
  [/coil|cable/i,'Coil each cable around your hand, then clip or tie it. Coiled cables take a quarter of the space.'],
  [/zone|assign|home/i,'Say each zone out loud as you finish it. Naming the spot helps the whole household remember it.'],
];
function tipFor(s){
  const hay=(s.t+' '+(s.w||''));
  for(const [re,tip] of TIP_RULES){ if(re.test(hay)) return tip; }
  return 'Finish one shelf completely before starting the next. Small finished wins keep you going.';
}

/* ---------- Animated step illustrations ----------
   Each step gets a small looping motion graphic matched to what the
   step asks for, so the checklist reads at a glance. Classification lives in
   stepMedia.js so the produced-clip pipeline and these fallback scenes can
   never disagree; these inline SVGs are the spec the real clips must match,
   and the runtime fallback whenever a clip isn't produced yet. */
const A_WRAP=(cls,inner)=>`<svg class="sa sa-${cls}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const STEP_ART={
  purge:A_WRAP('purge',`<rect x="4" y="31" width="11" height="11" rx="2"/><rect x="18.5" y="31" width="11" height="11" rx="2"/><rect x="33" y="31" width="11" height="11" rx="2"/>
    <rect class="d1" x="6.5" y="8" width="7" height="7" rx="1.5"/><rect class="d2" x="20.5" y="6" width="7" height="7" rx="1.5"/><rect class="d3" x="35" y="9" width="7" height="7" rx="1.5"/>`),
  unload:A_WRAP('unload',`<path d="M8 30v10a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2V30"/><path d="M6 30h36"/>
    <rect class="u1" x="13" y="20" width="8" height="8" rx="1.5"/><rect class="u2" x="27" y="20" width="8" height="8" rx="1.5"/>`),
  wipe:A_WRAP('wipe',`<path d="M6 36h36"/><rect class="w-dust" x="8" y="28" width="32" height="6" rx="2"/><circle class="w-pad" cx="12" cy="24" r="6"/>`),
  label:A_WRAP('label',`<rect x="9" y="16" width="30" height="24" rx="3"/><rect class="l-tag" x="16" y="24" width="16" height="8" rx="1.5"/><path class="l-line" d="M19 28h10"/>`),
  hang:A_WRAP('hang',`<path d="M4 12h40"/><g class="h1"><path d="M18 12v4"/><path d="M12 20l6-4 6 4"/><path d="M12 20v14h12V20"/></g><g class="h2"><path d="M34 12v4"/><path d="M29 20l5-4 5 4"/><path d="M29 20v8h10v-8"/></g>`),
  fold:A_WRAP('fold',`<path d="M8 40h32"/><rect x="12" y="28" width="24" height="12" rx="2"/><rect class="f-flap" x="12" y="16" width="24" height="12" rx="2"/>`),
  photo:A_WRAP('photo',`<rect x="8" y="14" width="32" height="24" rx="4"/><circle cx="24" cy="26" r="6"/><path d="M18 14l2.5-4h7L30 14"/><circle class="p-flash" cx="24" cy="26" r="3"/>`),
  contain:A_WRAP('contain',`<path d="M10 26h28l-3 14a3 3 0 0 1-3 2.4H16a3 3 0 0 1-3-2.4z"/><rect class="c1" x="14" y="8" width="8" height="8" rx="1.5"/><rect class="c2" x="27" y="8" width="8" height="8" rx="1.5"/>`),
  moveUp:A_WRAP('up',`<path d="M8 12h32M8 38h32"/><rect class="m-box" x="19" y="27" width="10" height="10" rx="1.5"/><path class="m-arrow" d="M38 32v-12M34 24l4-4 4 4"/>`),
  moveDown:A_WRAP('down',`<path d="M8 12h32M8 38h32"/><rect class="m-box2" x="19" y="13" width="10" height="10" rx="1.5"/><path class="m-arrow" d="M38 18v12M34 26l4 4 4-4"/>`),
  zones:A_WRAP('zones',`<rect x="8" y="8" width="32" height="32" rx="3"/><rect class="z1" x="12" y="12" width="24" height="7" rx="1.5"/><rect class="z2" x="12" y="21" width="24" height="7" rx="1.5"/><rect class="z3" x="12" y="30" width="24" height="7" rx="1.5"/>`),
  group:A_WRAP('group',`<circle class="g1" cx="12" cy="14" r="4.5"/><circle class="g2" cx="36" cy="12" r="4.5"/><circle class="g3" cx="10" cy="36" r="4.5"/><circle class="g4" cx="38" cy="34" r="4.5"/>`),
  done:A_WRAP('done',`<circle cx="24" cy="24" r="17"/><path class="dn-check" d="M15 24.5l6.5 6.5L33 18"/>`),
};

export function renderSteps(list){
  const wrap=document.getElementById('res-steps'); wrap.innerHTML='';
  state.stepDone=new Array(list.length).fill(false);
  list.forEach((s,i)=>{
    const t=document.createElement('div'); t.className='task'; t.id='task-'+i;
    const art=STEP_ART[classifyAction(s)]||STEP_ART.done;
    t.innerHTML=`
      <button class="check" onclick="toggleStep(${i})">${ICON.check}</button>
      <div>
        <span class="step-art" data-step-media="${mediaKeyFor(s, state.space)}">${art}</span>
        <div class="num">Step ${i+1}</div>
        <div class="tname">${escapeHtml(s.t)}</div>
        <div class="meta"><span class="time">${SVG.clock} ${escapeHtml(s.m)}</span></div>
        <div class="why2"><strong>Why:</strong> ${escapeHtml(s.w)}</div>
        <div class="acts">
          <button class="mark" onclick="toggleStep(${i})">Mark complete</button>
          <button onclick="skipStep(${i})">Skip</button>
          <button onclick="toggleStepTip(${i})">Need help?</button>
        </div>
        <div class="step-tip hide" id="step-tip-${i}">${ICON.why}<span>${escapeHtml(tipFor(s))}</span></div>
      </div>`;
    wrap.appendChild(t);
  });
  state.stepCount=list.length;
  updateProgress();
  setStepsView(state.stepsView||'all');
  // Upgrade scenes to produced clips where they exist (lazy, in-view only);
  // fire-and-forget — the inline SVGs above are already the full experience.
  hydrateStepMedia(wrap).catch(()=>{});
}
export function toggleStepTip(i){
  const el=document.getElementById('step-tip-'+i);
  if(el) el.classList.toggle('hide');
}

/* ---------- "One at a time" focus mode for the checklist ---------- */
let focusIdx=0;
function firstOpenStep(){
  const i=(state.stepDone||[]).findIndex(d=>!d);
  return i<0 ? Math.max(0,(state.stepCount||1)-1) : i;
}
function focusShow(i){
  focusIdx=Math.max(0, Math.min((state.stepCount||1)-1, i));
  document.querySelectorAll('#res-steps .task').forEach((t,k)=>t.classList.toggle('current', k===focusIdx));
  const pos=document.getElementById('focus-pos');
  if(pos) pos.textContent='Step '+(focusIdx+1)+' of '+state.stepCount;
  const prev=document.getElementById('focus-prev');
  if(prev) prev.disabled = focusIdx===0;
  const done=document.getElementById('focus-done');
  if(done){
    const last=focusIdx===state.stepCount-1;
    done.textContent = state.stepDone[focusIdx]
      ? (last ? 'All done' : 'Next step →')
      : (last ? 'Complete' : 'Complete and next →');
  }
}
export function setStepsView(v){
  state.stepsView=v;
  const ch=document.getElementById('ch-steps');
  if(ch) ch.classList.toggle('focus-mode', v==='focus');
  document.querySelectorAll('.steps-toggle button').forEach(b=>b.classList.toggle('sel', b.dataset.v===v));
  if(v==='focus') focusShow(firstOpenStep());
}
export function focusNav(d){ focusShow(focusIdx+d); }
export function focusDone(){
  if(!state.stepDone[focusIdx]) toggleStep(focusIdx);
  focusShow(focusIdx < state.stepCount-1 ? focusIdx+1 : focusIdx);
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
  // Cap chips per shelf and keep rows single-line so switching modes never
  // changes the drawing's size — only its contents.
  const MAXC=4;
  cab.innerHTML=map.map((m,ri)=>{
    let items=parseZone(m.zone);
    const isLast=ri===map.length-1;
    let shelfCls='', tag='';
    if(m.eye){ shelfCls=' eye'; tag='<span class="cab-tag eyet">eye level</span>'; }
    if(mode==='Minimal look') items=items.slice(0,2);
    if(mode==='Kid-friendly setup' && isLast){ shelfCls=' kid'; tag='<span class="cab-tag kidt">kid reach</span>'; }
    let row;
    if(mode==='Hidden storage'){
      const n=Math.min(MAXC, Math.max(1,Math.ceil(items.length/2)));
      row=Array.from({length:n}).map(()=>`<span class="cab-item bin">${SVG.shoppingBag}<span class="nm">Basket</span></span>`).join('');
    }else{
      const extra=Math.max(0, items.length-MAXC);
      row=items.slice(0,MAXC).map(it=>{
        const c=AFTER_PALETTE[(colorI++)%AFTER_PALETTE.length];
        const bin=(mode==='More bins');
        const label=(mode==='More labels')?`<span class="lbl">${escapeHtml(it).slice(0,10)}</span>`:'';
        const lead=bin?SVG.archive:`<span class="sw" style="background:${c}"></span>`;
        return `<span class="cab-item${bin?' bin':''}">${lead}<span class="nm">${escapeHtml(it)}</span>${label}</span>`;
      }).join('')+(extra?`<span class="cab-item more"><span class="nm">+${extra} more</span></span>`:'');
    }
    if(!row) row='<span class="cab-item"><span class="nm" style="color:var(--ink-3)">open</span></span>';
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
