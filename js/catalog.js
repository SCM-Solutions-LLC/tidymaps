import { state } from './state.js';
import { withAffiliate } from './affiliates.js';
import { SETUP_ARCHETYPE, resolveLayout } from './layout.js';
import { planFromPhotos } from './planProvenance.js';

/* Dimension-aware product matching against the curated catalog
   (data/catalog.json: real SKUs with cross-referenced dimensions). Every entry
   also carries `checked` (when a person last looked at the listing),
   `available` (whether it could still be bought then) and `img` (null until a
   licensed photo exists). The matcher never offers a product marked
   unavailable; a weekly workflow reads each retailer page and asks a person to
   flip the flag when a listing goes (scripts/check-product-links.mjs). */

let catalog=null;
let loadFailed=false;
export async function loadCatalog(){
  if(catalog) return catalog;
  try{
    const res=await fetch('data/catalog.json');
    if(res && res.ok===false) throw new Error(`catalog ${res.status}`);
    catalog=await res.json();
    loadFailed=false;
  }catch(_){
    /* Say so, and leave the cache empty so the next screen tries again. A
       failed fetch used to be cached as an empty catalog, and every product
       row then read "No exact match in our catalog" for the rest of the
       session, which is a different claim from "we could not load it". */
    loadFailed=true;
    return {version:0, priceAsOf:'', products:[]};
  }
  return catalog;
}
export function catalogFailed(){ return loadFailed; }
export function catalogProducts(){ return catalog ? (catalog.products||[]) : []; }

/* The newest `checked` among the products still on offer, as a month. The
   catalog-wide `priceAsOf` is the fallback for a file that predates per-product
   checks. */
export function priceAsOf(){
  if(!catalog) return '';
  const newest=catalogProducts().filter(p=>p.available!==false).map(p=>String(p.checked||'')).filter(Boolean).sort().pop();
  return newest ? newest.slice(0,7) : (catalog.priceAsOf||'');
}

/* A check date for people: "2026-07" reads "Jul 2026" and a full date
   "Oct 3, 2026". Anything else comes back as it was. */
export function fmtChecked(s){
  const [y,m,d]=String(s||'').split('-').map(Number);
  if(!y||!m) return String(s||'');
  const month=new Date(Date.UTC(y,m-1,d||1)).toLocaleString('en-US',{month:'short',timeZone:'UTC'});
  return d?`${month} ${d}, ${y}`:`${month} ${y}`;
}

// Width lost to the carcass sides and the play inside them: two 0.75-inch
// panels and two inches, matching `usable` in js/three/layouts/*.js.
export const CARCASS_WIDTH_ALLOWANCE = 3.5;

/* Room-shaped setups (walk-ins, L-shapes) are measured as a room: the depth
   is floor, not shelf, so judging a bin against it called a 20-inch bin a fit
   and badged every product "Fits your 72" shelf depth". Their shelving is 14
   to 18 inches deep. The formula is the 3D builders' own
   (js/three/layouts/walkin-u.js, l-run.js), 14-inch floor included, because
   the fit note in the 3D view is what a pick is judged by in the end; the
   server's usableShelfDepth (planSchema.js) lacks that floor, which HANDOFF
   records for the server PR. Anything else is a unit whose measured depth is
   its shelf depth. The second argument is a setup id or an archetype. */
const ROOM_SHELF_FACTOR={'walkin-u':0.2,'l-run':0.22};
export function shelfDepthFor(dims, setupOrArchetype){
  const depth=Number(dims && dims.d_in)||0;
  if(!depth) return null;
  const factor=ROOM_SHELF_FACTOR[SETUP_ARCHETYPE[setupOrArchetype]||setupOrArchetype];
  if(!factor) return depth;
  const width=Number(dims && dims.w_in)||depth;
  const smallest=Math.min(width, depth);
  return Math.max(14, smallest*factor);
}

