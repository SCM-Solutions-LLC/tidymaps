import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

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

  addBox(scene, doorW, doorH, T*0.4, -W/4, H/2, doorZ+T*0.2+2, doorMat);  // left door ajar
  addBox(scene, doorW, doorH, T*0.4,  W/4, H/2, doorZ+T*0.2+2, doorMat);  // right door ajar

  const hingeMat=new THREE.MeshStandardMaterial({ color:0x999999, metalness:0.5, roughness:0.3 });
  for(const sx of [-1, 1]){
    for(const hy of [H*0.3, H*0.7]){
      addBox(scene, 0.5, 1.2, 0.5, sx*(W/2-T-0.3), hy, doorZ+0.3, hingeMat);
    }
  }

  const handleMat=new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.6, roughness:0.3 });
  addBox(scene, 0.4, 3, 0.6, -T*2, H/2, doorZ+T*0.2+2.3, handleMat);
  addBox(scene, 0.4, 3, 0.6,  T*2, H/2, doorZ+T*0.2+2.3, handleMat);

  const surfaces=[];
  const usable=W-2*T-2;

  shelfYs.forEach((y,i)=>{
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
      length:usable, gap:gapAbove[i], itemDepth:Math.min(D*0.55, 8),
    });
  });

  return { surfaces };
}
