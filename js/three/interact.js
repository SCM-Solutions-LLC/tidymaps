import * as THREE from 'three';

/* Pointer-drag for items: raycast pick, lift, retarget across shelf
   hitboxes, snap into a slot on drop. onDrop(item, targetShelf) may veto
   nothing but can warn (safety). */

export function attachDrag(view, { onDrop }={}){
  const { renderer, camera, controls, items, shelves, reflow }=view;
  const canvas=renderer.domElement;
  const ray=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  let dragging=null, dragShelf=null;

  function cast(e, targets){
    const r=canvas.getBoundingClientRect();
    pointer.x=((e.clientX-r.left)/r.width)*2-1;
    pointer.y=-((e.clientY-r.top)/r.height)*2+1;
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(targets, false);
  }

  function onDown(e){
    const hit=cast(e, items)[0];
    if(!hit) return;
    dragging=hit.object;
    dragShelf=shelves.find(s=>s.index===dragging.userData.shelfIndex)||null;
    controls.enabled=false;
    dragging.position.y+=1.2;
    dragging.material.emissive=new THREE.Color(0x1c2b20);
    canvas.setPointerCapture(e.pointerId);
  }

  function onMove(e){
    if(!dragging) return;
    const shelfHit=cast(e, shelves.map(s=>s.hitbox))[0];
    if(shelfHit){
      dragShelf=shelves.find(s=>s.hitbox===shelfHit.object);
      const p=shelfHit.point;
      const halfW=(shelfHit.object.geometry.parameters.width)/2-dragging.scale.x/2;
      dragging.position.x=Math.max(-halfW, Math.min(halfW, p.x));
      dragging.position.y=dragShelf.y+dragging.scale.y/2+1.2;
      dragging.userData.label.position.x=dragging.position.x;
      dragging.userData.label.position.y=dragging.position.y+dragging.scale.y/2+0.6;
    }
  }

  function onUp(e){
    if(!dragging) return;
    const item=dragging;
    dragging=null;
    controls.enabled=true;
    item.material.emissive=new THREE.Color(0x000000);
    if(dragShelf){
      item.userData.shelfIndex=dragShelf.index;
      // slot from x position among items on the target shelf
      const here=items.filter(m=>m!==item && m.userData.shelfIndex===dragShelf.index)
        .sort((a,b)=>a.position.x-b.position.x);
      let slot=here.findIndex(m=>item.position.x<m.position.x);
      if(slot<0) slot=here.length;
      here.forEach((m,i)=>{ m.userData.slot=i>=slot?i+1:i; });
      item.userData.slot=slot;
      if(onDrop) onDrop(item, dragShelf);
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
