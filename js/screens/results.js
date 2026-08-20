import { MAP, EXISTING, STEPS, AFTER_MODES, AFTER_PALETTE, DEMO_FEATURES, DEMO_CATS } from '../data.js';
import { SVG, ICON } from '../icons.js';
import { state, persistGuestDraft, isMetric, currentPlanInstance, planInstanceIsCurrent } from '../state.js';
import { escapeHtml, toast } from '../ui.js';
import { activeSafetyNotes, activeProductNeeds, activeGeometry, renderZones, modelLabel } from '../plan.js';
import { areaFor, art, fmtFt, fmtIn, optionsForHousehold } from '../wizard-data.js';
import { loadCatalog, matchProducts, fitBadge, searchLinks, priceAsOf, TYPE_LABEL } from '../catalog.js';
import { withAffiliate, affiliateRel, affiliatesConfigured, AFFILIATE_DISCLOSURE } from '../affiliates.js';
import { backendConfigured } from '../config.js';
import { renderAfter as renderAfterApi, renderAfterErrorMessage } from '../api.js';
import { fileToScaledB64 } from '../media.js';
import { getSession } from '../auth.js';
import { updateSpacePatch, persistAnswers } from '../db.js';
import { classifyAction, motifForSpace, glyphForStep, mediaKeyFor, hydrateStepMedia } from '../stepMedia.js';
import { track } from '../telemetry.js';
import { applyCategoryEdits } from '../personalize.js';
import { go } from '../router.js';
import { runLoading } from './loading.js';
import { buildRate } from './feedback.js';

