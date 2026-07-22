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
   nothing but can warn (safety). */

export function attachDrag(view, { onDrop }={}){
  const { renderer, camera, controls, items, shelves, reflow }=view;
  const surfaces=view.surfaces||shelves;
  const canvas=renderer.domElement;
  const ray=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  let dragging=null, dragSurface=null;

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
    dragSurface=surfaces.find(s=>s.index===dragging.userData.shelfIndex)||null;
    controls.enabled=false;
    dragging.position.y+=1.2;
    dragging.material.emissive=new THREE.Color(0x1c2b20);
    canvas.setPointerCapture(e.pointerId);
  }

  function onMove(e){
    if(!dragging) return;
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
    if(dragSurface){
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
    try{ canvas.releasePointerCapture(e.pointerId); }catch(_){}
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  return ()=>{
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
  };
}
