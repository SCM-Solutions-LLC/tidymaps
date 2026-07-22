import { state, persistGuestDraft } from '../state.js';
import { toast, escapeHtml } from '../ui.js';
import { go } from '../router.js';
import { activeGeometry, activeMapV2 } from '../plan.js';
import { getSession } from '../auth.js';
import { updateSpacePatch } from '../db.js';
import { resolveLayout, chipArchetypesFor, ARCHETYPE_LABELS } from '../layout.js';

/* 3D screen wrapper. three.js (~680KB) loads only when this opens. */

let view=null, detach=null, resizeHandler=null;
let layoutOverride=null;
let dimsPreview=null;
let _buildScene=null, _attachDrag=null;

function currentLayout(){
  const map=activeMapV2();
  return resolveLayout({
    ai: state.ai||{ map },
    setup: state.setup,
    scenarioKey: state.space,
    override: layoutOverride,
    map,
  });
}

function rebuildScene(){
  if(!_buildScene) return;
  const canvas=document.getElementById('v3d-canvas');
  if(!canvas) return;
  const placements=view?view.placements():
    (state.arrangement&&state.arrangement.placements)||[];
  if(detach){ detach(); detach=null; }
  if(view){ view.dispose(); view=null; }

  const geometry=dimsPreview||activeGeometry();
  const map=activeMapV2();
  const resolved=currentLayout();
  view=_buildScene({ geometry, map, placements, canvas, layout:resolved });
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
  updateStatus(geometry, resolved);
}

export async function openViewer3d(){
  go('viewer3d');
  const status=document.getElementById('v3d-status');
  if(view) return;
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
    const geometry=activeGeometry();
    const map=activeMapV2();
    const resolved=currentLayout();
    const placements=(state.arrangement && state.arrangement.placements)||[];
    view=buildScene({ geometry, map, placements, canvas, layout:resolved });
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
    initLayoutChips(resolved);
    initDimSliders(geometry);
    updateStatus(geometry, resolved);
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

function updateStatus(geometry, resolved){
  const status=document.getElementById('v3d-status');
  if(!status) return;
  const label=ARCHETYPE_LABELS[resolved.type]||resolved.type;
  let note=geometry.estimated
    ? 'Dimensions are estimated from your photos. Add measurements in the wizard for exact scale.'
    : `Built from your measurements: ${geometry.width}″w × ${geometry.height}″h × ${geometry.depth}″d.`;
  const sourceDesc={
    override:'your selection.',
    ai:'matched from your photos.',
    setup:'from your setup choice.',
    scenario:'from the space type.',
    default:'default layout.',
  };
  note+=' Shown as '+label+' — '+(sourceDesc[resolved.source]||sourceDesc.default);
  if(dimsPreview) note+=' Sliders preview size only — save arrangement to keep.';
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
  state.arrangement={ version:1, geometry:activeGeometry(), placements:view.placements() };
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
  disposeViewer3d();
  openViewer3d();
  toast('Back to the recommended arrangement');
}

export function disposeViewer3d(){
  if(detach){ detach(); detach=null; }
  if(resizeHandler){ removeEventListener('resize', resizeHandler); resizeHandler=null; }
  if(view){ view.dispose(); view=null; }
  dirty=false;
}

const ZONE_COLORS=['var(--honey)','var(--primary-bg)','var(--sage-bg)','var(--surface-3)','var(--primary-line)'];
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
      rebuildScene();
    };
    wrap.appendChild(btn);
  }
}

function initDimSliders(geometry){
  const fmt=v=>{
    const ft=Math.floor(v/12);
    const inches=v%12;
    return ft+'′'+(inches?inches+'″':'');
  };
  let debounce=null;
  function onSliderInput(){
    const w=parseInt(document.getElementById('v3d-w').value,10)||geometry.width;
    const d=parseInt(document.getElementById('v3d-d').value,10)||geometry.depth;
    const h=parseInt(document.getElementById('v3d-h').value,10)||geometry.height;
    dimsPreview={...geometry, width:w, depth:d, height:h, estimated:false};
    clearTimeout(debounce);
    debounce=setTimeout(rebuildScene, 250);
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
