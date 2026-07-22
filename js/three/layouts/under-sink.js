import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  addBox(scene, W, H, T, 0, H/2, -D/2+T/2, mats.carcass);  // back
  addBox(scene, T, H, D, -W/2+T/2, H/2, 0, mats.carcass);  // left
  addBox(scene, T, H, D,  W/2-T/2, H/2, 0, mats.carcass);  // right
  addBox(scene, W, T, D, 0, H-T/2, 0, mats.carcass);        // top (counter)
  addBox(scene, W, T, D, 0, T/2, 0, mats.carcass);          // bottom

  const counterMat=new THREE.MeshStandardMaterial({ color:0xc8c0b4, roughness:0.6 });
  addBox(scene, W+2, T*2, D+2, 0, H-T, 0, counterMat);

  const sinkW=W*0.5;
  const sinkD=D*0.5;
  const sinkH=4;
  const sinkMat=new THREE.MeshStandardMaterial({ color:0xd8d8d8, metalness:0.3, roughness:0.5 });
  addBox(scene, sinkW, T*0.5, sinkD, 0, H-T*2-sinkH/2, -D*0.1, sinkMat);

  const pipeMat=new THREE.MeshStandardMaterial({ color:0xa0a0a0, metalness:0.4, roughness:0.35 });
  const pipeR=0.8;
  const pipeTop=H-T*2-sinkH;
  const bendY=H*0.45;

  const straightDown=new THREE.Mesh(
    new THREE.CylinderGeometry(pipeR, pipeR, pipeTop-bendY, 10),
    pipeMat);
  straightDown.position.set(0, (pipeTop+bendY)/2, -D*0.1);
  scene.add(straightDown);

  const trapR=3;
  const trapGeo=new THREE.TorusGeometry(trapR, pipeR, 8, 16, Math.PI);
  const trap=new THREE.Mesh(trapGeo, pipeMat);
  trap.rotation.x=Math.PI/2;
  trap.rotation.z=Math.PI;
  trap.position.set(0, bendY-trapR, -D*0.1);
  scene.add(trap);

  const tailY=bendY-trapR*2;
  const tail=new THREE.Mesh(
    new THREE.CylinderGeometry(pipeR, pipeR, tailY-T, 10),
    pipeMat);
  tail.position.set(0, (tailY+T)/2, -D*0.1);
  scene.add(tail);

  const surfaces=[];
  const usable=W-2*T-2;
  const pipeZone=sinkW*0.6;
  const sideUsable=(usable-pipeZone)/2;

  shelfYs.forEach((y,i)=>{
    const row=rowsByShelf.get(i)||null;
    const surface=row&&row.surface;
    const isDrawer=surface==='drawer';
    const isFloor=surface==='floor'||(i>=NSH-1 && !surface);

    if(isDrawer){
      const drawerH=Math.min(gapAbove[i]-1, 6);
      const drawerMat=new THREE.MeshStandardMaterial({ color:0xd5d0c4, roughness:0.75 });
      const pullOut=D*0.5;
      addBox(scene, usable, T*0.6, D-T, 0, y-T*0.3, T/4, drawerMat);
      addBox(scene, usable, drawerH-T, T*0.4, 0, y+drawerH/2-0.5, pullOut/2, drawerMat);

      const handleMat=new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.6, roughness:0.3 });
      addBox(scene, W*0.2, 0.4, 0.6, 0, y+drawerH/2-0.5, pullOut+0.5, handleMat);

      const accent=accentFor(row);
      if(accent){
        addBox(scene, usable, 0.3, 0.3, 0, y+drawerH-0.3, pullOut+0.3,
          new THREE.MeshBasicMaterial({ color:accent }));
      }
      if(row) addShelfLabel(scene, row, -W/2, y+drawerH+1.5, pullOut+0.6);

      const hit=makeHitbox(scene,
        usable, Math.max(5, drawerH), pullOut+2,
        0, y+drawerH/2, pullOut/2,
        { shelfIndex:i, shelfY:y, row });

      surfaces.push({
        index:i, kind:'drawer', row, y, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0),
        normal: new THREE.Vector3(0,0,1),
        length:usable, gap:drawerH-1, itemDepth:Math.min(pullOut*0.8, 8),
      });
    } else {
      if(!isFloor && y<H-T*2 && y>T*1.6){
        addBox(scene, sideUsable, T, D-T, -(pipeZone+sideUsable)/2, y-T/2, T/4, mats.shelf);
        addBox(scene, sideUsable, T, D-T,  (pipeZone+sideUsable)/2, y-T/2, T/4, mats.shelf);
      }

      const accent=accentFor(row);
      if(accent){
        addBox(scene, W-2*T, 0.4, 0.4, 0, y+0.2-T/2, D/2-0.3,
          new THREE.MeshBasicMaterial({ color:accent }));
      }
      if(row) addShelfLabel(scene, row, -W/2, y+3.4, D/2+0.6);

      const hit=makeHitbox(scene,
        W-2*T, Math.max(6, H/NSH*0.85), D,
        0, y+Math.max(3, H/NSH*0.42), 0,
        { shelfIndex:i, shelfY:y, row });

      surfaces.push({
        index:i, kind:isFloor?'floor':'shelf', row, y, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0),
        normal: new THREE.Vector3(0,0,1),
        length:usable, gap:gapAbove[i], itemDepth:Math.min(D*0.55, 8),
      });
    }
  });

  return { surfaces };
}
