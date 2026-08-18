import { state } from './state.js';
import { iconFor } from './icons.js';
import { MAP, DEMO_GEOMETRY, DEMO_SAFETY_NOTES, DEMO_PRODUCT_NEEDS } from './data.js';
import { normalizeLayout, surfaceFromIcon, SURFACES, SETUP_ARCHETYPE } from './layout.js';
import { kidAgeYears } from './wizard-data.js';

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
/* Two helpers, because one was doing two incompatible jobs.

   `positive` is right for everything it is used on below — widths, depths,
   quantities, shelf counts — where zero is not a measurement but a missing
   one, and where `maxDims` even relies on the zero fallback being falsy.

   It was wrong for exactly one caller. `shelfIndex` is an index: 0 is the top
   shelf, the most ordinary value a plan can carry. Under `positive` an
   explicit 0 failed the `n>0` test and fell back to the row's array position,
   which is not merely a misplaced row — it can land on an index another row
   already holds, and the 3D view keys its shelves by index, so one of the two
   is dropped from the drawing entirely. It also recreates the duplicate-index
   condition the server validator rejects by name, and breaks the idempotency
   contract documented below that the share path depends on. Latent so far only
   because a plan whose rows arrive top-down has shelfIndex === i anyway. */
const positive = (v,fallback)=>{ const n=Number(v); return Number.isFinite(n)&&n>0?n:fallback; };
/* The absent values are named rather than left to Number(), which answers 0
   for null, '' and false alike. Under `positive` those all failed the `n>0`
   test and fell through to the fallback, so admitting 0 as a real index has to
   keep saying "absent" for them explicitly — otherwise a row with no
   shelfIndex at all silently claims the top shelf. */
const nonNegInt = (v,fallback)=>{
  if(v===null || v===undefined || v==='' || typeof v==='boolean') return fallback;
  const n=Number(v);
  return Number.isFinite(n) && n>=0 ? Math.round(n) : fallback;
};

