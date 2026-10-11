import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';
import { rodClosetDepth } from '../roomBoards.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  addBox(scene, W, H, T, 0, H/2, -D/2+T/2, mats.carcass);  // back
  addBox(scene, T, H, D, -W/2+T/2, H/2, 0, mats.carcass);  // left
  addBox(scene, T, H, D,  W/2-T/2, H/2, 0, mats.carcass);  // right
  addBox(scene, W, T, D, 0, H-T/2, 0, mats.carcass);        // top
  addBox(scene, W, T, D, 0, T/2, 0, mats.carcass);          // bottom

  const rodMat=new THREE.MeshStandardMaterial({ color:0xb0b0b0, metalness:0.5, roughness:0.3 });
  const surfaces=[];
  const usable=W-2*T-2;
  /* The shelf over the rod is not as deep as the closet (roomBoards.js
     rodClosetDepth). It used to be drawn door to back wall, a 30-inch board
     in a 30-inch reach-in, so a 20-inch bin sat on it happily here while the
     product card, which judges by the real shelf, called the same bin too
     big. The board hangs off the back wall; a closet no deeper than the
     shelf is drawn as it always was. */
  const shelfD=rodClosetDepth(D);
  const shallow=shelfD<D-T;
  const boardD=shallow?shelfD:D-T;
  const boardZ=shallow?-D/2+T+shelfD/2:T/4;

  shelfYs.forEach((y,i)=>{
    const row=rowsByShelf.get(i)||null;
    const surface=row&&row.surface;
    const isFloor=surface==='floor'||(i>=NSH-1 && !surface);
    const isRod=surface==='rod'||(i>0 && i<NSH-1 && !surface && !isFloor);
    const isShelf=!isFloor && !isRod;

    if(isRod){
      const rodY=y+gapAbove[i]*0.85;
      const rod=new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, W-2*T, 12),
        rodMat);
      rod.rotation.z=Math.PI/2;
      rod.position.set(0, rodY, 0);
      scene.add(rod);

      const bracketMat=new THREE.MeshStandardMaterial({ color:0x999999, metalness:0.4, roughness:0.4 });
      for(const side of [-1, 1]){
        const bracket=new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8), bracketMat);
        bracket.rotation.z=Math.PI/2;
        bracket.position.set(side*(W/2-T-0.3), rodY, 0);
        scene.add(bracket);
      }

      const accent=accentFor(row);
      if(accent){
        addBox(scene, W-2*T, 0.3, 0.3, 0, rodY+0.5, D/2-0.3,
          new THREE.MeshBasicMaterial({ color:accent }));
      }
      if(row) addShelfLabel(scene, row, -W/2, rodY+2.5, D/2+0.6);

      const hit=makeHitbox(scene,
        W-2*T, Math.max(6, gapAbove[i]*0.7), D,
        0, rodY-gapAbove[i]*0.25, 0,
        { shelfIndex:i, shelfY:rodY, row });

      surfaces.push({
        index:i, kind:'rod', row, y:rodY, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0),
        normal: new THREE.Vector3(0,0,1),
        length:usable, gap:gapAbove[i]*0.7, itemDepth:Math.min(D*0.4, 6),
      });
    } else {
      if(isShelf && y<H-T*2 && y>T*1.6){
        addBox(scene, W-2*T, T, boardD, 0, y-T/2, boardZ, mats.shelf);
      }
      /* A shelf row lives on the board, so its marker, its hitbox and the
         depth its contents are judged against are the board's. The floor row
         is the whole closet, as before. */
      const onBoard=isShelf&&shallow;
      const rowD=onBoard?shelfD:D;
      const rowZ=onBoard?boardZ:0;

      const accent=accentFor(row);
      if(accent){
        addBox(scene, W-2*T, 0.4, 0.4, 0, y+0.2-T/2, onBoard?boardZ+boardD/2-0.3:D/2-0.3,
          new THREE.MeshBasicMaterial({ color:accent }));
      }
      if(row) addShelfLabel(scene, row, -W/2, y+3.4, D/2+0.6);

      const hit=makeHitbox(scene,
        W-2*T, Math.max(6, H/NSH*0.85), rowD,
        0, y+Math.max(3, H/NSH*0.42), rowZ,
        { shelfIndex:i, shelfY:y, row });

      surfaces.push({
        index:i, kind:isFloor?'floor':'shelf', row, y, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0),
        normal: new THREE.Vector3(0,0,1),
        length:usable, gap:gapAbove[i], depth:rowD, itemDepth:Math.min(rowD*0.55, 8),
      });
    }
  });

  return { surfaces };
}