/* ---------- Results ---------- */
export function buildResults(){
  const A=state.ai;
  state.features=((A&&A.features.length)?A.features:DEMO_FEATURES).slice();
  // The contents step is authoritative when the user engaged with it;
  // otherwise the plan's own detected categories stand.
  if(!state.catsTouched || !state.cats.length){
    /* DEMO_CATS only when there is no plan at all. A real analysis that
       returned no categories used to print twelve pantry ones — "Snacks",
       "Canned goods", "Pasta & grains" — under a heading claiming they were
       detected, with the KPI reading "12 found". Same rule as the problems and
       opportunities lists below: a plan that exists speaks for itself, even
       when what it says is nothing. */
    state.cats=(A ? (A.cats||[]) : DEMO_CATS).slice();
  }
  const isRealAi = A && state.planMeta && state.planMeta.source==='ai';
  // AI badge on results title
  const badge=document.getElementById('res-ai-badge');
  if(badge) badge.style.display = isRealAi ? 'inline-flex' : 'none';

  // report masthead + byline
  // A shared plan carries its own space type; state.space is deliberately null
  // there, and areaFor(null) would illustrate a closet with a pantry.
  const resultArea=areaFor(state.space || state.sharedSpaceId);
  const spaceLabel = A ? A.spaceType : resultArea.label;
  const mastSpace=document.getElementById('mast-space');
  if(mastSpace) mastSpace.textContent = spaceLabel;
  const resTitle=document.getElementById('res-title');
  if(resTitle) resTitle.textContent = `The ${spaceLabel.toLowerCase()}, with a place for everything`;
  const hero=document.getElementById('plan-hero-img');
  if(hero){
    const svg=art(resultArea.artKey).replace('aria-hidden="true"','role="img"');
    hero.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    hero.alt=`Illustrated ${resultArea.label.toLowerCase()} organization plan`;
    hero.dataset.space=resultArea.id;
    // The figure carries the "Walk through it in 3D" button, so a failed load
    // earlier in the session must not keep it hidden once a good illustration
    // is in place — the onerror handler puts "hide" back if this one fails too.
    hero.closest('.plan-hero-photo').classList.remove('hide');
    hero.closest('.plan-hero-photo').classList.add('illustrated');
  }
  const mastDate=document.getElementById('mast-date');
  if(mastDate) mastDate.textContent = new Date().toLocaleString('en-US',{month:'long',year:'numeric'});
  const byline=document.getElementById('res-byline');
  const model=(state.planMeta&&state.planMeta.model)||'';
  /* "based on your selections" is true of a plan built from the wizard and
     false of the landing page's sample, which is opened by someone who has
     made no selections at all. The three states are different claims and now
     read as three different lines. */
  const isSample = !isRealAi && state.planMeta && state.planMeta.source==='demo'
    && !state.setupTouched && !state.catsTouched && !state.shoppingTouched;
  if(byline) byline.textContent = isRealAi
    ? 'Analyzed by Claude'+(modelLabel(model)?' · '+modelLabel(model):'')
    : (isSample ? 'Sample plan · not based on your space'
                : 'Personalized plan · based on your selections');

  // masthead answer chips: setup + measurements, household, effort — the
  // wizard's answers round-tripped onto the plan (design contract)
  const g=activeGeometry();
  const chipDims=document.getElementById('chip-dims');
  if(chipDims) chipDims.textContent=[state.setupLabel, fmtFt(g.width/12)+' × '+fmtFt(g.height/12)]
    .filter(Boolean).join(' · ');
  const chipHh=document.getElementById('chip-household');
  if(chipHh){
    const h=state.household;
    const parts=[];
    if(h.adults) parts.push(h.adults+(h.adults===1?' adult':' adults'));
    if(h.kidCount) parts.push(h.kidCount+(h.kidCount===1?' kid':' kids'));
    if(h.petCount) parts.push(h.petCount+(h.petCount===1?' pet':' pets'));
    /* Mobility belongs here more than the counts do. A plan for a household
       with a reach limitation is built around it — the safety notes argue from
       it, the zones are placed for it — and the chip row listed "2 adults"
       while three safety notes cited reach the user had told us about. The
       answer that shaped the plan most was the one answer it did not show, so
       the plan read as though it had invented the constraint. */
    (h.mobility||[]).forEach(m=>parts.push(m));
    chipHh.textContent=parts.join(' · ');
    chipHh.style.display=parts.length?'':'none';
  }
  const chipEffort=document.getElementById('chip-effort');
  if(chipEffort){
    chipEffort.textContent=[state.effort, A?A.time:''].filter(Boolean).join(' · ');
    chipEffort.style.display=state.effort?'':'none';
  }

  // product-click intent, delegated so it survives re-renders of the list
  // (property assignment keeps this idempotent across buildResults calls)
  /* A user who said they are open to buying, given a plan with $118 of
     recommendations, reported seeing "no product options to purchase" — the
     chapter renders collapsed, so the whole list sits behind a click nobody
     knows to make. A section with nothing in it stays folded; a section with
     something to buy opens itself. */
  const shopCh=document.getElementById('ch-shop');
  if(shopCh){
    const hasNeeds=(activeProductNeeds()||[]).length>0 && state.upgrades;
    shopCh.classList.toggle('collapsed', !hasNeeds);
    const head=shopCh.querySelector('.ch-head');
    if(head) head.setAttribute('aria-expanded', hasNeeds?'true':'false');
  }

  const upWrap=document.getElementById('res-upgrades');
  if(upWrap) upWrap.onclick=(e)=>{
    const a=e.target.closest('a[href]');
    if(!a) return;
    let retailer='unknown';
    try{ retailer=new URL(a.href).hostname.replace(/^www\./,''); }catch(_){}
    track('product_clicked', { retailer, productType:a.classList.contains('pname')?'pick':'search' });
  };

  // read-only share view: banner up top, owner-only actions hidden, and all
  // persistence already blocked (shareView guards the guest-draft writer;
  // activeSpaceId is null so server patches never fire)
  const shareNote=document.getElementById('res-share-note');
  if(shareNote){
    shareNote.classList.toggle('hide', !state.shareView);
    if(state.shareView){
      /* The second sentence is CONSTANT, and that is the point of it. A
         visitor reading a plan with no safety section would otherwise take it
         for a plan that needed none; saying so only when notes were removed
         would itself disclose that this household has some. It reads the same
         on every shared plan, so it says nothing about this one. */
      shareNote.textContent=`You’re viewing “${state.sharedName||'a shared plan'}” — a read-only plan someone shared with you. Checking off steps here won’t change their copy. Shared plans leave out everything about the owner’s household, including any safety notes written for it, so ask them if that matters here.`;
    }
  }
  document.querySelectorAll('#screen-results [data-owner-only]')
    .forEach(b=>b.classList.toggle('hide', !!state.shareView));

  // analysis-failed banner: their photo may be up top, but the plan used demo fallback
  const fb=document.getElementById('res-fallback-note');
  if(fb){
    const showFallback = state.aiError && state.planMeta && state.planMeta.source==='demo-fallback';
    fb.classList.toggle('hide', !showFallback);
    if(showFallback) fb.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
      <div><strong>We couldn't analyze your photos this time.</strong> ${escapeHtml(state.aiError)}
      The plan below is based on your selections, not your photos.
      <a href="#" onclick="retryAnalysis();return false" style="text-decoration:underline;font-weight:600">Retry analysis</a>
      · <a href="#" onclick="restart();return false" style="text-decoration:underline">Start over</a></div>`;
  }

  // summary: first sentence as the lede, the rest as scannable bullets
  const sumText = A ? A.summary :
    'We detected snacks, canned goods, spices, baking supplies, breakfast items, paper goods, and overflow items. The main issue is that similar items are spread across multiple shelves, daily-use items are mixed with rarely used items, and vertical space is underused.';
  const sents=sumText.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
  const sumPoints=document.getElementById('res-summary-points');
  /* The lede is the opening sentence, which is built from the measurements the
     user typed and is a statement of fact. The bullets after it describe the
     contents of the space — and with no photo, nothing looked at it, so they
     describe a space like theirs rather than theirs. Say which. */
  const unobserved = !!(A && A.observed === false);
  const sumTitle=document.getElementById('res-summary-points-title');
  if(sumTitle){
    sumTitle.textContent = unobserved ? 'What a space like this usually looks like' : '';
    sumTitle.classList.toggle('hide', !unobserved || sents.length<3);
  }
  if(sents.length>=3){
    document.getElementById('res-summary').textContent=sents[0];
    if(sumPoints) sumPoints.innerHTML=sents.slice(1).map(s=>`<li>${escapeHtml(s)}</li>`).join('');
  }else{
    document.getElementById('res-summary').textContent=sumText;
    if(sumPoints) sumPoints.innerHTML='';
  }
  /* "N found" and "Detected item categories" describe a photo being read. Two
     separate things can make that untrue, and only one of them was checked.

     `unobserved` covers "there was no photo". It does not cover "there was a
     photo, but this list is not what came back from it" — and on the real
     backend that is the normal case: buildResults above keeps the user's own
     taps whenever they engaged with the contents step, and discards the
     model's categories entirely. So a reader who ticked three chips saw
     "Categories 3 found" under "Detected item categories", with none of the
     model's actual detections anywhere on the page.

     Observation is only claimed when a photo was read AND the list is the
     photo's. */
  const catsAreTheirs = !!state.catsTouched;
  const catsObserved = !unobserved && !catsAreTheirs;
  // kpis
  const kpis=[
    ['Space type', A?A.spaceType:'Pantry'],
    ['Categories', state.cats.length + (catsObserved ? ' found' : ' listed')],
    ['Time', A?A.time:'45–90 min'],['Cost', costLabel()]
  ];
  document.getElementById('res-kpis').innerHTML=kpis.map(([k,v])=>`<div class="kpi"><div class="k">${escapeHtml(k)}</div><div class="v"${k==='Cost'?' id="kpi-cost"':''}>${escapeHtml(v)}</div></div>`).join('');
  const catTags=document.getElementById('res-cat-tags');
  catTags.innerHTML=state.cats.map(c=>`<span class="tag">${escapeHtml(c)}</span>`).join('');
  /* No categories is a real answer now that an empty list is no longer filled
     in. An empty chip row under a heading is worse than no section. */
  catTags.classList.toggle('hide', !state.cats.length);
  const catTitle=document.getElementById('res-cat-title');
  if(catTitle) catTitle.classList.toggle('hide', !state.cats.length);
  if(catTitle) catTitle.textContent = catsObserved ? 'Detected item categories' : 'Item categories you told us about';
  /* The sample lists below stand in for a plan that has not been built yet.
     On a SHARED plan they would be something else: sentences nobody wrote,
     rendered to a visitor as the owner's findings about their own space. The
     hole is reachable now that get-shared-space removes any line naming the
     household — a plan whose only opportunity was the household's note comes
     through with an empty list — but a plan that simply came back without
     problems always had it. Empty stays empty for a visitor. */
  /* `A ? [] : list` — a plan that EXISTS and returned nothing gets nothing.
     The guard used to be `A && A.problems.length`, so an empty list from a real
     analysis took the fallback: a garage plan that came back with no problems
     printed six invented pantry ones under "Main organization problems". The
     share view was protected by `sample()` and the owner's view was not, which
     is backwards — the owner is the one who can tell it is wrong, and the one
     being lied to about their own space.

     This is the rule activeProductNeeds() already applies in plan.js: only a
     MISSING plan gets the sample. */
  const sample = (list) => ((state.shareView || A) ? [] : list);
  const problems = (A&&A.problems.length)?A.problems:sample([
    'Similar items are spread across multiple shelves','Frequently used snacks are too high',
    'Canned goods are hard to see','Loose packets are creating clutter',
    'Bulk items are taking up prime shelf space','Heavy items should be moved lower']);
  document.getElementById('res-problems').innerHTML=problems.map(p=>`<li>${escapeHtml(p)}</li>`).join('');
  const opps = (A&&A.opportunities.length)?A.opportunities:sample([
    'Existing baskets are underused','Unused vertical space above the cans',
    'Right-side open shelf space is free','Lower shelf can safely hold heavy items']);
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
        <div class="why">${ICON.why}<span>${escapeHtml(m.why)}</span></div>${safetyWhy}${itemsRow(m)}</div>
    </div>`;
  }).join('');

  /* Say whose space these problems belong to. Without a photo nothing looked at
     the user's room, so "Main organization problems" claims findings the app
     never made — the list is what typically goes wrong in a space of this kind.
     A plan built from a real photo keeps the original title. */
  const problemsTitle = document.getElementById('res-problems-title');
  if (problemsTitle) {
    problemsTitle.textContent = (A && A.observed === false)
      ? 'What usually goes wrong in a space like this'
      : 'Main organization problems';
  }

  /* Reuse section. These fell back to pantry copy — "two baskets, one deep
     bin… above the cans" and "your two baskets and deep bin already cover
     snacks, breakfast, and overflow". That fallback fires exactly when
     projectOntoArchetype has blanked the real lede for naming a surface the
     setup lacks, so a garage rack and a rolling tool chest were the two setups
     most likely to show it — and they did. A generic sentence is honest for
     every space; saying nothing is better than saying something about someone
     else's pantry. */
  const lede = (A && A.existingLede) || '';
  const ledeEl = document.getElementById('res-existing-lede');
  ledeEl.textContent = lede || 'Start with what is already in the space — the plan below puts it to work before it asks you to buy anything.';
  /* Same trap as the lede above, one level down: when every reuse card was
     filtered out for naming a fitting this setup lacks, the grid fell back to
     the pantry defaults — so a workbench plan advised reusing "2 baskets… for
     snacks and breakfast items". Show the real cards or show none; the section
     still has its lede either way. */
  const existingData = (A && A.existing && A.existing.length) ? A.existing
    : (A ? [] : EXISTING);
  const existingWrap = document.getElementById('res-existing');
  existingWrap.innerHTML=existingData.map(e=>`
    <div class="feat"><span class="fi">${e.ico}</span><div><span class="ft">${escapeHtml(e.ft)}</span><span class="fd">${escapeHtml(e.fd)}</span></div></div>`).join('');
  existingWrap.classList.toggle('hide', !existingData.length);
  const dontBuy = (A && A.dontBuy) || '';
  // No generic substitute here: "what not to buy yet" is only useful when it
  // names something. Hide the callout rather than invent advice.
  document.getElementById('res-dontbuy').textContent = dontBuy;
  const dbWrap = document.getElementById('res-dontbuy').closest('.callout');
  if (dbWrap) dbWrap.classList.toggle('hide', !dontBuy);

  // steps
  renderSteps((A&&A.steps.length)?A.steps:STEPS);

  // after tabs
  const at=document.getElementById('after-tabs'); at.innerHTML='';
  // "Kid-friendly setup" is meaningless for a household that told us it has no
  // kids, and offering it here undoes the answer they gave in the wizard.
  const afterModes=optionsForHousehold(AFTER_MODES, state.household);
  if(!afterModes.includes(state.afterMode)) state.afterMode=afterModes[0];
  afterModes.forEach(m=>{
    const b=document.createElement('button'); b.className='after-tab'+(m===state.afterMode?' sel':''); b.textContent=m;
    b.onclick=()=>{ state.afterMode=m; at.querySelectorAll('.after-tab').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); renderAfter(m); };
    at.appendChild(b);
  });
  renderAfter(state.afterMode);

  // upgrades / shopping — catalog-matched, dimension-aware.
  // The catalog is a separate fetch, so this section is empty until it lands
  // and then N product rows drop in at once. Reserve the space first, and give
  // the wait an end: loadCatalog swallows its own errors into an empty list, so
  // without this the section would sit blank under a visible heading forever.
  setUpgrades(state.upgrades);
  showUpgradesSkeleton();
  loadCatalog()
    .then(()=>{ initShopping(); renderUpgrades(); })
    .catch(()=>{ showUpgradesFailed(); });

  // photorealistic before/after (only when we have the user's photo)
  setupAfterPhoto();

  // the pay-for-it question, asked here because nobody reaches the screen
  // that used to be its only home
  buildRate();

  initTocSpy();
}

