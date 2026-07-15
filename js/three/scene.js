import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeLabelSprite } from './labels.js';

/* Schematic 3D of the organized space: carcass + shelves from the plan's
   geometry, one zone per map row, items as draggable blocks. World units
   are inches. */

const COLORS = {
  bg: 0xf9f2ec,
  carcass: 0xf3e9df,
  shelf: 0xe8dccf,
  eye: 0xc4674a,       // terracotta
  kidSafe: 0x5d9c72,   // green
  keepHigh: 0xcc8b3a,  // amber
};
const ITEM_PALETTE = [0xcb7a58, 0xd9a05b, 0x7ea37a, 0x6b93b8, 0xa084b8, 0x9aa65c];
const SIZE_H = { s: 3.4, m: 5.4, l: 8.2 };

function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,32); }

export function itemIdFor(shelfIndex, idx, name){ return `${shelfIndex}-${idx}-${slug(name)}`; }

export function buildScene({ geometry, map, placements, canvas }){
  const W=geometry.width, H=geometry.height, D=geometry.depth, T=0.75;

  const renderer=new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2));
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(COLORS.bg);

  const camera=new THREE.PerspectiveCamera(42, 1, 1, H*20);
  // frame the whole unit: camera sits H*1.5 away along a front-right-high axis
  const target=new THREE.Vector3(0, H*0.46, 0);
  camera.position.copy(new THREE.Vector3(0.55, 0.36, 1).normalize().multiplyScalar(H*1.55).add(target));

  const controls=new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enablePan=false;
  controls.enableDamping=true;
  controls.dampingFactor=0.08;
  controls.minDistance=H*0.7;
  controls.maxDistance=H*3.2;
  controls.maxPolarAngle=Math.PI*0.52;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8f8378, 1.05));
  const dir=new THREE.DirectionalLight(0xffffff, 1.25);
  dir.position.set(W, H*1.4, D*2.2);
  scene.add(dir);

  const carcassMat=new THREE.MeshStandardMaterial({ color:COLORS.carcass, roughness:0.9 });
  const shelfMat=new THREE.MeshStandardMaterial({ color:COLORS.shelf, roughness:0.85 });
  const addBox=(w,h,d,x,y,z,mat)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat||carcassMat);
    m.position.set(x,y,z);
    scene.add(m);
    return m;
  };
  // open-front carcass
  addBox(W, H, T, 0, H/2, -D/2+T/2);            // back
  addBox(T, H, D, -W/2+T/2, H/2, 0);            // left
  addBox(T, H, D,  W/2-T/2, H/2, 0);            // right
  addBox(W, T, D, 0, H-T/2, 0);                 // top
  addBox(W, T, D, 0, T/2, 0);                   // bottom

  // shelves + invisible drop targets
  const shelves=[];   // {index, y, hitbox, rowMeta}
  const rowsByShelf=new Map();
  map.forEach(row=>{ rowsByShelf.set(row.shelfIndex, row); });
  geometry.shelfYFracs.forEach((frac,i)=>{
    const y=Math.max(T, H*(1-frac));
    if(y<H-T*2) addBox(W-2*T, T, D-T, 0, y-T/2, T/4, shelfMat);
    const row=rowsByShelf.get(i)||null;
    // accent strip along the shelf front for eye-level / safety rows
    if(row){
      let accent=null;
      if(row.safety && row.safety.flag==='kid-safe') accent=COLORS.kidSafe;
      else if(row.safety && row.safety.flag) accent=COLORS.keepHigh;
      else if(row.eye) accent=COLORS.eye;
      if(accent){
        addBox(W-2*T, 0.4, 0.4, 0, y+0.2-T/2, D/2-0.3,
          new THREE.MeshBasicMaterial({ color:accent }));
      }
      const label=makeLabelSprite(row.lv + (row.safety&&row.safety.flag?`  ·  ${row.safety.flag.replace(/-/g,' ')}`:''),
        { color:'#4a3f38' });
      label.position.set(-W/2+label.scale.x/2+1.5, y+3.4, D/2+0.6);
      scene.add(label);
    }
    // generous invisible hitbox for drag targeting
    const hit=new THREE.Mesh(
      new THREE.BoxGeometry(W-2*T, Math.max(6, H/geometry.shelfCount*0.85), D),
      new THREE.MeshBasicMaterial({ visible:false }));
    hit.position.set(0, y+Math.max(3, H/geometry.shelfCount*0.42), 0);
    hit.userData={ shelfIndex:i, shelfY:y, row };
    scene.add(hit);
    shelves.push({ index:i, y, hitbox:hit, row });
  });

  // items
  const items=[];
  let colorI=0;
  map.forEach(row=>{
    (row.items||[]).forEach((it,idx)=>{
      const id=itemIdFor(row.shelfIndex, idx, it.name);
      const placed=placements.find(p=>p.itemId===id);
      const h=SIZE_H[it.size]||SIZE_H.m;
      const color=ITEM_PALETTE[(colorI++)%ITEM_PALETTE.length];
      const mesh=new THREE.Mesh(
        new THREE.BoxGeometry(1,1,1),
        new THREE.MeshStandardMaterial({ color, roughness:0.65 }));
      mesh.scale.set(1, h, Math.min(D*0.55, 8));
      mesh.userData={ itemId:id, name:it.name, flags:it.flags||[], size:it.size,
        shelfIndex: placed?placed.shelfIndex:row.shelfIndex,
        slot: placed?placed.slot:idx,
        baseColor:color };
      scene.add(mesh);
      const label=makeLabelSprite(it.name, { size:11, bg:'rgba(255,255,255,.94)' });
      label.center.set(0.5,0);
      mesh.userData.label=label;
      scene.add(label);
      items.push(mesh);
    });
  });

  // lay items out in slot order per shelf
  function reflow(){
    shelves.forEach(sh=>{
      const here=items.filter(m=>m.userData.shelfIndex===sh.index)
        .sort((a,b)=>a.userData.slot-b.userData.slot);
      here.forEach((m,i)=>{ m.userData.slot=i; });
      const n=here.length;
      if(!n) return;
      const usable=W-2*T-2;
      const cell=usable/n;
      here.forEach((m,i)=>{
        const w=Math.min(cell*0.78, 10);
        m.scale.x=w;
        const x=-usable/2+cell*(i+0.5);
        m.position.set(x, sh.y+m.scale.y/2, T/2);
        m.userData.label.position.set(x, sh.y+m.scale.y+0.5, D/2+0.5);
      });
    });
  }
  reflow();

  function setSize(){
    const w=canvas.clientWidth||canvas.parentElement.clientWidth;
    const h=canvas.clientHeight||Math.min(innerHeight*0.68, 560);
    renderer.setSize(w, h, false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
  }
  setSize();

  let raf=0, disposed=false;
  function loop(){
    if(disposed) return;
    controls.update();
    renderer.render(scene, camera);
    raf=requestAnimationFrame(loop);
  }
  loop();

  function dispose(){
    disposed=true;
    cancelAnimationFrame(raf);
    controls.dispose();
    scene.traverse(o=>{
      if(o.geometry) o.geometry.dispose();
      if(o.material){
        (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{
          if(m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    renderer.dispose();
  }

  return { scene, renderer, camera, controls, items, shelves, reflow, setSize, dispose,
    placements(){ return items.map(m=>({ itemId:m.userData.itemId, shelfIndex:m.userData.shelfIndex, slot:m.userData.slot })); } };
}
