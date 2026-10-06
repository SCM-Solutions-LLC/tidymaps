function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }

/* Where n boards go when nothing better is known. A fraction is measured
   from the top, the bottom board sits on the floor (scene.js snaps anything
   past 0.86 there), and the compartments between are equal.

   The old spacing ran from 0.08 to 0.90, which put the top board eight
   percent of the height below the top and made the top compartment a
   sliver: three inches in a 30-inch wall cabinet, seven in an 8-foot
   walk-in, with the other compartments sharing the rest. Every projected
   plan's "Top shelf" or "Top drawer" was that sliver, and a wide sideboard
   drawn as two drawers got a 3-inch top drawer over a 31-inch one. Scenario
   authors who set their own fractions still get exactly those. */
export function evenShelfFracs(count){
  const n=clamp(Math.round(Number(count)||1),1,12);
  if(n===1) return [0.5];
  return Array.from({length:n},(_,i)=>0.92*(i+1)/n);
}

/* Where a room's boards go. A unit's lowest level is its base, so the even
   spread ends on the floor. A room's floor is already drawn, as the slab a
   floor row sits on, and its lowest board is a shelf above it: a walk-in's
   "lower shelf" row sat on the slab under the even spread, beside the floor
   row, and an L's corner shelf ran through it. So n boards share the wall
   with n+1 equal compartments, the lowest one above the floor snap (0.86;
   twelve boards end at 0.849). Used wherever a geometry says
   `levelsAre: 'boards'`. */
export function roomShelfFracs(count){
  const n=clamp(Math.round(Number(count)||1),1,12);
  return Array.from({length:n},(_,i)=>0.92*(i+1)/(n+1));
}

function defaultShelfFracs(count,boards){
  return boards?roomShelfFracs(count):evenShelfFracs(count);
}

function meansBoards(geometry){
  return !!(geometry&&geometry.levelsAre==='boards');
}

export function normalizeViewerGeometry(geometry,layoutType){
  const source=geometry||{};
  const shelfCount=clamp(Math.round(Number(source.shelfCount)||5),1,12);
  const valid=Array.isArray(source.shelfYFracs)&&source.shelfYFracs.length===shelfCount&&
    source.shelfYFracs.every((value,index,all)=>Number.isFinite(Number(value))&&Number(value)>=0&&
      Number(value)<=1&&(index===0||Number(value)>Number(all[index-1])));
  const rawHeight=Math.max(10,Number(source.height)||60);
  return {
    ...source,
    width:Math.max(8,Number(source.width)||30),
    height:layoutType==='under-sink'?clamp(rawHeight,28,42):rawHeight,
    depth:Math.max(4,Number(source.depth)||14),
    shelfCount,
    shelfYFracs:valid?source.shelfYFracs.map(Number):defaultShelfFracs(shelfCount,meansBoards(source)),
  };
}

/* Resample an existing set of shelf positions to a new count, keeping the
   shape the user gave them. Linear interpolation over the index preserves the
   endpoints and the relative spacing, and turns a strictly increasing input
   into a strictly increasing output for any count. */
function isDefaultSpread(fracs,boards){
  const spread=defaultShelfFracs(fracs.length,boards);
  return fracs.every((value,index)=>Math.abs(value-spread[index])<1e-9);
}

function resampleShelfFracs(fracs,count,boards){
  const src=Array.isArray(fracs)?fracs.map(Number).filter(Number.isFinite):[];
  if(!src.length||count<1) return defaultShelfFracs(count,boards);
  if(count===src.length) return src.slice();
  if(src.length===1||count===1) return defaultShelfFracs(count,boards);
  // Nothing to preserve if the user never moved a shelf — and going through
  // the interpolation would only introduce float drift against the default spread.
  if(isDefaultSpread(src,boards)) return defaultShelfFracs(count,boards);
  return Array.from({length:count},(_,i)=>{
    const t=i*(src.length-1)/(count-1);
    const lo=Math.floor(t), hi=Math.min(src.length-1,lo+1);
    return src[lo]+(src[hi]-src[lo])*(t-lo);
  });
}

/* Nudging the shelf-count slider by one used to replace every shelf position
   with even spacing, silently throwing away whatever heights the user had just
   dragged out by hand. The count is now applied on top of their spacing;
   "Space evenly" is the button that deliberately resets it. */
