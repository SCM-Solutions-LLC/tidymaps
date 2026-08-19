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