/* The archetype the 3D view draws, resolved the way the viewer resolves it
   (js/screens/viewer3d.js currentLayout): a layout picked in the viewer, then
   a setup the user touched, then what the photos showed, then the preselected
   setup. state.setup alone is not it. The wizard preselects a cabinet for
   every area and most people leave it, so a walk-in the photos revealed was
   still judged against the room's 72 inches here while the viewer drew
   14-inch shelves, and the card and the 3D view disagreed about the same
   bin. */
export function currentArchetype(){
  return resolveLayout({
    ai: state.ai, setup: state.setup, setupTouched: state.setupTouched,
    aiFromPhotos: planFromPhotos(), scenarioKey: state.space,
    override: state.arrangement && state.arrangement.layoutOverride,
    map: null,
  }).type;
}

// Door racks and hook racks mount on a door, wall, or pegboard — outside the
// measured carcass — so the enclosure never bounds them. Measuring a 36″
// closet must not rule out a 41″ hook rail for the wall beside it.
const MOUNTS_OUTSIDE = new Set(['door-rack', 'hook-rack']);

// Fit verdicts: 'fits' (≥0.5in clearance on every known axis), 'tight'
// (positive but <0.5in), 'no-fit', or 'unknown' when nothing is measurable.
export function fitFor(product, need){
  // The tighter of the two constraints wins on every axis: the need's own
  // maxDims (where the plan wants it to sit) AND the user's measured space.
  // maxDims used to override a smaller measured depth outright, so a 12.9″
  // tray on a 9″ shelf was badged "Fits your 9″ shelf depth".
  const md = need.maxDims || {};
  const measured = MOUNTS_OUTSIDE.has(need.type) ? {} : (state.dims || {});
  const shelfD = shelfDepthFor(measured, currentArchetype());
  const tighter = (a, b) => (a && b) ? Math.min(a, b) : (a || b || null);
  const limits={
    // The measured width is the outside of the carcass. Its sides and the
    // play a drawer box or a shelf needs come off it, the same 3.5 inches the
    // 3D builders leave, so an 18-inch drawer tower stops being told a
    // 16-inch tray fits the 14.5 inches its drawers actually have.
    w: tighter(md.w_in, measured.w_in ? measured.w_in-CARCASS_WIDTH_ALLOWANCE : null),
    h: tighter(md.h_in, measured.h_in),
    d: tighter(md.d_in, shelfD || null),
  };
  let margin=Infinity, known=false;
  for(const axis of ['w','h','d']){
    const lim=limits[axis];
    if(!lim) continue;
    known=true;
    const room=lim - product.dims_in[axis];
    if(room<0) return 'no-fit';
    /* Depth is a yes or no, the way the 3D view judges it (depth <= shelf
       depth): a basket that fills a shelf front to back is a fit, not a tight
       one. Calling it tight ranked a $5 basket behind an $18 one whose three
       copies then did not fit the zone's width in 3D, and the plan's own
       view flagged the plan's own pick. */
    if(axis!=='d') margin=Math.min(margin, room);
  }
  if(!known) return 'unknown';
  return margin>=0.5 ? 'fits' : 'tight';
}

/* Products of the need's type that can still be bought, best fit first and
   cheapest within a fit. Pure, so the test suite can hand it a catalog. */
export function rankProducts(products, need){
  const order={fits:0, tight:1, unknown:2, 'no-fit':3};
  return (products||[])
    .filter(p=>p.type===need.type && p.available!==false)
    .map(p=>({product:p, fit:fitFor(p, need)}))
    .sort((a,b)=>(order[a.fit]-order[b.fit]) || (a.product.price_usd-b.product.price_usd));
}
export function matchProducts(need){
  return catalog ? rankProducts(catalog.products, need) : [];
}

/* One shopping-list entry for a need: the best product that is not a misfit,
   or the bare type when nothing fits. `checked` is the include checkbox and
   `checkedOn` the catalog's check date; the two are different things. */
