import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats, layout }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  const counterY=H*0.55;
  const upperH=H-counterY;
  const lowerH=counterY;
  const upperD=D*0.7;

  addBox(scene, W, lowerH, T, 0, lowerH/2, -D/2+T/2, mats.carcass);
  addBox(scene, T, lowerH, D, -W/2+T/2, lowerH/2, 0, mats.carcass);
  addBox(scene, T, lowerH, D,  W/2-T/2, lowerH/2, 0, mats.carcass);
  addBox(scene, W, T, D, 0, T/2, 0, mats.carcass);

  const counterMat=new THREE.MeshStandardMaterial({ color:0xc8c0b4, roughness:0.6 });
  addBox(scene, W+1, T*1.5, D+1, 0, counterY-T*0.75, 0, counterMat);

  addBox(scene, W, upperH, T, 0, counterY+upperH/2, -D/2+T/2, mats.carcass);
  addBox(scene, T, upperH, upperD, -W/2+T/2, counterY+upperH/2, -D/2+upperD/2+T, mats.carcass);
  addBox(scene, T, upperH, upperD,  W/2-T/2, counterY+upperH/2, -D/2+upperD/2+T, mats.carcass);
  addBox(scene, W, T, upperD, 0, H-T/2, -D/2+upperD/2+T, mats.carcass);

  const sections=layout&&layout.sections||[];
  const upperRows=[], lowerRows=[];

  for(const sec of sections){
    const isUpper=sec.id==='upper'||sec.place==='upper';
    const target=isUpper?upperRows:lowerRows;
    for(const r of sec.rows||[]) target.push(r);
  }

  if(!upperRows.length && !lowerRows.length){
    for(let i=0;i<NSH;i++){
      if(shelfYs[i]>=counterY) upperRows.push(i);
      else lowerRows.push(i);
    }
  }

  const surfaces=[];
  const usable=W-2*T-2;

  for(const idx of lowerRows){
    const y=shelfYs[idx]; if(y===undefined) continue;
    const row=rowsByShelf.get(idx)||null;
    if(y>T*2 && y<counterY-T*2) addBox(scene, usable, T, D-T, 0, y-T/2, T/4, mats.shelf);

    const accent=accentFor(row);
    if(accent) addBox(scene, usable, 0.4, 0.4, 0, y+0.2-T/2, D/2-0.3, new THREE.MeshBasicMaterial({ color:accent }));
    if(row) addShelfLabel(scene, row, -W/2, y+3.4, D/2+0.6);

    const hit=makeHitbox(scene, usable, Math.max(5, lowerH/Math.max(1,lowerRows.length)*0.8), D,
      0, y+Math.max(2.5, lowerH/Math.max(1,lowerRows.length)*0.4), 0,
      { shelfIndex:idx, shelfY:y, row });

    surfaces.push({
      index:idx, kind:'shelf', row, y, hitbox:hit,
      uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
      length:usable, gap:gapAbove[idx], itemDepth:Math.min(D*0.55, 8),
    });
  }

  for(const idx of upperRows){
    const y=shelfYs[idx]; if(y===undefined) continue;
    const row=rowsByShelf.get(idx)||null;
    const shelfZ=-D/2+upperD/2+T;
    if(y>counterY+T && y<H-T*2) addBox(scene, usable, T, upperD-T, 0, y-T/2, shelfZ, mats.shelf);

    const accent=accentFor(row);
    if(accent) addBox(scene, usable, 0.4, 0.4, 0, y+0.2-T/2, -D/2+upperD+T+0.3, new THREE.MeshBasicMaterial({ color:accent }));
    if(row) addShelfLabel(scene, row, -W/2, y+3.4, -D/2+upperD+T+0.6);

    const hit=makeHitbox(scene, usable, Math.max(5, upperH/Math.max(1,upperRows.length)*0.8), upperD+2,
      0, y+Math.max(2.5, upperH/Math.max(1,upperRows.length)*0.4), shelfZ,
      { shelfIndex:idx, shelfY:y, row });

    surfaces.push({
      index:idx, kind:'shelf', row, y, hitbox:hit,
      uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
      length:usable, gap:gapAbove[idx], itemDepth:Math.min(upperD*0.55, 8),
    });
  }

  return { surfaces };
}