/* The chapter nav has always had a styled "current chapter" state that nothing
   ever switched on. Four of the six chapters now start folded, so knowing where
   you are — and being able to open a chapter straight from the nav — is what
   makes the folding safe rather than hiding things. */
let tocSpy=null;
function initTocSpy(){
  const nav=document.querySelector('.report-toc');
  if(!nav) return;
  const links=[...nav.querySelectorAll('a[href^="#ch-"]')];
  if(!links.length) return;

  // Opening from the nav also unfolds the chapter, otherwise the link jumps to
  // a heading with nothing under it.
  nav.onclick=(e)=>{
    const a=e.target.closest('a[href^="#ch-"]');
    if(!a) return;
    const ch=document.querySelector(a.getAttribute('href'));
    if(!ch) return;
    if(ch.classList.contains('collapsed')){
      ch.classList.remove('collapsed');
      const head=ch.querySelector('.ch-head');
      if(head) head.setAttribute('aria-expanded','true');
    }
  };

  if(tocSpy) tocSpy.disconnect();
  if(typeof IntersectionObserver!=='function') return;
  const mark=(id)=>links.forEach(a=>{
    const on=a.getAttribute('href')==='#'+id;
    a.classList.toggle('here', on);
    if(on) a.setAttribute('aria-current','true'); else a.removeAttribute('aria-current');
  });
  const seen=new Map();
  tocSpy=new IntersectionObserver((entries)=>{
    entries.forEach(en=>seen.set(en.target.id, en));
    // the topmost chapter currently on screen wins
    const visible=[...seen.values()].filter(en=>en.isIntersecting)
      .sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
    if(visible.length) mark(visible[0].target.id);
  }, { rootMargin:'-25% 0px -60% 0px', threshold:0 });
  links.forEach(a=>{
    const ch=document.querySelector(a.getAttribute('href'));
    if(ch) tocSpy.observe(ch);
  });
}