export function selectionFor(need, needIdx){
  const top=matchProducts(need).filter(m=>m.fit!=='no-fit')[0];
  return {
    needIdx, checked:true, qty:need.qty,
    type:need.type,
    productId: top?top.product.id:null,
    name: top?top.product.name:TYPE_LABEL[need.type],
    price_usd: top?top.product.price_usd:null,
    url: top?top.product.url:null,
    retailer: top?top.product.retailer:null,
    img: top?(top.product.img||null):null,
    checkedOn: top?(top.product.checked||null):null,
    fit: top?top.fit:'unknown',
    dims_in: top?{...top.product.dims_in}:null,
  };
}

/* A saved plan stores the product it picked (`spaces.shopping`), so a product
   that has since left the catalog, or been marked unavailable, used to come
   back as a live link to a dead listing with its old price in the total.
   Re-read everything about the product from the catalog, and keep only what is
   the user's: the quantity, the include checkbox, and which need it answers.

   A product that cannot be bought degrades the row to the shape selectionFor
   gives a need nothing matched (the type's label, no retailer, no price), so
   the summary list, the exported list and the 3D legend stop naming it; the
   card keeps `formerName` for its notice. Its id stays as `formerProductId`:
   "currently unavailable" is often temporary, and a product that comes back
   is restored on the next load instead of staying "no longer sold" for good. */
export function reconcileSelection(selection, need, products){
  const id=selection.productId||selection.formerProductId||null;
  const product=id?(products||[]).find(p=>p.id===id):null;
  const base={...selection, type:need.type};
  if(product && product.available!==false){
    delete base.unavailable; delete base.formerName; delete base.formerProductId;
    return {
      ...base,
      productId:product.id,
      name:product.name, price_usd:product.price_usd, url:product.url, retailer:product.retailer,
      img:product.img||null, checkedOn:product.checked||null,
      fit:fitFor(product, need), dims_in:{...product.dims_in},
    };
  }
  if(!id) return base; // never had a product: nothing to reconcile
  return {
    ...base,
    productId:null, formerProductId:id, unavailable:true,
    formerName:selection.formerName||(selection.productId?selection.name:null)||null,
    name:TYPE_LABEL[need.type]||need.type, retailer:null,
    price_usd:null, url:null, img:null, checkedOn:product?(product.checked||null):null,
    fit:'unknown', dims_in:null,
  };
}

export function fitBadge(fit, type){
  // A label set has no size to fit, and a safety latch screws to a door or
  // frame (organizerKinds.js draws neither). A rack hangs outside the measured
  // space (fitFor already says so), so its fit is the plan's own cap, not a depth.
  if(type==='label-set' || type==='safety-latch') return {cls:'', txt:''};
  const shelf=MOUNTS_OUTSIDE.has(type) ? null : shelfDepthFor(state.dims, currentArchetype());
  const depth=shelf ? Math.round(shelf) : null;
  switch(fit){
    case 'fits':   return {cls:'green', txt: depth ? `Fits your ${depth}" shelf depth` : 'Fits the space we detected'};
    // "check this" and "this will not fit" are different answers and no longer
    // share a colour — the words carry it too, so the state never rests on hue
    case 'tight':  return {cls:'warn',   txt:'Tight fit: double-check'};
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
  const caps=[need.maxDims && need.maxDims.d_in, shelfDepthFor(state.dims, currentArchetype())].filter(Boolean);
  const depth=caps.length?Math.min(...caps):null;
  if(depth) q+=` max ${Math.floor(depth)} inch deep`;
  const enc=encodeURIComponent(q);
  return [
    {retailer:'Amazon', url:withAffiliate(`https://www.amazon.com/s?k=${enc}`,'Amazon')},
    {retailer:'Target', url:withAffiliate(`https://www.target.com/s?searchTerm=${enc}`,'Target')},
    {retailer:'The Container Store', url:withAffiliate(`https://www.containerstore.com/s?q=${enc}`,'The Container Store')},
  ];
}
