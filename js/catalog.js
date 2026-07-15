import { state } from './state.js';

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
  const limits={
    w: need.maxDims ? need.maxDims.w_in : null,
    h: need.maxDims ? need.maxDims.h_in : null,
    d: (need.maxDims && need.maxDims.d_in) || (state.dims && state.dims.d_in ? state.dims.d_in-0.5 : null),
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
    case 'tight':  return {cls:'warn',  txt:'Tight fit — double-check'};
    case 'no-fit': return {cls:'warn',  txt:'Too big for this space'};
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
  const depth=(need.maxDims && need.maxDims.d_in) || (state.dims && state.dims.d_in);
  if(depth) q+=` max ${Math.floor(depth)} inch deep`;
  const enc=encodeURIComponent(q);
  return [
    {retailer:'Amazon', url:`https://www.amazon.com/s?k=${enc}`},
    {retailer:'Target', url:`https://www.target.com/s?searchTerm=${enc}`},
    {retailer:'The Container Store', url:`https://www.containerstore.com/s?q=${enc}`},
  ];
}
