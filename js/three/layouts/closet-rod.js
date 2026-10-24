import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox, addOpenDoor, doorFramePoints } from './helpers.js';
import { rodClosetDepth, doorRowsOf, shelfRowsOf, hangsDoorRows } from '../roomBoards.js';
import { openDoor, doorSlot, binOf } from '../doorBins.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats, layout }=ctx;
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

  /* A reach-in closet stands behind a door, and an over-the-door rack row
     hangs on it: the door is drawn swung open with the rack's bins on its
     inside, as a cabinet's is (layouts/cabinet.js). It used to be one more
     shelf board over the clothes. A wardrobe has no such door here
     (hangsDoorRows), and a closet with nothing on its door is drawn
     open-fronted as before. */
  const doorRows=hangsDoorRows(layout)?doorRowsOf(ctx.map, layout):new Set();
  const rackRows=[...doorRows].sort((a,b)=>a-b);
  const doorZ=D/2;
  if(rackRows.length){
    const rack=openDoor({ role:'reach-in', hinge:'right', x0:-W/2+T, x1:W/2-T, y0:T, y1:H-T, bins:Math.min(5, Math.max(3, rackRows.length)) });
    const doorMat=new THREE.MeshStandardMaterial({ color:0xdcd5c8, roughness:0.7, transparent:true, opacity:0.35 });
    addOpenDoor(scene, rack, doorZ, { shellMat:doorMat, linerMat:doorMat,
      binMat:new THREE.MeshStandardMaterial({ color:0xcfc6b6, roughness:0.6 }),
      handleMat:new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.6, roughness:0.3 }) });
    scene.userData.framePoints=doorFramePoints([rack], doorZ);
    rackRows.forEach((i, t)=>{
      const row=rowsByShelf.get(i)||null;
      const slot=doorSlot(i, rack, binOf(t, rackRows.length, rack.bins), doorZ);
      const normal=new THREE.Vector3(slot.normal.x, 0, slot.normal.z);
      const uDir=new THREE.Vector3(slot.uDir.x, 0, slot.uDir.z);
      const label=row?addShelfLabel(scene, row, slot.x, slot.y+Math.min(3.4, slot.gap*0.6), slot.z, { normal }):null;
      if(label) label.position.set(slot.x+normal.x*3, slot.y+Math.min(3.4, slot.gap*0.6), slot.z+normal.z*3+0.6);
      const hit=makeHitbox(scene, slot.length, Math.max(3, slot.gap*0.85), slot.depth,
        slot.x, slot.y+Math.max(1.5, slot.gap*0.42), slot.z, { shelfIndex:i, shelfY:slot.y, row });
      hit.rotation.y=Math.atan2(-uDir.z, uDir.x);
      surfaces.push({
        index:i, kind:'door', row, y:slot.y, hitbox:hit, uDir, normal,
        length:slot.length, gap:slot.gap, depth:slot.depth, itemDepth:3,
      });
    });
  }
  /* Board j carries the j-th row not on the door (scene.js counted the boards
     without them, roomBoards.cabinetShelfGeometry). The rod and floor
     fallbacks for a row with no surface are positional, so they read the
     board's place, not the row's. */
  const shelfRows=rackRows.length?shelfRowsOf(ctx.map, layout):null;
  const lastRow=Math.max(-1, ...(ctx.map||[]).map((row, k)=>(Number.isInteger(row&&row.shelfIndex)?row.shelfIndex:k)));
  const boardRow=j=>!shelfRows?j:j<shelfRows.length?shelfRows[j]:lastRow+1+(j-shelfRows.length);

  shelfYs.forEach((y,j)=>{
    const i=boardRow(j);
    const row=rowsByShelf.get(i)||null;
    const surface=row&&row.surface;
    const isFloor=surface==='floor'||(j>=NSH-1 && !surface);
    const isRod=surface==='rod'||(j>0 && j<NSH-1 && !surface && !isFloor);
    const isShelf=!isFloor && !isRod;

    if(isRod){
      const rodY=y+gapAbove[j]*0.85;
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
        W-2*T, Math.max(6, gapAbove[j]*0.7), D,
        0, rodY-gapAbove[j]*0.25, 0,
        { shelfIndex:i, shelfY:rodY, row });

      surfaces.push({
        index:i, kind:'rod', row, y:rodY, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0),
        normal: new THREE.Vector3(0,0,1),
        length:usable, gap:gapAbove[j]*0.7, itemDepth:Math.min(D*0.4, 6),
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
        length:usable, gap:gapAbove[j], depth:rowD, itemDepth:Math.min(rowD*0.55, 8),
      });
    }
  });

  surfaces.sort((a,b)=>a.index-b.index);
  return { surfaces };
}
