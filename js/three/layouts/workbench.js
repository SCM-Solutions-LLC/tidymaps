import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats, layout }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  const benchY=H*0.5;
  const pegH=H-benchY;

  addBox(scene, W, pegH, T*0.5, 0, benchY+pegH/2, -D/2+T/4, mats.carcass);

  const pegMat=new THREE.MeshStandardMaterial({ color:0xd4c8a8, roughness:0.85 });
  const pegW=W-2;
  const pegRows=Math.floor(pegH/3);
  const pegCols=Math.floor(pegW/3);
  for(let r=0;r<pegRows;r++){
    for(let c=0;c<pegCols;c++){
      const peg=new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.8, 6), pegMat);
      peg.rotation.x=Math.PI/2;
      peg.position.set(
        -pegW/2+3*(c+0.5),
        benchY+2+3*(r+0.5),
        -D/2+T+0.4);
      scene.add(peg);
    }
  }

  const benchMat=new THREE.MeshStandardMaterial({ color:0xb8a07a, roughness:0.7 });
  addBox(scene, W+1, T*2, D+1, 0, benchY-T, 0, benchMat);

  const legMat=new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.3, roughness:0.5 });
  for(const sx of [-1, 1]){
    addBox(scene, T*1.5, benchY-T, T*1.5, sx*(W/2-T*2), (benchY-T)/2, -D/2+T*2, legMat);
    addBox(scene, T*1.5, benchY-T, T*1.5, sx*(W/2-T*2), (benchY-T)/2,  D/2-T*2, legMat);
  }

  const sections=layout&&layout.sections||[];
  const wallRows=[], benchRows=[];

  for(const sec of sections){
    const isWall=sec.id==='wall'||sec.place==='wall';
    const target=isWall?wallRows:benchRows;
    for(const r of sec.rows||[]) target.push(r);
  }

  if(!wallRows.length && !benchRows.length){
    for(let i=0;i<NSH;i++){
      if(shelfYs[i]>=benchY) wallRows.push(i);
      else benchRows.push(i);
    }
  }

  const surfaces=[];
  const usable=W-2;

  for(const idx of wallRows){
    const y=shelfYs[idx]; if(y===undefined) continue;
    const row=rowsByShelf.get(idx)||null;
    const isPeg=row&&row.surface==='pegboard';

    if(row) addShelfLabel(scene, row, -W/2, y+3, -D/2+T+2);

    const accent=accentFor(row);
    if(accent) addBox(scene, usable, 0.35, 0.35, 0, y+0.2, -D/2+T+0.5, new THREE.MeshBasicMaterial({ color:accent }));

    const hit=makeHitbox(scene, usable, Math.max(5, pegH/Math.max(1,wallRows.length)*0.8), 4,
      0, y+2.5, -D/2+T+2,
      { shelfIndex:idx, shelfY:y, row });

    surfaces.push({
      index:idx, kind:isPeg?'pegboard':'shelf', row, y, hitbox:hit,
      uDir: new THREE.Vector3(1,0,0),
      normal: new THREE.Vector3(0,0,1),
      length:usable, gap:gapAbove[idx]||5, itemDepth:3,
    });
  }

  for(const idx of benchRows){
    const y=shelfYs[idx]; if(y===undefined) continue;
    const row=rowsByShelf.get(idx)||null;
    const isWorktop=row&&row.surface==='worktop';
    const isDrawer=row&&row.surface==='drawer';

    if(isDrawer){
      const drawerH=Math.min(gapAbove[idx]-1, 6);
      const drawerMat=new THREE.MeshStandardMaterial({ color:0xd5d0c4, roughness:0.75 });
      const pullOut=D*0.5;
      addBox(scene, usable*0.4, T*0.6, D-T, W/4, y-T*0.3, T/4, drawerMat);
      addBox(scene, usable*0.4, drawerH-T, T*0.4, W/4, y+drawerH/2-0.5, pullOut/2, drawerMat);

      const handleMat=new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.6, roughness:0.3 });
      addBox(scene, usable*0.1, 0.4, 0.6, W/4, y+drawerH/2-0.5, pullOut+0.5, handleMat);

      if(row) addShelfLabel(scene, row, -W/2, y+drawerH+1.5, pullOut+0.6);

      const hit=makeHitbox(scene, usable, Math.max(5, drawerH), pullOut+2,
        0, y+drawerH/2, pullOut/2,
        { shelfIndex:idx, shelfY:y, row });

      surfaces.push({
        index:idx, kind:'drawer', row, y, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
        length:usable, gap:drawerH-1, itemDepth:Math.min(pullOut*0.8, 8),
      });
    } else {
      if(isWorktop){
        if(row) addShelfLabel(scene, row, -W/2, benchY+2, D/2+0.6);
      } else {
        if(y>T*2) addBox(scene, usable, T, D-T, 0, y-T/2, T/4, mats.shelf);
        if(row) addShelfLabel(scene, row, -W/2, y+3.4, D/2+0.6);
      }

      const accent=accentFor(row);
      if(accent) addBox(scene, usable, 0.4, 0.4, 0, (isWorktop?benchY:y)+0.2-T/2, D/2-0.3, new THREE.MeshBasicMaterial({ color:accent }));

      const surfY=isWorktop?benchY-T:y;
      const hit=makeHitbox(scene, usable, Math.max(5, 8), D,
        0, surfY+3, 0,
        { shelfIndex:idx, shelfY:surfY, row });

      surfaces.push({
        index:idx, kind:isWorktop?'worktop':'shelf', row, y:surfY, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
        length:usable, gap:gapAbove[idx]||8, itemDepth:Math.min(D*0.55, 8),
      });
    }
  }

  return { surfaces };
}
