import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

/* Built-in closet: real upper shelf + hanging zones + visible lower drawers.
   Items still follow plan surfaces, while permanent drawer fronts make the
   selected "Built-in + drawers" setup unmistakable. */
export function build(ctx){
  const { scene, geo, rowsByShelf, mats }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  addBox(scene, W, H, T, 0, H/2, -D/2+T/2, mats.carcass);
  addBox(scene, T, H, D, -W/2+T/2, H/2, 0, mats.carcass);
  addBox(scene, T, H, D, W/2-T/2, H/2, 0, mats.carcass);
  addBox(scene, W, T, D, 0, H-T/2, 0, mats.carcass);
  addBox(scene, W, T, D, 0, T/2, 0, mats.carcass);

  const drawerMat=new THREE.MeshStandardMaterial({ color:0xd8d2c5, roughness:0.72 });
  const hardware=new THREE.MeshStandardMaterial({ color:0x8a8177, metalness:0.55, roughness:0.3 });
  const drawerBankW=Math.min(W*0.46, 34);
  const drawerBankH=Math.min(H*0.3, 25);
  addBox(scene, drawerBankW, drawerBankH, D-T, 0, drawerBankH/2+T, 0, drawerMat);
  for(let i=1;i<3;i++) addBox(scene, drawerBankW-1, 0.25, 0.25, 0, T+drawerBankH*i/3, D/2+0.2, hardware);
  for(let i=0;i<3;i++) addBox(scene, drawerBankW*0.22, 0.35, 0.55, 0, T+drawerBankH*(i+0.5)/3, D/2+0.45, hardware);

  const rodMat=new THREE.MeshStandardMaterial({ color:0x8d9490, metalness:0.7, roughness:0.24 });
  const surfaces=[];
  const usable=W-2*T-2;

  shelfYs.forEach((baseY,i)=>{
    const row=rowsByShelf.get(i)||null;
    const surface=(row&&row.surface)||(i===0?'shelf':i===NSH-1?'floor':'rod');
    let y=baseY;

    if(surface==='rod'){
      y=Math.max(drawerBankH+9, Math.min(H-9, baseY+gapAbove[i]*0.72));
      const halfGap=2;
      for(const side of [-1,1]){
        const len=(usable-drawerBankW-halfGap*2)/2;
        if(len<=3) continue;
        const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,len,14),rodMat);
        rod.rotation.z=Math.PI/2;
        rod.position.set(side*(drawerBankW/2+halfGap+len/2),y,0);
        scene.add(rod);
      }
    }else if(surface==='shelf' && y>drawerBankH+T && y<H-T*2){
      addBox(scene,usable,T,D-T,0,y-T/2,T/4,mats.shelf);
    }

    const accent=accentFor(row);
    if(accent) addBox(scene,usable,0.35,0.35,0,y+0.2,D/2-0.3,new THREE.MeshBasicMaterial({color:accent}));
    if(row) addShelfLabel(scene,row,-W/2,y+3.2,D/2+0.7);

    const floor=surface==='floor';
    const hit=makeHitbox(scene,usable,Math.max(6,H/NSH*0.8),D,0,
      floor?T+3:y+(surface==='rod'?-Math.max(3,gapAbove[i]*0.25):Math.max(3,H/NSH*0.4)),0,
      {shelfIndex:i,shelfY:y,row});
    surfaces.push({
      index:i,kind:surface,row,y:floor?T:y,hitbox:hit,
      uDir:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1),
      length:usable,gap:surface==='rod'?Math.max(10,gapAbove[i]*0.75):gapAbove[i],
      itemDepth:surface==='rod'?2:Math.min(D*0.55,8),
    });
  });
  return { surfaces };
}
