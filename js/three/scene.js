import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeLabelSprite } from './labels.js';
import { LAYOUT_BUILDERS } from './layouts/index.js';
import { COLORS, ITEM_PALETTE, SIZE_H, slug, createMaterials } from './layouts/helpers.js';
import { ITEM_NORMAL_OFFSET, itemYForSurface, pointOnSurface, surfaceRotationY } from './surfaceMath.js';

/* Schematic 3D of the organized space: carcass + shelves from the plan's
   geometry, one zone per map row, items as draggable blocks. World units
   are inches. */

export function itemIdFor(shelfIndex, idx, name){ return `${shelfIndex}-${idx}-${slug(name)}`; }

export function buildScene({ geometry, map, placements, canvas, layout }){
  const W=Math.max(8, Number(geometry.width)||30);
  const H=Math.max(10, Number(geometry.height)||60);
  const D=Math.max(4, Number(geometry.depth)||14);
  const T=0.75;
  const NSH=Math.max(1, Math.round(Number(geometry.shelfCount))||(map?map.length:5)||5);
  const fracs=(Array.isArray(geometry.shelfYFracs) && geometry.shelfYFracs.length
    ? geometry.shelfYFracs.map(Number).filter(n=>Number.isFinite(n)&&n>=0&&n<=1)
    : []);
  const shelfFracs=fracs.length?fracs
    :Array.from({length:NSH},(_,i)=>0.08+0.82*(NSH===1?0.5:i/(NSH-1)));

  const renderer=new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2));
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(COLORS.bg);

  const S=Math.max(H, W*0.95, D*1.3);
  const camera=new THREE.PerspectiveCamera(42, 1, 1, S*20);
  const target=new THREE.Vector3(0, H*0.46, 0);
  camera.position.copy(new THREE.Vector3(0.55, 0.36, 1).normalize().multiplyScalar(S*1.55).add(target));

  const controls=new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enablePan=false;
  controls.enableDamping=true;
  controls.dampingFactor=0.08;
  controls.minDistance=S*0.7;
  controls.maxDistance=S*3.2;
  controls.maxPolarAngle=Math.PI*0.52;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xfdfff5, 0x8b9184, 1.05));
  const dir=new THREE.DirectionalLight(0xffffff, 1.25);
  dir.position.set(W, H*1.4, D*2.2);
  scene.add(dir);

  const shelfYs=shelfFracs.map(frac=>{
    let y=Math.max(T, Math.min(H*(1-frac), H-T-3.2));
    if(frac>=0.86) y=T;
    return y;
  });
  const gapAbove=shelfYs.map(y=>{
    const above=shelfYs.filter(o=>o>y+0.5);
    const ceil=above.length?Math.min(...above):H-T;
    return Math.max(2.2, ceil-y);
  });

  const rowsByShelf=new Map();
  map.forEach(row=>{ rowsByShelf.set(row.shelfIndex, row); });

  const mats=createMaterials();
  const layoutType=(layout&&layout.type)||'shelves';
  const builder=LAYOUT_BUILDERS[layoutType]||LAYOUT_BUILDERS.shelves;
  const { surfaces }=builder({
    scene,
    geo:{ W, H, D, T, NSH, shelfYs, gapAbove, fracs:shelfFracs },
    map, rowsByShelf, mats,
    layout: layout||{ type:'shelves' },
  });

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
        baseColor:color, baseH:h };
      scene.add(mesh);
      const shortName=it.name.length>18?it.name.slice(0,17)+'…':it.name;
      const label=makeLabelSprite(shortName, { size:10, bg:'rgba(255,255,255,.92)' });
      label.center.set(0.5,0);
      mesh.userData.label=label;
      scene.add(label);
      items.push(mesh);
    });
  });

  const shelves=surfaces;

  function reflow(){
    surfaces.forEach(sh=>{
      const here=items.filter(m=>m.userData.shelfIndex===sh.index)
        .sort((a,b)=>a.userData.slot-b.userData.slot);
      here.forEach((m,i)=>{ m.userData.slot=i; });
      const n=here.length;
      if(!n) return;
      const maxH=Math.max(1.6,(sh.gap||gapAbove[sh.index]||8)-1.4);
      const usable=sh.length||(W-2*T-2);
      const cell=usable/n;
      here.forEach((m,i)=>{
        const w=Math.min(cell*0.78, 10);
        m.scale.x=w;
        m.scale.y=Math.min(m.userData.baseH||m.scale.y, maxH);
        m.scale.z=Math.min(sh.itemDepth||D*0.55, 8);
        const offset=-usable/2+cell*(i+0.5);
        const position=pointOnSurface(sh, offset, ITEM_NORMAL_OFFSET);
        m.position.set(position.x, itemYForSurface(sh, m.scale.y), position.z);
        m.rotation.y=surfaceRotationY(sh);
        const lift=n>3?(i%2)*2.2:0;
        const labelPosition=pointOnSurface(sh, offset, ITEM_NORMAL_OFFSET+m.scale.z/2+0.5);
        m.userData.label.position.set(
          labelPosition.x,
          m.position.y+m.scale.y/2+0.5+lift,
          labelPosition.z,
        );
      });
    });
  }
  reflow();

  function setSize(){
    const w=canvas.clientWidth||canvas.parentElement.clientWidth||640;
    const h=canvas.clientHeight||Math.min(innerHeight*0.68, 560)||420;
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

  return { scene, renderer, camera, controls, items, shelves, surfaces, reflow, setSize, dispose,
    placements(){ return items.map(m=>({ itemId:m.userData.itemId, shelfIndex:m.userData.shelfIndex, slot:m.userData.slot })); } };
}
