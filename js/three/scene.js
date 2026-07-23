import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeLabelSprite } from './labels.js';
import { LAYOUT_BUILDERS } from './layouts/index.js';
import { COLORS, ITEM_PALETTE, slug, createMaterials } from './layouts/helpers.js';
import { semanticItemHeight, semanticItemKind } from './itemKinds.js';
import { organizerSpecFor } from './organizerKinds.js';
import { measuredCapacityProfile, naturalItemWidth, naturalOrganizerWidth, visualUnitCount } from './capacity.js';
import { ITEM_NORMAL_OFFSET, itemYForSurface, pointOnSurface, surfaceRotationY } from './surfaceMath.js';

/* Schematic 3D of the organized space: carcass + shelves from the plan's
   geometry, one zone per map row, items as draggable blocks. World units
   are inches. */

export function itemIdFor(shelfIndex, idx, name){ return `${shelfIndex}-${idx}-${slug(name)}`; }

function extrudedShape(points){
  const shape=new THREE.Shape();
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:0.16,bevelEnabled:true,bevelSize:0.035,bevelThickness:0.035,bevelSegments:2});
  geometry.translate(0,0,-0.08);
  return geometry;
}

function itemMaterial(color){
  return new THREE.MeshStandardMaterial({color,roughness:0.62,metalness:0.02});
}

function addChild(parent,geometry,material,position,rotation){
  const child=new THREE.Mesh(geometry,material);
  if(position) child.position.set(...position);
  if(rotation) child.rotation.set(...rotation);
  child.castShadow=true;
  child.receiveShadow=true;
  parent.add(child);
  return child;
}

function createSemanticItem(name,kind,color){
  const mat=itemMaterial(color);
  let mesh;
  if(kind==='garment'){
    mesh=new THREE.Mesh(extrudedShape([
      [-0.18,0.5],[0.18,0.5],[0.28,0.35],[0.5,0.22],[0.36,-0.02],[0.24,0.06],
      [0.24,-0.5],[-0.24,-0.5],[-0.24,0.06],[-0.36,-0.02],[-0.5,0.22],[-0.28,0.35],
    ]),mat);
    const hangerMat=new THREE.LineBasicMaterial({color:0x7c746c});
    const hangerGeo=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.3,0.42,0.13),new THREE.Vector3(0,0.61,0.13),
      new THREE.Vector3(0.3,0.42,0.13),new THREE.Vector3(-0.3,0.42,0.13),
    ]);
    mesh.add(new THREE.Line(hangerGeo,hangerMat));
  }else if(kind==='shoe'){
    mesh=new THREE.Mesh(extrudedShape([[-0.5,-0.28],[-0.2,-0.28],[-0.05,0.12],[0.18,0.2],[0.34,0.02],[0.5,-0.08],[0.46,-0.3]]),mat);
  }else if(kind==='bottle'){
    mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.46,1,18),mat);
    addChild(mesh,new THREE.CylinderGeometry(0.2,0.2,0.16,14),itemMaterial(0xf1eadf),[0,0.58,0]);
  }else if(kind==='can'){
    mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48,1,20),mat);
    addChild(mesh,new THREE.TorusGeometry(0.34,0.025,6,20),itemMaterial(0xd7d1c7),[0,0.505,0],[Math.PI/2,0,0]);
  }else if(kind==='dish'){
    mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.16,24),mat);
    mesh.rotation.x=Math.PI/2;
  }else if(kind==='tool'){
    mesh=new THREE.Mesh(new THREE.BoxGeometry(0.2,1,0.2),mat);
    addChild(mesh,new THREE.BoxGeometry(0.78,0.22,0.28),itemMaterial(0x7f746a),[0,0.42,0]);
  }else if(kind==='food'){
    mesh=new THREE.Mesh(extrudedShape([
      [-0.42,-0.5],[0.42,-0.5],[0.38,0.34],[0.27,0.5],[-0.27,0.5],[-0.38,0.34],
    ]),mat);
    addChild(mesh,new THREE.BoxGeometry(0.6,0.08,0.2),itemMaterial(0xf3eadc),[0,0.08,0.13]);
  }else{
    mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
    if(kind==='linen'){
      addChild(mesh,new THREE.BoxGeometry(0.92,0.04,1.04),itemMaterial(0xf4eee5),[0,0.08,0]);
      addChild(mesh,new THREE.BoxGeometry(0.92,0.04,1.04),itemMaterial(0xf4eee5),[0,-0.15,0]);
    }else if(kind==='container'){
      addChild(mesh,new THREE.BoxGeometry(1.06,0.09,1.06),itemMaterial(0xf0e5d6),[0,0.46,0]);
      addChild(mesh,new THREE.BoxGeometry(0.36,0.05,1.08),itemMaterial(0xf8f4ec),[0,0.06,0.01]);
    }else{
      addChild(mesh,new THREE.BoxGeometry(0.82,0.06,1.04),itemMaterial(0xf2eadf),[0,0.32,0]);
    }
  }
  mesh.name=`item-${kind}-${slug(name)}`;
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  return mesh;
}

