import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox, addOpenDoor, doorFramePoints } from './helpers.js';
import { fridgePlan } from '../fridgePlan.js';

/* A fridge, drawn as the card the user picked: shelves and crispers in the
   fresh compartment, bins on the inside of the doors (swung open so they
   face you), and the freezer where that model keeps it. Which row goes
   where is fridgePlan's (js/three/fridgePlan.js), the same answer the size
   arithmetic reads. It used to stack every row as a glass shelf in one box,
   so a twelve-row French door showed twelve shelves with its door bins and
   freezer baskets among them. */

const V=(o)=>new THREE.Vector3(o.x, o.y||0, o.z);

export function build(ctx){
  const { scene, geo, map, layout }=ctx;
  const { W, H, D, T }=geo;
  const plan=fridgePlan({ setup:layout&&layout.setup, map, layout, width:W, height:H, depth:D });

  const shellMat=new THREE.MeshStandardMaterial({ color:0xf4f5f2, roughness:0.55 });
  const linerMat=new THREE.MeshStandardMaterial({ color:0xfbfcfa, roughness:0.7 });
  const glassMat=new THREE.MeshStandardMaterial({ color:0xd8ecf0, roughness:0.25, transparent:true, opacity:0.45 });
  const binMat=new THREE.MeshStandardMaterial({ color:0xdbe9ee, roughness:0.35, transparent:true, opacity:0.55 });
  const drawerMat=new THREE.MeshStandardMaterial({ color:0xe3eef0, roughness:0.4, transparent:true, opacity:0.5 });
  /* The freezer drawer's front stands between the camera and the baskets
     drawn out of it, so it is see-through, like the old fridge door was. */
  const freezerMat=new THREE.MeshStandardMaterial({ color:0xe6ecf2, roughness:0.6, transparent:true, opacity:0.35 });
  const handleMat=new THREE.MeshStandardMaterial({ color:0xb5b8b2, metalness:0.6, roughness:0.3 });

  // The cabinet: back, sides, top, bottom.
  addBox(scene, W, H, T, 0, H/2, -D/2+T/2, linerMat);
  addBox(scene, T, H, D, -W/2+T/2, H/2, 0, shellMat);
  addBox(scene, T, H, D,  W/2-T/2, H/2, 0, shellMat);
  addBox(scene, W, T, D, 0, H-T/2, 0, shellMat);
  addBox(scene, W, T, D, 0, T/2, 0, shellMat);
  for(const d of plan.dividers){
    if(d.axis==='y') addBox(scene, W-2*T, T*2, D-T, 0, d.at, T/2, shellMat);
    else addBox(scene, T, H-2*T, D-T, d.at, H/2, T/2, shellMat);
  }

  for(const b of plan.boards){
    addBox(scene, b.x1-b.x0, T*0.5, D-T-1, (b.x0+b.x1)/2, b.y-T*0.25, T/2-0.5, glassMat);
  }

  // Crisper and deli drawers: clear bins at the front of the compartment.
  for(const dr of plan.drawers){
    const dd=D*0.8, z=D/2-dd/2-0.3, w=dr.w-1;
    addBox(scene, w, 0.3, dd, dr.x, dr.y+0.15, z, drawerMat);
    addBox(scene, w, dr.h-0.8, 0.3, dr.x, dr.y+(dr.h-0.8)/2, D/2-0.3, drawerMat);
    addBox(scene, 0.3, dr.h-0.8, dd, dr.x-w/2, dr.y+(dr.h-0.8)/2, z, drawerMat);
    addBox(scene, 0.3, dr.h-0.8, dd, dr.x+w/2, dr.y+(dr.h-0.8)/2, z, drawerMat);
    addBox(scene, Math.min(6, w*0.4), 0.5, 0.5, dr.x, dr.y+dr.h-1.6, D/2+0.1, handleMat);
  }

  // A pull-out freezer drawer: its front, and the baskets drawn out of it.
  const fz=plan.freezer;
  if(fz&&fz.kind==='drawer'){
    const pull=D*0.5;
    addBox(scene, W-0.4, fz.y1-fz.y0+T, 1.6, 0, (fz.y0+fz.y1)/2, D/2+pull+0.8, freezerMat);
    addBox(scene, W*0.5, 0.7, 0.9, 0, fz.y1-2, D/2+pull+2, handleMat);
    for(const b of plan.freezerBaskets){
      const bd=D*0.85, z=pull+T/2;
      const w=b.x1-b.x0-0.6, cx=(b.x0+b.x1)/2;
      addBox(scene, w, 0.3, bd, cx, b.y, z, binMat);
      addBox(scene, 0.3, b.h, bd, b.x0+0.3, b.y+b.h/2, z, binMat);
      addBox(scene, 0.3, b.h, bd, b.x1-0.3, b.y+b.h/2, z, binMat);
      addBox(scene, w, b.h, 0.3, cx, b.y+b.h/2, z-bd/2, binMat);
      for(let k=1;k<b.splits;k++) addBox(scene, 0.3, b.h*0.8, bd, b.x0+(b.x1-b.x0)*k/b.splits, b.y+b.h*0.4, z, binMat);
    }
  }

  // Doors, swung open, with their bins on the inside.
  for(const d of plan.doors) addOpenDoor(scene, d, D/2, { shellMat, linerMat, binMat, handleMat });
  scene.userData.framePoints=doorFramePoints(plan.doors, D/2);

  // One surface per row, where fridgePlan put it.
  const surfaces=[];
  /* Slots side by side on one level (three freezer baskets, two crispers)
     would print their labels on one line over each other: each one after
     the first on a level sits a little higher. */
  const sharing=new Map();
  for(const [index, slot] of plan.slots){
    const row=ctx.rowsByShelf.get(index)||null;
    const normal=slot.normal?V(slot.normal):new THREE.Vector3(0,0,1);
    const uDir=slot.uDir?V(slot.uDir):new THREE.Vector3(1,0,0);
    const rotY=Math.atan2(-uDir.z, uDir.x);
    const front=slot.part==='door'?slot.z:(slot.part==='freezer'&&fz&&fz.kind==='drawer')?D/2+D*0.5+1.8:D/2;

    const accent=accentFor(row);
    if(accent){
      const strip=addBox(scene, slot.length, 0.4, 0.4,
        slot.x+normal.x*(slot.depth/2), slot.y+0.2, slot.part==='door'?slot.z+normal.z*(slot.depth/2):front-0.3,
        new THREE.MeshBasicMaterial({ color:accent }));
      strip.rotation.y=rotY;
    }
    if(row){
      const levelKey=`${slot.part==='door'?slot.hinge+slot.door:'in'}:${Math.round(slot.y*2)}:${Math.round(slot.z)}`;
      const nth=sharing.get(levelKey)||0;
      sharing.set(levelKey, nth+1);
      const label=addShelfLabel(scene, row, slot.x-slot.length/2, slot.y+Math.min(3.4, slot.gap*0.6)+nth*2.4, front+0.6, { normal });
      if(label&&slot.part==='door'){
        label.position.set(slot.x+normal.x*3, slot.y+Math.min(3.4, slot.gap*0.6), slot.z+normal.z*3+0.6);
      }
    }

    const hit=makeHitbox(scene, slot.length, Math.max(3, slot.gap*0.85), slot.depth,
      slot.x, slot.y+Math.max(1.5, slot.gap*0.42), slot.part==='door'?slot.z:slot.z+(slot.part==='freezer'&&fz&&fz.kind==='drawer'?0:T/2),
      { shelfIndex:index, shelfY:slot.y, row });
    hit.rotation.y=rotY;

    surfaces.push({
      index, kind:slot.kind, row, y:slot.y, hitbox:hit,
      uDir, normal,
      length:slot.length, gap:slot.gap, depth:slot.depth,
      itemDepth:Math.min(slot.depth*0.55, slot.part==='door'?3:8),
      ...(slot.kind==='drawer'?{ drawDepth:slot.depth }:{}),
    });
  }

  /* Plan order: the keyboard's "move up a shelf" steps through this list. */
  surfaces.sort((a,b)=>a.index-b.index);
  return { surfaces };
}
