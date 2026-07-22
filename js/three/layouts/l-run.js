import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

export function build(ctx){
  const { scene, geo, rowsByShelf, mats, layout }=ctx;
  const { W, H, D, T, NSH, shelfYs, gapAbove }=geo;

  const runALen=W;
  const runBLen=D*1.2;

  addBox(scene, runALen, H, T, 0, H/2, -D/2+T/2, mats.carcass);             // run-A back
  addBox(scene, T, H, D, -runALen/2+T/2, H/2, 0, mats.carcass);            // run-A left
  addBox(scene, runALen, T, D, 0, H-T/2, 0, mats.carcass);                  // run-A top
  addBox(scene, runALen, T, D, 0, T/2, 0, mats.carcass);                    // run-A bottom

  addBox(scene, T, H, runBLen, runALen/2-T/2, H/2, -D/2-runBLen/2+T, mats.carcass);  // run-B back (shared corner)
  addBox(scene, D, T, runBLen, runALen/2+D/2-T, H-T/2, -D/2-runBLen/2+T, mats.carcass);  // run-B top
  addBox(scene, D, T, runBLen, runALen/2+D/2-T, T/2, -D/2-runBLen/2+T, mats.carcass);    // run-B bottom
  addBox(scene, D, H, T, runALen/2+D/2-T, H/2, -D/2-runBLen+T/2, mats.carcass);          // run-B far end

  const sections=layout&&layout.sections||[];
  const runARows=[], runBRows=[];

  for(const sec of sections){
    const isB=sec.id==='run-b'||sec.place==='run-b'||sec.id==='right'||sec.place==='right';
    const target=isB?runBRows:runARows;
    for(const r of sec.rows||[]) target.push(r);
  }

  if(!runARows.length && !runBRows.length){
    const split=Math.ceil(NSH/2);
    for(let i=0;i<NSH;i++){
      if(i<split) runARows.push(i); else runBRows.push(i);
    }
  }

  const surfaces=[];
  const usableA=runALen-2*T-2;
  const usableB=runBLen-T-1;

  function buildRunA(rows){
    for(const idx of rows){
      const y=shelfYs[idx]; if(y===undefined) continue;
      const row=rowsByShelf.get(idx)||null;
      if(y<H-T*2 && y>T*1.6) addBox(scene, usableA, T, D-T, 0, y-T/2, T/4, mats.shelf);

      const accent=accentFor(row);
      if(accent) addBox(scene, usableA, 0.4, 0.4, 0, y+0.2-T/2, D/2-0.3, new THREE.MeshBasicMaterial({ color:accent }));
      if(row) addShelfLabel(scene, row, -runALen/2, y+3.4, D/2+0.6);

      const hit=makeHitbox(scene, usableA, Math.max(6, H/NSH*0.85), D, 0, y+Math.max(3, H/NSH*0.42), 0,
        { shelfIndex:idx, shelfY:y, row });

      surfaces.push({
        index:idx, kind:'shelf', row, y, hitbox:hit,
        uDir: new THREE.Vector3(1,0,0), normal: new THREE.Vector3(0,0,1),
        length:usableA, gap:gapAbove[idx], itemDepth:Math.min(D*0.55, 8),
      });
    }
  }

  function buildRunB(rows){
    const xBase=runALen/2;
    for(const idx of rows){
      const y=shelfYs[idx]; if(y===undefined) continue;
      const row=rowsByShelf.get(idx)||null;
      if(y<H-T*2 && y>T*1.6){
        addBox(scene, D-T, T, usableB, xBase+D/2-T/2, y-T/2, -D/2-usableB/2+T, mats.shelf);
      }

      const accent=accentFor(row);
      if(accent) addBox(scene, 0.4, 0.4, usableB, xBase+D-0.3, y+0.2-T/2, -D/2-usableB/2+T, new THREE.MeshBasicMaterial({ color:accent }));
      if(row) addShelfLabel(scene, row, xBase+D+0.5, y+3.4, -D/2+T+0.6);

      const hit=makeHitbox(scene, D, Math.max(6, H/NSH*0.85), usableB+2,
        xBase+D/2-T/2, y+Math.max(3, H/NSH*0.42), -D/2-usableB/2+T,
        { shelfIndex:idx, shelfY:y, row });

      surfaces.push({
        index:idx, kind:'shelf', row, y, hitbox:hit,
        uDir: new THREE.Vector3(0,0,-1), normal: new THREE.Vector3(1,0,0),
        length:usableB, gap:gapAbove[idx], itemDepth:Math.min(D*0.55, 8),
      });
    }
  }

  buildRunA(runARows);
  buildRunB(runBRows);

  return { surfaces };
}
