/* Step-media pipeline: real motion clips for the plan checklist.

   Every step is classified into an action, staged on the furniture motif of
   the user's space, holding the item glyph the step moves. That triple is the
   media key: {action}-{motif}-{glyph}, and clips live at
   media/steps/{key}.(mp4|webm|json) — declared in data/step-media.json, which
   tests/step-media.test.mjs validates at build time (unknown vocabulary,
   missing ready files, or stray pending files all fail CI).

   Runtime contract: clips lazy-load only when the step scrolls into view and
   only when the manifest marks them ready, so nothing ever 404s. Until a clip
   exists (or if it fails to load / can't be played), the inline animated SVG
   scene keeps rendering — the design-owned placeholder IS the fallback. */

/* ---------- Vocabulary ---------- */
// Actions mirror the STEP_ART scene set in results.js: the placeholder SVG
// scenes define the spec the produced clips must match.
export const ACTIONS = ['purge','unload','wipe','label','hang','fold','photo','contain','group','moveUp','moveDown','zones','done'];
export const MOTIFS = ['shelves','drawers','rail','bench'];
export const GLYPHS = ['shoe','hanger','foldedclothes','towel','jar','can','bottle','utensil','tool','tote','plate','bag'];

/* ---------- Classification (shared with the SVG fallback) ---------- */
// Moved verbatim from results.js so the media key and the fallback scene can
// never disagree about what a step is showing.
const ART_RULES=[
  [/expired|duplicate|donate|toss|purge|trash|declutter|retire/i,'purge'],
  [/empty|pull everything|dump|unload|take everything|one wall at a time|one zone at a time/i,'unload'],
  [/wipe|clean|dust/i,'wipe'],
  [/label/i,'label'],
  [/hang|rod/i,'hang'],
  [/fold/i,'fold'],
  [/photo/i,'photo'],
  [/basket|bin|caddy|tray|corral|file .*upright|containers? with|stand tools/i,'contain'],
  [/group|sort|similar|together|categor|match|split|separate/i,'group'],
  [/top shelf|up high|overhead|bulk|backup|rarely|lift/i,'moveUp'],
  [/heavy|lowest shelf|lower shelf|bottom|floor|raw meat/i,'moveDown'],
  [/zone|assign|home|section|crisper|door/i,'zones'],
];
export function classifyAction(step){
  const hay=(step.t||'')+' '+(step.w||'');
  for(const [re,type] of ART_RULES){ if(re.test(hay)) return type; }
  return 'done';
}

// The furniture the scene is staged on, from the chosen space.
const SPACE_MOTIF={
  drawers:'drawers', junk:'drawers',
  closet:'rail', walkin:'rail',
  garage:'bench',
};
export function motifForSpace(spaceId){
  return SPACE_MOTIF[spaceId]||'shelves';
}

// The item being moved in the scene: first match from the step's own text,
// then the space's typical item as the default.
const GLYPH_RULES=[
  [/shoe|sneaker|boot/i,'shoe'],
  [/hang|rod|shirt|coat|dress/i,'hanger'],
  [/fold|sweater|jean|t-shirt|clothes/i,'foldedclothes'],
  [/towel|linen|sheet/i,'towel'],
  [/jar|sauce|spice/i,'jar'],
  [/can(s|ned)? |cans$|canned/i,'can'],
  [/bottle|detergent|spray|shampoo/i,'bottle'],
  [/utensil|spatula|cutlery|silverware/i,'utensil'],
  [/tool|drill|hammer|wrench|hardware/i,'tool'],
  [/tote|storage box|overflow|bulk/i,'tote'],
  [/plate|dish|bowl/i,'plate'],
  [/bag|packet|snack|pouch/i,'bag'],
];
const SPACE_GLYPH={
  pantry:'can', cabinet:'plate', drawers:'utensil', junk:'utensil',
  closet:'hanger', walkin:'hanger', linen:'towel', bathroom:'bottle',
  fridge:'jar', garage:'tool', attic:'tote', laundry:'bottle', kids:'tote',
};
export function glyphForStep(step, spaceId){
  const hay=(step.t||'')+' '+(step.w||'');
  for(const [re,g] of GLYPH_RULES){ if(re.test(hay)) return g; }
  return SPACE_GLYPH[spaceId]||'tote';
}

export function mediaKeyFor(step, spaceId){
  return `${classifyAction(step)}-${motifForSpace(spaceId)}-${glyphForStep(step, spaceId)}`;
}

// Parse + validate a manifest key back into its triple. Returns null when any
// part is outside the vocabulary (the build guard uses this too).
export function parseMediaKey(key){
  const m=/^([a-zA-Z]+)-([a-z]+)-([a-z]+)$/.exec(String(key||''));
  if(!m) return null;
  const [,action,motif,glyph]=m;
  if(!ACTIONS.includes(action)||!MOTIFS.includes(motif)||!GLYPHS.includes(glyph)) return null;
  return {action,motif,glyph};
}

/* ---------- Manifest + lazy loader ---------- */
let manifest=null;
export async function loadStepMedia(){
  if(manifest) return manifest;
  try{
    const res=await fetch('data/step-media.json');
    if(!res.ok) return null;
    const data=await res.json();
    if(!data||typeof data.clips!=='object') return null;
    manifest=data;
    return manifest;
  }catch(_){
    return null;
  }
}

// A clip is playable when it's declared ready AND this runtime can render its
// format: mp4/webm natively, Lottie json only once a player is vendored.
export function playableClip(man, key){
  const c=man&&man.clips&&man.clips[key];
  if(!c||c.status!=='ready'||typeof c.file!=='string') return null;
  if(/\.(mp4|webm)$/i.test(c.file)) return c;
  if(/\.json$/i.test(c.file) && typeof window!=='undefined' && window.lottie) return c;
  return null;
}

/* Upgrade [data-step-media] slots to real clips as they scroll into view.
   The inline SVG stays in the DOM until the clip actually plays, and comes
   back if playback errors — the fallback is never a blank box. */
export async function hydrateStepMedia(root=document){
  const slots=[...root.querySelectorAll('[data-step-media]')];
  if(!slots.length) return;
  const man=await loadStepMedia();
  if(!man) return; // no manifest: inline SVG scenes stay in charge
  const pending=slots.filter(el=>playableClip(man, el.dataset.stepMedia));
  if(!pending.length) return;
  const attach=(el)=>{
    const clip=playableClip(man, el.dataset.stepMedia);
    if(!clip||el.querySelector('video')) return;
    const v=document.createElement('video');
    v.muted=true; v.loop=true; v.autoplay=true; v.playsInline=true;
    v.preload='none'; v.setAttribute('aria-hidden','true');
    v.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain';
    v.onerror=()=>v.remove();                    // SVG underneath takes over again
    v.oncanplay=()=>el.classList.add('has-clip'); // CSS hides the SVG only now
    v.src=clip.file;
    el.style.position='relative';
    el.appendChild(v);
  };
  if(typeof IntersectionObserver==='undefined'){ pending.forEach(attach); return; }
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ io.unobserve(e.target); attach(e.target); } });
  },{rootMargin:'120px'});
  pending.forEach(el=>io.observe(el));
}
