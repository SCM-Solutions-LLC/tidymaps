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

export function geometryWithShelfCount(geometry,count){
  const shelfCount=clamp(Math.round(Number(count)||1),1,12);
  return {...geometry,shelfCount,shelfYFracs:evenShelfFracs(shelfCount),estimated:false};
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