/* ---------- Photorealistic after-render (Gemini via edge function) ---------- */
function beforePhotoSrc(){
  if(state._beforeUrl){ try{ URL.revokeObjectURL(state._beforeUrl); }catch(_){} state._beforeUrl=null; }
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
  if(!beforeUrl){
    // No photo, nothing to advertise: the flag must not outlive the block.
    const noFlag=document.getElementById('after-chapter-flag');
    if(noFlag) noFlag.classList.add('hide');
    return;
  }
  const slider=document.getElementById('ba-slider');
  const genRow=document.getElementById('after-gen-row');
  const disclaimer=document.getElementById('ba-disclaimer');
  /* The chapter this lives in ships folded, and a folded chapter renders
     nothing but its h3 — .ch-sub is display:none while collapsed. So the only
     way a reader learns the photo preview exists is a flag in the head. It was
     reported twice as "I do not see the AI photo option": the button was
     there, un-hidden and 0px tall inside a collapsed section. */
  const flag=document.getElementById('after-chapter-flag');
  if(flag) flag.classList.toggle('hide', !(afterUrl || backendConfigured()));
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

/* Which photo this render works from, decided synchronously. The encode is
   awaited; the CHOICE must not be, or a plan switch between the two picks the
   photo from one plan and everything around it from another. */
function beforePhotoSource(target=state){
  if(target.uploadedFiles && target.uploadedFiles.length) return { kind:'file', file:target.uploadedFiles[0] };
  if(target.frames && target.frames.length) return { kind:'frame', data:target.frames[0].data };
  if(target._beforeUrl) return { kind:'url', url:target._beforeUrl };
  return null;
}

async function encodeBeforePhoto(src){
  if(!src) throw new Error('No photo to work from.');
  if(src.kind==='file') return { media_type:'image/jpeg', data: await fileToScaledB64(src.file) };
  if(src.kind==='frame') return { media_type:'image/jpeg', data: src.data };
  const blob=await (await fetch(src.url)).blob();
  const data=await new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>res(String(fr.result).split(',')[1]);
    fr.onerror=rej;
    fr.readAsDataURL(blob);
  });
  return { media_type: blob.type||'image/jpeg', data };
}

