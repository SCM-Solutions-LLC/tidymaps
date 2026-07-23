import * as THREE from 'three';
import {addBox,addShelfLabel,accentFor,makeHitbox} from './helpers.js';

function distributeRows(layout,rowsByShelf,count){
  const sections=(layout&&layout.sections)||[];
  const explicit=sections.some(sec=>['left','back','right','floor'].includes(sec.id)||['left','back','right','floor'].includes(sec.place));
  const out={left:[],back:[],right:[],floor:[]};
  if(explicit){
    sections.forEach(sec=>{
      const key=['left','back','right','floor'].find(k=>sec.id===k||sec.place===k)||'back';
      (sec.rows||[]).forEach(i=>out[key].push(i));
    });
    return out;
  }
  const all=sections.length?[...new Set(sections.flatMap(sec=>sec.rows||[]))]:Array.from({length:count},(_,i)=>i);
  const movable=[];
  all.forEach(i=>((rowsByShelf.get(i)||{}).surface==='floor'?out.floor:movable).push(i));
  movable.forEach((i,index)=>out[['left','back','right'][index%3]].push(i));
  return out;
}

function addRod(scene,length,x,y,z,axis,material){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,length,14),material);
  if(axis==='x') mesh.rotation.z=Math.PI/2;
  else mesh.rotation.x=Math.PI/2;
  mesh.position.set(x,y,z);
  mesh.castShadow=true;
  scene.add(mesh);
}

/* Walk-in room using full measured footprint. Three storage walls wrap one
   open aisle. Shelves and rods stay realistic depth instead of filling room. */
export function build(ctx){
  const {scene,geo,rowsByShelf,mats,layout}=ctx;
  const {W,H,D,T,NSH,shelfYs,gapAbove}=geo;
  const shelfDepth=Math.max(8,Math.min(18,Math.min(W,D)*0.2));
  const rodMat=new THREE.MeshStandardMaterial({color:0x8d9490,metalness:0.7,roughness:0.24});

  addBox(scene,W,T,D,0,T/2,0,mats.carcass);
  addBox(scene,W,H,T,0,H/2,-D/2+T/2,mats.carcass);
  addBox(scene,T,H,D,-W/2+T/2,H/2,0,mats.carcass);
  addBox(scene,T,H,D,W/2-T/2,H/2,0,mats.carcass);

  const rows=distributeRows(layout,rowsByShelf,NSH);
  const surfaces=[];
  const backLength=Math.max(8,W-2*shelfDepth-2*T-2);
  const sideLength=Math.max(8,D-shelfDepth-2*T-6);

  // A walk-in is one continuous fitted system, not three unrelated ledges.
  // Repeat each physical tier around the room while assigning its items to
  // just one wall below.
  for(let idx=0;idx<NSH;idx++){
    const baseY=shelfYs[idx];
    if(baseY===undefined) continue;
    const row=rowsByShelf.get(idx)||null;
    const kind=(row&&row.surface)||'shelf';
    if(kind==='floor') continue;
    const y=kind==='rod'?Math.min(H-7,baseY+gapAbove[idx]*0.78):baseY;
    const backZ=-D/2+T+shelfDepth/2;
    const sideZ=-D/2+T+shelfDepth+sideLength/2;
    if(kind==='rod'){
      addRod(scene,backLength,0,y,backZ,'x',rodMat);
      addRod(scene,sideLength,-W/2+T+shelfDepth/2,y,sideZ,'z',rodMat);
      addRod(scene,sideLength,W/2-T-shelfDepth/2,y,sideZ,'z',rodMat);
    }else if(baseY>1.6*T&&baseY<H-2*T){
      addBox(scene,backLength,T,shelfDepth,0,baseY-T/2,backZ,mats.shelf);
      addBox(scene,shelfDepth,T,sideLength,-W/2+T+shelfDepth/2,baseY-T/2,sideZ,mats.shelf);
      addBox(scene,shelfDepth,T,sideLength,W/2-T-shelfDepth/2,baseY-T/2,sideZ,mats.shelf);
    }
  }

  function buildSurface(idx,wall){
    const baseY=shelfYs[idx];
    if(baseY===undefined) return;
    const row=rowsByShelf.get(idx)||null;
    const kind=(row&&row.surface)||'shelf';
    const floor=kind==='floor'||wall==='floor';
    const rod=kind==='rod';
    if(floor){
      const hit=makeHitbox(scene,W-2*T,6,D-2*T,0,T+3,0,{shelfIndex:idx,shelfY:T,row});
      if(row) addShelfLabel(scene,row,-W/2,T+3.5,D/2+0.7);
      surfaces.push({index:idx,kind:'floor',row,y:T,hitbox:hit,uDir:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1),length:W-2*T-2,gap:10,itemDepth:Math.min(D*0.3,9)});
      return;
    }

    const back=wall==='back';
    const left=wall==='left';
    const length=back?backLength:sideLength;
    const x=back?0:left?-W/2+T+shelfDepth/2:W/2-T-shelfDepth/2;
    const z=back?-D/2+T+shelfDepth/2:-D/2+T+shelfDepth+sideLength/2;
    const y=rod?Math.min(H-7,baseY+gapAbove[idx]*0.78):baseY;

    const accent=accentFor(row);
    if(accent) addBox(scene,back?length:0.4,0.35,back?0.4:length,
      back?x:(left?-W/2+shelfDepth+T:W/2-shelfDepth-T),y+0.2,
      back?-D/2+shelfDepth+T:z,new THREE.MeshBasicMaterial({color:accent}));
    if(row) addShelfLabel(scene,row,back?-W/2:(left?-W/2:W/2-shelfDepth),y+3.2,back?z+shelfDepth/2+0.7:-D/2+T);

    const hit=makeHitbox(scene,back?length:shelfDepth,Math.max(6,H/NSH*0.8),back?shelfDepth:length,
      x,rod?y-gapAbove[idx]*0.25:y+Math.max(3,H/NSH*0.4),z,{shelfIndex:idx,shelfY:y,row});
    surfaces.push({
      index:idx,kind,row,y,hitbox:hit,
      uDir:back?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),
      normal:back?new THREE.Vector3(0,0,1):new THREE.Vector3(left?1:-1,0,0),
      length,gap:rod?Math.max(10,gapAbove[idx]*0.75):gapAbove[idx],itemDepth:rod?1.5:Math.min(shelfDepth*0.58,8),
    });
  }

  rows.left.forEach(i=>buildSurface(i,'left'));
  rows.back.forEach(i=>buildSurface(i,'back'));
  rows.right.forEach(i=>buildSurface(i,'right'));
  rows.floor.forEach(i=>buildSurface(i,'floor'));
  scene.userData.layoutFootprint={type:'walkin-u',width:W,depth:D,shelfDepth};
  return {surfaces};
}
