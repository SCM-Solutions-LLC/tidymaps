import * as THREE from 'three';
import { addBox, addShelfLabel, addAccentStrip, makeHitbox, addOpenDoor, doorFramePoints } from './helpers.js';
import { doorRowsOf, shelfRowsOf, hangsDoorRows } from '../roomBoards.js';
import { openDoor, doorSlot, binOf } from '../doorBins.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats, layout }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;
  const floating=['openshelf','wallshelf'].includes(layout&&layout.setup);
  const placement=floating&&(layout&&layout.shelfPlacement)||'center';
  /* Open and wall shelving hang on a wall, and were drawn from the floor up
     like a freestanding unit: with no base board to stand on (that is the
     carcass's), the bottom row had no board at all and its bins sat on the
     ground. Here the wall runs on below the run and the floor drops away,
     and every row gets its board. The boards stay where they were, so the
     headroom drawn is still the headroom the card judges a pick by. */
  const hang=floating?18:0;

  addBox(scene, W, H+hang, floating?T*0.45:T, 0, (H-hang)/2, -D/2+T/2, mats.carcass);  // wall/back
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

  /* A reach-in stands behind a door, and a door rack row hangs on it: the
     door is drawn swung open with the rack's bins on its inside, the way a
     cabinet's is (layouts/cabinet.js). It used to be one more board inside
     the closet. Open and wall shelving have no door (hangsDoorRows), and a
     reach-in with nothing on its door is drawn open-fronted as before. */
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

  /* Board j carries the j-th shelf row: row j when nothing is on the door,
     otherwise the rows left once the door rows are taken out, which is how
     scene.js counted the boards (roomBoards.cabinetShelfGeometry). */
  const shelfRows=rackRows.length?shelfRowsOf(ctx.map, layout):null;
  const lastRow=Math.max(-1, ...(ctx.map||[]).map((row, i)=>(Number.isInteger(row&&row.shelfIndex)?row.shelfIndex:i)));
  const boardRow=j=>!shelfRows?j:j<shelfRows.length?shelfRows[j]:lastRow+1+(j-shelfRows.length);

  shelfYs.forEach((y,j)=>{
    const i=boardRow(j);
    if(y<H-T*2 && (floating || y>T*1.6)){
      addBox(scene, usable, T, D-T, shelfX, y-T/2, T/4, mats.shelf).userData.isShelfBoard=true;
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
      gap: gapAbove[j],
      // Wall shelves have no top board: the highest one is open above.
      openAbove: floating&&!shelfYs.some((other,k)=>k!==j&&other>y+0.5),
      itemDepth: Math.min(D*0.55, 8),
    });
  });

  surfaces.sort((a,b)=>a.index-b.index);
  return { surfaces, floorY:-hang };
}
