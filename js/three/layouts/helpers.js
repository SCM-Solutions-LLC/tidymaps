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

export function addShelfLabel(scene, row, leftEdge, y, z){
  if(!row) return;
  const text=row.lv+(row.safety&&row.safety.flag?`  ·  ${row.safety.flag.replace(/-/g,' ')}`:'');
  const label=makeLabelSprite(text, { color:'#3b4237' });
  label.position.set(leftEdge+label.scale.x/2+1.5, y, z);
  scene.add(label);
}

export function addAccentStrip(scene, row, w, y, z){
  const accent=accentFor(row);
  if(!accent) return;
  addBox(scene, w, 0.4, 0.4, 0, y+0.2, z,
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
