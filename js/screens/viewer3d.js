import { state, persistGuestDraft } from '../state.js';
import { toast, escapeHtml } from '../ui.js';
import { go } from '../router.js';
import { activeGeometry, activeMapV2, activeProductNeeds } from '../plan.js';
import { getSession } from '../auth.js';
import { updateSpacePatch } from '../db.js';
import { resolveLayout, chipArchetypesFor, ARCHETYPE_LABELS } from '../layout.js';
import { selectedProductNeeds } from '../three/organizerKinds.js';
import {
  normalizeViewerGeometry,geometryWithShelfCount,geometryWithShelfHeight,
  shelfHeightInches,mapForShelfCount,inferLSide,
} from '../three/viewerOptions.js';

/* 3D screen wrapper. three.js (~680KB) loads only when this opens. */

let view=null, detach=null, resizeHandler=null, contextLostHandler=null;
let layoutOverride=null;
let dimsPreview=null;
let lSideChoice='auto';
let shelfPlacement='center';
let rebuildTimer=null;
let _buildScene=null, _attachDrag=null;

/* There used to be a webglAvailable() pre-flight here that probed a throwaway
   canvas and, if it got a context, called WEBGL_lose_context.loseContext() to
   "hand it straight back". It was a veto: answer no and the viewer showed
   hardware-acceleration advice without ever asking three.js for a real context.

   Two things were wrong with that. Browsers cap how many context losses one
   document may accumulate before they stop granting contexts at all, and the
   router disposes the viewer on every navigation away, so each plan → 3D → plan
   round trip deliberately burned one more. And the probe's verdict was final
   while createRenderer below it already walks from an antialiased context down
   to a bare one — so the fragile check could overrule the robust one and tell
   somebody with a working GPU that their browser could not do 3D.

   Now nothing decides but the renderer itself. The cost is downloading three.js
   before discovering a genuinely WebGL-less browser, which is a one-time cost on
   a click the user made on purpose; the benefit is that a browser which can run
   this never gets told it cannot. */

/* "Reloading usually fixes this" was wrong and it wasted people's time. A
   refused context is almost never transient: it is hardware acceleration
   switched off, a blocklisted driver, or a browser with WebGL disabled. Say
   what actually helps, and make clear the plan itself is unaffected.

   `reason` is the error the renderer actually threw. It is shown because the
   advice below is a guess about someone else's machine: when it is the wrong
   guess, the real message is the only thing that says so. */
function webglHelpMessage(reason){
  return 'This browser could not start the 3D view, which needs WebGL. '
    + 'In Chrome, check Settings &rsaquo; System &rsaquo; “Use graphics acceleration when available”, '
    + 'then reopen the browser. Everything in your plan is on the previous screen — '
    + '<button class="btn btn-ghost btn-sm" type="button" onclick="go(\'results\')" '
    + 'style="margin-left:4px">Back to the plan</button>'
    + (reason ? '<span class="small muted" style="display:block;margin-top:8px">Reported by the browser: '
        + escapeHtml(String(reason).slice(0,160)) + '</span>' : '');
}

/* A rod holds things that hang. itemYForSurface poses anything dropped on one
   below the rail, keyed off the target surface alone, so before this a bottle
   or a stack of cans could be left floating under the rod in its own geometry.
   Everything else is fair game — a shelf takes anything. */
const HANGABLE=new Set(['garment','linen']);

function dropAllowed(item, surface){
  if(!surface || surface.kind!=='rod') return true;
  return HANGABLE.has(item.userData.kind);
}

function rejectReason(item){
  const name=(item.userData&&item.userData.name)||'That item';
  return '“'+name+'” doesn’t hang on a rod — it went back where it was.';
}

function organizerPlan(){
  const existing=(state.ai&&state.ai.existing)||[];
  return {
    space:state.space,
    styles:(state.styles||[]).slice(),
    prefs:[...(state.prefs||[])],
    productNeeds:selectedProductNeeds(activeProductNeeds(),state.shopping),
    existingText:existing.map(entry=>`${entry.ft||''} ${entry.fd||''}`).join(' '),
  };
}

