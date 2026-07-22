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
    color:0xe0e0e0, roughness:0.5, transparent:true, opacity:0.25 });
  const doorH=H-2*T;
  const doorZ=D/2;
  addBox(scene, W-T, doorH, T*0.3, 2, H/2, doorZ+3, doorMat);

  const handleMat=new THREE.MeshStandardMaterial({ color:0xaaaaaa, metalness:0.5, roughness:0.3 });
  addBox(scene, 0.5, H*0.3, 0.6, -W/2+T+1, H*0.55, doorZ+3.3, handleMat);

  const glassMat=new THREE.MeshStandardMaterial({
    color:0xd8ecf0, roughness:0.3, transparent:true, opacity:0.3 });

  const drawerMat=new THREE.MeshStandardMaterial({ color:0xd0d4d0, roughness:0.65 });

  const surfaces=[];
  const usable=W-2*T-2;

  shelfYs.forEach((y,i)=>{
    const row=rowsByShelf.get(i)||null;
    const surface=row&&row.surface;
    const isDrawer=surface==='drawer'||(i>=NSH-2 && !surface);
    const isShelf=!isDrawer;

    if(isDrawer){
      const drawerH=Math.min(gapAbove[i]-0.5, 7);
      const pullOut=D*0.55;
      addBox(scene, usable, T*0.5, D-T, 0, y-T*0.25, T/4, drawerMat);
      addBox(scene, usable, drawerH-T, T*0.3, 0, y+drawerH/2-0.5, pullOut/2, drawerMat);
      addBox(scene, T*0.4, drawerH-T, pullOut, -W/2+T+0.5, y+drawerH/2-0.5, pullOut/2, drawerMat);
      addBox(scene, T*0.4, drawerH-T, pullOut,  W/2-T-0.5, y+drawerH/2-0.5, pullOut/2, drawerMat);

      addBox(scene, usable*0.25, 0.35, 0.5, 0, y+drawerH/2-0.5, pullOut+0.4, handleMat);

      const accent=accentFor(row);
      if(accent) addBox(scene, usable, 0.3, 0.3, 0, y+drawerH-0.3, pullOut+0.3, new THREE.MeshBasicMaterial({ color:accent }));
      if(row) addShelfLabel(scene, row, -W/2, y+drawerH+1.5, pullOut+0.6);

      const hit=makeHitbox(scene, usable, Math.max(5, drawerH), pullOut+2,
        0, y+drawerH/2, pullOut/2,
        { shelfIndex:i, shelfY:y, row });

      surfaces.push({
        index:i, kind:'drawer', row, y, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
        length:usable, gap:drawerH-1, itemDepth:Math.min(pullOut*0.8, 8),
      });
    } else {
      if(y<H-T*2 && y>T*1.6){
        addBox(scene, W-2*T, T*0.5, D-T, 0, y-T*0.25, T/4, glassMat);
      }

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
    }
  });

  return { surfaces };
}
