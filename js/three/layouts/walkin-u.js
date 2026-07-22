import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats, layout }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  const wallD=D*0.35;
  const floorY=T;

  addBox(scene, W, T, D, 0, T/2, 0, mats.carcass);       // floor
  addBox(scene, W, H, T, 0, H/2, -D/2+T/2, mats.carcass); // back wall
  addBox(scene, T, H, wallD, -W/2+T/2, H/2, -D/2+wallD/2+T, mats.carcass); // left wall inner
  addBox(scene, T, H, wallD,  W/2-T/2, H/2, -D/2+wallD/2+T, mats.carcass); // right wall inner

  const sections=layout&&layout.sections||[];
  const leftRows=[], backRows=[], rightRows=[], floorRows=[];

  for(const sec of sections){
    const target=sec.id==='left'||sec.place==='left'?leftRows
      :sec.id==='right'||sec.place==='right'?rightRows
      :sec.id==='floor'||sec.place==='floor'?floorRows
      :backRows;
    for(const r of sec.rows||[]) target.push(r);
  }

  if(!leftRows.length && !backRows.length && !rightRows.length){
    const perWall=Math.max(1, Math.floor(NSH/3));
    for(let i=0;i<NSH;i++){
      if(i<perWall) leftRows.push(i);
      else if(i<perWall*2) backRows.push(i);
      else if(shelfYs[i]<=T*2) floorRows.push(i);
      else rightRows.push(i);
    }
  }

  const surfaces=[];
  const backUsable=W-2*T-2;
  const sideUsable=wallD-T-1;

  function buildWallSurfaces(rows, xOffset, zBase, length, isBack){
    for(const idx of rows){
      const y=shelfYs[idx];
      if(y===undefined) continue;
      const row=rowsByShelf.get(idx)||null;

      if(y>T*2 && y<H-T*2){
        if(isBack){
          addBox(scene, length, T, wallD, xOffset, y-T/2, -D/2+wallD/2+T, mats.shelf);
        } else {
          addBox(scene, T*0.8, T, length, xOffset, y-T/2, zBase+length/2, mats.shelf);
        }
      }

      const accent=accentFor(row);
      if(accent){
        const stripZ=isBack?-D/2+wallD+T+0.3:zBase+length+0.3;
        const stripX=xOffset;
        addBox(scene, isBack?length:0.4, isBack?0.4:0.4, isBack?0.4:length,
          stripX, y+0.2-T/2, stripZ,
          new THREE.MeshBasicMaterial({ color:accent }));
      }

      if(row){
        const lx=isBack?-W/2:xOffset+(xOffset<0?-3:3);
        const lz=isBack?-D/2+wallD+T+0.6:zBase+length+0.6;
        addShelfLabel(scene, row, lx, y+3.4, lz);
      }

      const hitW=isBack?length:3;
      const hitD=isBack?wallD+2:length+2;
      const hit=makeHitbox(scene,
        hitW, Math.max(6, H/NSH*0.85), hitD,
        xOffset, y+Math.max(3, H/NSH*0.42),
        isBack?-D/2+wallD/2+T:zBase+length/2,
        { shelfIndex:idx, shelfY:y, row });

      surfaces.push({
        index:idx, kind:row&&row.surface==='rod'?'rod':'shelf', row, y, hitbox:hit,
        uDir: isBack?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),
        normal: isBack?new THREE.Vector3(0,0,1):new THREE.Vector3(xOffset>0?-1:1,0,0),
        length, gap:gapAbove[idx], itemDepth:Math.min(wallD*0.6, 8),
      });
    }
  }

  buildWallSurfaces(leftRows, -W/2+T+0.5, -D/2+T, sideUsable, false);
  buildWallSurfaces(backRows, 0, 0, backUsable, true);
  buildWallSurfaces(rightRows, W/2-T-0.5, -D/2+T, sideUsable, false);

  for(const idx of floorRows){
    const row=rowsByShelf.get(idx)||null;
    if(row) addShelfLabel(scene, row, -W/2, T+3.4, D/2+0.6);

    const hit=makeHitbox(scene,
      W-2*T, 5, D,
      0, T+2.5, 0,
      { shelfIndex:idx, shelfY:floorY, row });

    surfaces.push({
      index:idx, kind:'floor', row, y:floorY, hitbox:hit,
      uDir: new THREE.Vector3(1,0,0),
      normal: new THREE.Vector3(0,0,1),
      length:backUsable, gap:8, itemDepth:Math.min(D*0.55, 8),
    });
  }

  return { surfaces };
}