function currentLayout(map=activeMapV2()){
  const resolved=resolveLayout({
    ai: state.ai||{ map },
    setup: state.setup,
    setupTouched: state.setupTouched,
    aiFromPhotos: !!(state.planMeta && state.planMeta.source === 'ai'),
    scenarioKey: state.space,
    override: layoutOverride,
    map,
  });
  return {
    ...resolved,
    lSide:lSideChoice==='auto'?inferLSide(resolved):lSideChoice,
    lSideChoice,
    shelfPlacement,
  };
}

function restoreArrangementOptions(){
  const arrangement=state.arrangement;
  layoutOverride=arrangement&&arrangement.layoutOverride||null;
  lSideChoice=arrangement&&arrangement.lSide||'auto';
  shelfPlacement=arrangement&&arrangement.shelfPlacement||'center';
  dimsPreview=arrangement&&arrangement.version>=2&&arrangement.geometry
    ? {...arrangement.geometry}:null;
}

function currentSceneInput(){
  let resolved=currentLayout();
  const sourceGeometry=dimsPreview||activeGeometry();
  const geometry=normalizeViewerGeometry(sourceGeometry,resolved.type);
  const map=resolved.type==='shelves'
    ?mapForShelfCount(activeMapV2(),geometry.shelfCount):activeMapV2();
  resolved=currentLayout(map);
  return {geometry,map,resolved,sourceGeometry};
}

function queueRebuild(){
  clearTimeout(rebuildTimer);
  rebuildTimer=setTimeout(rebuildScene,180);
}

function rebuildScene(){
  if(!_buildScene) return;
  const canvas=document.getElementById('v3d-canvas');
  if(!canvas) return;
  const placements=view?view.placements():
    (state.arrangement&&state.arrangement.placements)||[];
  if(detach){ detach(); detach=null; }
  if(view){ view.dispose(); view=null; }

  const {geometry,map,resolved,sourceGeometry}=currentSceneInput();
  view=_buildScene({ geometry, map, placements, canvas, layout:resolved, organizerPlan:organizerPlan() });
  canvas.dataset.layout=resolved.type;
  const kids=state.household.kids.present==='yes';
  detach=_attachDrag(view, {
    canDrop: dropAllowed,
    onRejectDrop(item, shelf){ toast(rejectReason(item, shelf)); },
    onDrop(item, shelf){
      const flags=item.userData.flags||[];
      const hazardous=flags.some(f=>['chemical','sharp','heavy','fragile'].includes(f));
      const kidShelf=shelf.row && shelf.row.safety && shelf.row.safety.flag==='kid-safe';
      if(kids && hazardous && kidShelf){
        toast('Heads up: “'+item.userData.name+'” is within kids’ reach. We recommend a higher shelf.');
      }
      markDirty();
    },
  });
  view.setSize();
  populateZones(map);
  populateOrganizers();
  initDimSliders(geometry, resolved);
  initStructureControls(geometry,resolved);
  updateStatus(geometry, resolved, sourceGeometry);
}

