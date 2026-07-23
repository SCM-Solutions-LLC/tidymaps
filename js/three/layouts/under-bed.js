import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

/* Low platform with side-by-side rolling drawers. Rows become horizontal
   drawer bays instead of a tall drawer tower. */
export function build(ctx){
  const { scene, geo, rowsByShelf, mats }=ctx;
  const { W, H, D, T, NSH, gapAbove }=geo;
  const frameH=Math.max(7,Math.min(H*0.72,12));
  const mattressH=Math.max(3,Math.min(6,H-frameH+2));
  const frontZ=D/2;

  addBox(scene,W,frameH,D,0,frameH/2,0,mats.carcass);
  const mattress=new THREE.MeshStandardMaterial({color:0xe8dfd2,roughness:0.95});
  addBox(scene,W+2,mattressH,D+2,0,frameH+mattressH/2,0,mattress);

  const drawerMat=new THREE.MeshStandardMaterial({color:0xd8c9b7,roughness:0.72});
  const hardware=new THREE.MeshStandardMaterial({color:0x85796f,metalness:0.5,roughness:0.35});
  const count=Math.max(1,NSH);
  const bayW=W/count;
  const surfaces=[];

  for(let i=0;i<count;i++){
    const row=rowsByShelf.get(i)||null;
    const x=-W/2+bayW*(i+0.5);
    addBox(scene,bayW-1.2,frameH-1.5,T*0.45,x,frameH/2,frontZ+0.3,drawerMat);
    addBox(scene,Math.min(7,bayW*0.36),0.35,0.6,x,frameH*0.58,frontZ+0.7,hardware);
    const accent=accentFor(row);
    if(accent) addBox(scene,bayW-2,0.3,0.3,x,frameH-0.8,frontZ+0.8,new THREE.MeshBasicMaterial({color:accent}));
    if(row) addShelfLabel(scene,row,x-bayW/2,frameH+2.2,frontZ+1);
    const hit=makeHitbox(scene,bayW-1.5,frameH-1,D*0.7,x,frameH/2,D*0.12,
      {shelfIndex:i,shelfY:T,row});
    surfaces.push({
      index:i,kind:'drawer',row,y:T,hitbox:hit,
      uDir:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1),
      length:bayW-2,gap:Math.max(4,(gapAbove&&gapAbove[i])||frameH-2),itemDepth:Math.min(D*0.5,8),
    });
  }
  return { surfaces };
}