function createOrganizer(type){
  const group=new THREE.Group();
  group.name=`organizer-${type}`;
  group.userData.type=type;
  const clear=new THREE.MeshStandardMaterial({
    color:0xc4ddd4,transparent:true,opacity:0.38,roughness:0.22,metalness:0,
    depthWrite:false,side:THREE.DoubleSide,
  });
  const edge=new THREE.MeshStandardMaterial({color:0x8fa9a0,roughness:0.55,transparent:true,opacity:0.72});
  const woven=new THREE.MeshStandardMaterial({color:0xb88755,roughness:0.94});
  const tray=new THREE.MeshStandardMaterial({color:0xd8d2c6,roughness:0.82});
  const label=new THREE.MeshStandardMaterial({color:0xf7f3ea,roughness:0.85});
  const metal=new THREE.MeshStandardMaterial({color:0xb8b9b3,metalness:0.22,roughness:0.48});

  if(type==='clear-bin'){
    addChild(group,new THREE.BoxGeometry(1,0.06,1),clear,[0,-0.47,0]);
    addChild(group,new THREE.BoxGeometry(1,0.52,0.045),clear,[0,-0.22,0.48]);
    addChild(group,new THREE.BoxGeometry(1,0.52,0.045),clear,[0,-0.22,-0.48]);
    addChild(group,new THREE.BoxGeometry(0.045,0.52,1),clear,[-0.48,-0.22,0]);
    addChild(group,new THREE.BoxGeometry(0.045,0.52,1),clear,[0.48,-0.22,0]);
    addChild(group,new THREE.BoxGeometry(1.03,0.035,0.05),edge,[0,0.05,0.49]);
    addChild(group,new THREE.BoxGeometry(0.34,0.12,0.055),label,[0,-0.2,0.515]);
  }else if(type==='basket'){
    addChild(group,new THREE.BoxGeometry(1,0.07,1),woven,[0,-0.47,0]);
    for(const y of [-0.38,-0.2,-0.02,0.16]){
      addChild(group,new THREE.BoxGeometry(1,0.11,0.07),woven,[0,y,0.47]);
      addChild(group,new THREE.BoxGeometry(1,0.11,0.07),woven,[0,y,-0.47]);
    }
    addChild(group,new THREE.BoxGeometry(0.07,0.7,1),woven,[-0.47,-0.14,0]);
    addChild(group,new THREE.BoxGeometry(0.07,0.7,1),woven,[0.47,-0.14,0]);
    addChild(group,new THREE.BoxGeometry(0.32,0.12,0.08),label,[0,-0.05,0.515]);
  }else if(type==='divider'){
    addChild(group,new THREE.BoxGeometry(1,0.08,1),tray,[0,-0.46,0]);
    addChild(group,new THREE.BoxGeometry(1,0.28,0.055),tray,[0,-0.32,0.47]);
    addChild(group,new THREE.BoxGeometry(1,0.28,0.055),tray,[0,-0.32,-0.47]);
    addChild(group,new THREE.BoxGeometry(0.055,0.28,1),tray,[-0.47,-0.32,0]);
    addChild(group,new THREE.BoxGeometry(0.055,0.28,1),tray,[0.47,-0.32,0]);
    for(const x of [-0.18,0.18]) addChild(group,new THREE.BoxGeometry(0.035,0.25,0.94),tray,[x,-0.31,0]);
  }else if(type==='turntable'){
    addChild(group,new THREE.CylinderGeometry(0.5,0.5,0.16,28),tray,[0,-0.42,0]);
    addChild(group,new THREE.TorusGeometry(0.46,0.025,6,28),edge,[0,-0.31,0],[Math.PI/2,0,0]);
  }else if(type==='riser'){
    addChild(group,new THREE.BoxGeometry(1,0.12,0.54),metal,[0,-0.12,-0.22]);
    addChild(group,new THREE.BoxGeometry(1,0.12,0.46),metal,[0,0.32,0.26]);
    addChild(group,new THREE.BoxGeometry(0.06,0.92,0.06),metal,[-0.42,-0.06,0.25]);
    addChild(group,new THREE.BoxGeometry(0.06,0.92,0.06),metal,[0.42,-0.06,0.25]);
  }else if(type==='door-rack'){
    addChild(group,new THREE.BoxGeometry(0.07,1,0.07),metal,[-0.46,0,0]);
    addChild(group,new THREE.BoxGeometry(0.07,1,0.07),metal,[0.46,0,0]);
    for(const y of [-0.34,0,0.34]){
      addChild(group,new THREE.BoxGeometry(1,0.06,0.46),metal,[0,y,0]);
      addChild(group,new THREE.BoxGeometry(1,0.18,0.05),metal,[0,y+0.08,0.22]);
    }
  }else if(type==='hook-rack'){
    addChild(group,new THREE.BoxGeometry(1,0.18,0.16),metal,[0,0.28,0]);
    for(const x of [-0.36,-0.12,0.12,0.36]){
      addChild(group,new THREE.CylinderGeometry(0.035,0.035,0.42,10),metal,[x,0.02,0.08],[Math.PI/2,0,0]);
      addChild(group,new THREE.TorusGeometry(0.1,0.035,6,12,Math.PI),metal,[x,-0.14,0.24],[0,Math.PI/2,0]);
    }
  }
  return group;
}