export function geometryWithShelfCount(geometry,count,{ preserveSpacing=true }={}){
  const shelfCount=clamp(Math.round(Number(count)||1),1,12);
  const boards=meansBoards(geometry);
  const shelfYFracs=preserveSpacing
    ?resampleShelfFracs(normalizeViewerGeometry(geometry).shelfYFracs,shelfCount,boards)
    :defaultShelfFracs(shelfCount,boards);
  return {...geometry,shelfCount,shelfYFracs,estimated:false};
}

export function shelfHeightInches(geometry,index){
  const g=normalizeViewerGeometry(geometry);
  return Math.round(g.height*(1-g.shelfYFracs[index]));
}

export function geometryWithShelfHeight(geometry,index,height){
  const g=normalizeViewerGeometry(geometry);
  const heights=g.shelfYFracs.map(frac=>g.height*(1-frac));
  const max=index===0?g.height-3:heights[index-1]-3;
  const min=index===heights.length-1?3:heights[index+1]+3;
  heights[index]=clamp(Number(height)||heights[index],min,max);
  return {...g,shelfYFracs:heights.map(value=>1-value/g.height),estimated:false};
}

/* Fold the plan's rows down to the number of shelves the viewer draws.
   Every row that comes out carries srcRows, the shelfIndex values of the
   plan rows it was made from, because the merged rows are renumbered and
   the plan's own links (steps[].rows, spotted[].row) still index the
   unmerged map. Without it a consumer that followed a step to "row 3" of a
   three-shelf viewer was shown whatever plan row happened to fold there.

   A merged row used to inherit its first row's wall and tier, so a left-wall
   row folded with a back-wall row came out as the left wall's top shelf. The
   wall is kept only when every row in the bucket agrees on it, and the tier
   only alongside the wall, as the highest row's, since a row made from two
   shelves sits where its top one sat. An unmerged map is returned as it
   came, srcRows aside. */
export function mapForShelfCount(map,count){
  const rows=Array.isArray(map)?map:[];
  const shelfCount=clamp(Math.round(Number(count)||rows.length||1),1,12);
  const srcIndex=(row,index)=>Number.isInteger(row.shelfIndex)?row.shelfIndex:index;
  if(rows.length<=shelfCount) return rows.map((row,index)=>({...row,srcRows:[srcIndex(row,index)]}));
  const buckets=Array.from({length:shelfCount},()=>[]);
  rows.forEach((row,index)=>buckets[Math.min(shelfCount-1,Math.floor(index*shelfCount/rows.length))].push(index));
  return buckets.map((members,shelfIndex)=>{
    const bucket=members.map(index=>rows[index]);
    const safety=bucket.find(row=>row.safety&&row.safety.flag);
    const first={...bucket[0]};
    delete first.wall;
    delete first.tier;
    const wall=bucket.every(row=>row.wall===bucket[0].wall)?bucket[0].wall:null;
    const tiers=bucket.map(row=>row.tier).filter(Number.isInteger);
    return {
      ...first,
      ...(wall?{wall}:{}),
      ...(wall&&tiers.length?{tier:Math.min(...tiers)}:{}),
      shelfIndex,
      srcRows:members.map(index=>srcIndex(rows[index],index)),
      lv:bucket.map(row=>row.lv).filter(Boolean).join(' + '),
      zone:bucket.map(row=>row.zone).filter(Boolean).join(' + '),
      why:bucket.map(row=>row.why).filter(Boolean).join(' '),
      eye:bucket.some(row=>row.eye),
      safety:safety?safety.safety:(bucket[0].safety||{flag:null,why:null}),
      items:bucket.flatMap(row=>row.items||[]),
    };
  });
}

/* A room's geometry, read as boards per wall. A walk-in's plan arrives with
   shelfCount equal to its row count, which for a unit is the number of
   boards and for a room is the number of rows spread over three walls. The
   drawing needs the boards, so the screen asks roomBoards for N and stamps
   the geometry with it here: N boards at a room's spacing (roomShelfFracs,
   none of them on the floor), and `levelsAre: 'boards'` so a later open (or
   a saved arrangement) knows the count has been converted and does not
   convert it twice. `estimated` is kept as it was: the count changing says
   nothing about whether the sizes were measured. */
export function roomGeometryFor(geometry,N){
  const source=geometry||{};
  const shelfCount=clamp(Math.round(Number(N))||1,1,12);
  return {...source,shelfCount,shelfYFracs:roomShelfFracs(shelfCount),levelsAre:'boards',estimated:source.estimated};
}

export function inferLSide(layout){
  const sections=layout&&layout.sections||[];
  if(sections.some(section=>section.id==='left'||section.place==='left')) return 'left';
  return 'right';
}
