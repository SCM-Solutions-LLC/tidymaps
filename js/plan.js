import { state } from './state.js';
import { iconFor } from './icons.js';
import { MAP, DEMO_GEOMETRY, DEMO_SAFETY_NOTES, DEMO_PRODUCT_NEEDS } from './data.js';
import { normalizeLayout, surfaceFromIcon, SURFACES } from './layout.js';

/* ============================================================
   Plan contract v2: raw model JSON -> the exact shapes the UI renders.
   The edge function returns the model's JSON untouched; all validation,
   vocabulary enforcement, and defaulting happens here.
   ============================================================ */

export const PRODUCT_TYPES = ['clear-bin','basket','turntable','can-riser','shelf-riser','door-rack','airtight-container','drawer-organizer','hook-rack','label-set','safety-latch'];
const PRODUCT_TYPE_SET = new Set(PRODUCT_TYPES);
const SAFETY_FLAGS = new Set(['kid-safe','keep-high','lock-or-latch']);
const ITEM_FLAGS = new Set(['heavy','chemical','sharp','fragile','kid-frequent']);
const ITEM_SIZES = new Set(['s','m','l']);

const s = v => (v==null?'':String(v));
const num = (v,fallback)=>{ const n=Number(v); return Number.isFinite(n)&&n>0?n:fallback; };

function normalizeGeometry(g, mapLen){
  // the user's own shelf count wins over the AI estimate (map rows are clamped
  // to shelfCount downstream, so the two always stay consistent)
  const userShelves = state.dims && state.dims.shelves;
  const shelfCount = Math.max(1, Math.min(12, Math.round(num(userShelves, num(g&&g.shelfCount, mapLen||5)))));
  let fracs = Array.isArray(g&&g.shelfYFracs) ? g.shelfYFracs.map(Number).filter(n=>Number.isFinite(n)&&n>=0&&n<=1) : [];
  if(fracs.length!==shelfCount){
    fracs = Array.from({length:shelfCount},(_,i)=>0.08+0.82*(shelfCount===1?0:i/(shelfCount-1)));
  }
  const geo = {
    unit:'in',
    width: num(g&&g.width, 30),
    height: num(g&&g.height, 60),
    depth: num(g&&g.depth, 14),
    shelfCount,
    shelfYFracs: fracs,
    estimated: g ? g.estimated!==false : true,
  };
  // user-measured dimensions always win
  if(state.dims){
    if(state.dims.w_in) geo.width=state.dims.w_in;
    if(state.dims.h_in) geo.height=state.dims.h_in;
    if(state.dims.d_in) geo.depth=state.dims.d_in;
    geo.estimated=false;
  }
  return geo;
}

function normalizeItems(arr){
  return (Array.isArray(arr)?arr:[]).slice(0,10).map(it=>({
    name: s(it&&it.name)||'Items',
    size: ITEM_SIZES.has(it&&it.size)?it.size:'m',
    flags: (Array.isArray(it&&it.flags)?it.flags:[]).filter(f=>ITEM_FLAGS.has(f)),
  }));
}

// Derive surface kind from raw icon keyword (must happen before iconFor converts to SVG)
function deriveSurface(raw, iconKeyword) {
  if (raw && SURFACES.includes(raw)) return raw;
  return surfaceFromIcon(iconKeyword) || null;
}

// Convert raw AI JSON into the exact shapes the UI render code expects
export function normalizeAi(j){
  const rawMap = Array.isArray(j.map)?j.map:[];
  const geometry = normalizeGeometry(j.geometry, rawMap.length);
  return {
    spaceType: s(j.spaceType)||'Space',
    summary: s(j.summary),
    cats: (j.categories||[]).map(s).filter(Boolean),
    features: (j.features||[]).map(f=>({ico:iconFor(f.icon), ttl:s(f.title), sub:s(f.sub)})),
    problems: (j.problems||[]).map(s).filter(Boolean),
    opportunities: (j.opportunities||[]).map(s).filter(Boolean),
    map: rawMap.map((m,i)=>({
      lv:s(m.level), ic:iconFor(m.icon), zone:s(m.zone), why:s(m.why), eye:!!m.eye,
      shelfIndex: Math.max(0, Math.min(geometry.shelfCount-1, Math.round(num(m.shelfIndex, i)))),
      safety: {
        flag: (m.safety && SAFETY_FLAGS.has(m.safety.flag)) ? m.safety.flag : null,
        why: s(m.safety && m.safety.why) || null,
      },
      items: normalizeItems(m.items),
      surface: deriveSurface(m.surface, m.icon),
    })),
    geometry,
    layout: normalizeLayout(j.layout, geometry.shelfCount),
    safetyNotes: (j.safetyNotes||[]).map(s).filter(Boolean).slice(0,6),
    productNeeds: (Array.isArray(j.productNeeds)?j.productNeeds:[])
      .filter(p=>p && PRODUCT_TYPE_SET.has(p.type))
      .slice(0,10)
      .map(p=>({
        type:p.type,
        qty: Math.max(1, Math.min(12, Math.round(num(p.qty,1)))),
        purpose: s(p.purpose),
        targetZone: s(p.targetZone),
        maxDims: (p.maxDims && num(p.maxDims.w_in,0) && num(p.maxDims.h_in,0) && num(p.maxDims.d_in,0))
          ? {w_in:num(p.maxDims.w_in,0), h_in:num(p.maxDims.h_in,0), d_in:num(p.maxDims.d_in,0)} : null,
        priority: p.priority==='high'?'high':'nice',
      })),
    existingLede: s(j.existingLede),
    existing: (j.existing||[]).map(e=>({ico:iconFor(e.icon), ft:s(e.title), fd:s(e.detail)})),
    dontBuy: s(j.dontBuy),
    steps: (j.steps||[]).map(st=>({t:s(st.task), m:s(st.time)||'—', w:s(st.why)})),
    time: s(j.time)||'45–90 min',
    cost: s(j.cost)||'$0 / $45–85'
  };
}

