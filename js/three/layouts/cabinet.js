import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox, addOpenDoor, doorFramePoints } from './helpers.js';
import { doorRowsOf, shelfRowsOf } from '../roomBoards.js';
import { openDoor, doorSlot, binOf } from '../doorBins.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  addBox(scene, W, H, T, 0, H/2, -D/2+T/2, mats.carcass);   // back
  addBox(scene, T, H, D, -W/2+T/2, H/2, 0, mats.carcass);   // left
  addBox(scene, T, H, D,  W/2-T/2, H/2, 0, mats.carcass);   // right
  addBox(scene, W, T, D, 0, H-T/2, 0, mats.carcass);         // top
  addBox(scene, W, T, D, 0, T/2, 0, mats.carcass);           // bottom

  const doorMat=new THREE.MeshStandardMaterial({
    color:0xdcd5c8, roughness:0.7, transparent:true, opacity:0.35 });
  const doorW=W/2-T;
  const doorH=H-2*T;
  const doorZ=D/2;

  /* A door rack row hangs on the inside of the right door, so that door is
     drawn swung open with the rack on it. It used to be one more board
     inside the box, a shelf the cabinet does not have. */
  const doorRows=doorRowsOf(ctx.map, ctx.layout);
  const rackRows=[...doorRows].sort((a,b)=>a-b);
  const rack=rackRows.length?openDoor({ role:'cabinet', hinge:'right', x0:0, x1:W/2, y0:T, y1:H-T, bins:Math.min(5, Math.max(3, rackRows.length)) }):null;

  addBox(scene, doorW, doorH, T*0.4, -W/4, H/2, doorZ+T*0.2+2, doorMat);  // left door ajar
  if(rack){
    const binMat=new THREE.MeshStandardMaterial({ color:0xcfc6b6, roughness:0.6 });
    addOpenDoor(scene, rack, doorZ, { shellMat:doorMat, linerMat:doorMat, binMat, handleMat:new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.6, roughness:0.3 }) });
    scene.userData.framePoints=doorFramePoints([rack], doorZ);
  }else{
    addBox(scene, doorW, doorH, T*0.4,  W/4, H/2, doorZ+T*0.2+2, doorMat);  // right door ajar
  }

  const hingeMat=new THREE.MeshStandardMaterial({ color:0x999999, metalness:0.5, roughness:0.3 });
  for(const sx of [-1, 1]){
    for(const hy of [H*0.3, H*0.7]){
      addBox(scene, 0.5, 1.2, 0.5, sx*(W/2-T-0.3), hy, doorZ+0.3, hingeMat);
    }
  }

  const handleMat=new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.6, roughness:0.3 });
  addBox(scene, 0.4, 3, 0.6, -T*2, H/2, doorZ+T*0.2+2.3, handleMat);
  if(!rack) addBox(scene, 0.4, 3, 0.6,  T*2, H/2, doorZ+T*0.2+2.3, handleMat);

  const surfaces=[];
  const usable=W-2*T-2;
  /* Board j carries the j-th shelf row. With no door rows that is row j,
     as it always was; with them, scene.js has already counted the boards
     without the door rows (roomBoards.cabinetShelfGeometry). A board past
     the last shelf row is empty, and is keyed past every row of the plan
     so it is never mistaken for a door row. */
  const shelfRows=doorRows.size?shelfRowsOf(ctx.map, ctx.layout):null;
  const lastRow=Math.max(-1, ...(ctx.map||[]).map((row, i)=>(Number.isInteger(row&&row.shelfIndex)?row.shelfIndex:i)));
  const boardRow=j=>!shelfRows?j:j<shelfRows.length?shelfRows[j]:lastRow+1+(j-shelfRows.length);

  rackRows.forEach((i, t)=>{
    const row=rowsByShelf.get(i)||null;
    const slot=doorSlot(i, rack, binOf(t, rackRows.length, rack.bins), doorZ);
    const normal=new THREE.Vector3(slot.normal.x, 0, slot.normal.z);
    const uDir=new THREE.Vector3(slot.uDir.x, 0, slot.uDir.z);
    const label=row?addShelfLabel(scene, row, slot.x, slot.y+Math.min(3.4, slot.gap*0.6), slot.z, { normal }):null;
    if(label) label.position.set(slot.x+normal.x*3, slot.y+Math.min(3.4, slot.gap*0.6), slot.z+normal.z*3+0.6);
    const hit=makeHitbox(scene, slot.length, Math.max(3, slot.gap*0.85), slot.depth,
      slot.x, slot.y+Math.max(1.5, slot.gap*0.42), slot.z, { shelfIndex:i, shelfY:slot.y, row });
    hit.rotation.y=Math.atan2(-uDir.z, uDir.x);
    surfaces.push({
      index:i, kind:'door', row, y:slot.y, hitbox:hit, uDir, normal,
      length:slot.length, gap:slot.gap, depth:slot.depth, itemDepth:3,
    });
  });

  shelfYs.forEach((y,j)=>{
    const i=boardRow(j);
    const row=rowsByShelf.get(i)||null;
    if(y<H-T*2 && y>T*1.6) addBox(scene, W-2*T, T, D-T, 0, y-T/2, T/4, mats.shelf);

    const accent=accentFor(row);
    if(accent) addBox(scene, W-2*T, 0.4, 0.4, 0, y+0.2-T/2, D/2-0.3, new THREE.MeshBasicMaterial({ color:accent }));
    if(row) addShelfLabel(scene, row, -W/2, y+3.4, D/2+0.6);

    const hit=makeHitbox(scene, W-2*T, Math.max(6, H/NSH*0.85), D,
      0, y+Math.max(3, H/NSH*0.42), 0,
      { shelfIndex:i, shelfY:y, row });

    surfaces.push({
      index:i, kind:'shelf', row, y, hitbox:hit,
      uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
      length:usable, gap:gapAbove[j], itemDepth:Math.min(D*0.55, 8),
    });
  });

  surfaces.sort((a,b)=>a.index-b.index);
  return { surfaces };
}
