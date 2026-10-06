import * as THREE from 'three';
import { addBox, addShelfLabel, accentFor, makeHitbox, addRod } from './helpers.js';
import { roomPlanFor, roomShelfDepth, runLength } from '../roomBoards.js';

/* Open, integrated L-shaped room. Width and depth define room footprint;
   shelves keep realistic 10 to 18 inch depth instead of becoming full-room
   slabs or an appendage outside the measured bounds.

   Both runs carry the same N boards at the same heights, and each plan row
   sits on one board of one run, as the room plan (roomBoards.js) says. The
   plan's walls are back and side: the side run is drawn on whichever side
   the layout says (lSide), so rows the plan put on the left and rows it put
   on the right both land there. */
export function build(ctx){
  const {scene,geo,rowsByShelf,mats,layout}=ctx;
  const {W,H,D,T,NSH,shelfYs,gapAbove}=geo;
  const geometry={width:W,height:H,depth:D};
  // Same floor and the same half-room cap as the walk-in, for the same
  // reasons, with the L's own factor: see roomShelfDepth in roomBoards.js.
  const shelfDepth=roomShelfDepth('l-run',geometry);
  const sideSign=layout&&layout.lSide==='left'?-1:1;
  const rodMat=new THREE.MeshStandardMaterial({color:0x8d9490,metalness:0.7,roughness:0.24});

  addBox(scene,W,T,D,0,T/2,0,mats.carcass);
  addBox(scene,W,H,T,0,H/2,-D/2+T/2,mats.carcass);
  addBox(scene,T,H,D,sideSign*(W/2-T/2),H/2,0,mats.carcass);

  // See walkin-u.js: the type is pinned for a caller whose layout has none.
  const room=ctx.room||roomPlanFor({ map:ctx.map, layout:{...(layout||{}),type:'l-run'}, N:NSH, boardYs:shelfYs, rowsByShelf });
  const surfaces=[];
  const usableA=runLength('l-run','back',geometry);
  const usableB=runLength('l-run','side',geometry);
  const backX=-sideSign*shelfDepth/2;
  const backZ=-D/2+T+shelfDepth/2;
  const sideX=sideSign*(W/2-T-shelfDepth/2);
  const sideZ=shelfDepth/2;
  const rowFor=idx=>rowsByShelf.get(idx)||null;
  const kindOf=row=>(row&&row.surface)||'shelf';
  const rodY=board=>Math.min(H-7,shelfYs[board]+gapAbove[board]*0.78);

  const rodAt=new Set();
  for(const [idx,wall] of room.wallOf){
    if(kindOf(rowFor(idx))==='rod') rodAt.add(`${wall}:${room.boardOf.get(idx)}`);
  }

  // The fixture itself wraps the corner at every board; a rod replaces the
  // board only on the run where a rod row sits.
  for(const wall of ['back','side']){
    const back=wall==='back';
    const length=back?usableA:usableB;
    const x=back?backX:sideX;
    const z=back?backZ:sideZ;
    for(let board=0;board<NSH;board++){
      const baseY=shelfYs[board];
      if(baseY===undefined) continue;
      if(rodAt.has(`${wall}:${board}`)){
        addRod(scene,length,x,rodY(board),z,back?'x':'z',rodMat);
      }else if(baseY>1.6*T&&baseY<H-2*T){
        addBox(scene,back?length:shelfDepth,T,back?shelfDepth:length,x,baseY-T/2,z,mats.shelf);
      }
    }
  }

  function buildSurface(idx,side){
    const board=room.boardOf.get(idx);
    const baseY=shelfYs[board];
    if(baseY===undefined) return;
    const row=rowFor(idx);
    const kind=kindOf(row);
    const floor=kind==='floor';
    const rod=kind==='rod';
    const back=side==='back';
    const length=back?usableA:usableB;
    const centerX=back?backX:sideX;
    const centerZ=back?backZ:sideZ;
    const gap=gapAbove[board];
    const y=rod?rodY(board):floor?T:baseY;

    const accent=accentFor(row);
    if(accent){
      addBox(scene,back?length:0.4,0.35,back?0.4:length,
        back?centerX:sideSign*(W/2-shelfDepth-0.2), y+0.2,
        back?-D/2+shelfDepth+T:sideZ,
        new THREE.MeshBasicMaterial({color:accent}));
    }
    if(row) addShelfLabel(scene,row,back?-W/2:sideSign*(W/2-shelfDepth),y+3.2,back?backZ+shelfDepth/2+0.7:-D/2+T,
      { normal: back?new THREE.Vector3(0,0,1):new THREE.Vector3(-sideSign,0,0) });

    const hit=makeHitbox(scene,back?length:shelfDepth,
      Math.max(6,H/NSH*0.8),back?shelfDepth: length,
      centerX,rod?y-gap*0.25:floor?T+3:y+Math.max(3,H/NSH*0.4),centerZ,
      {shelfIndex:idx,shelfY:y,row});
    /* The side run's uDir follows its side so items face the room and
       slots read left to right from the aisle whichever side it is on; see
       the note on the walk-in's left wall in walkin-u.js. */
    surfaces.push({
      index:idx,kind,row,y,hitbox:hit,
      uDir:back?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,sideSign),
      normal:back?new THREE.Vector3(0,0,1):new THREE.Vector3(-sideSign,0,0),
      length,gap:rod?Math.max(10,gap*0.75):gap,
      depth:shelfDepth,itemDepth:rod?1.5:Math.min(shelfDepth*0.58,8),
    });
  }

  for(const wall of room.walls) wall.rows.forEach(idx=>buildSurface(idx,wall.id));
  /* Floor rows run along the back, as they did before the room plan. */
  room.floorRows.forEach(idx=>{
    const row=rowFor(idx);
    const hit=makeHitbox(scene,usableA,Math.max(6,H/NSH*0.8),shelfDepth,backX,T+3,backZ,{shelfIndex:idx,shelfY:T,row});
    if(row) addShelfLabel(scene,row,-W/2,T+3.2,backZ+shelfDepth/2+0.7,{ normal:new THREE.Vector3(0,0,1) });
    surfaces.push({
      index:idx,kind:'floor',row,y:T,hitbox:hit,
      uDir:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1),
      length:usableA,gap:gapAbove[NSH-1]||10,depth:shelfDepth,itemDepth:Math.min(shelfDepth*0.58,8),
    });
  });
  scene.userData.layoutFootprint={type:'l-run',width:W,depth:D,shelfDepth,lSide:sideSign<0?'left':'right'};
  return {surfaces};
}