function normalizeGeometry(g, mapLen){
  // the user's own shelf count wins over the AI estimate (map rows are clamped
  // to shelfCount downstream, so the two always stay consistent)
  const userShelves = state.dims && state.dims.shelves;
  const shelfCount = Math.max(1, Math.min(12, Math.round(positive(userShelves, positive(g&&g.shelfCount, mapLen||5)))));
  let fracs = Array.isArray(g&&g.shelfYFracs) ? g.shelfYFracs.map(Number).filter(n=>Number.isFinite(n)&&n>=0&&n<=1) : [];
  if(fracs.length!==shelfCount){
    fracs = Array.from({length:shelfCount},(_,i)=>0.08+0.82*(shelfCount===1?0:i/(shelfCount-1)));
  }
  const geo = {
    unit:'in',
    width: positive(g&&g.width, 30),
    height: positive(g&&g.height, 60),
    depth: positive(g&&g.depth, 14),
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

/* normalizeAi must be IDEMPOTENT. Saved rows and share payloads store the
   already-normalized plan (db.js writes state.ai), and the share-link path
   runs it through here again — reading only the raw names blanked every step
   title, zone level and category for every visitor on a shared plan. Each
   field below accepts the raw name first, then its normalized twin. */
const pick = (raw, norm) => (raw !== undefined && raw !== null ? raw : norm);

// Convert raw AI JSON into the exact shapes the UI render code expects
export function normalizeAi(j){
  const rawMap = Array.isArray(j.map)?j.map:[];
  const geometry = normalizeGeometry(j.geometry, rawMap.length);
  return {
    spaceType: s(j.spaceType)||'Space',
    summary: s(j.summary),
    cats: (pick(j.categories, j.cats)||[]).map(s).filter(Boolean),
    features: (j.features||[]).map(f=>({ico:iconFor(pick(f.icon, f.ico)), ttl:s(pick(f.title, f.ttl)), sub:s(f.sub)})),
    problems: (j.problems||[]).map(s).filter(Boolean),
    opportunities: (j.opportunities||[]).map(s).filter(Boolean),
    map: rawMap.map((m,i)=>({
      lv:s(pick(m.level, m.lv)), ic:iconFor(pick(m.icon, m.ic)), zone:s(m.zone), why:s(m.why), eye:!!m.eye,
      shelfIndex: Math.max(0, Math.min(geometry.shelfCount-1, nonNegInt(m.shelfIndex, i))),
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
        qty: Math.max(1, Math.min(12, Math.round(positive(p.qty,1)))),
        purpose: s(p.purpose),
        targetZone: s(p.targetZone),
        maxDims: (p.maxDims && positive(p.maxDims.w_in,0) && positive(p.maxDims.h_in,0) && positive(p.maxDims.d_in,0))
          ? {w_in:positive(p.maxDims.w_in,0), h_in:positive(p.maxDims.h_in,0), d_in:positive(p.maxDims.d_in,0)} : null,
        priority: p.priority==='high'?'high':'nice',
        /* Survives normalizeAi so a saved or reloaded plan still knows which
           products the user asked for. Dropping it here is how `observed` and
           `cite` were lost before — this whitelist is the whole contract. */
        ...(p.addedByUser ? { addedByUser:true } : {}),
      })),
    /* Did anything actually look at this space? Demo scenarios set this false;
       a model plan comes from real photos, so absent means observed. The report
       uses it to scope prose that would otherwise read as findings. */
    observed: j.observed !== false,
    existingLede: s(j.existingLede),
    existing: (j.existing||[]).map(e=>({ico:iconFor(pick(e.icon, e.ico)), ft:s(pick(e.title, e.ft)), fd:s(pick(e.detail, e.fd))})),
    dontBuy: s(j.dontBuy),
    /* `cite` is the user's own answer, carried on the step's face rather than
       inside the collapsed "Why?" panel. It has to survive this whitelist or
       the report never sees it — the same way `observed` was dropped here and
       the honesty scoping vanished with it. */
    steps: (j.steps||[]).map(st=>({
      t:s(pick(st.task, st.t)), m:s(pick(st.time, st.m))||'—', w:s(pick(st.why, st.w)),
      ...(st.cite ? { cite:s(st.cite) } : {}),
    })),
    time: s(j.time)||'45–90 min',
    cost: s(j.cost)||'$0 / $45–85'
  };
}

/* The model id, as a person would write it.

   The byline built this with `.replace('claude-','').replace(/-/g,' ')`, which
   turned claude-sonnet-4-6 into "sonnet 4 6" — lowercase, and a version number
   with its decimal point spread into a space. Hyphens do two different jobs in
   these ids: they separate words, and they stand in for the dot in a version.
   Replacing both with the same character loses that.

   Deliberately tolerant of ids it has never seen. This is a byline, not a
   contract: an unrecognised shape should read a little plainly rather than
   render nothing or throw. A trailing build date is dropped because it is not
   something a reader needs. */
export function modelLabel(id){
  const raw = String(id || '').trim();
  if (!raw) return '';
  const parts = raw.replace(/^claude-/, '').split('-')
    // a dated build (20251001) or a moving alias is noise in a byline
    .filter(p => p && !/^\d{6,}$/.test(p) && p !== 'latest');
  if (!parts.length) return '';
  const out = [];
  for (const p of parts) {
    const isNum = /^\d+$/.test(p);
    // consecutive numbers are one version: 4, 6 -> 4.6
    if (isNum && out.length && /^[\d.]+$/.test(out[out.length - 1])) {
      out[out.length - 1] += '.' + p;
    } else {
      out.push(isNum ? p : p.charAt(0).toUpperCase() + p.slice(1));
    }
  }
  return out.join(' ');
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
  // An EMPTY list is an answer, not missing data: "Use what I have" (the
  // wizard default) deliberately zeroes productNeeds. Falling back on empty
  // used to hand every $0 plan — pantry or workbench alike — the demo
  // pantry's $153 shopping list. Only a missing plan gets the demo needs.
  return state.ai ? (state.ai.productNeeds || []) : DEMO_PRODUCT_NEEDS;
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
    /* Counts are forwarded, not just presence. The wizard asks how many adults,
       kids and pets live here — steppers that go to twelve — and none of it
       reached the model: only the yes/no. A household of one and a household of
       six got the same plan, while the header chip dutifully echoed "6 adults"
       back, which is how an answer looks alive while being discarded. */
    adults:Math.max(0, Number(h.adults)||0),
    /* `ageYears` alongside `ages`: the prompt's hard safety rules are written in
       numbers ("kids ages 0-9", "your 3-year-old") and the wizard collects four
       words, so the model was being asked to guess what a "Big kid" is before it
       could apply a rule that decides where the bleach goes. */
    kids:{present:h.kids.present==='yes', count:Math.max(0, Number(h.kidCount)||0),
      ages:h.kids.ages.slice(), ageYears:kidAgeYears(h.kids.ages)},
    pets:{present:h.pets.present==='yes', count:Math.max(0, Number(h.petCount)||0), types:h.pets.types.slice()},
    mobility:h.mobility.slice(),
    notes,
  } : null;
  return {
    spaceType: state.space || 'pantry',
    room: state.room || null,
    /* archetype and touched travel with the setup: the archetype is the shape
       the app will draw, and `touched` says whether the user picked the card or
       merely left the preselected one, which is the difference between an
       answer and a default. The edge function pins layout.type to the archetype
       only when the choice was real. */
    setup: state.setup ? {
      id: state.setup,
      label: state.setupLabel || state.setup,
      archetype: SETUP_ARCHETYPE[state.setup] || null,
      touched: !!state.setupTouched,
    } : null,
    /* The user's own first answer, not the engine id it was bridged to. The id
       is a five-way bucket built for the deterministic scenarios; sending it
       here rendered as "Their main goal: unsure" for most of the wizard's
       options, which is a claim about the user, and a wrong one. */
    goal: (state.goals && state.goals[0]) || state.goal || null,
    goals: (state.goals||[]).slice(),      // the user's own words — cite verbatim
    styles: (state.styles||[]).slice(),
    /* `touched` travels with the shopping answer for the same reason it does
       with the setup: the value alone cannot tell the model whether the user
       chose it or merely left the card we preselected, and the backend turns
       "Use what I have" into a hard rule that empties the shopping list. */
    shopping: state.shoppingPref || null,
    shoppingTouched: !!state.shoppingTouched,
    detected: (state.detected||[]).slice(),
    categories: (state.cats||[]).slice(),  // authoritative when the user edited them
    prefs: [...(state.prefs||[])],
    budget: state.budget || null,
    effort: state.effort || null,
    toggles,
    dims: state.dims,
    /* Display preference, not a measurement — state.dims stays in inches for
       the plan and 3D contract. It travels here only so the offline engine's
       generated sentences quote the same system the person who generated them
       is reading, rather than inches regardless. */
    metric: state.units === 'metric',
    household,
  };
}
