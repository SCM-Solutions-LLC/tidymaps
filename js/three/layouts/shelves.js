import * as THREE from 'three';
import { addBox, addShelfLabel, addAccentStrip, makeHitbox } from './helpers.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats, layout }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;
  const floating=['openshelf','wallshelf'].includes(layout&&layout.setup);
  const placement=floating&&(layout&&layout.shelfPlacement)||'center';

  addBox(scene, W, H, floating?T*0.45:T, 0, H/2, -D/2+T/2, mats.carcass);  // wall/back
  if(!floating){
    addBox(scene, T, H, D, -W/2+T/2, H/2, 0, mats.carcass);
    addBox(scene, T, H, D,  W/2-T/2, H/2, 0, mats.carcass);
    addBox(scene, W, T, D, 0, H-T/2, 0, mats.carcass);
    addBox(scene, W, T, D, 0, T/2, 0, mats.carcass);
  }

  const surfaces=[];
  const usable=floating?Math.max(12,W*0.72):W-2*T-2;
  const shelfTravel=floating?Math.max(0,(W-usable)/2-1.5):0;
  const shelfX=placement==='left'?-shelfTravel:placement==='right'?shelfTravel:0;
  const bracketMat=new THREE.MeshStandardMaterial({color:0x8f948d,metalness:0.45,roughness:0.38});

  shelfYs.forEach((y,i)=>{
    if(y<H-T*2 && y>T*1.6){
      addBox(scene, usable, T, D-T, shelfX, y-T/2, T/4, mats.shelf);
      if(floating){
        for(const x of [-usable*0.32,usable*0.32]){
          addBox(scene,T*0.45,Math.min(4,D*0.35),T*0.45,shelfX+x,y-Math.min(2,D*0.175),-D/2+T,bracketMat);
          addBox(scene,T*0.45,T*0.45,Math.max(2,D*0.45),shelfX+x,y-T,D*0.1,bracketMat);
        }
      }
    }
    const row=rowsByShelf.get(i)||null;

    addAccentStrip(scene, row, usable, y-T/2, D/2-0.3, shelfX);
    if(row){
      addShelfLabel(scene, row, shelfX-usable/2, y+3.4, D/2+0.6);
    }

    const hit=makeHitbox(scene,
      usable, Math.max(6, H/NSH*0.85), D,
      shelfX, y+Math.max(3, H/NSH*0.42), 0,
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