export async function generateAfter(){
  const btn=document.getElementById('after-gen-btn');
  const note=document.getElementById('after-gen-note');
  btn.disabled=true;
  btn.innerHTML='Rendering&hellip; <span class="spin-ring" style="border-color:rgba(255,255,255,.5);border-right-color:transparent"></span>';
  note.textContent='This usually takes ten seconds or so.';
  /* Photo, instructions, space and plan id are all taken here, together,
     before the first await. The render used to await the encode and only then
     read buildGeminiBrief() and state.activeSpaceId, so opening another plan
     mid-encode sent one space's photo with another space's zone plan, billed
     it to the new space's row, and wrote the returned image onto whichever
     plan was on screen when it came back. Every one of those is a different
     plan's data crossing into this one. */
  const instance=currentPlanInstance();
  const source=beforePhotoSource();
  const zones=renderZones();
  const spaceId=state.activeSpaceId;
  const stillCurrent=()=>planInstanceIsCurrent(instance);
  try{
    const image=await encodeBeforePhoto(source);
    if(!stillCurrent()) return;
    const res=await renderAfterApi(image, zones, spaceId);
    // The preview belongs to the plan it was rendered for. A plan switch while
    // it was in flight means there is nothing here to write it to.
    if(!stillCurrent()) return;
    state.afterRenderB64=res.image.data;
    setupAfterPhoto();
    track('after_render_requested', { ok:true });
    toast('Photo preview ready — drag the slider');
  }catch(e){
    track('after_render_requested', { ok:false });
    // The note sits on the plan that failed. Another plan's screen must not
    // inherit its error message.
    if(stillCurrent()) note.textContent=renderAfterErrorMessage(e);
  }finally{
    /* The button is restored either way: it belongs to the report, and
       leaving it spinning would strand whichever plan is on screen now. */
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
  if(valid){
    state.shopping.forEach((selection,i)=>{
      const need=needs[selection.needIdx]||needs[i];
      const match=matchProducts(need).find(entry=>entry.product.id===selection.productId);
      selection.type=need.type;
      if(match) selection.dims_in={...match.product.dims_in};
    });
    return;
  }
  state.shopping=needs.map((need,i)=>{
    const top=matchProducts(need).filter(m=>m.fit!=='no-fit')[0];
    return {
      needIdx:i, checked:true, qty:need.qty,
      type:need.type,
      productId: top?top.product.id:null,
      name: top?top.product.name:TYPE_LABEL[need.type],
      price_usd: top?top.product.price_usd:null,
      url: top?top.product.url:null,
      retailer: top?top.product.retailer:null,
      img: top?(top.product.img||null):null,
      fit: top?top.fit:'unknown',
      dims_in:top?{...top.product.dims_in}:null,
    };
  });
}

/* Append a product need the user asked for, keeping state.shopping in step.

   initShopping treats a length mismatch between needs and selections as "this
   is stale, rebuild it", and a rebuild discards every product the user picked.
   So the selection for the new need is built here, the same way initShopping
   builds the rest, rather than left for the next render to notice. */
export function addProductNeed(need){
  if(!state.ai) return false;
  const needs=state.ai.productNeeds=state.ai.productNeeds||[];
  /* normalizeAi caps productNeeds at 10, and a saved plan is re-normalized on
     load — so an eleventh item would appear, persist, and then quietly vanish
     the next time the plan was opened. Refuse it out loud instead. */
  if(needs.length>=10){
    toast('Your shopping list is full at 10 items. Remove one to add another.');
    return false;
  }
  needs.push(need);
  const top=matchProducts(need).filter(m=>m.fit!=='no-fit')[0];
  state.shopping=state.shopping||[];
  state.shopping.push({
    needIdx: needs.length-1, checked:true, qty:need.qty,
    type:need.type,
    productId: top?top.product.id:null,
    name: top?top.product.name:TYPE_LABEL[need.type],
    price_usd: top?top.product.price_usd:null,
    url: top?top.product.url:null,
    retailer: top?top.product.retailer:null,
    img: top?(top.product.img||null):null,
    fit: top?top.fit:'unknown',
    dims_in: top?{...top.product.dims_in}:null,
  });
  if(getSession()) updateSpacePatch({ plan: state.ai, shopping: state.shopping });
  else persistGuestDraft();
  // the cost tile and the list are both downstream of what just changed
  buildResults();
  return true;
}

function persistShopping(){
  if(getSession()) updateSpacePatch({shopping:state.shopping});
  else persistGuestDraft();
}

/* Placeholder rows shaped like the product rows that replace them, so the
   chapter does not grow under the reader while they are looking at it. Lives
   inside #res-upgrades itself: the shopping chapter's header sits in a wrapper
   rather than the chapter, so anything placed higher would not collapse with
   it. */
function showUpgradesSkeleton(){
  const wrap=document.getElementById('res-upgrades');
  if(!wrap) return;
  wrap.setAttribute('aria-busy','true');
  const row=`<li class="sk-prod">
      <span class="skeleton sk-thumb"></span>
      <span class="sk-lines">
        <span class="skeleton skeleton-text long"></span>
        <span class="skeleton skeleton-text short"></span>
      </span>
    </li>`;
  wrap.innerHTML=`<ul class="sk-list" aria-hidden="true">${row.repeat(3)}</ul>`;
}
function showUpgradesFailed(){
  const wrap=document.getElementById('res-upgrades');
  if(!wrap) return;
  wrap.removeAttribute('aria-busy');
  wrap.innerHTML='<p class="load-failed">We could not load the product list just now. '
    + 'The plan above is complete without it — everything it asks you to do uses what you already own.</p>';
}

export function renderUpgrades(){
  const needs=activeProductNeeds();
  document.getElementById('res-upgrades').removeAttribute('aria-busy');
  document.getElementById('res-upgrades').innerHTML=needs.map((need,i)=>{
    const sel=state.shopping[i];
    const options=matchProducts(need).filter(m=>m.fit!=='no-fit').slice(0,4);
    const badge=fitBadge(sel.fit);
    const links=searchLinks(need).map(l=>
      `<a href="${l.url}" target="_blank" rel="${affiliateRel(l.retailer)}" style="text-decoration:underline">${escapeHtml(l.retailer)}</a>`).join(' · ');
    const img=sel.img
      ?`<img src="${sel.img}" alt="" loading="lazy" onerror="this.parentElement.classList.add('noimg');this.remove()">`
      :'';
    const picker=options.length>1?`
      <label class="field" style="margin:10px 0 0"><span>Swap for a different product</span>
      <select onchange="pickProduct(${i},this.value)" style="padding:9px 11px;font-size:13px">
        ${options.map(o=>`<option value="${o.product.id}" ${o.product.id===sel.productId?'selected':''}>${escapeHtml(o.product.name.length>60?o.product.name.slice(0,57)+'…':o.product.name)} · $${o.product.price_usd}</option>`).join('')}
      </select></label>`:'';
    const main=sel.productId?`
      <a class="pname" href="${withAffiliate(sel.url, sel.retailer)}" target="_blank" rel="${affiliateRel(sel.retailer)}">${escapeHtml(sel.name)}</a>
      <div class="pretail">at ${escapeHtml(sel.retailer)}${badge.txt?` <span class="tag ${badge.cls}">${escapeHtml(badge.txt)}</span>`:''}</div>`:
      `<div class="pretail">No exact match in our catalog. Search: ${links}</div>`;
    return `
    <div class="prod${sel.checked?'':' excluded'}">
      <input type="checkbox" ${sel.checked?'checked':''} onchange="toggleUpgrade(${i})" aria-label="Include ${escapeHtml(TYPE_LABEL[need.type])} in shopping list">
      <span class="pic${img?'':' noimg'}">${img}<span class="pic-ico">${SVG[TYPE_ICON[need.type]]||SVG.box}</span></span>
      <div>
        <h4>${need.qty>1?need.qty+' × ':''}${escapeHtml(TYPE_LABEL[need.type])}${
          /* Everything else in this list is what the model recommended from the
             photos. An item the user added in the 3D view must not wear the
             same badge — the plan would be taking credit for their idea, and
             they would have no way to tell the two apart later. */
          need.addedByUser?'<span class="tag">you added this</span>'
            :(need.priority==='high'?'<span class="tag green">recommended</span>':'')}</h4>
        <div class="pwhy">${escapeHtml(need.purpose)}</div>
        ${main}
        <details class="pmore">
          <summary>Details &amp; other options</summary>
          <div class="pmeta">
            <span>${SVG.mapPin} ${escapeHtml(need.targetZone||'Anywhere')}</span>
            ${need.maxDims?`<span>${SVG.ruler} Max ${fmtIn(need.maxDims.w_in, isMetric())}w × ${fmtIn(need.maxDims.h_in, isMetric())}h × ${fmtIn(need.maxDims.d_in, isMetric())}d</span>`:''}
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
    type:need.type,
    productId:m.product.id, name:m.product.name, price_usd:m.product.price_usd,
    url:m.product.url, retailer:m.product.retailer, img:m.product.img||null, fit:m.fit,
    dims_in:{...m.product.dims_in},
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
/* The Cost tile used to print the scenario's own constant — "$0 / $45–85" —
   over a shopping list the app had pre-selected and pre-ticked to $153, on the
   same screen, and adjusting the plan did not move it. The two numbers now come
   from the same place: the products actually ticked. */
export function costLabel(){
  const picked=(state.upgrades ? (state.shopping||[]) : []).filter(s=>s.checked);
  if(!picked.length) return '$0';
  const total=picked.reduce((sum,s)=>sum+(s.price_usd!=null?s.price_usd*s.qty:0),0);
  const unpriced=picked.some(s=>s.price_usd==null);
  // Both options stay visible: the plan works at $0, and this is what the
  // selected products add to it.
  return '$0 / $'+Math.round(total)+(unpriced?'+':'');
}

function syncCostKpi(){
  const el=document.getElementById('kpi-cost');
  if(el) el.textContent=costLabel();
}

export function renderShopping(){
  syncCostKpi();
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

/* The things the plan says it saw on this level.

   Every map row already carries items[] with a name, a size and flags; the 3D
   view builds from them and normalizeAi preserves them, but the report
   referenced m.items exactly zero times. So the one place the app could show
   "here is what I identified in your photo" showed nine category chips
   instead, and the actual contents were carried all the way to the browser and
   never drawn. Hazard flags come along, because a row listing bleach should
   say so where the bleach is named. */
const ITEM_FLAG_LABEL={heavy:'heavy',chemical:'chemical',sharp:'sharp',fragile:'fragile'};
function itemsRow(m){
  const items=(m.items||[]).filter(it=>it&&it.name);
  if(!items.length) return '';
  const chips=items.map(it=>{
    const flags=(it.flags||[]).filter(f=>ITEM_FLAG_LABEL[f]);
    const title=flags.length?` title="${escapeHtml(flags.map(f=>ITEM_FLAG_LABEL[f]).join(', '))}"`:'';
    return `<span class="mi${flags.length?' mi-flag':''}"${title}>${escapeHtml(it.name)}</span>`;
  }).join('');
  /* "Items in this zone", not "identified here". applyCategoryEdits pushes the
     user's own contents-step taps into these same rows (personalize.js), so a
     reader who ticked "Camping gear" was shown it on a shelf as something the
     analysis had identified in their photo. The new name is true whichever
     source a chip came from. */
  return `<div class="map-items" aria-label="Items in this zone">${chips}</div>`;
}

/* ---------- Animated step illustrations ----------
   Each step gets a small looping motion graphic matched to what the step asks
   for, so the checklist reads at a glance. Classification lives in
   stepMedia.js so the produced-clip pipeline and these fallback scenes can
   never disagree; these inline SVGs are the spec the real clips must match,
   and the runtime fallback whenever a clip isn't produced yet.

   A scene is three things, and it used to be one. stepMedia already derives a
   MOTIF from the space (shelves, drawers, a closet rail, a garage bench) and a
   GLYPH from the step's own words (a can, a jar, a hanger, a tool) — that
   triple is the media key the produced clips are named for. The SVG fallback
   threw two thirds of it away and keyed on the action alone, so "Sort items
   into categories" was the same four circles in a pantry and in a garage, and
   the two steps either side of it in one plan were the same picture with a
   different caption. The furniture and the item are what make a step look like
   YOUR step, and both were already computed.

   So: a motif backdrop, drawn quiet, and the moving pieces built from the
   step's glyph. Same 48-unit box, same class names on the animated parts, so
   the keyframes in components.css keep working. */
const A_WRAP=(cls,inner)=>`<svg class="sa sa-${cls}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

/* Each glyph is drawn around its own bottom-centre so a scene can stand one on
   a surface by translating alone. 10 units tall: legible at 78px, still legible
   at the 68px the phone breakpoint uses. */
const GLYPH_ART={
  can:`<rect x="-4" y="-10" width="8" height="10" rx="1.5"/><path d="M-4 -7.2h8"/>`,
  jar:`<path d="M-4 -8v5.5a2.5 2.5 0 0 0 2.5 2.5h3a2.5 2.5 0 0 0 2.5-2.5V-8z"/><rect x="-3" y="-11" width="6" height="3" rx="1"/>`,
  bottle:`<path d="M-3 -7.5v5a2.5 2.5 0 0 0 2.5 2.5h1a2.5 2.5 0 0 0 2.5-2.5v-5z"/><path d="M-1.2 -7.5v-3.5h2.4v3.5"/>`,
  bag:`<path d="M-4.5 0l1.2-8h6.6l1.2 8z"/><path d="M-2 -8a2 2 0 0 1 4 0"/>`,
  plate:`<circle cx="0" cy="-5" r="5"/><circle cx="0" cy="-5" r="1.8"/>`,
  utensil:`<path d="M-2.5 0v-6.5"/><path d="M-2.5 -6.5v-4M-4.5 -10.5v3M-0.5 -10.5v3"/><path d="M2.5 0v-4"/><path d="M2.5 -4a2.2 2.2 0 0 0 0-6.5 2.2 2.2 0 0 0 0 6.5z"/>`,
  tool:`<path d="M0 0v-6"/><path d="M-4.5 -10.5h9v4h-9z"/>`,
  tote:`<rect x="-5" y="-8" width="10" height="8" rx="1.5"/><path d="M-2 -8v-2.5h4V-8"/>`,
  towel:`<rect x="-4" y="-9.5" width="8" height="9.5" rx="1.5"/><path d="M-4 -6h8"/>`,
  foldedclothes:`<rect x="-5" y="-4.5" width="10" height="4.5" rx="1.5"/><rect x="-5" y="-10" width="10" height="5" rx="1.5"/>`,
  shoe:`<path d="M-5.5 0v-2.5l3.5-1.5 2-3.5h1.6l.9 4 3 1.5V0z"/>`,
  hanger:`<path d="M0 -11.5v1.6"/><path d="M-5.5 -6l5.5-4.4 5.5 4.4z"/><rect x="-5" y="-5.5" width="10" height="5.5" rx="1.2"/>`,
};
/* Position and animation are separate elements on purpose: a CSS `transform`
   in a keyframe REPLACES the transform attribute, so animating the same node
   that carries translate(x y) would fling it to the origin mid-loop. */
const G=(glyph,x,y,cls='')=>`<g transform="translate(${x} ${y})"><g class="sa-it${cls?' '+cls:''}">${GLYPH_ART[glyph]||GLYPH_ART.tote}</g></g>`;
const GS=(glyph,x,y,scale)=>`<g transform="translate(${x} ${y}) scale(${scale})"><g class="sa-it">${GLYPH_ART[glyph]||GLYPH_ART.tote}</g></g>`;

/* The furniture. Every motif puts its working surface at y=41 so the scenes
   below can place an item the same way whatever space they are staged in;
   what differs is what stands above and behind it. */
/* A hanger drawn downward from the rod it hangs on, rather than upward from a
   surface it stands on — the one glyph whose anchor is its top. */
const HANGER_DOWN=`<path d="M0 3v2.2"/><path class="hg-bar" d="M-6.5 10l6.5-4.8 6.5 4.8z"/><rect class="hg-body" x="-5" y="11.5" width="10" height="11" rx="1.5"/>`;

const MOTIF_ART={
  shelves:`<g class="sa-fx"><path d="M5 41h38M5 22h38"/><path d="M7.5 41V12M40.5 41V12"/></g>`,
  drawers:`<g class="sa-fx"><path d="M5 41h38"/><rect x="9" y="7" width="30" height="9" rx="2"/><rect x="9" y="19" width="30" height="9" rx="2"/><path d="M20 11.5h8M20 23.5h8"/></g>`,
  rail:`<g class="sa-fx"><path d="M5 41h38"/><path d="M7 13h34"/><path d="M9 13V9.5M39 13V9.5"/></g>`,
  bench:`<g class="sa-fx"><path d="M5 41h38"/><path d="M9 41v5M39 41v5"/><rect x="11" y="7" width="26" height="12" rx="1.5"/><path d="M16 11h1M22 11h1M28 11h1M34 11h1M16 15.5h1M22 15.5h1M28 15.5h1M34 15.5h1"/></g>`,
};

/* One entry per action in stepMedia's ACTIONS. Each returns the moving layer
   for that action, built from this step's glyph. */
const SCENES={
  // items leave the shelf and are gone — the inverse of `stock`
  purge:(g)=>`${G(g,13,40,'d1')}${G(g,24,40,'d2')}${G(g,35,40,'d3')}`,
  // everything comes off, all at once, before the work starts
  unload:(g)=>`${G(g,16,40,'u1')}${G(g,32,40,'u2')}`,
  wipe:()=>`<rect class="w-dust" x="9" y="34.5" width="30" height="6" rx="2"/><g class="w-pad"><rect x="7" y="26" width="12" height="7.5" rx="3"/></g>`,
  label:(g)=>`${G(g,24,40)}<g class="l-tag"><rect x="16" y="18" width="16" height="9.5" rx="2"/><path class="l-line" d="M20 22.8h8"/></g>`,
  // hang draws its own rod: a hanging step is about the rail even in a room
  // whose motif is shelves.
  hang:()=>`<g class="sa-fx"><path d="M5 12h38"/></g>
    <g transform="translate(17 12)"><g class="h1">${HANGER_DOWN}</g></g>
    <g transform="translate(32 12)"><g class="h2">${HANGER_DOWN}</g></g>`,
  fold:()=>`<rect x="14" y="30" width="20" height="10" rx="2"/><rect class="f-flap" x="14" y="19" width="20" height="11" rx="2"/>`,
  photo:()=>`<rect x="10" y="15" width="28" height="21" rx="4"/><circle cx="24" cy="26" r="6"/><path d="M19 15l2.2-3.5h5.6L29 15"/><circle class="p-flash" cx="24" cy="26" r="3"/>`,
  // things going INTO something that holds them
  contain:(g)=>`<path class="cn-bin" d="M12.5 28h23l-2.4 12.2a2.5 2.5 0 0 1-2.5 2H17.4a2.5 2.5 0 0 1-2.5-2z"/>${G(g,19,24,'c1')}${G(g,30,22,'c2')}`,
  moveUp:(g)=>`${G(g,20,40,'m-box')}<path class="m-arrow" d="M36 36V24M32 28l4-4 4 4"/>`,
  moveDown:(g)=>`${G(g,20,21,'m-box2')}<path class="m-arrow" d="M36 24v12M32 32l4 4 4-4"/>`,
  // one shelf, divided — each zone lights in turn with its own contents
  zones:(g)=>`<g class="z1"><rect x="7" y="29" width="11" height="11" rx="2"/></g>${GS(g,12.5,39,0.62)}
    <g class="z2"><rect x="18.5" y="29" width="11" height="11" rx="2"/></g>${GS(g,24,39,0.62)}
    <g class="z3"><rect x="30" y="29" width="11" height="11" rx="2"/></g>${GS(g,35.5,39,0.62)}`,
  group:(g)=>`${G(g,12,20,'g1')}${G(g,36,18,'g2')}${G(g,11,40,'g3')}${G(g,37,40,'g4')}`,
  // items arriving on the shelf and staying there
  stock:(g)=>`${G(g,16,40,'s1')}${G(g,32,40,'s2')}`,
  // the shelf as it will look when this is over, and a tick over it
  done:(g)=>`${G(g,12,40)}${G(g,22,40)}${G(g,32,40)}
    <circle class="dn-ring" cx="36" cy="14" r="9.5"/><path class="dn-check" d="M31.5 14.4l3.2 3.2 6.3-6.8"/>`,
};

/* The scene for one step: its action, staged on its space, holding its item. */
export function stepScene(step, spaceId){
  const action=classifyAction(step);
  const motif=motifForSpace(spaceId);
  const glyph=glyphForStep(step, spaceId);
  const build=SCENES[action]||SCENES.done;
  return A_WRAP(`${action} sa-m-${motif} sa-g-${glyph}`,
    `${MOTIF_ART[motif]||MOTIF_ART.shelves}${build(glyph)}`);
}

export function renderSteps(rawList){
  const wrap=document.getElementById('res-steps'); wrap.innerHTML='';
  /* Steps normally arrive normalized ({t,m,w}), but a guest draft or a saved
     row written before the Adjust-screen shape fix can still carry raw
     {task,time,why} steps — which rendered as "undefined". Accept both. */
  const list=(rawList||[]).map(s=>(s && s.t!==undefined) ? s
    : {t:(s&&s.task)||'', m:((s&&s.time)||'—'), w:(s&&s.why)||''}).filter(s=>s.t);
  state.stepDone=new Array(list.length).fill(false);
  state.stepSkipped=new Array(list.length).fill(false);
  list.forEach((s,i)=>{
    const t=document.createElement('div'); t.className='task'; t.id='task-'+i;
    const art=stepScene(s, state.space);
    t.innerHTML=`
      <button type="button" class="check" onclick="toggleStep(${i})" aria-label="Mark step ${i+1} complete" aria-pressed="false">${ICON.check}</button>
      <div>
        <div class="num">Step ${i+1}</div>
        <div class="tname">${escapeHtml(s.t)}</div>
        ${(s.cite && !state.shareView) ? `<div class="step-cite">${escapeHtml(s.cite)}</div>` : ''}
        <span class="step-art" data-step-media="${mediaKeyFor(s, state.space)}">${art}</span>
        <div class="meta"><span class="time">${SVG.clock} ${escapeHtml(s.m)}</span></div>
        <div class="acts">
          <button class="mark" onclick="toggleStep(${i})">Mark complete</button>
          <button onclick="skipStep(${i})">Skip</button>
          <button class="whybtn" onclick="toggleStepTip(${i})"
                  aria-expanded="false" aria-controls="step-tip-${i}">Why?</button>
        </div>
        <div class="step-tip hide" id="step-tip-${i}">
          <div class="why2"><strong>Why:</strong> ${escapeHtml(s.w)}</div>
          <div class="tip-how">${ICON.why}<span>${escapeHtml(tipFor(s))}</span></div>
        </div>
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
/* Holds both the "why" and the how-to hint. They used to be separate — the why
   as permanent prose on every card, the hint behind a button — which put a
   sentence of explanation on screen eight times over on a checklist someone
   reads standing up with their hands full. One disclosure, closed by default. */
export function toggleStepTip(i){
  const el=document.getElementById('step-tip-'+i);
  if(!el) return;
  const open=el.classList.toggle('hide')===false;
  const btn=document.querySelector('#task-'+i+' .whybtn');
  if(btn) btn.setAttribute('aria-expanded', String(open));
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
/* `restore` means "put the checklist back the way it was", not "the user just
   did this". Both go through here because the DOM work is identical, and that
   is how every restore came to be counted as fresh engagement: reopening a
   saved plan, following a ?space= link, restoring a guest draft, and — twice
   per visit — rendering the Adjust screen all call applySavedProgress, which
   calls this once per completed step.

   The event it fired is not a spare one. `checkedCount` is described in this
   file as the core engagement-depth signal, the "did they actually work the
   plan" number, and the handoff reads it per anon_id to decide what to build
   next. Someone with five steps done who opened Adjust twice produced fifteen
   step_checked events with the count climbing each time. The plan was worked
   once. */
export function toggleStep(i, { restore=false }={}){
  state.stepDone[i]=!state.stepDone[i];
  document.getElementById('task-'+i).classList.toggle('done',state.stepDone[i]);
  const check=document.querySelector('#task-'+i+' .check');
  check.setAttribute('aria-pressed', String(state.stepDone[i]));
  check.setAttribute('aria-label', state.stepDone[i]?`Mark step ${i+1} incomplete`:`Mark step ${i+1} complete`);
  document.querySelector('#task-'+i+' .mark').textContent=state.stepDone[i]?'Completed':'Mark complete';
  updateProgress();
  if(state.stepDone[i] && !restore){
    // checkedCount is the core engagement depth signal (>= 3 = worked the plan)
    track('step_checked', {
      index:i, total:state.stepCount||0,
      checkedCount:(state.stepDone||[]).filter(Boolean).length,
    });
  }
  /* The write stays on the restore path. It is the same value going back
     where it came from, so it costs one debounced PATCH and nothing else —
     but Adjust can change how many steps a plan has, and the restored
     checklist is then a genuinely new shape that has to be saved. */
  if(getSession()) updateSpacePatch({progress:{stepsDone:state.stepDone}});
  else persistGuestDraft();
}

// Re-apply a saved checklist (from a saved space or a guest draft) after renderSteps reset it
export function applySavedProgress(saved){
  (saved||[]).forEach((v,i)=>{
    // restore:true — this is a checklist coming back, not somebody ticking it.
    if(v && state.stepDone && i<state.stepDone.length && !state.stepDone[i]) toggleStep(i, { restore:true });
  });
}
/* Skipping is not doing. Skip used to call toggleStep, so the card flipped to
   "Completed", the progress bar moved, and the toast said "Step skipped" — the
   app recording work that was explicitly declined, in a checklist whose whole
   value is knowing what is left. The step is set aside instead: out of the way,
   still open, and not counted. */
export function skipStep(i){
  if(state.stepDone[i]) toggleStep(i);          // un-complete before setting aside
  state.stepSkipped=state.stepSkipped||[];
  state.stepSkipped[i]=!state.stepSkipped[i];
  const card=document.getElementById('task-'+i);
  if(card) card.classList.toggle('skipped', !!state.stepSkipped[i]);
  const btn=card && card.querySelector('.acts button:nth-of-type(2)');
  if(btn) btn.textContent=state.stepSkipped[i]?'Unskip':'Skip';
  updateProgress();
  toast(state.stepSkipped[i]?'Step set aside — it is still on the list':'Step back on the list');
}
export function updateProgress(){
  const done=state.stepDone.filter(Boolean).length;
  const skipped=(state.stepSkipped||[]).filter(Boolean).length;
  const n=state.stepCount;
  const pct=Math.round(done/n*100);
  document.getElementById('prog-text').textContent=
    `Step ${done} of ${n} complete`+(skipped?` · ${skipped} set aside`:'');
  document.getElementById('prog-pct').textContent=pct+'%';
  document.getElementById('prog-bar').style.width=pct+'%';
}
export function activeMap(){ return (state.ai && state.ai.map && state.ai.map.length) ? state.ai.map : MAP; }
export function parseZone(z){ return String(z||'').split(/[·•,;]|\s\/\s/).map(s=>s.trim()).filter(Boolean); }
export function renderAfter(mode){
  /* Just the mode. It read "After · <mode>", which only meant anything while
     a "before" pane sat beside it; with that gone, "After" implied a
     comparison the section no longer makes. */
  document.getElementById('after-h').textContent=mode;
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
  /* Persist only on an actual change. buildResults calls this on every render
     to re-apply the current value, and writing the row each time a report is
     drawn would be a request per navigation for nothing. */
  const changed = state.upgrades!==on;
  state.upgrades=on;
  if(changed && getSession()) persistAnswers();
  document.getElementById('res-upgrades-wrap').classList.toggle('hide',!on);
  /* The subtitle used to state flatly that the reader had said they were open
     to buying storage. For anyone who left the preselected card alone that is
     a sentence about a decision they never made — the same false attribution
     the touched flags exist to prevent, printed above a list of things to buy.
     Suggestions are still worth showing when nobody said either way; claiming
     they were asked for is not. */
  const sub=document.getElementById('res-upgrades-sub');
  if(sub){
    sub.textContent = state.shoppingTouched
      ? 'Only because you said you’re open to buying storage products. The $0 plan above works without any of these.'
      : 'You didn’t tell us either way about buying storage, so these are suggestions only. The plan above works without any of them.';
  }
  const tocShop=document.getElementById('toc-shop');
  if(tocShop) tocShop.classList.toggle('hide',!on);
  // Turning the section off zeroes what the plan costs; the tile has to hear it.
  syncCostKpi();
}

/* Called after analysis (see loading.js). The contents step's category list
   is authoritative when the user engaged with it: unticked categories leave
   every zone, added ones get a home in exactly one zone — then the whole
   report renders from the edited plan. Works for both AI and demo plans. */
export function syncCategoriesToResults(){
  if(state.ai && state.catsTouched && state.cats.length){
    applyCategoryEdits(state.ai, state.cats);
  }
  buildResults();
}

export function retryAnalysis(){
  state.aiError=null; state.planMeta=null;
  go('loading'); runLoading();
}
