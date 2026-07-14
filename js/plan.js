import { state } from './state.js';
import { iconFor } from './icons.js';
import { MAP, DEMO_GEOMETRY, DEMO_SAFETY_NOTES, DEMO_PRODUCT_NEEDS } from './data.js';

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
  const shelfCount = Math.max(1, Math.min(12, Math.round(num(g&&g.shelfCount, mapLen||5))));
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
    })),
    geometry,
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

// Assemble the context object the analyze-space edge function expects
export function buildAnalysisContext(){
  const toggles={};
  Object.keys(state).forEach(k=>{ if(k.startsWith('detail_')) toggles[k.slice(7)]=state[k]; });
  const h=state.household;
  const household = (h.kids.present!==null || h.pets.present!==null || h.mobility.length || h.notes.trim()) ? {
    kids:{present:h.kids.present==='yes', ages:h.kids.ages.slice()},
    pets:{present:h.pets.present==='yes', types:h.pets.types.slice()},
    mobility:h.mobility.slice(),
    notes:h.notes.trim(),
  } : null;
  return {
    spaceType: state.space || 'pantry',
    goal: state.goal || null,
    prefs: [...(state.prefs||[])],
    budget: state.budget || null,
    effort: state.effort || null,
    toggles,
    dims: state.dims,
    household,
  };
}