export async function openViewer3d(){
  go('viewer3d');
  /* A share-link visitor can look but not write. The report already hides its
     owner-only controls this way; the viewer had no equivalent, so Save
     arrangement was live for someone whose writes are blocked further down —
     it reported "Arrangement saved" and stored nothing at all. */
  document.querySelectorAll('#screen-viewer3d [data-owner-only]')
    .forEach(b=>b.classList.toggle('hide', !!state.shareView));
  const status=document.getElementById('v3d-status');
  if(view) return;
  restoreArrangementOptions();
  const canvas=document.getElementById('v3d-canvas');
  status.textContent='Loading 3D view…';
  try{
    const [{ buildScene }, { attachDrag }]=await Promise.all([
      import('../three/scene.js'),
      import('../three/interact.js'),
    ]);
    _buildScene=buildScene;
    _attachDrag=attachDrag;
    for(let i=0;i<20 && !canvas.clientWidth;i++){
      await new Promise(r=>requestAnimationFrame(r));
    }
    const {geometry,map,resolved,sourceGeometry}=currentSceneInput();
    const placements=(state.arrangement && state.arrangement.placements)||[];
    view=buildScene({ geometry, map, placements, canvas, layout:resolved, organizerPlan:organizerPlan() });
    canvas.dataset.layout=resolved.type;
    const kids=state.household.kids.present==='yes';
    detach=attachDrag(view, {
      canDrop: dropAllowed,
      onRejectDrop(item, shelf){ toast(rejectReason(item, shelf)); },
      onDrop(item, shelf){
        const flags=item.userData.flags||[];
        const hazardous=flags.some(f=>['chemical','sharp','heavy','fragile'].includes(f));
        const kidShelf=shelf.row && shelf.row.safety && shelf.row.safety.flag==='kid-safe';
        if(kids && hazardous && kidShelf){
          toast('Heads up: “'+item.userData.name+'” is within kids’ reach. We recommend a higher shelf.');
        }
        markDirty();
      },
    });
    resizeHandler=()=>view && view.setSize();
    addEventListener('resize', resizeHandler);
    openViewer3d._retried=false;
    /* The canvas is a permanent DOM node — go() only toggles .active — and
       {once:true} only removes a handler that actually fires. Every open and
       every "reset arrangement" used to add one more, so a session that
       revisited the 3D view accumulated them. Keep a reference and take it off
       in disposeViewer3d instead. */
    contextLostHandler=()=>{ disposeViewer3d(); };
    canvas.addEventListener('webglcontextlost', contextLostHandler, { once:true });

    const title=document.getElementById('v3d-title');
    if(title){
      const name=(state.ai&&state.ai.spaceType)||state.space||'space';
      title.textContent='Your '+name+', standing up';
    }

    populateZones(map);
    populateOrganizers();
    initLayoutChips(resolved);
    initDimSliders(geometry, resolved);
    initStructureControls(geometry,resolved);
    updateStatus(geometry, resolved, sourceGeometry);
  }catch(e){
    console.error('3D viewer failed', e);
    if(!openViewer3d._retried){
      openViewer3d._retried=true;
      disposeViewer3d();
      await new Promise(r=>setTimeout(r, 700));
      return openViewer3d();
    }
    openViewer3d._retried=false;
    // A context failure is its own thing and has real advice; anything else
    // still shows the underlying reason.
    if((e&&e.code==='webgl-unavailable')||/webgl|context/i.test(String((e&&e.message)||e))){
      // e.cause is the last thing WebGLRenderer threw; e.message is our own
      // label, which tells the user nothing they can act on.
      status.innerHTML=webglHelpMessage((e&&e.cause&&e.cause.message)||(e&&e.message));
      return;
    }
    const why=String((e&&e.message)||e).slice(0,140);
    status.innerHTML='The 3D view could not load ('+escapeHtml(why)+'). The plan above has everything you need.';
  }
}

function updateStatus(geometry, resolved, sourceGeometry=geometry){
  const status=document.getElementById('v3d-status');
  if(!status) return;
  const label=ARCHETYPE_LABELS[resolved.type]||resolved.type;
  let note=geometry.estimated
    ? 'Dimensions are estimated from your photos. Add measurements in the wizard for exact scale.'
    : `Built from your measurements: ${sourceGeometry.width}″w × ${sourceGeometry.height}″h × ${sourceGeometry.depth}″d.`;
  const sourceDesc={
    override:'your selection.',
    ai:'matched from your photos.',
    setup:'from your setup choice.',
    scenario:'from the space type.',
    default:'default layout.',
  };
  /* When the shape came from the setup the user picked, name their choice.
     "Shown as Shelves — from your setup choice" printed the archetype instead,
     so someone who chose "Reach-in" was told it was Shelves, and a Butler's
     pantry was labelled "Counter + uppers" — the name of a card in a different
     room they never saw. It reads as though the answer was lost. */
  const chosen = resolved.source==='setup' && state.setupLabel;
  note += chosen
    ? ` Shown as your ${state.setupLabel.toLowerCase()}, drawn as ${label}.`
    : ' Shown as '+label+' — '+(sourceDesc[resolved.source]||sourceDesc.default);
  if(resolved.type==='under-sink') note+=sourceGeometry.height!==geometry.height
    ?` Vanity shown at ${geometry.height} inches so the fixture stays realistic.`
    :' Vanity height is limited to a realistic 28–42 inches.';
  note+=' Item and organizer quantity adjust to measured capacity. Checked shopping products use catalog dimensions.';
  if(dirty) note+=' Save arrangement to keep these changes.';
  status.textContent=note;
}

