import { MAP, EXISTING, STEPS, UPGRADES, AFTER_MODES, AFTER_PALETTE } from '../data.js';
import { SVG, ICON } from '../icons.js';
import { state } from '../state.js';
import { escapeHtml, toast } from '../ui.js';
import { AI } from '../ai.js';
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
  if(byline) byline.textContent = A
    ? 'Analyzed by Claude · '+AI.model.replace('claude-','').replace(/-/g,' ')
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

  // map
  const mapData = (A&&A.map.length)?A.map:MAP;
  document.getElementById('res-map').innerHTML=mapData.map(m=>`
    <div class="shelf ${m.eye?'eye':''}">
      <div class="label"><span class="lv">${escapeHtml(m.lv)}</span><span class="ic">${m.ic}</span></div>
      <div class="body"><div class="zone">${escapeHtml(m.zone)}</div>
        <div class="why">${ICON.why}<span>${escapeHtml(m.why)}</span></div></div>
    </div>`).join('');

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

  // upgrades
  if(!state.upgradeChecked || state.upgradeChecked.length!==UPGRADES.length){
    state.upgradeChecked=UPGRADES.map(()=>true);
  }
  renderUpgrades();
  setUpgrades(state.upgrades);
}
export function renderUpgrades(){
  document.getElementById('res-upgrades').innerHTML=UPGRADES.map((u,i)=>`
    <div class="prod${state.upgradeChecked[i]?'':' excluded'}">
      <input type="checkbox" ${state.upgradeChecked[i]?'checked':''} onchange="toggleUpgrade(${i})" aria-label="Include ${escapeHtml(u.h)} in shopping list">
      <span class="pic">${u.pic}</span>
      <div><h4>${u.h}</h4><div class="pwhy">${u.why}</div>
        <div class="pmeta"><span>${SVG.mapPin} ${u.where}</span><span>${u.dim?SVG.ruler+' Measure first':SVG.check.replace('stroke-width="3"','stroke-width="2" width="12" height="12"')+' No dimensions needed'}</span></div>
      </div>
      <span class="cost">${u.cost}</span>
    </div>`).join('');
  renderShopping();
}
export function toggleUpgrade(i){
  state.upgradeChecked[i]=!state.upgradeChecked[i];
  document.querySelectorAll('#res-upgrades .prod')[i].classList.toggle('excluded',!state.upgradeChecked[i]);
  renderShopping();
}
export function uncheckAllUpgrades(){
  state.upgradeChecked=UPGRADES.map(()=>false);
  renderUpgrades();
  toast('All upgrades removed — you\'re on the $0 plan');
}
export function renderShopping(){
  const picked=UPGRADES.filter((u,i)=>state.upgradeChecked[i]);
  const list=document.getElementById('res-shopping');
  list.innerHTML=picked.length?picked.map(u=>`<li><span>${u.h}</span><span class="qcost">${u.cost}</span></li>`).join(''):
    '<li><span class="muted">No items selected — you\'re on the $0 plan.</span></li>';
  const total=picked.reduce((sum,u)=>sum+(parseInt(u.cost.replace(/\D/g,''),10)||0),0);
  document.getElementById('res-shop-total').textContent=total?('$'+total):'$0';
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