/* ---------- Active-plan getters: AI result or demo fallback ---------- */
export function activeMapV2(){ return (state.ai && state.ai.map && state.ai.map.length) ? state.ai.map : MAP; }
export function activeGeometry(){
  if(state.ai && state.ai.geometry) return state.ai.geometry;
  return normalizeGeometry(DEMO_GEOMETRY, MAP.length);
}
export function activeSafetyNotes(){
  if(state.ai) return state.ai.safetyNotes || [];
  // demo shows safety notes only when the household says kids are present
  return state.household.kids.present==='yes' ? DEMO_SAFETY_NOTES : [];
}
export function activeProductNeeds(){
  return (state.ai && state.ai.productNeeds && state.ai.productNeeds.length)
    ? state.ai.productNeeds : DEMO_PRODUCT_NEEDS;
}

// The edit brief for the photorealistic "after" render. The transformation
// must be dramatic and cover the WHOLE frame — an after photo that changed
// two items reads as a bug, not a plan.
export function buildGeminiBrief(){
  const lines=activeMapV2().map(m=>{
    const safety=(m.safety&&m.safety.why)?` (${m.safety.why})`:'';
    return `- ${m.lv}: ${m.zone}${safety}`;
  });
  return 'TASK: dramatically reorganize everything in this photo. The output must look like a completely different, professionally organized version of this exact space. If your result would look nearly identical to the input photo, you have failed the task; the transformation must be unmistakable at a glance.\n\n'
    + 'Physically rearrange the items: pick up every visible object and place it in its mapped zone below. Stand containers upright in straight front-facing rows, group like items together, stack neatly, clear ALL loose clutter off the floor and surfaces, and leave visible empty breathing room on every shelf. Straighten anything tilted. Brighten the scene slightly so the result reads clean and well lit.\n\n'
    + 'Zone plan (place items accordingly):\n'
    + lines.join('\n')
    + '\n\nReuse the photo\'s own items: the SAME products, packaging, and colors that appear in the original, just relocated and tidied. Do not invent new products, people, or text overlays.\n'
    + 'Keep unchanged: the room itself, camera angle, walls, floor, and shelf architecture. Everything ON the shelves and floor must visibly move.';
}

// Assemble the context object the analyze-space edge function expects
export function buildAnalysisContext(){
  const toggles={};
  Object.keys(state).forEach(k=>{ if(k.startsWith('detail_')) toggles[k.slice(7)]=state[k]; });
  const h=state.household;
  const notes=(h.notes||'').trim();
  const household = (h.kids.present!==null || h.pets.present!==null || h.mobility.length || notes) ? {
    kids:{present:h.kids.present==='yes', ages:h.kids.ages.slice()},
    pets:{present:h.pets.present==='yes', types:h.pets.types.slice()},
    mobility:h.mobility.slice(),
    notes,
  } : null;
  return {
    spaceType: state.space || 'pantry',
    room: state.room || null,
    setup: state.setup ? { id: state.setup, label: state.setupLabel || state.setup } : null,
    goal: state.goal || null,
    goals: (state.goals||[]).slice(),      // the user's own words — cite verbatim
    styles: (state.styles||[]).slice(),
    shopping: state.shoppingPref || null,
    detected: (state.detected||[]).slice(),
    categories: (state.cats||[]).slice(),  // authoritative when the user edited them
    prefs: [...(state.prefs||[])],
    budget: state.budget || null,
    effort: state.effort || null,
    toggles,
    dims: state.dims,
    household,
  };
}