let dirty=false;
function markDirty(){
  dirty=true;
  const btn=document.getElementById('v3d-save');
  if(btn) btn.disabled=false;
}

export function saveArrangement(){
  if(!view) return;
  /* Defence in depth behind the hidden button: persistGuestDraft early-returns
     in a share view and updateSpacePatch no-ops without an activeSpaceId, so
     reaching here would have toasted success over two silent no-ops. */
  if(state.shareView){ toast('This is a shared plan — start your own to save changes.'); return; }
  const {geometry}=currentSceneInput();
  state.arrangement={
    version:2,geometry,placements:view.placements(),
    layoutOverride,lSide:lSideChoice,shelfPlacement,
  };
  if(getSession()) updateSpacePatch({ arrangement: state.arrangement });
  else persistGuestDraft();
  dirty=false;
  const btn=document.getElementById('v3d-save');
  if(btn) btn.disabled=true;
  toast('Arrangement saved');
}

export function resetArrangement(){
  state.arrangement=null;
  layoutOverride=null;
  dimsPreview=null;
  lSideChoice='auto';
  shelfPlacement='center';
  disposeViewer3d();
  openViewer3d();
  toast('Back to the recommended arrangement');
}

export function disposeViewer3d(){
  clearTimeout(rebuildTimer);
  if(detach){ detach(); detach=null; }
  if(resizeHandler){ removeEventListener('resize', resizeHandler); resizeHandler=null; }
  if(contextLostHandler){
    const canvas=document.getElementById('v3d-canvas');
    if(canvas) canvas.removeEventListener('webglcontextlost', contextLostHandler);
    contextLostHandler=null;
  }
  if(view){ view.dispose(); view=null; }
  dirty=false;
}

const ZONE_COLORS=['var(--honey)','var(--primary-bg)','var(--sage-bg)','var(--surface-3)','var(--primary-line)'];
const ORGANIZER_LABELS={
  'clear-bin':'Clear bins','basket':'Woven baskets','divider':'Drawer dividers',
  'turntable':'Turntables','riser':'Shelf risers','door-rack':'Door racks','hook-rack':'Hook racks',
};

function populateOrganizers(){
  const wrap=document.getElementById('v3d-organizer-list');
  const section=document.getElementById('v3d-organizers');
  const fitNote=document.getElementById('v3d-fit-note');
  if(!wrap||!section||!view) return;
  /* Someone who answered "Use what I have" was still shown "12 × Clear bins"
     under "These match your plan", with an amber warning that nine groups did
     not fit — products they never asked for and cannot act on. The organizers
     are derived from the scene regardless of the shopping answer, so gate the
     panel on the upsell actually being on. */
  if(!state.upgrades){
    section.classList.add('hide');
    if(fitNote) fitNote.classList.add('hide');
    return;
  }
  const groups=new Map();
  (view.organizers||[]).forEach(organizer=>{
    const type=organizer.userData.type;
    const current=groups.get(type)||{type,qty:0,products:new Set(),issues:0};
    current.qty+=Math.max(1,Number(organizer.userData.requestedQty)||1);
    const spec=organizer.userData.spec||{};
    if(spec.productName) current.products.add(spec.productName);
    if(organizer.userData.fits===false) current.issues++;
    groups.set(type,current);
  });
  const entries=[...groups.values()];
  section.classList.toggle('hide',!entries.length);
  wrap.innerHTML=entries.map(entry=>{
    const title=[...entry.products].join(' · ');
    const qty=entry.qty>1?`${entry.qty} × `:'';
    return `<span class="v3d-organizer-chip" data-type="${entry.type}"${title?` title="${escapeHtml(title)}"`:''}><i></i>${qty}${ORGANIZER_LABELS[entry.type]||entry.type}</span>`;
  }).join('');
  const issueCount=entries.reduce((sum,entry)=>sum+entry.issues,0);
  const unplaced=Math.max(0,Number(view.unplacedOrganizerQty)||0);
  if(fitNote){
    fitNote.classList.toggle('hide',!issueCount&&!unplaced);
    fitNote.textContent=unplaced
      ?`${unplaced} selected organizer${unplaced===1?' does':'s do'} not fit the available matching shelves. Increase width, reduce quantity, or choose a smaller product.`
      :issueCount?`${issueCount} selected organizer group${issueCount===1?' does':'s do'} not fully fit. Check shelf depth and height.`:'';
  }
}

