function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }

export function evenShelfFracs(count){
  const n=clamp(Math.round(Number(count)||1),1,12);
  return Array.from({length:n},(_,i)=>0.08+0.82*(n===1?0.5:i/(n-1)));
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
    shelfYFracs:valid?source.shelfYFracs.map(Number):evenShelfFracs(shelfCount),
  };
}

/* Resample an existing set of shelf positions to a new count, keeping the
   shape the user gave them. Linear interpolation over the index preserves the
   endpoints and the relative spacing, and turns a strictly increasing input
   into a strictly increasing output for any count. */
function isEvenlySpaced(fracs){
  const even=evenShelfFracs(fracs.length);
  return fracs.every((value,index)=>Math.abs(value-even[index])<1e-9);
}

function resampleShelfFracs(fracs,count){
  const src=Array.isArray(fracs)?fracs.map(Number).filter(Number.isFinite):[];
  if(!src.length||count<1) return evenShelfFracs(count);
  if(count===src.length) return src.slice();
  if(src.length===1||count===1) return evenShelfFracs(count);
  // Nothing to preserve if the user never moved a shelf — and going through
  // the interpolation would only introduce float drift against evenShelfFracs.
  if(isEvenlySpaced(src)) return evenShelfFracs(count);
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
  const shelfYFracs=preserveSpacing
    ?resampleShelfFracs(normalizeViewerGeometry(geometry).shelfYFracs,shelfCount)
    :evenShelfFracs(shelfCount);
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

export function mapForShelfCount(map,count){
  const rows=Array.isArray(map)?map:[];
  const shelfCount=clamp(Math.round(Number(count)||rows.length||1),1,12);
  if(rows.length<=shelfCount) return rows.map(row=>({...row}));
  const buckets=Array.from({length:shelfCount},()=>[]);
  rows.forEach((row,index)=>buckets[Math.min(shelfCount-1,Math.floor(index*shelfCount/rows.length))].push(row));
  return buckets.map((bucket,shelfIndex)=>{
    const safety=bucket.find(row=>row.safety&&row.safety.flag);
    return {
      ...bucket[0],
      shelfIndex,
      lv:bucket.map(row=>row.lv).filter(Boolean).join(' + '),
      zone:bucket.map(row=>row.zone).filter(Boolean).join(' + '),
      why:bucket.map(row=>row.why).filter(Boolean).join(' '),
      eye:bucket.some(row=>row.eye),
      safety:safety?safety.safety:(bucket[0].safety||{flag:null,why:null}),
      items:bucket.flatMap(row=>row.items||[]),
    };
  });
}

export function inferLSide(layout){
  const sections=layout&&layout.sections||[];
  if(sections.some(section=>section.id==='left'||section.place==='left')) return 'left';
  return 'right';
}
