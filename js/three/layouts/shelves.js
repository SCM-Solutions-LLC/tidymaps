import * as THREE from 'three';
import { addBox, addShelfLabel, addAccentStrip, makeHitbox } from './helpers.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  addBox(scene, W, H, T, 0, H/2, -D/2+T/2, mats.carcass);  // back
  addBox(scene, T, H, D, -W/2+T/2, H/2, 0, mats.carcass);  // left
  addBox(scene, T, H, D,  W/2-T/2, H/2, 0, mats.carcass);  // right
  addBox(scene, W, T, D, 0, H-T/2, 0, mats.carcass);        // top
  addBox(scene, W, T, D, 0, T/2, 0, mats.carcass);          // bottom

  const surfaces=[];
  const usable=W-2*T-2;

  shelfYs.forEach((y,i)=>{
    if(y<H-T*2 && y>T*1.6) addBox(scene, W-2*T, T, D-T, 0, y-T/2, T/4, mats.shelf);
    const row=rowsByShelf.get(i)||null;

    addAccentStrip(scene, row, W-2*T, y-T/2, D/2-0.3);
    if(row){
      addShelfLabel(scene, row, -W/2, y+3.4, D/2+0.6);
    }

    const hit=makeHitbox(scene,
      W-2*T, Math.max(6, H/NSH*0.85), D,
      0, y+Math.max(3, H/NSH*0.42), 0,
      { shelfIndex:i, shelfY:y, row });

    surfaces.push({
      index:i, kind:'shelf', row, y, hitbox:hit,
      uDir: new THREE.Vector3(1,0,0),
      normal: new THREE.Vector3(0,0,1),
      length: usable,
      gap: gapAbove[i],
      itemDepth: Math.min(D*0.55, 8),
    });
  });

  return { surfaces };
}
