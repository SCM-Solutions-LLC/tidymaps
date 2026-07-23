import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats, layout }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;
  const vanity=layout&&layout.setup==='vanitydr';

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
  const sinkMat=new THREE.MeshStandardMaterial({ color:0xf2f0e9, metalness:0.05, roughness:0.32 });
  addBox(scene, sinkW, T*0.5, sinkD, 0, H-T*2-sinkH/2, -D*0.1, sinkMat);

  // Basin and faucet sit above the counter, so this always reads as a vanity
  // instead of a full-height cabinet with hidden plumbing.
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(sinkD*0.43,sinkD*0.38,1.4,36),sinkMat);
  basin.scale.x=Math.max(1.15,sinkW/sinkD);
  basin.position.set(0,H+0.25,-D*0.04);
  basin.castShadow=true;
  scene.add(basin);
  const drainMat=new THREE.MeshStandardMaterial({color:0x8e9695,metalness:0.75,roughness:0.2});
  const drain=new THREE.Mesh(new THREE.CylinderGeometry(0.65,0.65,0.12,20),drainMat);
  drain.position.set(0,H+1,-D*0.04);
  scene.add(drain);
  const faucetStem=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.55,5,16),drainMat);
  faucetStem.position.set(0,H+2.1,-D*0.34);
  scene.add(faucetStem);
  const faucetSpout=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.38,D*0.24,16),drainMat);
  faucetSpout.rotation.x=Math.PI/2;
  faucetSpout.position.set(0,H+4.35,-D*0.23);
  scene.add(faucetSpout);

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
  const drawerW=usable*0.36;
  const drawerX=(usable-drawerW)/2;
  const vanityShelfW=usable-drawerW-1;
  const vanityShelfX=-usable/2+vanityShelfW/2;

  // Open face frames establish normal cabinet proportions while preserving
  // a clear view of pipe-aware storage inside.
  const faceMat=new THREE.MeshStandardMaterial({color:0xd7d2c7,roughness:0.8});
  addBox(scene,T*1.2,H*0.82,T*0.7,-W/2+T,H*0.42,D/2+T*0.2,faceMat);
  addBox(scene,T*1.2,H*0.82,T*0.7,W/2-T,H*0.42,D/2+T*0.2,faceMat);
  addBox(scene,W-2*T,T*1.15,T*0.7,0,H*0.78,D/2+T*0.2,faceMat);

  shelfYs.forEach((y,i)=>{
    const row=rowsByShelf.get(i)||null;
    const surface=row&&row.surface;
    const isDrawer=vanity&&surface==='drawer';
    const isFloor=surface==='floor'||(i>=NSH-1 && !surface);

    if(isDrawer){
      const drawerH=Math.min(gapAbove[i]-1, 6);
      const drawerMat=new THREE.MeshStandardMaterial({ color:0xd5d0c4, roughness:0.75 });
      const pullOut=D*0.5;
      addBox(scene, drawerW, T*0.6, D-T, drawerX, y-T*0.3, T/4, drawerMat);
      addBox(scene, drawerW, drawerH-T, T*0.4, drawerX, y+drawerH/2-0.5, pullOut/2, drawerMat);

      const handleMat=new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.6, roughness:0.3 });
      addBox(scene, drawerW*0.42, 0.4, 0.6, drawerX, y+drawerH/2-0.5, pullOut+0.5, handleMat);

      const accent=accentFor(row);
      if(accent){
        addBox(scene, drawerW, 0.3, 0.3, drawerX, y+drawerH-0.3, pullOut+0.3,
          new THREE.MeshBasicMaterial({ color:accent }));
      }
      if(row) addShelfLabel(scene, row, drawerX-drawerW/2, y+drawerH+1.5, pullOut+0.6);

      const hit=makeHitbox(scene,
        drawerW, Math.max(5, drawerH), pullOut+2,
        drawerX, y+drawerH/2, pullOut/2,
        { shelfIndex:i, shelfY:y, row });

      surfaces.push({
        index:i, kind:'drawer', row, y, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0),
        normal: new THREE.Vector3(0,0,1),
        length:drawerW, gap:drawerH-1, itemDepth:Math.min(pullOut*0.8, 8),
      });
    } else {
      if(!isFloor && y<H-T*2 && y>T*1.6){
        if(vanity){
          addBox(scene,vanityShelfW,T,D-T,vanityShelfX,y-T/2,T/4,mats.shelf);
        }else{
          addBox(scene, sideUsable, T, D-T, -(pipeZone+sideUsable)/2, y-T/2, T/4, mats.shelf);
          addBox(scene, sideUsable, T, D-T,  (pipeZone+sideUsable)/2, y-T/2, T/4, mats.shelf);
        }
      }

      const accent=accentFor(row);
      if(accent){
        addBox(scene, W-2*T, 0.4, 0.4, 0, y+0.2-T/2, D/2-0.3,
          new THREE.MeshBasicMaterial({ color:accent }));
      }
      if(row) addShelfLabel(scene, row, -W/2, y+3.4, D/2+0.6);

      const shelfW=vanity?vanityShelfW:W-2*T;
      const shelfX=vanity?vanityShelfX:0;
      const hit=makeHitbox(scene,
        shelfW, Math.max(6, H/NSH*0.85), D,
        shelfX, y+Math.max(3, H/NSH*0.42), 0,
        { shelfIndex:i, shelfY:y, row });

      surfaces.push({
        index:i, kind:isFloor?'floor':'shelf', row, y, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0),
        normal: new THREE.Vector3(0,0,1),
        length:shelfW, gap:gapAbove[i], itemDepth:Math.min(D*0.55, 8),
      });
    }
  });

  scene.userData.layoutFootprint={type:'under-sink',width:W,depth:D,fixtureHeight:H,hasVisibleSink:true};
  return { surfaces };
}