function populateZones(map){
  const list=document.getElementById('v3d-zone-list');
  if(!list || !map) return;
  list.innerHTML='';
  const rows=(map.rows||map||[]);
  const heading=document.getElementById('v3d-zones-h');
  if(heading) heading.textContent=rows.length===1?'1 zone':rows.length+' zones';
  rows.forEach((row,i)=>{
    const zone=row.zone||row.lv||'Zone '+(i+1);
    const desc=row.why||'';
    const color=ZONE_COLORS[i%ZONE_COLORS.length];
    const el=document.createElement('div');
    el.className='v3d-zone-item';
    el.innerHTML=`<span class="vz-dot" style="background:${color}"></span><div><h4>${escapeHtml(zone)}</h4>${desc?'<p>'+escapeHtml(desc.slice(0,80))+'</p>':''}</div>`;
    el.onmouseenter=()=>{
      if(!view) return;
      view.items.filter(item=>item.userData.shelfIndex===row.shelfIndex).forEach(item=>{
        item.material.emissive.setHex(0x26372c);
        if(item.userData.label) item.userData.label.visible=true;
      });
      view.scene.traverse(node=>{
        if(node.userData.zoneShelfIndex===row.shelfIndex) node.visible=true;
      });
    };
    el.onmouseleave=()=>{
      if(!view) return;
      view.items.filter(item=>item.userData.shelfIndex===row.shelfIndex).forEach(item=>{
        item.material.emissive.setHex(0x000000);
        if(item.userData.label) item.userData.label.visible=false;
      });
      view.scene.traverse(node=>{
        if(node.userData.zoneShelfIndex===row.shelfIndex) node.visible=false;
      });
    };
    list.appendChild(el);
  });
}

function initLayoutChips(resolved){
  const wrap=document.getElementById('v3d-layouts');
  if(!wrap) return;
  wrap.innerHTML='';
  const archetypes=chipArchetypesFor(state.space);
  for(const arch of archetypes){
    const btn=document.createElement('button');
    btn.className='v3d-chip'+(arch===resolved.type?' sel':'');
    btn.dataset.layout=arch;
    btn.textContent=ARCHETYPE_LABELS[arch]||arch;
    btn.onclick=()=>{
      layoutOverride=arch;
      wrap.querySelectorAll('.v3d-chip').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
      markDirty();
      rebuildScene();
    };
    wrap.appendChild(btn);
  }
}

function initDimSliders(geometry, resolved){
  const roomLike=resolved&&['l-run','walkin-u'].includes(resolved.type);
  const vanity=resolved&&resolved.type==='under-sink';
  const width=document.getElementById('v3d-w');
  const depth=document.getElementById('v3d-d');
  const height=document.getElementById('v3d-h');
  if(width){ width.min=roomLike?'36':vanity?'18':'12'; width.max=roomLike?'180':vanity?'72':'120'; }
  if(depth){ depth.min=roomLike?'36':vanity?'12':'6'; depth.max=roomLike?'144':vanity?'30':'48'; }
  if(height){ height.min=roomLike?'60':vanity?'28':'12'; height.max=vanity?'42':'120'; }
  const fmt=v=>{
    const ft=Math.floor(v/12);
    const inches=v%12;
    return ft+'′'+(inches?inches+'″':'');
  };
  function onSliderInput(){
    const w=parseInt(document.getElementById('v3d-w').value,10)||geometry.width;
    const d=parseInt(document.getElementById('v3d-d').value,10)||geometry.depth;
    const h=parseInt(document.getElementById('v3d-h').value,10)||geometry.height;
    dimsPreview={...geometry, width:w, depth:d, height:h, estimated:false};
    markDirty();
    queueRebuild();
  }
  [['v3d-w','v3d-w-val'],['v3d-d','v3d-d-val'],['v3d-h','v3d-h-val']].forEach(([id,valId])=>{
    const input=document.getElementById(id);
    const label=document.getElementById(valId);
    if(!input||!label) return;
    input.oninput=()=>{
      label.textContent=fmt(parseInt(input.value,10));
      onSliderInput();
    };
  });
  if(geometry){
    const setSlider=(id,valId,val)=>{
      const input=document.getElementById(id);
      const label=document.getElementById(valId);
      if(input&&label&&val){ input.value=val; label.textContent=fmt(val); }
    };
    setSlider('v3d-w','v3d-w-val',geometry.width);
    setSlider('v3d-d','v3d-d-val',geometry.depth);
    setSlider('v3d-h','v3d-h-val',geometry.height);
  }
}

