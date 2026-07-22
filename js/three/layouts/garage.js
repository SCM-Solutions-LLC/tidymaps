import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

export function buildGarageRack(ctx){
  const { scene, geo, rowsByShelf, mats }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  const postMat=new THREE.MeshStandardMaterial({ color:0x777777, metalness:0.4, roughness:0.5 });
  const postW=1.5;
  for(const sx of [-1, 1]){
    for(const sz of [-1, 1]){
      addBox(scene, postW, H, postW,
        sx*(W/2-postW/2), H/2, sz*(D/2-postW/2), postMat);
    }
  }

  const groundMat=new THREE.MeshStandardMaterial({ color:0xb0afa8, roughness:0.95 });
  addBox(scene, W+8, 0.3, D+10, 0, -0.15, 2, groundMat);

  const surfaces=[];
  const usable=W-postW*2-1;

  shelfYs.forEach((y,i)=>{
    const row=rowsByShelf.get(i)||null;
    const isFloor=i>=NSH-1||(row&&row.surface==='floor');

    if(isFloor){
      if(row) addShelfLabel(scene, row, -W/2-2, T+3.4, D/2+2);

      const hit=makeHitbox(scene, W+6, 5, D+8,
        0, 2.5, 2,
        { shelfIndex:i, shelfY:0, row });

      surfaces.push({
        index:i, kind:'floor', row, y:0, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
        length:usable+4, gap:shelfYs[NSH-2]||H*0.3, itemDepth:D,
      });
    } else {
      addBox(scene, W-postW, T*0.8, D-postW, 0, y-T*0.4, 0,
        new THREE.MeshStandardMaterial({ color:0xc0beb0, roughness:0.8 }));

      const accent=accentFor(row);
      if(accent) addBox(scene, usable, 0.4, 0.4, 0, y+0.2-T/2, D/2-0.3, new THREE.MeshBasicMaterial({ color:accent }));
      if(row) addShelfLabel(scene, row, -W/2, y+3.4, D/2+0.6);

      const hit=makeHitbox(scene, usable, Math.max(6, H/NSH*0.85), D,
        0, y+Math.max(3, H/NSH*0.42), 0,
        { shelfIndex:i, shelfY:y, row });

      surfaces.push({
        index:i, kind:'shelf', row, y, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
        length:usable, gap:gapAbove[i], itemDepth:Math.min(D*0.55, 8),
      });
    }
  });

  return { surfaces };
}

export function buildOverheadRack(ctx){
  const { scene, geo, rowsByShelf, mats }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  const strutMat=new THREE.MeshStandardMaterial({ color:0x666666, metalness:0.5, roughness:0.4 });
  const strutW=1;
  const ceilY=H+8;

  for(const sx of [-1, 1]){
    for(const sz of [-1, 1]){
      addBox(scene, strutW, 10, strutW,
        sx*(W/2-strutW), ceilY-5, sz*(D/2-strutW), strutMat);
    }
  }

  const deckMat=new THREE.MeshStandardMaterial({ color:0xb0afa8, roughness:0.8 });
  addBox(scene, W, T, D, 0, ceilY-10, 0, deckMat);

  const surfaces=[];
  const usable=W-2;

  shelfYs.forEach((y,i)=>{
    const row=rowsByShelf.get(i)||null;
    const shelfY=ceilY-10+T;

    addBox(scene, usable, T*0.6, D-1, 0, shelfY+y*0.1-T*0.3, 0, mats.shelf);
    if(row) addShelfLabel(scene, row, -W/2, shelfY+y*0.1+2.5, D/2+0.6);

    const accent=accentFor(row);
    if(accent) addBox(scene, usable, 0.35, 0.35, 0, shelfY+y*0.1+0.2, D/2-0.3, new THREE.MeshBasicMaterial({ color:accent }));

    const hit=makeHitbox(scene, usable, Math.max(5, 6), D,
      0, shelfY+y*0.1+2.5, 0,
      { shelfIndex:i, shelfY:shelfY+y*0.1, row });

    surfaces.push({
      index:i, kind:'shelf', row, y:shelfY+y*0.1, hitbox:hit,
      uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
      length:usable, gap:gapAbove[i]||6, itemDepth:Math.min(D*0.55, 8),
    });
  });

  return { surfaces };
}
