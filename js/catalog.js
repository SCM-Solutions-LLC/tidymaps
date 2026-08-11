import { state } from './state.js';
import { withAffiliate } from './affiliates.js';

/* Dimension-aware product matching against the curated catalog
   (data/catalog.json — real SKUs with cross-referenced dimensions). */

let catalog=null;
export async function loadCatalog(){
  if(catalog) return catalog;
  try{
    const res=await fetch('data/catalog.json');
    catalog=await res.json();
  }catch(_){
    catalog={version:0, priceAsOf:'', products:[]};
  }
  return catalog;
}
export function priceAsOf(){ return catalog ? catalog.priceAsOf : ''; }

// Fit verdicts: 'fits' (≥0.5in clearance on every known axis), 'tight'
// (positive but <0.5in), 'no-fit', or 'unknown' when nothing is measurable.
export function fitFor(product, need){
  // The tighter of the two constraints wins on every axis: the need's own
  // maxDims (where the plan wants it to sit) AND the user's measured space.
  // maxDims used to override a smaller measured depth outright, so a 12.9″
  // tray on a 9″ shelf was badged "Fits your 9″ shelf depth".
  //
  // Door racks and hook racks mount on a door, wall, or pegboard — outside
  // the measured carcass — so the enclosure never bounds them. Measuring a
  // 36″ closet must not rule out a 41″ hook rail for the wall beside it.
  const MOUNTS_OUTSIDE = new Set(['door-rack', 'hook-rack']);
  const md = need.maxDims || {};
  const measured = MOUNTS_OUTSIDE.has(need.type) ? {} : (state.dims || {});
  const tighter = (a, b) => (a && b) ? Math.min(a, b) : (a || b || null);
  const limits={
    w: tighter(md.w_in, measured.w_in),
    h: tighter(md.h_in, measured.h_in),
    d: tighter(md.d_in, measured.d_in ? measured.d_in-0.5 : null),
  };
  let margin=Infinity, known=false;
  for(const axis of ['w','h','d']){
    const lim=limits[axis];
    if(!lim) continue;
    known=true;
    margin=Math.min(margin, lim - product.dims_in[axis]);
  }
  if(!known) return 'unknown';
  if(margin<0) return 'no-fit';
  return margin>=0.5 ? 'fits' : 'tight';
}

export function matchProducts(need){
  if(!catalog) return [];
  const order={fits:0, tight:1, unknown:2, 'no-fit':3};
  return catalog.products
    .filter(p=>p.type===need.type)
    .map(p=>({product:p, fit:fitFor(p, need)}))
    .sort((a,b)=>(order[a.fit]-order[b.fit]) || (a.product.price_usd-b.product.price_usd));
}

export function fitBadge(fit){
  const depth=state.dims && state.dims.d_in;
  switch(fit){
    case 'fits':   return {cls:'green', txt: depth ? `Fits your ${depth}" shelf depth` : 'Fits the space we detected'};
    // "check this" and "this will not fit" are different answers and no longer
    // share a colour — the words carry it too, so the state never rests on hue
    case 'tight':  return {cls:'warn',   txt:'Tight fit — double-check'};
    case 'no-fit': return {cls:'danger', txt:'Too big for this space'};
    default:       return {cls:'',      txt:'Add measurements to check fit'};
  }
}

const TYPE_QUERY={
  'clear-bin':'clear stackable pantry bin',
  'basket':'storage basket bin',
  'turntable':'lazy susan turntable organizer',
  'can-riser':'tiered can rack organizer',
  'shelf-riser':'shelf riser expandable',
  'door-rack':'over the door pantry organizer',
  'airtight-container':'airtight food storage container',
  'drawer-organizer':'drawer organizer tray',
  'hook-rack':'wall mounted hook rack',
  'label-set':'pantry label set',
  'safety-latch':'child safety cabinet latch',
};
export const TYPE_LABEL={
  'clear-bin':'Clear bin','basket':'Basket','turntable':'Turntable','can-riser':'Can riser',
  'shelf-riser':'Shelf riser','door-rack':'Door rack','airtight-container':'Airtight container',
  'drawer-organizer':'Drawer organizer','hook-rack':'Hook rack','label-set':'Label set','safety-latch':'Safety latch',
};

// Dimension-qualified search links — always available as a fallback
export function searchLinks(need){
  let q=TYPE_QUERY[need.type]||need.type;
  // Same rule as fitFor: the search cap is the tighter of the two, so the
  // query can't send someone shopping for a bin deeper than their shelf.
  const caps=[need.maxDims && need.maxDims.d_in, state.dims && state.dims.d_in].filter(Boolean);
  const depth=caps.length?Math.min(...caps):null;
  if(depth) q+=` max ${Math.floor(depth)} inch deep`;
  const enc=encodeURIComponent(q);
  return [
    {retailer:'Amazon', url:withAffiliate(`https://www.amazon.com/s?k=${enc}`,'Amazon')},
    {retailer:'Target', url:withAffiliate(`https://www.target.com/s?searchTerm=${enc}`,'Target')},
    {retailer:'The Container Store', url:withAffiliate(`https://www.containerstore.com/s?q=${enc}`,'The Container Store')},
  ];
}
