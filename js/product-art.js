/* ============================================================
   Product illustrations — one per catalog category.

   The catalog carries an optional `img` (a real retailer photo). Almost
   nothing in it does yet: displaying retailer photography means either an
   affiliate image API (Amazon's requires an approved Associates account —
   deliberately not applied for yet) or hotlinking, which breaks the moment a
   retailer rotates a URL. So a card falls back to the drawing for its
   category, in the same line-art language as the wizard's room and setup
   cards. It shows the shape of the thing without pretending to be a photo of
   this exact SKU, and a real `img` takes over automatically when one exists.
   ============================================================ */

const ART = {
  'clear-bin':
    '<path d="M20 22h56l-5 40H25z" fill="#fff"/><path d="M20 22h56M28 34h40M25 62h46"/>' +
    '<path d="M32 34v22M48 34v22M64 34v22" stroke-opacity=".35"/>' +
    '<rect x="38" y="40" width="20" height="10" rx="2" fill="#f6efe4"/><path d="M42 45h12"/>',
  'basket':
    '<path d="M22 26h52l-6 36H28z" fill="#f8e4d6"/><path d="M22 26h52"/>' +
    '<path d="M30 36h36M29 46h38M28 56h40" stroke-opacity=".45"/>' +
    '<path d="M36 26v36M48 26v36M60 26v36" stroke-opacity=".45"/>' +
    '<path d="M34 32h10a3 3 0 0 1 0 6H34zM52 32h10a3 3 0 0 1 0 6H52z" fill="#fff"/>',
  'turntable':
    '<ellipse cx="48" cy="52" rx="30" ry="11" fill="#f0fae1"/><path d="M18 52v4a30 11 0 0 0 60 0v-4"/>' +
    '<rect x="32" y="24" width="12" height="22" rx="2" fill="#fff"/><path d="M32 30h12"/>' +
    '<rect x="48" y="28" width="10" height="18" rx="2" fill="#ffe1d0"/><path d="M48 33h10"/>' +
    '<path d="M62 38c0-4 4-4 4 0v8h-4z" fill="#fff"/>',
  'can-riser':
    '<path d="M16 60h64M22 60V48h52v12M30 48V36h44v12M38 36V24h36v12"/>' +
    '<ellipse cx="46" cy="26" rx="7" ry="2.6" fill="#ffe1d0"/><path d="M39 26v6a7 2.6 0 0 0 14 0v-6"/>' +
    '<ellipse cx="44" cy="38" rx="7" ry="2.6" fill="#f0fae1"/><path d="M37 38v6a7 2.6 0 0 0 14 0v-6"/>' +
    '<ellipse cx="36" cy="50" rx="7" ry="2.6" fill="#fff"/><path d="M29 50v6a7 2.6 0 0 0 14 0v-6"/>',
  'shelf-riser':
    '<path d="M14 40h68v5H14z" fill="#f6efe4"/><path d="M20 45v18M76 45v18"/>' +
    '<rect x="26" y="22" width="16" height="18" rx="2" fill="#fff"/><path d="M26 28h16"/>' +
    '<rect x="48" y="26" width="14" height="14" rx="2" fill="#f0fae1"/>' +
    '<rect x="26" y="48" width="18" height="15" rx="2" fill="#ffe1d0"/><path d="M26 53h18"/>' +
    '<rect x="50" y="50" width="16" height="13" rx="2" fill="#fff"/>',
  'door-rack':
    '<path d="M28 8v58" stroke-width="3"/><path d="M28 8h6v58h-6z" fill="#f6efe4"/>' +
    '<path d="M34 16h34v10H34zM34 32h34v10H34zM34 48h34v10H34z" fill="#fff"/>' +
    '<path d="M38 16v-4a4 4 0 0 0-8 0" fill="none"/>' +
    '<rect x="40" y="18" width="8" height="8" rx="1.5" fill="#ffe1d0"/>' +
    '<rect x="52" y="34" width="8" height="8" rx="1.5" fill="#f0fae1"/>' +
    '<rect x="40" y="50" width="10" height="8" rx="1.5" fill="#ffe1d0"/>',
  'airtight-container':
    '<rect x="30" y="16" width="36" height="10" rx="3" fill="#f0fae1"/>' +
    '<circle cx="48" cy="21" r="3" fill="#fff"/>' +
    '<path d="M32 26h32v34a4 4 0 0 1-4 4H36a4 4 0 0 1-4-4z" fill="#fff"/>' +
    '<path d="M38 40c4-3 8 3 12 0s8 3 10 0" stroke-opacity=".5"/>' +
    '<rect x="38" y="46" width="20" height="10" rx="2" fill="#f6efe4"/><path d="M42 51h12"/>',
  'drawer-organizer':
    '<rect x="12" y="18" width="72" height="40" rx="3" fill="#fff"/>' +
    '<path d="M36 18v40M60 18v40M36 38h24"/>' +
    '<rect x="17" y="23" width="14" height="30" rx="1.5" fill="#f6efe4"/>' +
    '<rect x="41" y="22" width="14" height="12" rx="1.5" fill="#ffe1d0"/>' +
    '<rect x="41" y="42" width="14" height="12" rx="1.5" fill="#f0fae1"/>' +
    '<rect x="65" y="23" width="14" height="30" rx="1.5" fill="#fff"/><path d="M65 33h14M65 43h14"/>',
  'hook-rack':
    '<rect x="12" y="16" width="72" height="14" rx="2" fill="#f6efe4"/>' +
    '<path d="M24 30v6a4 4 0 0 0 8 0M46 30v6a4 4 0 0 0 8 0M68 30v6a4 4 0 0 0 8 0"/>' +
    '<path d="M22 42h14l3 20H19z" fill="#ffe1d0"/><path d="M22 48h14"/>' +
    '<path d="M50 42c6 0 10 5 10 12s-4 8-10 8-10-1-10-8 4-12 10-12z" fill="#f0fae1"/>',
  'label-set':
    '<rect x="14" y="18" width="34" height="18" rx="9" fill="#fff"/><path d="M22 27h18" stroke-opacity=".55"/>' +
    '<circle cx="18" cy="27" r="1.6" fill="#9a5b2e"/>' +
    '<rect x="52" y="18" width="30" height="18" rx="4" fill="#f0fae1"/><path d="M58 27h18" stroke-opacity=".55"/>' +
    '<rect x="14" y="44" width="30" height="18" rx="4" fill="#ffe1d0"/><path d="M20 53h18" stroke-opacity=".55"/>' +
    '<rect x="48" y="44" width="34" height="18" rx="9" fill="#fff"/><path d="M56 53h18" stroke-opacity=".55"/>' +
    '<circle cx="52" cy="53" r="1.6" fill="#9a5b2e"/>',
  'safety-latch':
    '<path d="M22 10h26v54H22z" fill="#fff"/><path d="M48 10h26v54H48z" fill="#fff"/>' +
    '<circle cx="43" cy="37" r="1.6" fill="#9a5b2e"/><circle cx="53" cy="37" r="1.6" fill="#9a5b2e"/>' +
    '<path d="M34 26h28v10H34z" fill="#f0fae1"/>' +
    '<path d="M40 26v-4a8 8 0 0 1 16 0v4" fill="none"/>' +
    '<circle cx="48" cy="31" r="2.4" fill="#fff"/>',
};

const cache = {};

/* Returns an inline SVG for a catalog product type, or a neutral box when the
   type is one the drawing set doesn't cover yet. */
export function productArt(type){
  if(!cache[type]){
    const body = ART[type] || '<rect x="24" y="22" width="48" height="40" rx="3" fill="#fff"/><path d="M24 34h48"/>';
    cache[type] =
      '<svg class="pc-art-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" fill="none" ' +
      'stroke="#9a5b2e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  return cache[type];
}

export function hasProductArt(type){ return Boolean(ART[type]); }
