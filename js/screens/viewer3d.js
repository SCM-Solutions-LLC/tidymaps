import { state, persistGuestDraft } from '../state.js';
import { SETUP_GEOM, GEOM_TO_V3D_LAYOUT } from '../wizard-data.js';
import { toast, escapeHtml } from '../ui.js';
import { go } from '../router.js';
import { activeGeometry, activeMapV2 } from '../plan.js';
import { getSession } from '../auth.js';
import { updateSpacePatch } from '../db.js';

/* 3D screen wrapper. three.js (~680KB) loads only when this opens. */

let view=null, detach=null, resizeHandler=null;

export async function openViewer3d(){
  go('viewer3d');
  const status=document.getElementById('v3d-status');
  if(view) return;                       // already built for this plan
  status.textContent='Loading 3D view…';
  const canvas=document.getElementById('v3d-canvas');
  try{
    const [{ buildScene }, { attachDrag }]=await Promise.all([
      import('../three/scene.js'),
      import('../three/interact.js'),
    ]);
    // Wait for the screen transition to lay the canvas out; a 0-width canvas
    // renders an invisible scene and looks like "3D is broken".
    for(let i=0;i<20 && !canvas.clientWidth;i++){
      await new Promise(r=>requestAnimationFrame(r));
    }
    const geometry=activeGeometry();
    const map=activeMapV2();
    const placements=(state.arrangement && state.arrangement.placements)||[];
    view=buildScene({ geometry, map, placements, canvas });
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
    populateZones(map);
    initLayoutChips();
    initDimSliders(geometry);
    let note=geometry.estimated
      ? 'Dimensions are estimated from your photos. Add measurements in the wizard for exact scale.'
      : `Built from your measurements: ${geometry.width}″w × ${geometry.height}″h × ${geometry.depth}″d.`;
    // Irregular layouts are flattened into one straight run — say so.
    if(/\b[lu][\s-]?shape|walk[\s-]?in|corner|wrap(s|ped)?|carousel|lazy susan|pull[\s-]?out|slide[\s-]?out|multiple (walls?|units?|bays?|sections?)|wall[\s-]?by[\s-]?wall|hanging rod/i.test((state.ai&&state.ai.summary)||'')){
      note+=' Corners, extra walls, rods, and pull-outs are shown as one straight run here. The level names tell you the real spot.';
    }
    status.textContent=note;
  }catch(e){
    console.error('3D viewer failed', e);
    // One automatic retry: covers transient GPU failures and the module-cache
    // mismatch that can happen when the site deploys mid-visit.
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
  disposeViewer3d();
  openViewer3d();
  toast('Back to the recommended arrangement');
}

// called by the router when navigating away
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
  (map.rows||map||[]).forEach((row,i)=>{
    const zone=row.zone||row.lv||'Zone '+(i+1);
    const desc=row.why||'';
    const color=ZONE_COLORS[i%ZONE_COLORS.length];
    const el=document.createElement('div');
    el.className='v3d-zone-item';
    el.innerHTML=`<span class="vz-dot" style="background:${color}"></span><div><h4>${escapeHtml(zone)}</h4>${desc?'<p>'+escapeHtml(desc.slice(0,80))+'</p>':''}</div>`;
    list.appendChild(el);
  });
}

function initLayoutChips(){
  const wrap=document.getElementById('v3d-layouts');
  if(!wrap) return;
  wrap.querySelectorAll('.v3d-chip').forEach(btn=>{
    btn.onclick=()=>{
      wrap.querySelectorAll('.v3d-chip').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
    };
  });
  // reflect the setup type chosen in the wizard
  const want=GEOM_TO_V3D_LAYOUT[SETUP_GEOM[state.setup]]||'cabinet';
  wrap.querySelectorAll('.v3d-chip').forEach(b=>b.classList.toggle('sel', b.dataset.layout===want));
}

function initDimSliders(geometry){
  const fmt=v=>{
    const ft=Math.floor(v/12);
    const inches=v%12;
    return ft+"′"+(inches?inches+"″":"");
  };
  [['v3d-w','v3d-w-val'],['v3d-d','v3d-d-val'],['v3d-h','v3d-h-val']].forEach(([id,valId])=>{
    const input=document.getElementById(id);
    const label=document.getElementById(valId);
    if(!input||!label) return;
    input.oninput=()=>{ label.textContent=fmt(parseInt(input.value,10)); };
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
