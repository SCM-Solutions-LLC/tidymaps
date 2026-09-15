import * as THREE from 'three';
import {
  ITEM_NORMAL_OFFSET,
  clampSurfaceOffset,
  itemYForSurface,
  pointOnSurface,
  surfaceOffsetForPoint,
  surfaceRotationY,
} from './surfaceMath.js';

/* Pointer-drag for items: raycast pick, lift, retarget across shelf
   hitboxes, snap into a slot on drop. onDrop(item, targetShelf) may veto
   nothing but can warn (safety). The same moves are on the keyboard below,
   and `announce(text)` is how each keyboard step is read out. */

export function attachDrag(view, { onDrop, canDrop, onRejectDrop, announce }={}){
  const { renderer, camera, controls, items, shelves, reflow, requestRender }=view;
  const surfaces=(view.surfaces||shelves).slice().sort((a,b)=>a.index-b.index);
  const canvas=renderer.domElement;
  const ray=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  let dragging=null, dragSurface=null;
  let hovered=null;

  function cast(e, targets){
    const r=canvas.getBoundingClientRect();
    pointer.x=((e.clientX-r.left)/r.width)*2-1;
    pointer.y=-((e.clientY-r.top)/r.height)*2+1;
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(targets, false);
  }

  function uProject(pos, surface){
    return surfaceOffsetForPoint(pos, surface);
  }

  function onDown(e){
    const hit=cast(e, items)[0];
    if(!hit) return;
    dragging=hit.object;
    hovered=dragging;
    if(dragging.userData.label) dragging.userData.label.visible=true;
    (dragging.userData.displayCopies||[]).forEach(copy=>{ copy.visible=false; });
    dragSurface=surfaces.find(s=>s.index===dragging.userData.shelfIndex)||null;
    controls.enabled=false;
    dragging.position.y+=1.2;
    dragging.material.emissive=new THREE.Color(0x1c2b20);
    canvas.setPointerCapture(e.pointerId);
  }

  function onMove(e){
    if(!dragging){
      const hit=cast(e,items)[0];
      const next=hit&&hit.object;
      if(next!==hovered){
        if(hovered&&hovered.userData.label) hovered.userData.label.visible=false;
        hovered=next||null;
        if(hovered&&hovered.userData.label) hovered.userData.label.visible=true;
        canvas.style.cursor=hovered?'grab':'default';
      }
      return;
    }
    const shelfHit=cast(e, surfaces.map(s=>s.hitbox))[0];
    if(shelfHit){
      dragSurface=surfaces.find(s=>s.hitbox===shelfHit.object);
      const p=shelfHit.point;
      const offset=clampSurfaceOffset(
        surfaceOffsetForPoint(p, dragSurface),
        dragSurface.length,
        dragging.scale.x,
      );
      const position=pointOnSurface(dragSurface, offset, ITEM_NORMAL_OFFSET);
      dragging.position.set(
        position.x,
        itemYForSurface(dragSurface, dragging.scale.y, 1.2),
        position.z,
      );
      dragging.rotation.y=surfaceRotationY(dragSurface);
      const labelPosition=pointOnSurface(
        dragSurface,
        offset,
        ITEM_NORMAL_OFFSET+dragging.scale.z/2+0.5,
      );
      dragging.userData.label.position.set(
        labelPosition.x,
        dragging.position.y+dragging.scale.y/2+0.6,
        labelPosition.z,
      );
    }
  }

  function onUp(e){
    if(!dragging) return;
    const item=dragging;
    dragging=null;
    controls.enabled=true;
    item.material.emissive=new THREE.Color(0x000000);
    /* A surface can refuse an item. Without this, anything dropped on a rod
       was posed hanging below it — itemYForSurface keys that off the TARGET
       surface alone — so a bottle or a stack of cans floated in mid-air under
       the rail with its own geometry. Leaving shelfIndex and slot untouched
       means the reflow below simply returns it to where it came from. */
    if(dragSurface && canDrop && !canDrop(item, dragSurface)){
      if(onRejectDrop) onRejectDrop(item, dragSurface);
    }else if(dragSurface){
      item.userData.shelfIndex=dragSurface.index;
      const here=items.filter(m=>m!==item && m.userData.shelfIndex===dragSurface.index)
        .sort((a,b)=>uProject(a.position, dragSurface)-uProject(b.position, dragSurface));
      const itemU=uProject(item.position, dragSurface);
      let slot=here.findIndex(m=>itemU<uProject(m.position, dragSurface));
      if(slot<0) slot=here.length;
      here.forEach((m,i)=>{ m.userData.slot=i>=slot?i+1:i; });
      item.userData.slot=slot;
      if(onDrop) onDrop(item, dragSurface);
    }
    reflow();
    if(item.userData.label) item.userData.label.visible=false;
    hovered=null;
    try{ canvas.releasePointerCapture(e.pointerId); }catch(_){}
  }

  function onLeave(){
    if(!dragging&&hovered&&hovered.userData.label) hovered.userData.label.visible=false;
    if(!dragging) hovered=null;
  }

  /* ---------- the same moves on the keyboard ----------
     Rearranging was drag-only, so the drawing could be looked at from the
     keyboard and nothing in it moved. With the canvas focused: Left and Right
     choose an item (its label shows, and the live region names it and where
     it sits); Space or Enter picks it up; Up and Down carry it to the surface
     above or below, Left and Right along the one it is on; Space or Enter
     puts it down, through the same canDrop and onDrop as a pointer drop;
     Escape puts it back where it was. Focus leaving the drawing puts a held
     item back too, so nothing is left in the air. */
  const say=(text)=>{ if(announce) announce(text); };
  const surfaceName=(s)=>(s&&s.row&&(s.row.level||s.row.lv))||(s?`${s.kind||'shelf'} ${s.index+1}`:'nowhere');
  const surfaceOf=(item)=>surfaces.find(s=>s.index===item.userData.shelfIndex)||null;
  const bySlot=(a,b)=>a.userData.slot-b.userData.slot;
  const ordered=()=>items.slice().sort((a,b)=>(a.userData.shelfIndex-b.userData.shelfIndex)||bySlot(a,b));
  let chosen=null;      // the item the arrows are on
  let held=null;        // the item being carried
  let origin=null;      // where the held item came from, for Escape and a refused drop

  function lift(item){
    if(item.userData.label) item.userData.label.visible=true;
    (item.userData.displayCopies||[]).forEach(copy=>{ copy.visible=false; });
    controls.enabled=false;
    item.position.y+=1.2;
    item.material.emissive=new THREE.Color(0x1c2b20);
  }
  function settle(item){
    controls.enabled=true;
    item.material.emissive=new THREE.Color(0x000000);
  }
  function placeAt(item, shelfIndex, slot){
    const others=items.filter(m=>m!==item&&m.userData.shelfIndex===shelfIndex).sort(bySlot);
    item.userData.shelfIndex=shelfIndex;
    others.forEach((m,i)=>{ m.userData.slot=i>=slot?i+1:i; });
    item.userData.slot=slot;
    reflow();
  }

  function choose(delta){
    const list=ordered();
    if(!list.length){ say('There is nothing to move in this drawing.'); return; }
    const at=chosen?list.indexOf(chosen):-1;
    const next=list[(at+delta+list.length)%list.length];
    if(chosen&&chosen!==next&&chosen.userData.label) chosen.userData.label.visible=false;
    chosen=next;
    hovered=next;
    if(chosen.userData.label) chosen.userData.label.visible=true;
    say(`${chosen.userData.name}, on ${surfaceName(surfaceOf(chosen))}, ${list.indexOf(chosen)+1} of ${list.length}. Space picks it up.`);
  }
  function pickUp(){
    if(!chosen){ choose(1); return; }
    held=chosen;
    origin={ shelfIndex:held.userData.shelfIndex, slot:held.userData.slot };
    lift(held);
    say(`Picked up ${held.userData.name}. Up and Down carry it to another shelf, Left and Right move it along, Space puts it down, Escape puts it back.`);
  }
  function carry(dShelf, dSlot){
    const here=surfaceOf(held);
    let target=here;
    if(dShelf){
      target=surfaces[surfaces.indexOf(here)+dShelf];
      if(!target){ say(`Nothing ${dShelf<0?'above':'below'} ${surfaceName(here)}.`); return; }
    }
    const others=items.filter(m=>m!==held&&m.userData.shelfIndex===target.index);
    const slot=dShelf?others.length:Math.max(0, Math.min(others.length, held.userData.slot+dSlot));
    if(!dShelf&&slot===held.userData.slot){
      say(`${held.userData.name} is already at the ${dSlot<0?'start':'end'} of ${surfaceName(target)}.`);
      return;
    }
    placeAt(held, target.index, slot);
    held.position.y+=1.2;
    if(held.userData.label) held.userData.label.visible=true;
    say(`${held.userData.name} on ${surfaceName(target)}, position ${slot+1} of ${others.length+1}.`);
  }
  function putBack(item, why){
    placeAt(item, origin.shelfIndex, origin.slot);
    say(`${why} ${item.userData.name} is back on ${surfaceName(surfaceOf(item))}.`);
  }
  function putDown(){
    const item=held; held=null;
    settle(item);
    const target=surfaceOf(item);
    if(target && canDrop && !canDrop(item, target)){
      if(onRejectDrop) onRejectDrop(item, target);
      putBack(item, `${item.userData.name} cannot go on ${surfaceName(target)}.`);
    }else{
      reflow();
      if(onDrop) onDrop(item, target);
      say(`Put down ${item.userData.name} on ${surfaceName(target)}.`);
    }
    origin=null;
  }
  function cancel(){
    const item=held; held=null;
    settle(item);
    putBack(item, 'Put back.');
    origin=null;
  }
  function onKey(e){
    if(dragging) return;
    const k=e.key;
    if(held){
      if(k==='ArrowUp') carry(-1,0);
      else if(k==='ArrowDown') carry(1,0);
      else if(k==='ArrowLeft') carry(0,-1);
      else if(k==='ArrowRight') carry(0,1);
      else if(k===' '||k==='Enter') putDown();
      else if(k==='Escape') cancel();
      else return;
      e.preventDefault();
      return;
    }
    if(k==='ArrowRight'||k==='ArrowDown') choose(1);
    else if(k==='ArrowLeft'||k==='ArrowUp') choose(-1);
    else if(k===' '||k==='Enter') pickUp();
    else return;
    e.preventDefault();
  }
  function onBlur(){
    if(held) cancel();
    if(chosen&&chosen.userData.label) chosen.userData.label.visible=false;
    chosen=null;
    hovered=null;
  }

  /* The render loop is on-demand now (js/three/scene.js): nothing repaints on
     its own, so every handler here that can move or restyle something in the
     scene — a drag in flight, a lift, a keyboard carry — has to ask for a
     frame itself. Wrapping each listener rather than sprinkling
     requestRender() through every mutation above means a new interaction
     added later cannot forget it. */
  function withRender(fn){
    return (...args)=>{ fn(...args); requestRender(); };
  }
  const onDownR=withRender(onDown);
  const onMoveR=withRender(onMove);
  const onUpR=withRender(onUp);
  const onLeaveR=withRender(onLeave);
  const onKeyR=withRender(onKey);
  const onBlurR=withRender(onBlur);

  canvas.addEventListener('pointerdown', onDownR);
  canvas.addEventListener('pointermove', onMoveR);
  canvas.addEventListener('pointerup', onUpR);
  canvas.addEventListener('pointercancel', onUpR);
  canvas.addEventListener('pointerleave', onLeaveR);
  canvas.addEventListener('keydown', onKeyR);
  canvas.addEventListener('blur', onBlurR);
  return ()=>{
    canvas.removeEventListener('pointerdown', onDownR);
    canvas.removeEventListener('pointermove', onMoveR);
    canvas.removeEventListener('pointerup', onUpR);
    canvas.removeEventListener('pointercancel', onUpR);
    canvas.removeEventListener('pointerleave', onLeaveR);
    canvas.removeEventListener('keydown', onKeyR);
    canvas.removeEventListener('blur', onBlurR);
  };
}
