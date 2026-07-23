import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats, layout }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;
  const toolChest=layout&&layout.setup==='toolchest';

  addBox(scene, W, H, T, 0, H/2, -D/2+T/2, mats.carcass);  // back
  addBox(scene, T, H, D, -W/2+T/2, H/2, 0, mats.carcass);  // left
  addBox(scene, T, H, D,  W/2-T/2, H/2, 0, mats.carcass);  // right
  addBox(scene, W, T, D, 0, T/2, 0, mats.carcass);          // bottom

  const drawerMat=new THREE.MeshStandardMaterial({ color:toolChest?0x687773:0xd5d0c4, roughness:0.75 });
  const handleMat=new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.6, roughness:0.3 });

  if(toolChest){
    const wheelMat=new THREE.MeshStandardMaterial({color:0x343936,roughness:0.8});
    for(const x of [-W*0.36,W*0.36]){
      for(const z of [-D*0.32,D*0.32]){
        const wheel=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,0.55,14),wheelMat);
        wheel.rotation.z=Math.PI/2;
        wheel.position.set(x,0.9,z);
        wheel.castShadow=true;
        scene.add(wheel);
      }
    }
    addBox(scene,W+1,1,D+1,0,H-0.5,0,drawerMat);
    addBox(scene,5,0.7,1.1,W/2+2.2,H-4,0,handleMat);
  }

  const surfaces=[];
  const usable=W-2*T-2;
  const topRow=rowsByShelf.get(0);
  const hasWorktop=NSH>1 && topRow && (topRow.surface==='worktop' || !topRow.surface);

  shelfYs.forEach((y,i)=>{
    const row=rowsByShelf.get(i)||null;
    const isTop=i===0 && hasWorktop;

    if(isTop){
      addBox(scene, W, T*1.5, D, 0, H-T*0.75, 0, mats.shelf);
      if(row) addShelfLabel(scene, row, -W/2, H+2.2, D/2+0.6);

      const hit=makeHitbox(scene,
        W-2*T, Math.max(6, 5), D,
        0, H+1.5, 0,
        { shelfIndex:i, shelfY:H-T*0.75, row });

      surfaces.push({
        index:i, kind:'worktop', row, y:H-T*0.75, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0),
        normal: new THREE.Vector3(0,0,1),
        length:usable, gap:8, itemDepth:Math.min(D*0.55,8),
      });
      return;
    }

    const drawerH=gapAbove[i]-1;
    const pullOut=D*0.6;
    addBox(scene, W-2*T-0.5, T*0.6, D-T, 0, y-T*0.3, T/4, drawerMat);
    addBox(scene, W-2*T-0.5, drawerH-T, T*0.4, 0, y+drawerH/2-0.5, pullOut/2, drawerMat);
    addBox(scene, T*0.5, drawerH-T, pullOut, -W/2+T+0.5, y+drawerH/2-0.5, pullOut/2, drawerMat);
    addBox(scene, T*0.5, drawerH-T, pullOut,  W/2-T-0.5, y+drawerH/2-0.5, pullOut/2, drawerMat);

    const handleW=W*0.25;
    addBox(scene, handleW, 0.4, 0.6, 0, y+drawerH/2-0.5, pullOut+0.5, handleMat);

    const accent=accentFor(row);
    if(accent){
      addBox(scene, W-2*T, 0.35, 0.35, 0, y+drawerH-0.5, pullOut+0.3,
        new THREE.MeshBasicMaterial({ color:accent }));
    }

    if(row) addShelfLabel(scene, row, -W/2, y+drawerH+1.5, pullOut+0.6);

    const hit=makeHitbox(scene,
      W-2*T, Math.max(5, drawerH), pullOut+2,
      0, y+drawerH/2, pullOut/2,
      { shelfIndex:i, shelfY:y, row });

    surfaces.push({
      index:i, kind:'drawer', row, y, hitbox:hit,
      uDir: new THREE.Vector3(1,0,0),
      normal: new THREE.Vector3(0,0,1),
      length:usable, gap:drawerH-1, itemDepth:Math.min(pullOut*0.8, 8),
    });
  });

  return { surfaces };
}
