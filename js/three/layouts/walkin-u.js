import * as THREE from 'three';
import {addBox,addShelfLabel,accentFor,makeHitbox,addRod} from './helpers.js';
import { roomPlanFor, roomShelfDepth, runLength } from '../roomBoards.js';

/* Walk-in room using full measured footprint. Three storage walls wrap one
   open aisle. Shelves and rods stay realistic depth instead of filling room.

   The room is one fitted system: every wall carries the same N boards at
   the same heights (geo.NSH, geo.shelfYs), and each plan row sits on one
   board of one wall. Which wall and which board come from the room plan
   (roomBoards.js), the same reading of the plan the report's wall tabs use.
   The builder used to draw one board per plan ROW on every wall and deal
   rows onto walls round-robin, so a 12-row pantry became 12 boards on each
   of three walls and the wall the plan named was ignored. */
export function build(ctx){
  const {scene,geo,rowsByShelf,mats,layout}=ctx;
  const {W,H,D,T,NSH,shelfYs,gapAbove}=geo;
  const geometry={width:W,height:H,depth:D};
  /* The depth formula lives in roomBoards.js (roomShelfDepth) with the
     reasons for its 14-inch floor and half-room cap; it is also the server's
     usableShelfDepth and catalog.js shelfDepthFor, and tests hold them equal
     (catalog-fit.test.mjs, plan-schema.test.mjs). */
  const shelfDepth=roomShelfDepth('walkin-u',geometry);
  const rodMat=new THREE.MeshStandardMaterial({color:0x8d9490,metalness:0.7,roughness:0.24});

  addBox(scene,W,T,D,0,T/2,0,mats.carcass);
  addBox(scene,W,H,T,0,H/2,-D/2+T/2,mats.carcass);
  addBox(scene,T,H,D,-W/2+T/2,H/2,0,mats.carcass);
  addBox(scene,T,H,D,W/2-T/2,H/2,0,mats.carcass);

  /* buildScene passes the room plan it computed; a builder called on its
     own (the layout spec does, with sections and no map) computes it here.
     The layout a direct caller hands over may carry no type, and this
     builder is the walk-in whatever it says, so the type is pinned. */
  const room=ctx.room||roomPlanFor({ map:ctx.map, layout:{...(layout||{}),type:'walkin-u'}, N:NSH, boardYs:shelfYs, rowsByShelf });
  const surfaces=[];
  const backLength=runLength('walkin-u','back',geometry);
  const sideLength=runLength('walkin-u','left',geometry);
  const backZ=-D/2+T+shelfDepth/2;
  const sideZ=-D/2+T+shelfDepth+sideLength/2;
  const wallX={left:-W/2+T+shelfDepth/2,back:0,right:W/2-T-shelfDepth/2};
  const rowFor=idx=>rowsByShelf.get(idx)||null;
  const kindOf=row=>(row&&row.surface)||'shelf';
  const rodY=board=>Math.min(H-7,shelfYs[board]+gapAbove[board]*0.78);

  /* Which board of which wall carries a rod row, so that board is drawn as
     a rod on that wall and as a shelf everywhere else. */
  const rodAt=new Set();
  for(const [idx,wall] of room.wallOf){
    if(kindOf(rowFor(idx))==='rod') rodAt.add(`${wall}:${room.boardOf.get(idx)}`);
  }

  for(const wall of ['left','back','right']){
    const back=wall==='back';
    const length=back?backLength:sideLength;
    const x=wallX[wall];
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

  function buildFloor(idx){
    const row=rowFor(idx);
    const hit=makeHitbox(scene,W-2*T,6,D-2*T,0,T+3,0,{shelfIndex:idx,shelfY:T,row});
    if(row) addShelfLabel(scene,row,-W/2,T+3.5,D/2+0.7);
    surfaces.push({index:idx,kind:'floor',row,y:T,hitbox:hit,uDir:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1),length:W-2*T-2,gap:10,depth:D,itemDepth:Math.min(D*0.3,9)});
  }

  function buildSurface(idx,wall){
    const board=room.boardOf.get(idx);
    const baseY=shelfYs[board];
    if(baseY===undefined) return;
    const row=rowFor(idx);
    const kind=kindOf(row);
    if(kind==='floor'){ buildFloor(idx); return; }
    const rod=kind==='rod';
    const back=wall==='back';
    const left=wall==='left';
    const length=back?backLength:sideLength;
    const x=wallX[wall];
    const z=back?backZ:sideZ;
    const y=rod?rodY(board):baseY;
    /* The pitch to the board above on this wall, or to the ceiling for the
       top board. Every wall shares the boards, so it is the board's own. */
    const gap=gapAbove[board];

    const accent=accentFor(row);
    if(accent) addBox(scene,back?length:0.4,0.35,back?0.4:length,
      back?x:(left?-W/2+shelfDepth+T:W/2-shelfDepth-T),y+0.2,
      back?-D/2+shelfDepth+T:z,new THREE.MeshBasicMaterial({color:accent}));
    if(row) addShelfLabel(scene,row,back?-W/2:(left?-W/2:W/2-shelfDepth),y+3.2,back?z+shelfDepth/2+0.7:-D/2+T,
      { normal: back?new THREE.Vector3(0,0,1):new THREE.Vector3(left?1:-1,0,0) });

    const hit=makeHitbox(scene,back?length:shelfDepth,Math.max(6,H/NSH*0.8),back?shelfDepth:length,
      x,rod?y-gap*0.25:y+Math.max(3,H/NSH*0.4),z,{shelfIndex:idx,shelfY:y,row});
    /* uDir is the direction slots run in and, through surfaceRotationY,
       which way items face: an item is authored facing +z and turned by
       atan2(-u.z, u.x). The right wall's (0,0,1) turns items to face -x,
       into the aisle, and its slots read left to right from the aisle. The
       left wall used the same vector, so its items faced -x as well: into
       their own wall, backs to the room, and its slots ran right to left as
       seen from the aisle. (0,0,-1) puts both right at once. */
    surfaces.push({
      index:idx,kind,row,y,hitbox:hit,
      uDir:back?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,left?-1:1),
      normal:back?new THREE.Vector3(0,0,1):new THREE.Vector3(left?1:-1,0,0),
      length,gap:rod?Math.max(10,gap*0.75):gap,depth:shelfDepth,itemDepth:rod?1.5:Math.min(shelfDepth*0.58,8),
    });
  }

  for(const wall of room.walls) wall.rows.forEach(idx=>buildSurface(idx,wall.id));
  room.floorRows.forEach(idx=>buildFloor(idx));
  scene.userData.layoutFootprint={type:'walkin-u',width:W,depth:D,shelfDepth};
  return {surfaces};
}
