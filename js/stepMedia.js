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
/* `stock` was the gap. A real pantry plan spends most of its steps putting
   things back — "Load back wall shelves first", "Set up can risers and stock
   canned goods" — and the vocabulary had no word for it, so those steps fell
   through every rule to `done`. One live plan of twelve steps used `done` five
   times, which is what "the animations are all the same" looks like from the
   outside. */
export const ACTIONS = ['purge','unload','wipe','label','hang','fold','photo','contain','group','moveUp','moveDown','zones','stock','done'];
/* A fridge, a kitchen cabinet and a vanity were all drawn as an open
   bookcase: a crisper step showed a jar on a shelf. Each now has its own
   furniture, and the fridge its own items. */
export const MOTIFS = ['shelves','drawers','rail','bench','fridge','cabinet','undersink'];
export const GLYPHS = ['shoe','hanger','foldedclothes','towel','jar','can','bottle','utensil','tool','tote','plate','bag','produce','carton','leftovers','meat'];

/* ---------- Classification (shared with the SVG fallback) ---------- */
// Moved verbatim from results.js so the media key and the fallback scene can
// never disagree about what a step is showing.
/* Order is load-bearing: first match wins, so the more specific rule goes
   above the more general one it would otherwise be swallowed by. */
/* Every word is anchored at its start (\b). Unanchored, the rules matched
   inside other words: "p-rod-uce" was a closet rod, so a fridge's "Move
   produce into the crisper drawers" drew dresses on hangers; "c-hang-e" hung
   things, "ca-bin-et" was a bin, "fold-er" folded clothes. */
const ART_RULES=[
  // "expiration dates" is how a plan actually phrases this; /expired/ alone
  // missed it and sent the step to `done`.
  [/\bexpir(?:ed|ation|y)|\bduplicates?\b|\bdonat|\btoss|\bpurge|\btrash|\bdeclutter|\bretire/i,'purge'],
  [/\bempty|\bpull everything|\bdump|\bunload|\btake everything|\bone wall at a time|\bone zone at a time/i,'unload'],
  // "cleaning supplies" is a category, not a wipe-down.
  [/\bwipe|\bclean(?:\b|ing\b(?!\s+(?:supplies|products|sprays?|gear)))|\bdust\b/i,'wipe'],
  [/\blabel/i,'label'],
  [/\bhang(?:s|ing)?\b|\brods?\b/i,'hang'],
  [/\bfold(?:s|ed|ing)?\b/i,'fold'],
  [/\bphoto/i,'photo'],
  /* Above moveDown: "on the floor" is where bulk items GO, and /bulk/ used to
     win first, so "Arrange appliances and bulk items on floor" animated things
     travelling upward while the step said put them down. A clip that
     contradicts its own instruction is worse than a repeated one. */
  /* A bare \bfloor\b is safe here only because this rule now sits ABOVE
     moveUp: any step naming the floor is about floor level, whatever else it
     mentions. Matching "on the floor" alone missed "to the floor". */
  [/\bheavy|\blowest shelf|\blower shelf|\bbottom\b|\bfloor\b|\braw meat/i,'moveDown'],
  [/\btop shelf|\bup high|\boverhead|\bbulk\b|\bbackups?\b|\brarely|\blift/i,'moveUp'],
  /* A turntable, riser or airtight container is a thing you add to hold other
     things. `containers? with` only matched one phrasing, so "Transfer dry
     goods into airtight containers" was not recognised as containing. */
  [/\bbaskets?\b|\bbins?\b|\bcadd(?:y|ies)\b|\btrays?\b|\bcorral|\bturntables?\b|\brisers?\b|\blazy susan|\bairtight|\bfile .*upright|\bcontainers?\b|\bstand tools/i,'contain'],
  /* Above `group`: "Assign each category to its wall zone" is a zoning step
     that happens to contain the word "category", and `group` was reading that
     word first. */
  [/\bzones?\b|\bassign|\bhomes?\b|\bsections?\b|\bcrispers?\b|\bdoor (?:racks?|shel(?:f|ves)|bins?)\b|\b(?:to|into|on) the doors?\b/i,'zones'],
  [/\bgroup|\bsort|\bsimilar|\btogether|\bcategor|\bmatch|\bsplit|\bseparat/i,'group'],
  // Last before the fallback: the generic "put it away" verbs, so anything
  // more specific above has already claimed its steps.
  [/\bload|\bstock|\bshelve\b|\bput (?:it |them )?away|\brestock|\bfill the/i,'stock'],
];

/* Clothes are only ever drawn where clothes are kept. The hang scene always
   draws a dress on a hanger and the fold scene a stack of shirts, whatever
   the item, so "Hang hand tools on the pegboard" put dresses on a workbench.
   Elsewhere those steps are about putting things in their place. Folding
   stays in the linen closet: a folded towel stack is what the scene draws. */
const HANG_SPACES=new Set(['closet','walkin','dresser','kids','laundry']);
const FOLD_SPACES=new Set([...HANG_SPACES,'linen']);
export function allowedAction(type, spaceId){
  if(type==='hang' && spaceId && !HANG_SPACES.has(spaceId)) return 'stock';
  if(type==='fold' && spaceId && !FOLD_SPACES.has(spaceId)) return 'stock';
  return type;
}

