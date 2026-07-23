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

let view=null, detach=null, resizeHandler=null;
let layoutOverride=null;
let dimsPreview=null;
let lSideChoice='auto';
let shelfPlacement='center';
let rebuildTimer=null;
let _buildScene=null, _attachDrag=null;

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
  const status=document.getElementById('v3d-status');
  if(view) return;
  restoreArrangementOptions();
  status.textContent='Loading 3D view…';
  const canvas=document.getElementById('v3d-canvas');
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
    canvas.addEventListener('webglcontextlost', ()=>{ disposeViewer3d(); }, { once:true });

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
    const why=String((e&&e.message)||e).slice(0,140);
    status.innerHTML='The 3D view could not load ('+escapeHtml(why)+'). Reloading the page usually fixes this. The plan above has everything you need.';
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
  note+=' Shown as '+label+' — '+(sourceDesc[resolved.source]||sourceDesc.default);
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
    dimsPreview=geometryWithShelfCount(dimsPreview||geometry,geometry.shelfCount);
    markDirty();
    rebuildScene();
  };
}