const KIND_MAX_W={garment:14,shoe:11,linen:12,bottle:6,can:6,dish:8,tool:7,food:8,container:13,'small-item':9};
const KIND_DEPTH={garment:1.2,shoe:4,linen:5,bottle:3.5,can:3.5,dish:2.5,tool:2.5,food:4,container:6,'small-item':4};

export function buildScene({ geometry, map, placements, canvas, layout, organizerPlan={}, representativeItems=true }){
  const W=Math.max(8, Number(geometry.width)||30);
  const rawH=Math.max(10, Number(geometry.height)||60);
  const H=layout&&layout.type==='under-sink'?Math.max(28,Math.min(42,rawH)):rawH;
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
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(COLORS.bg);
  scene.userData.capacityProfile=measuredCapacityProfile({width:W,height:H,depth:D});

  const S=Math.max(H, W*0.95, D*1.3);
  const camera=new THREE.PerspectiveCamera(42, 1, 1, S*20);
  const isOverhead=layout&&layout.type==='overhead-rack';
  // Ceiling racks live above normal cabinet height. Aim upward so rack and
  // stored items fill frame instead of leaving a large empty floor view.
  const target=new THREE.Vector3(0, isOverhead?H+2:H*0.46, 0);
  // Most corner layouts use the right-hand wall. Looking from the front-left
  // keeps that second run visible instead of flattening it into an appendage.
  // Walk-ins stay nearly centered so neither side wall blocks the aisle.
  const cameraX=layout&&layout.type==='walkin-u'?-0.08:
    layout&&layout.type==='l-run'&&layout.lSide==='left'?0.68:-0.68;
  const cameraDistance=S*(isOverhead?0.98:1.55);
  camera.position.copy(new THREE.Vector3(cameraX, 0.38, 1).normalize().multiplyScalar(cameraDistance).add(target));

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
  dir.castShadow=true;
  dir.shadow.mapSize.set(1024,1024);
  dir.shadow.camera.near=1;
  dir.shadow.camera.far=S*5;
  dir.shadow.camera.left=-S;
  dir.shadow.camera.right=S;
  dir.shadow.camera.top=S;
  dir.shadow.camera.bottom=-S;
  scene.add(dir);

  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(S*2.5,S*2.5),
    new THREE.MeshStandardMaterial({color:0xf0f2eb,roughness:1}));
  ground.rotation.x=-Math.PI/2;
  ground.position.y=-0.18;
  ground.receiveShadow=true;
  scene.add(ground);

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
  const organizers=[];
  const claimedPlanOrganizers=new Set();
  const planOrganizerRemaining=new Map();
  const matchedPlanOrganizers=new Set();
  let colorI=0;
  map.forEach(row=>{
    (row.items||[]).forEach((it,idx)=>{
      const id=itemIdFor(row.shelfIndex, idx, it.name);
      const placed=placements.find(p=>p.itemId===id);
      const surfaceKind=(row&&row.surface)||(layout&&layout.surfaceFor&&layout.surfaceFor(row.shelfIndex))||'shelf';
      const kind=semanticItemKind(it.name,surfaceKind);
      const h=semanticItemHeight(kind,it.size);
      const color=ITEM_PALETTE[(colorI++)%ITEM_PALETTE.length];
      const mesh=createSemanticItem(it.name,kind,color);
      mesh.scale.set(1,h,Math.min(KIND_DEPTH[kind]||5,D*0.55));
      mesh.userData={ itemId:id, name:it.name, flags:it.flags||[], size:it.size,
        kind,
        shelfIndex: placed?placed.shelfIndex:row.shelfIndex,
        slot: placed?placed.slot:idx,
        baseColor:color, baseH:h, displayCopies:[], visualUnitCount:1 };
      let organizerSpec=organizerSpecFor({
        surface:surfaceKind,row,itemKind:kind,
        space:organizerPlan.space,
        styles:organizerPlan.styles,
        prefs:organizerPlan.prefs,
        productNeeds:organizerPlan.productNeeds,
        existingText:organizerPlan.existingText,
      });
      if(organizerSpec&&organizerSpec.source==='plan'){
        const key=organizerSpec.needKey||organizerSpec.productId||`${organizerSpec.type}:${organizerSpec.label||''}`;
        const claim=`${row.shelfIndex}:${key}`;
        if(claimedPlanOrganizers.has(claim)) organizerSpec=null;
        else{
          claimedPlanOrganizers.add(claim);
          matchedPlanOrganizers.add(key);
          if(!planOrganizerRemaining.has(key)) planOrganizerRemaining.set(key,Math.max(1,Number(organizerSpec.qty)||1));
          const surface=surfaces.find(entry=>entry.index===row.shelfIndex);
          const dims=organizerSpec.productDims||{};
          const naturalW=Number(dims.w)||naturalOrganizerWidth(organizerSpec.type,organizerSpec.maxDims||{});
          const capacity=Math.max(1,Math.floor((((surface&&surface.length)||W)+1)/(naturalW+1)));
          const remaining=planOrganizerRemaining.get(key);
          const assigned=Math.min(remaining,capacity);
          organizerSpec={...organizerSpec,qty:assigned,requestedTotal:Math.max(1,Number(organizerSpec.qty)||1)};
          planOrganizerRemaining.set(key,remaining-assigned);
          if(assigned<1) organizerSpec=null;
        }
      }
      if(organizerSpec){
        const organizer=createOrganizer(organizerSpec.type);
        organizer.userData.spec=organizerSpec;
        organizer.userData.displayCopies=[];
        mesh.userData.organizer=organizer;
        scene.add(organizer);
        organizers.push(organizer);
      }
      scene.add(mesh);
      const shortName=it.name.length>18?it.name.slice(0,17)+'…':it.name;
      const label=makeLabelSprite(shortName, { size:10, bg:'rgba(255,255,255,.92)' });
      label.center.set(0.5,0);
      label.visible=false;
      mesh.userData.label=label;
      scene.add(label);
      items.push(mesh);
    });
  });

  const shelves=surfaces;

  function cloneDisplayVisual(item){
    // Three.js deep-clones userData through JSON. The draggable item's data
    // contains scene objects, so exclude it while cloning the lightweight
    // render tree and restore it immediately afterward.
    const data=item.userData;
    item.userData={};
    const copy=item.clone(true);
    item.userData=data;
    copy.userData={isDisplayCopy:true};
    return copy;
  }

  function ensureDisplayCopies(item,count){
    const copies=item.userData.displayCopies;
    while(copies.length<Math.max(0,count-1)){
      // Repeated contents share geometry and materials with their draggable
      // category item. This keeps large rooms full without multiplying GPU
      // resources for every representative shirt, bottle, or shoe.
      const copy=cloneDisplayVisual(item);
      copy.name=`display-copy-${copies.length+1}-${slug(item.userData.name)}`;
      scene.add(copy);
      copies.push(copy);
    }
    copies.forEach((copy,index)=>{ copy.visible=index<count-1; });
    return [item,...copies.slice(0,Math.max(0,count-1))];
  }

  function ensureOrganizerCopies(organizer,count){
    const copies=organizer.userData.displayCopies;
    while(copies.length<Math.max(0,count-1)){
      const data=organizer.userData;
      organizer.userData={};
      const copy=organizer.clone(true);
      organizer.userData=data;
      copy.userData={isOrganizerCopy:true,type:data.type,spec:data.spec};
      copy.name=`organizer-copy-${copies.length+1}-${data.type}`;
      scene.add(copy);
      copies.push(copy);
    }
    copies.forEach((copy,index)=>{ copy.visible=index<count-1; });
    return [organizer,...copies.slice(0,Math.max(0,count-1))];
  }

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
        const kind=m.userData.kind||'container';
        const organizer=m.userData.organizer;
        const spec=organizer&&organizer.userData.spec;
        const maxDims=spec&&spec.maxDims||{};
        const productDims=spec&&spec.productDims||{};
        const organizerNaturalW=organizer?(Number(productDims.w)||
          naturalOrganizerWidth(organizer.userData.type,maxDims)):0;
        const organizerW=organizer?organizerNaturalW:0;
        const organizerD=organizer?(Number(productDims.d)||Math.min(
          Number(maxDims.d_in)||Math.max(5,(sh.itemDepth||6)*1.28),Math.max(5,D*0.94))):0;
        const type=organizer&&organizer.userData.type;
        const organizerBaseH=organizer?Math.min(
          Math.max(0.8,type==='turntable'?0.8:type==='riser'?3.5:type==='divider'?2.4:type==='basket'?6.5:6),
          Number(maxDims.h_in)||Math.max(2,maxH*0.62),
          Math.max(0.8,maxH-0.8),
        ):0;
        const organizerH=organizer?(Number(productDims.h)||organizerBaseH):0;
        const requestedQty=organizer?Math.max(1,Number(spec.qty)||1):0;
        const organizerAvailable=organizer&&spec.source==='plan'?usable:cell;
        const organizerGap=1;
        const fitQty=organizer?Math.max(1,Math.floor((organizerAvailable+organizerGap)/(organizerNaturalW+organizerGap))):0;
        const visibleQty=organizer?Math.min(requestedQty,fitQty):0;
        const contentWidth=Math.max(2,organizer?Math.min(cell*0.9,
          visibleQty*organizerW+Math.max(0,visibleQty-1)*organizerGap):cell*0.86);
        const unitCount=representativeItems?visualUnitCount({
          availableWidth:contentWidth,kind,size:m.userData.size,surface:sh.kind,
          organizerType:null,
        }):1;
        const unitGap=unitCount>1?(sh.kind==='rod'?0.8:1.1):0;
        const w=Math.min(
          naturalItemWidth(kind,m.userData.size),
          (contentWidth-unitGap*(unitCount-1))/unitCount,
          KIND_MAX_W[kind]||10,
        );
        const itemH=Math.min(
          m.userData.baseH||m.scale.y,
          maxH,
          type==='divider'?Math.max(1.4,organizerH*0.78):maxH,
        );
        const itemD=Math.min(
          organizer?organizerD*0.48:(sh.itemDepth||D*0.55),
          KIND_DEPTH[kind]||6,
        );
        const offset=-usable/2+cell*(i+0.5);
        const position=pointOnSurface(sh, offset, ITEM_NORMAL_OFFSET);
        const itemLift=organizer?(type==='riser'?2.8:type==='turntable'?0.75:type==='divider'?0.28:0.45):0;
        const visuals=ensureDisplayCopies(m,unitCount);
        const visualStep=w+unitGap;
        visuals.forEach((visual,visualIndex)=>{
          const visualOffset=offset+(visualIndex-(unitCount-1)/2)*visualStep;
          const visualPosition=pointOnSurface(sh,visualOffset,ITEM_NORMAL_OFFSET);
          visual.scale.set(w,itemH,itemD);
          visual.position.set(visualPosition.x,itemYForSurface(sh,itemH)+itemLift,visualPosition.z);
          visual.rotation.y=surfaceRotationY(sh);
        });
        m.userData.visualUnitCount=unitCount;
        if(organizer){
          organizer.userData.requestedQty=requestedQty;
          organizer.userData.visibleQty=visibleQty;
          organizer.userData.fits=requestedQty<=fitQty&&organizerNaturalW<=organizerAvailable&&
            organizerD<=D&&organizerH<=maxH;
          const organizerVisuals=ensureOrganizerCopies(organizer,visibleQty);
          organizerVisuals.forEach((visual,visualIndex)=>{
            const organizerBaseOffset=spec.source==='plan'?0:offset;
            const organizerOffset=organizerBaseOffset+(visualIndex-(visibleQty-1)/2)*(organizerW+organizerGap);
            const organizerPosition=pointOnSurface(sh,organizerOffset,ITEM_NORMAL_OFFSET);
            visual.scale.set(organizerW,organizerH,organizerD);
            visual.position.set(organizerPosition.x,itemYForSurface(sh,organizerH),organizerPosition.z);
            visual.rotation.y=surfaceRotationY(sh);
          });
        }
        const lift=n>3?(i%2)*2.2:0;
        const labelPosition=pointOnSurface(sh, offset, ITEM_NORMAL_OFFSET+itemD/2+0.5);
        m.userData.label.position.set(
          labelPosition.x,
          itemYForSurface(sh,itemH)+itemLift+itemH/2+0.5+lift,
          labelPosition.z,
        );
      });
    });
  }
  reflow();
  const unplacedOrganizerQty=[...planOrganizerRemaining.entries()]
    .filter(([key])=>matchedPlanOrganizers.has(key))
    .reduce((sum,[,remaining])=>sum+Math.max(0,remaining),0);
  scene.userData.unplacedOrganizerQty=unplacedOrganizerQty;

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
    const geometries=new Set(),materials=new Set(),textures=new Set();
    scene.traverse(o=>{
      if(o.geometry) geometries.add(o.geometry);
      if(o.material){
        (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));
      }
    });
    geometries.forEach(geometry=>geometry.dispose());
    materials.forEach(material=>{
      if(material.map) textures.add(material.map);
      material.dispose();
    });
    textures.forEach(texture=>texture.dispose());
    renderer.dispose();
  }

  return { scene, renderer, camera, controls, items, organizers, shelves, surfaces, reflow, setSize, dispose,
    unplacedOrganizerQty,
    placements(){ return items.map(m=>({ itemId:m.userData.itemId, shelfIndex:m.userData.shelfIndex, slot:m.userData.slot })); } };
}
