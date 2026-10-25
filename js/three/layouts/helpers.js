import * as THREE from 'three';
import { makeLabelSprite } from '../labels.js';

export const COLORS = {
  bg: 0xf5f7f1,
  carcass: 0xebeee3,
  shelf: 0xdfe4d4,
  eye: 0x3a7350,
  kidSafe: 0x7db894,
  keepHigh: 0xc9973d,
};

export const ITEM_PALETTE = [0xb0885a, 0xd9a05b, 0x7ea37a, 0x6b93b8, 0xa084b8, 0x9aa65c];
export const SIZE_H = { s: 3.4, m: 5.4, l: 8.2 };

export function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,32); }

export function createMaterials(){
  return {
    carcass: new THREE.MeshStandardMaterial({ color:COLORS.carcass, roughness:0.9 }),
    shelf:   new THREE.MeshStandardMaterial({ color:COLORS.shelf, roughness:0.85 }),
  };
}

export function addBox(scene, w, h, d, x, y, z, mat){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z);
  m.castShadow=true;
  m.receiveShadow=true;
  scene.add(m);
  return m;
}

/* A hanging rod along one run. `axis` is the run's direction: 'x' for a
   back run, anything else for a side run along z. The walk-in and the L-run
   each carried their own copy of this; one copy here so a change to how a
   rod is drawn reaches both rooms. */
export function addRod(scene, length, x, y, z, axis, mat){
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,length,14), mat);
  if(axis==='x') rod.rotation.z=Math.PI/2;
  else rod.rotation.x=Math.PI/2;
  rod.position.set(x,y,z);
  rod.castShadow=true;
  scene.add(rod);
  return rod;
}

export function accentFor(row){
  if(!row) return null;
  if(row.safety && row.safety.flag==='kid-safe') return COLORS.kidSafe;
  if(row.safety && row.safety.flag) return COLORS.keepHigh;
  if(row.eye) return COLORS.eye;
  return null;
}

/* The name a shelf goes by, and the job it does, on one line.

   This used to read `row.lv` alone — the place ("top shelf") — while the
   sidebar beside it listed `row.zone`, the purpose ("Bulk overflow: extra
   paper goods"). One row of the plan, two names, and nothing on screen saying
   they were the same row: the controls called them shelves, the sidebar called
   them zones, and a reader had to work out that a zone IS what a shelf is for.
   The report already says so in as many words — "Each shelf is a labeled
   zone" — so the label says both, joined.

   Only the head of the zone goes on the sprite; the rest is already in the
   sidebar, and a paragraph floating in a 3D scene is not a label. Two shapes
   turn up and both have to be cut: the model writes "Name: the detail", and
   the demo scenarios write "Name · detail · detail". Splitting on only the
   colon left the demo labels as a truncated run-on ("Bulk overflow · Backup
   pa…") — the detail crowding out the name it was meant to qualify. */
function zoneLabelText(row){
  const place=String(row.lv||'').trim();
  const zone=String(row.zone||'').split(/[:·]/)[0].trim();
  const flag=row.safety&&row.safety.flag?`  ·  ${row.safety.flag.replace(/-/g,' ')}`:'';
  if(!zone) return place+flag;
  if(!place) return zone+flag;
  const joined=`${place} · ${zone}`;
  return (joined.length>38?joined.slice(0,37)+'…':joined)+flag;
}

/* `normal` is the direction the surface faces. Front-facing runs are the
   common case, so it defaults to +z and only the layouts with side walls
   (walk-in, L-run) have to say otherwise. The renderer uses it to drop labels
   on walls the camera is behind — see the label pass in scene.js. */
export function addShelfLabel(scene, row, leftEdge, y, z, { normal=null }={}){
  if(!row) return;
  const text=zoneLabelText(row);
  const label=makeLabelSprite(text, { color:'#3b4237' });
  label.position.set(leftEdge+label.scale.x/2+1.5, y, z);
  /* Shown by default. They were built hidden and revealed only while the
     pointer sat on a sidebar row, which meant the zone names did not exist at
     all on a touch screen — there is no hover to give. */
  label.visible=true;
  label.userData.zoneShelfIndex=row.shelfIndex;
  label.userData.isZoneLabel=true;
  /* The text is drawn into a canvas texture, so it cannot be read back off the
     sprite. Kept here so what the drawing says is checkable. */
  label.userData.labelText=text;
  label.userData.faceNormal=normal?normal.clone():new THREE.Vector3(0,0,1);
  label.userData.baseScale=label.scale.clone();
  /* Where the builder put it. The label pass in scene.js slides a label
     sideways to keep it in a narrow frame and starts from here each time. */
  label.userData.basePosition=label.position.clone();
  scene.add(label);
  return label;
}

export function addAccentStrip(scene, row, w, y, z, x=0){
  const accent=accentFor(row);
  if(!accent) return;
  addBox(scene, w, 0.4, 0.4, x, y+0.2, z,
    new THREE.MeshBasicMaterial({ color:accent }));
}

export function makeHitbox(scene, w, h, d, x, y, z, userData){
  const hit=new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ visible:false }));
  hit.position.set(x, y, z);
  Object.assign(hit.userData, userData);
  scene.add(hit);
  return hit;
}

/* A door swung open (js/three/doorBins.js openDoor), with its bins on the
   inside: the slab, a liner, a grip near the free edge, and one clear tray
   per bin. `hz` is the front plane the hinge stands on. */
export function addOpenDoor(scene, d, hz, { shellMat, linerMat, binMat, handleMat }){
  const rotY=Math.atan2(-d.run.z, d.run.x);
  const at=(along, out)=>[d.hingeX+d.run.x*along+d.inward.x*out, hz+d.run.z*along+d.inward.z*out];
  const half=d.width/2, slabT=1.6, midY=(d.y0+d.y1)/2;
  const place=(mesh, along, out, y)=>{
    const [x,z]=at(along, out);
    mesh.position.set(x, y, z);
    mesh.rotation.y=rotY;
    return mesh;
  };
  place(addBox(scene, d.width-0.3, d.y1-d.y0-0.3, slabT, 0,0,0, shellMat), half, -slabT/2, midY);
  place(addBox(scene, d.width-2.4, d.y1-d.y0-2.4, 0.3, 0,0,0, linerMat), half, 0.2, midY);
  place(addBox(scene, 0.7, Math.min(18, (d.y1-d.y0)*0.4), 0.9, 0,0,0, handleMat), d.width-2, -(slabT+0.5), midY);
  const len=d.width-4, binD=4, lip=Math.max(1.6, d.binH*0.45);
  for(const by of d.binYs){
    place(addBox(scene, len, 0.3, binD, 0,0,0, binMat), half, binD/2+1.2, by);
    place(addBox(scene, len, lip, 0.3, 0,0,0, binMat), half, binD+1.2, by+lip/2);
  }
}

/* The far corners of open doors, for the camera to keep in frame on a
   narrow canvas (scene.js fitWidthInFrame). */
export function doorFramePoints(doors, hz){
  const out=[];
  for(const d of doors){
    const x=d.hingeX+d.run.x*d.width, z=hz+d.run.z*d.width;
    out.push([x, d.y0, z], [x, d.y1, z]);
  }
  return out;
}
