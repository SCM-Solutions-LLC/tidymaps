/* ============================================================
   Product illustrations — one per catalog category.

   The catalog carries an optional `img` (a real retailer photo). Almost
   nothing in it does yet: displaying retailer photography means either an
   affiliate image API (Amazon's requires an approved Associates account —
   deliberately not applied for yet) or hotlinking, which breaks the moment a
   retailer rotates a URL. So a card falls back to the drawing for its
   category, in the same elevation voice as the wizard's space and setup
   cards. It shows the shape of the thing without pretending to be a photo of
   this exact SKU, and a real `img` takes over automatically when one exists.
   ============================================================ */

const T = '#f0fae1'; // the tint, via css/components.css
const T2 = '#ffe1d0'; // the deeper tint

/* Drawn in the wizard's elevation voice (js/wizard-data.js): one thin ink
   line, square corners, stock and tint fills, a short spot rule where a
   label sits (class "lbl"). Each is the object seen straight on. */
const ART = {
  'clear-bin':
    '<path d="M20 20h56l-4 42H24z" fill="#fff" class="case"/><path d="M20 20h56"/>' +
    '<path d="M32 20v42M48 20v42M64 20v42"/><path d="M38 40h20" class="lbl"/>',
  'basket':
    '<path d="M22 24h52l-5 38H27z" fill="' + T + '" class="case"/><path d="M22 24h52"/>' +
    '<path d="M30 34h36M29 44h38M28 54h40"/><path d="M37 24v38M48 24v38M59 24v38"/>' +
    '<path d="M32 24v-5h10v5M54 24v-5h10v5"/>',
  'turntable':
    '<path d="M16 54h64M20 54v5h56v-5" fill="#fff" class="case"/><path d="M48 59v5M36 64h24"/>' +
    '<rect x="26" y="26" width="12" height="28" fill="#fff"/><path d="M28 26v-3h8v3M29 40h6" class="lbl"/>' +
    '<rect x="42" y="32" width="10" height="22" fill="' + T + '"/><path d="M42 36h10"/>' +
    '<path d="M58 30h4v2l2 2v20h-8V34l2-2z" fill="#fff"/><path d="M58 44h4" class="lbl"/>',
  'can-riser':
    '<path d="M14 62h68M20 62V50h56v12M28 50V38h44v12M36 38V26h36v12" class="case"/>' +
    '<rect x="40" y="16" width="12" height="10" fill="' + T + '"/><path d="M40 18.5h12M40 23.5h12"/>' +
    '<rect x="32" y="28" width="12" height="10" fill="#fff"/><path d="M32 30.5h12M32 35.5h12"/>' +
    '<rect x="24" y="40" width="12" height="10" fill="' + T2 + '"/><path d="M24 42.5h12M24 47.5h12"/>',
  'shelf-riser':
    '<path d="M14 40h68v4H14z" fill="#fff" class="case"/><path d="M20 44v18M76 44v18M14 62h68"/>' +
    '<rect x="26" y="24" width="14" height="16" fill="#fff"/><path d="M26 26h14M29 33h8" class="lbl"/>' +
    '<rect x="46" y="28" width="12" height="12" fill="' + T + '"/><path d="M46 30h12"/>' +
    '<rect x="26" y="48" width="18" height="14" fill="' + T2 + '"/><path d="M26 50h18M31 56h8" class="lbl"/>' +
    '<rect x="50" y="50" width="16" height="12" fill="#fff"/><path d="M50 52h16"/>',
  'door-rack':
    '<path d="M26 6h6v60h-6z" fill="' + T + '" class="case"/><path d="M32 12v-4h-8"/>' +
    '<path d="M32 18h34v10H32zM32 34h34v10H32zM32 50h34v10H32z" fill="#fff"/>' +
    '<rect x="37" y="10" width="7" height="8" fill="#fff"/><path d="M38.5 14h4" class="lbl"/>' +
    '<rect x="48" y="26" width="8" height="8" fill="' + T2 + '"/><path d="M48 28h8"/>' +
    '<rect x="38" y="42" width="10" height="8" fill="#fff"/><path d="M40 46h6" class="lbl"/>',
  'airtight-container':
    '<rect x="30" y="14" width="36" height="8" fill="' + T + '" class="case"/><path d="M42 14v-3h12v3"/>' +
    '<rect x="32" y="22" width="32" height="42" fill="#fff" class="case"/>' +
    '<path d="M32 44h32"/><path d="M40 52h16" class="lbl"/>',
  'drawer-organizer':
    '<rect x="12" y="18" width="72" height="40" fill="#fff" class="case"/>' +
    '<path d="M36 18v40M60 18v40M36 38h24"/>' +
    '<rect x="17" y="23" width="14" height="30" fill="' + T + '"/>' +
    '<rect x="41" y="23" width="14" height="10" fill="' + T2 + '"/>' +
    '<rect x="41" y="43" width="14" height="10" fill="#fff"/>' +
    '<path d="M65 28h14M65 38h14M65 48h14"/>',
  'hook-rack':
    '<rect x="12" y="16" width="72" height="12" fill="#fff" class="case"/><path d="M18 22h4M74 22h4"/>' +
    '<path d="M24 28v6h6M46 28v6h6M68 28v6h6"/>' +
    '<path d="M22 40h14l2 20H20z" fill="' + T + '"/><path d="M25 46h8" class="lbl"/>' +
    '<path d="M44 40h12v18H44z" fill="#fff"/><path d="M47 44h6" class="lbl"/>',
  'label-set':
    '<rect x="14" y="18" width="34" height="16" fill="#fff" class="case"/><path d="M20 26h20" class="lbl"/>' +
    '<rect x="52" y="18" width="30" height="16" fill="' + T + '"/><path d="M58 26h18" class="lbl"/>' +
    '<rect x="14" y="42" width="30" height="16" fill="' + T2 + '"/><path d="M20 50h18" class="lbl"/>' +
    '<rect x="48" y="42" width="34" height="16" fill="#fff" class="case"/><path d="M54 50h20" class="lbl"/>',
  'safety-latch':
    '<path d="M22 10h26v54H22z" fill="#fff" class="case"/><path d="M48 10h26v54H48z" fill="#fff" class="case"/>' +
    '<path d="M44 34v6M52 34v6"/>' +
    '<path d="M34 24h28v10H34z" fill="' + T + '"/>' +
    '<path d="M40 24v-5h16v5"/><rect x="46" y="27" width="4" height="4" fill="#fff"/>',
};

const cache = {};

/* Returns an inline SVG for a catalog product type, or a neutral box when the
   type is one the drawing set doesn't cover yet. */
export function productArt(type){
  if(!cache[type]){
    const body = ART[type] || '<rect x="24" y="22" width="48" height="40" fill="#fff" class="case"/><path d="M24 34h48"/>';
    cache[type] =
      '<svg class="pc-art-svg art-el" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" fill="none" ' +
      'stroke="#1f2a2b" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  return cache[type];
}

export function hasProductArt(type){ return Boolean(ART[type]); }