/* The title says what the step does; the why only explains it. Reading both
   at once let a reason decide the picture: "Empty the vanity" became a purge
   because its why mentioned expired products. The why is a tiebreak now,
   used only when the title names nothing. */
function firstMatch(rules, step, skip){
  for(const text of [step.t||'', step.w||'']){
    for(const [re,value] of rules){
      if(skip && skip(value)) continue;
      if(re.test(text)) return value;
    }
  }
  return null;
}
export function classifyAction(step, spaceId){
  const type=firstMatch(ART_RULES, step);
  return type ? allowedAction(type, spaceId) : 'done';
}

// The furniture the scene is staged on, from the chosen space. Garage
// shelving is a rack of shelves; the bench is the workbench's.
const SPACE_MOTIF={
  drawers:'drawers', junk:'drawers', dresser:'drawers',
  closet:'rail', walkin:'rail',
  workbench:'bench',
  fridge:'fridge', cabinet:'cabinet', bathroom:'undersink',
};
export function motifForSpace(spaceId){
  return SPACE_MOTIF[spaceId]||'shelves';
}

// The item being moved in the scene: first match from the step's own text,
// then the space's typical item as the default.
const GLYPH_RULES=[
  [/\bshoes?\b|\bsneakers?\b|\bboots?\b/i,'shoe'],
  [/\bhang|\brods?\b|\bshirts?\b|\bcoats?\b|\bdress(?:es)?\b/i,'hanger'],
  [/\bfold|\bsweaters?\b|\bjeans?\b|\bt-shirts?\b|\bclothes\b/i,'foldedclothes'],
  // A baking sheet is not linen.
  [/\btowels?\b|\blinens?\b|(?<!baking )\bsheets?\b/i,'towel'],
  [/\bjars?\b|\bsauces?\b|\bspices?\b|\bcondiments?\b/i,'jar'],
  [/\bcans\b|\bcanned\b/i,'can'],
  [/\bbottles?\b|\bdetergents?\b|\bsprays?\b|\bshampoos?\b/i,'bottle'],
  [/\butensils?\b|\bspatulas?\b|\bcutlery\b|\bsilverware\b/i,'utensil'],
  [/\btools?\b|\bdrills?\b|\bhammers?\b|\bwrench(?:es)?\b|\bhardware\b/i,'tool'],
  [/\btotes?\b|\bstorage box(?:es)?\b|\boverflow\b|\bbulk\b/i,'tote'],
  [/\bplates?\b|\bdish(?:es)?\b|\bbowls?\b/i,'plate'],
  /* Dry goods are what you decant: flour, rice, pasta, cereal. Defaulting them
     to the pantry's `can` made "Transfer dry goods into airtight containers"
     and "Set up can risers and stock canned goods" the same picture. */
  [/\bbags?\b|\bpackets?\b|\bsnacks?\b|\bpouch(?:es)?\b|\bdry goods\b|\bgrains?\b|\bflour\b|\brice\b|\bpasta\b|\bcereal\b/i,'bag'],
  /* Fridge food, below everything above so "condiment jars" and "juice
     bottles" keep the container they name. Meat first: "Sort freezer into
     bins: meat, veg, meals" is about the raw meat. */
  [/\bmeats?\b|\bchicken\b|\bfish\b|\bpoultry\b|\bseafood\b|\bdeli\b/i,'meat'],
  [/\bproduce\b|\bfruits?\b|\bveg(?:gies|etables?)?\b|\bgreens\b|\bsalads?\b|\bherbs\b|\bberries\b/i,'produce'],
  [/\bdairy\b|\bmilk\b|\bjuice\b|\beggs?\b|\byog(?:h)?urts?\b|\bcartons?\b|\bcheese\b/i,'carton'],
  [/\bleftovers?\b|\bmeals?\b|\bmeal prep\b/i,'leftovers'],
];
const SPACE_GLYPH={
  pantry:'can', cabinet:'plate', drawers:'utensil', junk:'utensil',
  closet:'hanger', walkin:'hanger', dresser:'foldedclothes', linen:'towel', bathroom:'bottle',
  fridge:'carton', garage:'tote', workbench:'tool', attic:'tote', laundry:'bottle', kids:'tote',
};
// Same rule as the actions: no hanger or folded shirt outside a clothes space.
export function glyphAllowed(glyph, spaceId){
  if(!spaceId) return true;
  if(glyph==='hanger') return HANG_SPACES.has(spaceId);
  if(glyph==='foldedclothes') return FOLD_SPACES.has(spaceId);
  return true;
}
export function glyphForStep(step, spaceId){
  return firstMatch(GLYPH_RULES, step, g=>!glyphAllowed(g, spaceId))
    || SPACE_GLYPH[spaceId] || 'tote';
}

export function mediaKeyFor(step, spaceId){
  return `${classifyAction(step, spaceId)}-${motifForSpace(spaceId)}-${glyphForStep(step, spaceId)}`;
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
  // The SVG scenes hold still under prefers-reduced-motion (CSS strips their
  // animations); an autoplaying clip would bring that motion right back, so
  // the upgrade is skipped entirely and the stilled SVG stays.
  if(typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