function initStructureControls(geometry,resolved){
  const structure=document.getElementById('v3d-structure');
  const lControl=document.getElementById('v3d-l-side-control');
  const shelfControls=document.getElementById('v3d-shelf-controls');
  if(!structure||!lControl||!shelfControls) return;
  const isL=resolved.type==='l-run';
  const isShelves=resolved.type==='shelves';
  structure.classList.toggle('hide',!isL&&!isShelves);
  lControl.classList.toggle('hide',!isL);
  shelfControls.classList.toggle('hide',!isShelves);

  if(isL){
    const wrap=document.getElementById('v3d-l-side');
    wrap.querySelectorAll('[data-side]').forEach(button=>{
      button.classList.toggle('sel',button.dataset.side===lSideChoice);
      button.onclick=()=>{
        lSideChoice=button.dataset.side;
        markDirty();
        rebuildScene();
      };
    });
  }

  if(!isShelves) return;
  const count=document.getElementById('v3d-shelf-count');
  const countValue=document.getElementById('v3d-shelf-count-val');
  count.value=geometry.shelfCount;
  countValue.textContent=geometry.shelfCount;
  count.oninput=()=>{
    countValue.textContent=count.value;
    dimsPreview=geometryWithShelfCount(dimsPreview||geometry,Number(count.value));
    markDirty();
    queueRebuild();
  };

  const floating=['wallshelf','openshelf'].includes(state.setup);
  const placementControl=document.getElementById('v3d-shelf-placement-control');
  placementControl.classList.toggle('hide',!floating);
  if(floating){
    const wrap=document.getElementById('v3d-shelf-placement');
    wrap.querySelectorAll('[data-placement]').forEach(button=>{
      button.classList.toggle('sel',button.dataset.placement===shelfPlacement);
      button.onclick=()=>{
        shelfPlacement=button.dataset.placement;
        markDirty();
        rebuildScene();
      };
    });
  }

  const heights=document.getElementById('v3d-shelf-heights');
  heights.innerHTML=geometry.shelfYFracs.map((_,index)=>{
    const value=shelfHeightInches(geometry,index);
    return `<label class="v3d-dim v3d-shelf-height"><span>Shelf ${index+1} <strong>${value}″ high</strong></span><input type="range" data-shelf-height="${index}" min="3" max="${Math.max(3,geometry.height-3)}" value="${value}"></label>`;
  }).join('');
  heights.querySelectorAll('[data-shelf-height]').forEach(input=>{
    input.oninput=()=>{
      const label=input.closest('label').querySelector('strong');
      label.textContent=input.value+'″ high';
      dimsPreview=geometryWithShelfHeight(dimsPreview||geometry,Number(input.dataset.shelfHeight),Number(input.value));
      markDirty();
      queueRebuild();
    };
  });
  document.getElementById('v3d-even-shelves').onclick=()=>{
    // The one control that is meant to discard manual shelf heights.
    dimsPreview=geometryWithShelfCount(dimsPreview||geometry,geometry.shelfCount,{ preserveSpacing:false });
    markDirty();
    rebuildScene();
  };
}
