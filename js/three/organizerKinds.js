/* Pure organizer selection. Product recommendations win; the user's style
   and reusable containers fill gaps. The renderer consumes the returned
   visual type without knowing anything about wizard wording. */

const TYPE_MAP={
  'clear-bin':'clear-bin',
  'airtight-container':'clear-bin',
  basket:'basket',
  'drawer-organizer':'divider',
  turntable:'turntable',
  'can-riser':'riser',
  'shelf-riser':'riser',
  'door-rack':'door-rack',
  'hook-rack':'hook-rack',
};

function norm(value){
  return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function targetScore(target,row){
  const t=norm(target);
  if(!t) return 0;
  if(/every (shelf|zone|drawer)|whole space/.test(t)) return 1;
  const rowText=norm(`${row&&row.lv||''} ${row&&row.zone||''}`);
  if(!rowText) return 0;
  if(rowText.includes(t)||t.includes(rowText)) return 5;
  const tokens=t.split(' ').filter(word=>word.length>3);
  return tokens.reduce((score,word)=>score+(rowText.includes(word)?1:0),0);
}

function matchingNeed(productNeeds,row){
  let best=null,bestScore=0;
  for(const need of productNeeds||[]){
    if(!TYPE_MAP[need&&need.type]) continue;
    const score=targetScore(need.targetZone,row);
    if(score>bestScore){ best=need; bestScore=score; }
  }
  return best;
}

export function selectedProductNeeds(productNeeds,shopping){
  const needs=Array.isArray(productNeeds)?productNeeds:[];
  if(!Array.isArray(shopping)) return needs;
  return shopping.filter(item=>item&&item.checked).map(item=>{
    const need=needs[item.needIdx];
    if(!need) return null;
    const dims=item.dims_in;
    return {
      ...need,
      qty:Math.max(1,Number(item.qty)||Number(need.qty)||1),
      productId:item.productId||null,
      productName:item.name||null,
      productDims:dims&&Number(dims.w)>0&&Number(dims.h)>0&&Number(dims.d)>0
        ? {w:Number(dims.w),h:Number(dims.h),d:Number(dims.d)} : null,
      fit:item.fit||'unknown',
    };
  }).filter(Boolean);
}

export function organizerSpecFor({surface,row,itemKind,space,styles,prefs,productNeeds,existingText}){
  if(surface==='rod') return null;
  const need=matchingNeed(productNeeds,row);
  if(need){
    const visualType=TYPE_MAP[need.type];
    if(visualType==='door-rack'&&surface!=='door') return null;
    if(visualType==='hook-rack'&&!['door','pegboard'].includes(surface)) return null;
    if(surface==='pegboard'&&visualType!=='hook-rack') return null;
    if(surface==='door'&&!['door-rack','hook-rack'].includes(visualType)) return null;
    return {
      type:visualType,source:'plan',maxDims:need.maxDims||null,
      qty:Math.max(1,Number(need.qty)||1),label:need.purpose||'',
      productId:need.productId||null,productName:need.productName||null,
      productDims:need.productDims||null,fit:need.fit||'unknown',
      targetZone:need.targetZone||'',
      needKey:need.productId||`${need.type}:${norm(need.targetZone)}:${norm(need.purpose)}`,
    };
  }

  if(['door','pegboard'].includes(surface)) return null;

  const choices=norm([...(styles||[]),...(prefs||[])].join(' '));
  if(/basket|woven|hidden storage/.test(choices)) return {type:'basket',source:'style'};
  if(/clear container|clear acrylic/.test(choices)) return {type:'clear-bin',source:'style'};
  if(/divider|file folded|slot for everything|tray|cadd/.test(choices)) return {type:'divider',source:'style'};
  if(surface==='drawer') return {type:'divider',source:'surface'};

  const reuse=norm(existingText);
  if(/basket/.test(reuse)&&['food','linen','container','small-item'].includes(itemKind)){
    return {type:'basket',source:'reuse'};
  }
  if(space==='linen'&&['linen','container','bottle'].includes(itemKind)) return {type:'basket',source:'space'};
  if(space==='bathroom'&&itemKind!=='tool') return {type:'clear-bin',source:'space'};
  if(space==='garage'&&['container','small-item'].includes(itemKind)) return {type:'clear-bin',source:'space'};
  return null;
}

export const ORGANIZER_TYPES=['clear-bin','basket','divider','turntable','riser','door-rack','hook-rack'];
