import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox } from './helpers.js';

function splitRows(layout, rowsByShelf, count){
  const sections=(layout&&layout.sections)||[];
  const explicit=sections.some(sec=>['run-a','run-b','left','right'].includes(sec.id)||['run-a','run-b','left','right'].includes(sec.place));
  const all=sections.length?[...new Set(sections.flatMap(sec=>sec.rows||[]))]:Array.from({length:count},(_,i)=>i);
  if(!explicit){
    const movable=all.filter(i=>(rowsByShelf.get(i)||{}).surface!=='floor');
    const floor=all.filter(i=>(rowsByShelf.get(i)||{}).surface==='floor');
    const split=Math.ceil(movable.length/2);
    return {a:movable.slice(0,split).concat(floor),b:movable.slice(split)};
  }
  const a=[],b=[];
  sections.forEach(sec=>{
    const side=sec.id==='run-b'||sec.place==='run-b'||sec.id==='right'||sec.place==='right';
    (sec.rows||[]).forEach(i=>(side?b:a).push(i));
  });
  return {a,b};
}

function addRod(scene,length,x,y,z,axis,mat){
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,length,14),mat);
  if(axis==='x') rod.rotation.z=Math.PI/2;
  else rod.rotation.x=Math.PI/2;
  rod.position.set(x,y,z);
  rod.castShadow=true;
  scene.add(rod);
}

/* Open, integrated L-shaped room. Width and depth define room footprint;
   shelves keep realistic 10–18 inch depth instead of becoming full-room
   slabs or an appendage outside the measured bounds. */
export function build(ctx){
  const {scene,geo,rowsByShelf,mats,layout}=ctx;
  const {W,H,D,T,NSH,shelfYs,gapAbove}=geo;
  const shelfDepth=Math.max(8,Math.min(18,Math.min(W,D)*0.22));
  const sideSign=layout&&layout.lSide==='left'?-1:1;
  const rodMat=new THREE.MeshStandardMaterial({color:0x8d9490,metalness:0.7,roughness:0.24});

  addBox(scene,W,T,D,0,T/2,0,mats.carcass);
  addBox(scene,W,H,T,0,H/2,-D/2+T/2,mats.carcass);
  addBox(scene,T,H,D,sideSign*(W/2-T/2),H/2,0,mats.carcass);

  const rows=splitRows(layout,rowsByShelf,NSH);
  const surfaces=[];
  const usableA=Math.max(8,W-shelfDepth-2*T-2);
  const usableB=Math.max(8,D-shelfDepth-2*T-2);
  const backX=-sideSign*shelfDepth/2;
  const backZ=-D/2+T+shelfDepth/2;
  const sideX=sideSign*(W/2-T-shelfDepth/2);
  const sideZ=shelfDepth/2;

  // The fixture itself wraps the corner at every tier. Plan rows still own
  // one draggable surface each, but the empty half no longer looks bolted on.
  for(let idx=0;idx<NSH;idx++){
    const baseY=shelfYs[idx];
    if(baseY===undefined) continue;
    const row=rowsByShelf.get(idx)||null;
    const kind=(row&&row.surface)||'shelf';
    if(kind==='floor') continue;
    const y=kind==='rod'?Math.min(H-7,baseY+gapAbove[idx]*0.78):baseY;
    if(kind==='rod'){
      addRod(scene,usableA,backX,y,backZ,'x',rodMat);
      addRod(scene,usableB,sideX,y,sideZ,'z',rodMat);
    }else if(baseY>1.6*T&&baseY<H-2*T){
      addBox(scene,usableA,T,shelfDepth,backX,baseY-T/2,backZ,mats.shelf);
      addBox(scene,shelfDepth,T,usableB,sideX,baseY-T/2,sideZ,mats.shelf);
    }
  }

  function buildSurface(idx,side){
    const baseY=shelfYs[idx];
    if(baseY===undefined) return;
    const row=rowsByShelf.get(idx)||null;
    const kind=(row&&row.surface)||'shelf';
    const floor=kind==='floor';
    const rod=kind==='rod';
    const length=side==='back'?usableA:usableB;
    const centerX=side==='back'?backX:sideX;
    const centerZ=side==='back'?backZ:sideZ;
    const y=rod?Math.min(H-7,baseY+gapAbove[idx]*0.78):floor?T:baseY;

    const accent=accentFor(row);
    if(accent){
      addBox(scene,side==='back'?length:0.4,0.35,side==='back'?0.4:length,
        side==='back'?centerX:sideSign*(W/2-shelfDepth-0.2), y+0.2,
        side==='back'?-D/2+shelfDepth+T:sideZ,
        new THREE.MeshBasicMaterial({color:accent}));
    }
    if(row) addShelfLabel(scene,row,side==='back'?-W/2:sideSign*(W/2-shelfDepth),y+3.2,side==='back'?backZ+shelfDepth/2+0.7:-D/2+T);

    const hit=makeHitbox(scene,side==='back'?length:shelfDepth,
      Math.max(6,H/NSH*0.8),side==='back'?shelfDepth: length,
      centerX,rod?y-gapAbove[idx]*0.25:floor?T+3:y+Math.max(3,H/NSH*0.4),centerZ,
      {shelfIndex:idx,shelfY:y,row});
    surfaces.push({
      index:idx,kind,row,y,hitbox:hit,
      uDir:side==='back'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),
      normal:side==='back'?new THREE.Vector3(0,0,1):new THREE.Vector3(-sideSign,0,0),
      length,gap:rod?Math.max(10,gapAbove[idx]*0.75):gapAbove[idx],
      itemDepth:rod?1.5:Math.min(shelfDepth*0.58,8),
    });
  }

  rows.a.forEach(i=>buildSurface(i,'back'));
  rows.b.forEach(i=>buildSurface(i,'side'));
  scene.userData.layoutFootprint={type:'l-run',width:W,depth:D,shelfDepth,lSide:sideSign<0?'left':'right'};
  return {surfaces};
}
