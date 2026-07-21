/* ============================================================
   Wizard data model — the Claude Design wizard contract.

   Three-step space selection (room → area → setup type), setup-specific
   default measurements, and per-space question sets (categories, goals,
   styles, detection). Content is lifted verbatim from the design
   prototype (TidyMap Wizard.dc.html); ids map onto the production
   space ids used by demo scenarios, the plan engine, and saved plans.
   ============================================================ */

/* ---------- Rooms ---------- */
export const ROOMS = [
  { id: 'kitchen', label: 'Kitchen', desc: 'Pantry, cabinets & drawers', imgKey: 'wiz-room-kitchen', artKey: 'roomKitchen' },
  { id: 'bedroom', label: 'Bedroom', desc: 'Closet & dresser', imgKey: 'wiz-room-bedroom', artKey: 'roomBedroom' },
  { id: 'bath', label: 'Bathroom & hall', desc: 'Vanity & linen closet', imgKey: 'wiz-room-bath', artKey: 'roomBath' },
  { id: 'garage', label: 'Garage', desc: 'Shelving & workbench', imgKey: 'wiz-room-garage', artKey: 'roomGarage' },
];

/* ---------- Areas within each room (id = production space id) ---------- */
export const AREAS = {
  kitchen: [
    { id: 'pantry', label: 'Pantry', short: 'pantry', desc: 'Food storage — cabinet to walk-in', imgKey: 'wiz-pantry-cabinet', artKey: 'artPantry' },
    { id: 'cabinet', label: 'Cabinets', short: 'cabinets', desc: 'Dishes, pots & counter clutter', imgKey: 'wiz-cabinets', artKey: 'artTallCab' },
    { id: 'drawers', label: 'Drawers', short: 'drawers', desc: 'Cutlery, utensils & the junk drawer', imgKey: 'wiz-area-drawers', artKey: 'artInCounter' },
  ],
  bedroom: [
    { id: 'closet', label: 'Closet', short: 'closet', desc: 'Clothes, shoes & accessories', imgKey: 'wiz-area-closet', artKey: 'artWardrobe' },
    { id: 'dresser', label: 'Dresser', short: 'dresser', desc: 'Folded clothes in drawers', imgKey: 'wiz-area-dresser', artKey: 'artDresser' },
  ],
  bath: [
    { id: 'bathroom', label: 'Vanity & under-sink', short: 'vanity', desc: 'Toiletries, makeup & meds', imgKey: 'wiz-area-vanity', artKey: 'artVanity' },
    { id: 'linen', label: 'Linen closet', short: 'linen closet', desc: 'Sheets, towels & spare bedding — usually in the hall', imgKey: 'wiz-area-linen', artKey: 'artLinen' },
  ],
  garage: [
    { id: 'garage', label: 'Shelving & storage', short: 'garage shelving', desc: 'Bins, tools & seasonal gear', imgKey: 'wiz-garage-shelving', artKey: 'artGarageShelf' },
    { id: 'workbench', label: 'Workbench', short: 'workbench', desc: 'Tools, hardware & projects', imgKey: 'wiz-area-workbench', artKey: 'artWorkbench' },
  ],
};

export function roomFor(spaceId) {
  for (const room of ROOMS) {
    if ((AREAS[room.id] || []).some(a => a.id === spaceId)) return room;
  }
  return ROOMS[0];
}
export function areaFor(spaceId) {
  for (const list of Object.values(AREAS)) {
    const a = list.find(x => x.id === spaceId);
    if (a) return a;
  }
  return AREAS.kitchen[0];
}

/* "Where in the kitchen?" reads naturally; "Bathroom & hall" needs a hand. */
export function roomLower(roomId) {
  const room = ROOMS.find(r => r.id === roomId) || ROOMS[0];
  return room.id === 'bath' ? 'bathroom (or hall)' : room.label.toLowerCase();
}

/* ---------- Per-space question sets ---------- */
export const SPACE_CFG = {
  pantry: {
    categories: ['Dry goods & grains', 'Canned goods', 'Snacks', 'Breakfast', 'Baking', 'Drinks', 'Spices & oils', 'Appliances', 'Bulk & overflow', "Kids' snacks"],
    goals: ["Can't find anything", 'Always running out of room', "Kids can't reach their things", 'Expired food hides in back', 'No system for restocking', 'Looks cluttered', 'Hard to keep tidy'],
    detect: ['Cereal & breakfast boxes', 'Canned goods', 'Snack bags', 'Baking supplies', 'Bottles & oils'],
    detectCats: ['Breakfast', 'Canned goods', 'Snacks', 'Baking', 'Spices & oils'],
  },
  cabinet: {
    categories: ['Dishes & glasses', 'Pots & pans', 'Food storage containers', 'Small appliances', 'Cooking utensils', 'Baking gear', 'Cleaning supplies', "Kids' dishes"],
    goals: ["Can't find anything", 'Always running out of room', 'Counters are always full', 'Lids everywhere, no matches', "Kids can't reach their things", 'Looks cluttered', 'Hard to keep tidy'],
    detect: ['Dishes & glasses', 'Small appliances', 'Container stacks', 'Pots & pans'],
    detectCats: ['Dishes & glasses', 'Small appliances', 'Food storage containers', 'Pots & pans'],
  },
  drawers: {
    categories: ['Cutlery', 'Cooking utensils', 'Wraps & foil', 'Kitchen towels', 'Junk-drawer bits', 'Batteries & tools', "Kids' things"],
    goals: ["Can't find anything", 'Always running out of room', 'It became the junk drawer', 'Things jam when it opens', 'Looks cluttered', 'Hard to keep tidy'],
    detect: ['Loose utensils', 'Wraps & foil boxes', 'Odds and ends'],
    detectCats: ['Cooking utensils', 'Wraps & foil', 'Junk-drawer bits'],
  },
  closet: {
    categories: ['Hanging clothes', 'Folded clothes', 'Shoes', 'Bags & purses', 'Accessories', 'Seasonal coats', 'Extra bedding', "Kids' clothes"],
    goals: ["Can't find anything", 'Always running out of room', 'Outfits take forever', 'Clothes pile up on a chair', "Kids can't reach their things", 'Looks cluttered', 'Hard to keep tidy'],
    detect: ['Hanging shirts', 'Folded sweaters', 'Shoes on the floor', 'Bags & totes'],
    detectCats: ['Hanging clothes', 'Folded clothes', 'Shoes', 'Bags & purses'],
  },
  dresser: {
    categories: ['Everyday tops', 'Pants & jeans', 'Underwear & socks', 'Pajamas', 'Workout clothes', 'Sweaters', 'Accessories', 'Off-season overflow'],
    goals: ["Can't find anything", 'Drawers jam or overflow', 'Folding never lasts', 'Always running out of room', 'Looks cluttered', 'Hard to keep tidy'],
    detect: ['Folded shirts', 'Jeans stack', 'Sock jumble'],
    detectCats: ['Everyday tops', 'Pants & jeans', 'Underwear & socks'],
  },
  bathroom: {
    categories: ['Daily toiletries', 'Makeup', 'Hair tools', 'Medicines', 'First aid', 'Cleaning supplies', 'Backstock & refills', 'Towels'],
    goals: ["Can't find anything", 'Products keep multiplying', 'Under-sink is a jumble', 'Counter is always full', 'Expired stuff hides in back', 'Hard to keep tidy'],
    detect: ['Bottles & jars', 'Hair tools', 'Cleaning sprays'],
    detectCats: ['Daily toiletries', 'Hair tools', 'Cleaning supplies'],
  },
  linen: {
    categories: ['Sheet sets', 'Towels', 'Blankets & duvets', 'Pillows', 'Toiletry backstock', 'Cleaning supplies', 'Beach towels'],
    goals: ["Can't find anything", 'Always running out of room', 'Sheet sets get separated', 'Towels avalanche when you pull one', 'Looks cluttered', 'Hard to keep tidy'],
    detect: ['Stacked towels', 'Folded sheets', 'Bulky blankets', 'Toiletry backstock'],
    detectCats: ['Towels', 'Sheet sets', 'Blankets & duvets', 'Toiletry backstock'],
  },
  garage: {
    categories: ['Tools', 'Paint & chemicals', 'Sports gear', 'Camping gear', 'Holiday decor', 'Garden supplies', 'Bulk household', "Kids' outdoor toys"],
    goals: ["Can't find anything", 'The floor is a pile zone', 'No room for the car', 'Seasonal stuff gets buried', 'Always running out of room', 'Hard to keep tidy'],
    detect: ['Stacked bins', 'Sports gear', 'Garden tools'],
    detectCats: ['Sports gear', 'Garden supplies', 'Bulk household'],
  },
  workbench: {
    categories: ['Hand tools', 'Power tools', 'Screws & fasteners', 'Paint & supplies', 'Tape & adhesives', 'Safety gear', 'Batteries & cords'],
    goals: ["Can't find the right tool", 'The bench is buried', 'Small parts everywhere', 'Cords tangle', 'Always running out of room', 'Hard to keep tidy'],
    detect: ['Power tools', 'Jars of small parts', 'Paint cans'],
    detectCats: ['Power tools', 'Screws & fasteners', 'Paint & supplies'],
  },
};

/* ---------- Per-space organizing styles ---------- */
export const STYLESETS = {
  pantry: [
    { label: 'Clear containers', desc: 'Decant into jars — see what’s left at a glance' },
    { label: 'Baskets & bins', desc: 'Warm woven storage that hides busy packaging' },
    { label: 'Labeled everything', desc: 'A named home for every shelf and bin' },
    { label: 'Keep it simple', desc: 'Work with what’s there, low-maintenance' },
  ],
  cabinet: [
    { label: 'Clear counters', desc: 'Everything behind doors, calm kitchen' },
    { label: 'Clear containers', desc: 'Spot staples and leftovers fast' },
    { label: 'Labeled shelves', desc: 'Everyone reshelves to the right spot' },
    { label: 'Keep it simple', desc: 'Work with what’s there, low-maintenance' },
  ],
  drawers: [
    { label: 'A slot for everything', desc: 'Dividers keep order on autopilot' },
    { label: 'Trays & caddies', desc: 'Lift a whole kit out at once' },
    { label: 'Labeled sections', desc: 'No more mystery drawer' },
    { label: 'Keep it simple', desc: 'Work with what’s there, low-maintenance' },
  ],
  closet: [
    { label: 'Matching hangers', desc: 'One hanger style — a calm, even rail' },
    { label: 'Baskets & bins', desc: 'Soft storage for folded and small things' },
    { label: 'Labeled shelves & bins', desc: 'Every stack and basket has a name' },
    { label: 'Capsule & minimal', desc: 'Fewer, better pieces — easier mornings' },
  ],
  dresser: [
    { label: 'File-folded drawers', desc: 'Clothes stand upright — see every shirt' },
    { label: 'Drawer dividers', desc: 'Sections that keep folds standing' },
    { label: 'Labeled drawers', desc: 'Everyone puts it back in the right one' },
    { label: 'Keep it simple', desc: 'Work with what’s there, low-maintenance' },
  ],
  bathroom: [
    { label: 'Clear acrylic', desc: 'See every product at a glance' },
    { label: 'Trays & caddies', desc: 'Your whole routine lifts out in one go' },
    { label: 'Labeled bins', desc: 'Backstock you can actually find' },
    { label: 'Clear-counter minimal', desc: 'Five things out, max' },
  ],
  linen: [
    { label: 'Woven baskets', desc: 'Grab-and-go by room or person' },
    { label: 'Shelf dividers', desc: 'Stacks that stay standing' },
    { label: 'Labeled shelves', desc: 'Sheets, towels, spares — all named' },
    { label: 'Keep it simple', desc: 'Work with what’s there, low-maintenance' },
  ],
  garage: [
    { label: 'Clear latching totes', desc: 'See contents without pulling bins down' },
    { label: 'Everything on the wall', desc: 'Hooks and racks — the floor stays a path' },
    { label: 'Big readable labels', desc: 'Findable from the doorway' },
    { label: 'Keep it simple', desc: 'Work with what’s there, low-maintenance' },
  ],
  workbench: [
    { label: 'Shadow-board pegboard', desc: 'An outlined spot for every tool' },
    { label: 'A drawer per tool type', desc: 'Everything files away out of sight' },
    { label: 'Labeled small parts', desc: 'Screws and bits, sorted and named' },
    { label: 'Clear-bench minimal', desc: 'Only the active project on top' },
  ],
};

/* ---------- Setup types per area (photo cards) ---------- */
export const SETUP_TYPES = {
  pantry: [
    { id: 'cabinet', label: 'Cabinet', desc: 'A tall cupboard with doors', imgKey: 'wiz-cabinets', artKey: 'artTallCab' },
    { id: 'reachin', label: 'Reach-in', desc: 'Open the door, shelves face you', artKey: 'artReachIn' },
    { id: 'walkin', label: 'Walk-in', desc: 'A small room you step into', imgKey: 'wiz-pantry-walkin', artKey: 'artWalkIn' },
    { id: 'lshape', label: 'L-shaped', desc: 'Shelves wrap around a corner', artKey: 'artLShape' },
    { id: 'butler', label: 'Butler’s', desc: 'Counter with cabinets above & below', artKey: 'artCounter' },
  ],
  cabinet: [
    { id: 'counterup', label: 'Counter + uppers', desc: 'Cabinets above and below a counter', artKey: 'artCounter' },
    { id: 'lshapeK', label: 'L-shaped run', desc: 'Cabinets wrap around a corner', artKey: 'artLShape' },
    { id: 'tallcabK', label: 'Tall cabinet', desc: 'A full-height cupboard', imgKey: 'wiz-cabinets', artKey: 'artTallCab' },
    { id: 'openshelf', label: 'Open shelving', desc: 'Shelves on the wall, no doors', artKey: 'artOpenShelf' },
  ],
  drawers: [
    { id: 'incounter', label: 'In-counter drawers', desc: 'Built into the kitchen counter', artKey: 'artInCounter' },
    { id: 'tower', label: 'Drawer tower', desc: 'A tall, narrow stack of drawers', imgKey: 'wiz-drawer-tower', artKey: 'artTower' },
    { id: 'sideboard', label: 'Sideboard', desc: 'A wide, low piece — like a buffet or credenza', artKey: 'artSideboard' },
  ],
  closet: [
    { id: 'wardrobe', label: 'Wardrobe', desc: 'A freestanding closet with doors', artKey: 'artWardrobe' },
    { id: 'reachinC', label: 'Reach-in', desc: 'Standard closet behind sliding or hinged doors', artKey: 'artReachIn' },
    { id: 'walkinC', label: 'Walk-in', desc: 'A small room you step into', artKey: 'artWalkIn' },
    { id: 'lshapeC', label: 'L-shaped', desc: 'Shelving wraps around a corner', artKey: 'artLShape' },
    { id: 'builtin', label: 'Built-in + drawers', desc: 'Shelves up top, drawers below', imgKey: 'wiz-closet-builtin', artKey: 'artWardrobe' },
  ],
  dresser: [
    { id: 'dresser', label: 'Wide dresser', desc: 'A low, wide chest of drawers', artKey: 'artDresser' },
    { id: 'chest', label: 'Tall chest', desc: 'Narrow and tall, five-ish drawers', imgKey: 'wiz-drawer-tower', artKey: 'artTower' },
    { id: 'underbed', label: 'Under-bed drawers', desc: 'Rolling bins or drawers under the bed', artKey: 'artUnderbed' },
  ],
  bathroom: [
    { id: 'undersink', label: 'Under-sink cabinet', desc: 'The cabinet under the basin', artKey: 'artVanity' },
    { id: 'vanitydr', label: 'Vanity with drawers', desc: 'Doors plus a stack of drawers', artKey: 'artVanityDr' },
    { id: 'wallshelf', label: 'Wall shelves', desc: 'Open shelves above the toilet or counter', artKey: 'artOpenShelf' },
  ],
  linen: [
    { id: 'cabinetL', label: 'Cabinet', desc: 'A tall cupboard with doors', artKey: 'artTallCab' },
    { id: 'reachinL', label: 'Reach-in', desc: 'Open the door, shelves face you', artKey: 'artLinen' },
    { id: 'walkinL', label: 'Walk-in', desc: 'A deep closet you step into', imgKey: 'wiz-closet-builtin', artKey: 'artWalkIn' },
    { id: 'lshapeL', label: 'L-shaped', desc: 'Shelving wraps around a corner', artKey: 'artLShape' },
  ],
  garage: [
    { id: 'utility', label: 'Utility shelving', desc: 'Freestanding metal or wire rack', imgKey: 'wiz-garage-shelving', artKey: 'artGarageShelf' },
    { id: 'wallcab', label: 'Wall cabinets', desc: 'Closed cabinets mounted on the wall', artKey: 'artWallCab' },
    { id: 'overhead', label: 'Overhead rack', desc: 'A platform hung from the ceiling', imgKey: 'wiz-overhead-rack', artKey: 'artOverhead' },
  ],
  workbench: [
    { id: 'bench', label: 'Workbench & pegboard', desc: 'Work surface with tools on the wall', artKey: 'artWorkbench' },
    { id: 'toolchest', label: 'Rolling tool chest', desc: 'A cabinet of drawers on wheels', artKey: 'artToolChest' },
    { id: 'wallcabW', label: 'Wall cabinets', desc: 'Closed cabinets mounted on the wall', artKey: 'artWallCab' },
  ],
};

/* ---------- Default measurements per setup (feet) ---------- */
export const SETUP_DIMS = {
  cabinet: { w: 3, h: 6.5, d: 1.5 }, reachin: { w: 5, h: 7.5, d: 2 }, walkin: { w: 6, h: 8, d: 6 }, lshape: { w: 6, h: 8, d: 5 }, butler: { w: 7, h: 8, d: 2 },
  counterup: { w: 8, h: 8, d: 2 }, lshapeK: { w: 8, h: 8, d: 6 }, tallcabK: { w: 3, h: 7, d: 1.5 }, openshelf: { w: 6, h: 7.5, d: 1 },
  incounter: { w: 2.5, h: 3, d: 2 }, tower: { w: 1.5, h: 4.5, d: 1.5 }, sideboard: { w: 5, h: 3, d: 1.5 },
  wardrobe: { w: 3.5, h: 6.5, d: 2 }, reachinC: { w: 5, h: 8, d: 2.5 }, walkinC: { w: 6, h: 8, d: 6 }, lshapeC: { w: 6, h: 8, d: 5 }, builtin: { w: 6, h: 8, d: 2.5 },
  dresser: { w: 4, h: 3, d: 1.5 }, chest: { w: 2.5, h: 4.5, d: 1.5 }, underbed: { w: 4.5, h: 1, d: 2 },
  undersink: { w: 2.5, h: 2.5, d: 1.75 }, vanitydr: { w: 4, h: 2.75, d: 1.75 }, wallshelf: { w: 2.5, h: 2.5, d: 0.75 },
  cabinetL: { w: 3, h: 6.5, d: 1.5 }, reachinL: { w: 3, h: 7.5, d: 1.5 }, walkinL: { w: 4, h: 8, d: 4 }, lshapeL: { w: 5, h: 8, d: 4 },
  utility: { w: 6, h: 6.5, d: 1.5 }, wallcab: { w: 6, h: 2.5, d: 1.25 }, overhead: { w: 8, h: 1.5, d: 4 },
  bench: { w: 6, h: 6, d: 2 }, toolchest: { w: 2.5, h: 3.5, d: 1.5 }, wallcabW: { w: 4, h: 2.5, d: 1.25 },
};

/* Room-like setups: depth reads as "Room depth" and the summary says "room". */
export const ROOMY = ['walkin', 'lshape', 'walkinC', 'lshapeC', 'walkinL', 'lshapeL', 'lshapeK'];

/* Setup → 3D geometry family, and the matching 3D-viewer layout chip. */
export const SETUP_GEOM = { cabinet: 'cabinet', reachin: 'reachin', walkin: 'walkin', lshape: 'lshape', butler: 'butler', counterup: 'butler', lshapeK: 'lshape', tallcabK: 'cabinet', openshelf: 'reachin', incounter: 'butler', tower: 'cabinet', sideboard: 'reachin', wardrobe: 'cabinet', reachinC: 'reachin', walkinC: 'walkin', lshapeC: 'lshape', builtin: 'butler', dresser: 'reachin', chest: 'cabinet', underbed: 'reachin', undersink: 'reachin', vanitydr: 'butler', wallshelf: 'reachin', cabinetL: 'cabinet', reachinL: 'reachin', walkinL: 'walkin', lshapeL: 'lshape', utility: 'reachin', wallcab: 'reachin', overhead: 'reachin', bench: 'butler', toolchest: 'cabinet', wallcabW: 'reachin' };
export const GEOM_TO_V3D_LAYOUT = { cabinet: 'cabinet', reachin: 'reach-in', walkin: 'walk-in', lshape: 'l-shaped', butler: 'butlers' };

/* A few setups have a richer demo scenario than their area's default. */
export const SETUP_SCENARIO = { walkinC: 'walkin' };
export function scenarioKeyFor(spaceId, setupId) {
  return SETUP_SCENARIO[setupId] || spaceId || 'pantry';
}

/* ---------- People, effort, shopping ---------- */
export const KID_AGES = ['Baby', 'Toddler', 'Big kid', 'Teen'];
export const EFFORT_OPTS = [
  { label: 'Quick refresh', desc: 'About 30 minutes' },
  { label: 'Weekend reset', desc: '2–3 hours, no rush' },
  { label: 'Full overhaul', desc: 'A day or more — do it right' },
];
export const SHOPPING_OPTS = [
  { label: 'Use what I have', desc: 'Build the plan around what’s already in my home.' },
  { label: 'Open to a few ideas', desc: 'Suggest products sized to my shelves — always optional.' },
];

/* ---------- Bridges into the existing plan engine ---------- */

/* The plan engine's goal ids predate the per-space goal lists; the first
   selected goal maps to the closest engine id so applyGoal still works. */
export function goalIdFor(goalText) {
  const t = String(goalText || '').toLowerCase();
  if (!t) return null;
  if (/can't find|can’t find/.test(t)) return 'find';
  if (/kids can't reach|kids can’t reach/.test(t)) return 'kid';
  if (/running out of room|no room/.test(t)) return 'capacity';
  if (/cluttered/.test(t)) return 'clutter';
  if (/minimal/.test(t)) return 'minimal';
  return 'unsure';
}

/* Styles that have a matching engine preference get it, so deterministic
   personalization can cite and act on them; the raw style labels also travel
   in the analysis context for the AI path. */
const STYLE_PREF_RULES = [
  [/^label|labels$|labeled/i, 'Labels and categories'],
  [/clear (containers|acrylic|latching)/i, 'Use clear containers'],
  [/basket|trays & caddies/i, 'Use baskets / hidden storage'],
  [/keep it simple/i, 'Easy to maintain'],
  [/minimal|clear counters/i, 'Minimal look'],
  [/everything on the wall/i, 'Maximize vertical space'],
];
export function prefsForStyles(styles) {
  const prefs = new Set();
  (styles || []).forEach(sLabel => {
    for (const [re, pref] of STYLE_PREF_RULES) {
      if (re.test(sLabel)) { prefs.add(pref); break; }
    }
  });
  return prefs;
}

/* ---------- Measurement formatting (feet → 3′6″) ---------- */
export function fmtFt(ft) {
  const inches = Math.round(ft * 12), f = Math.floor(inches / 12), i = inches % 12;
  if (!f) return i + '″';
  return i ? f + '′' + i + '″' : f + '′';
}
export function measureSummary(setupId, dims) {
  const roomy = ROOMY.includes(setupId);
  return roomy
    ? fmtFt(dims.w) + ' × ' + fmtFt(dims.d) + ' room, ' + fmtFt(dims.h) + ' tall'
    : fmtFt(dims.w) + ' wide × ' + fmtFt(dims.h) + ' tall × ' + fmtFt(dims.d) + ' deep';
}

/* ---------- Line-art card illustrations (design-owned SVG set) ----------
   Every card renders instantly from these; hydrateImages() swaps in the real
   photo when the manifest marks its key "ready". No hotlinks, no 404s. */
const ART = {
  roomKitchen: '<rect x="8" y="8" width="22" height="16" rx="2" fill="#f0fae1"/><path d="M19 8v16M8 16h22"/><rect x="60" y="6" width="28" height="18" rx="2" fill="#fff"/><path d="M74 6v18"/><circle cx="71" cy="15" r="1.2" fill="#9a5b2e"/><circle cx="77" cy="15" r="1.2" fill="#9a5b2e"/><rect x="40" y="26" width="16" height="8" rx="2" fill="#ffe1d0"/><circle cx="48" cy="24" r="1.6"/><path d="M38 29h2M56 29h2"/><rect x="6" y="36" width="84" height="5" rx="2" fill="#f6efe4"/><rect x="10" y="41" width="76" height="24" rx="2" fill="#fff"/><path d="M35 41v24M61 41v24"/><circle cx="31" cy="53" r="1.2" fill="#9a5b2e"/><circle cx="39" cy="53" r="1.2" fill="#9a5b2e"/><circle cx="57" cy="53" r="1.2" fill="#9a5b2e"/><circle cx="65" cy="53" r="1.2" fill="#9a5b2e"/>',
  roomBedroom: '<rect x="8" y="20" width="8" height="32" rx="3" fill="#fff"/><rect x="12" y="34" width="50" height="16" rx="4" fill="#fff"/><rect x="36" y="34" width="26" height="16" rx="4" fill="#ffe1d0"/><rect x="17" y="27" width="14" height="9" rx="3" fill="#f0fae1"/><path d="M15 50v6M58 50v6M20 64h34"/><rect x="68" y="12" width="22" height="44" rx="2" fill="#fff"/><path d="M79 12v44"/><circle cx="76" cy="34" r="1.2" fill="#9a5b2e"/><circle cx="82" cy="34" r="1.2" fill="#9a5b2e"/><path d="M71 56v4M87 56v4"/>',
  roomBath: '<circle cx="28" cy="16" r="10" fill="#f0fae1"/><path d="M26 30h6M29 27v3"/><rect x="12" y="33" width="34" height="5" rx="2" fill="#f6efe4"/><rect x="15" y="38" width="28" height="21" rx="2" fill="#fff"/><path d="M29 38v21"/><circle cx="26" cy="48" r="1.2" fill="#9a5b2e"/><circle cx="32" cy="48" r="1.2" fill="#9a5b2e"/><path d="M56 20h30"/><rect x="60" y="20" width="10" height="17" rx="2" fill="#ffe1d0"/><rect x="74" y="20" width="10" height="17" rx="2" fill="#f0fae1"/><path d="M58 62h26"/>',
  roomGarage: '<rect x="8" y="5" width="80" height="12" rx="2" fill="#f6efe4"/><path d="M8 11h80"/><path d="M16 24v42M44 24v42"/><path d="M14 34h32M14 50h32M14 66h32"/><rect x="20" y="25" width="10" height="9" rx="1" fill="#ffe1d0"/><rect x="32" y="25" width="9" height="9" rx="1" fill="#f0fae1"/><rect x="20" y="41" width="9" height="9" rx="1" fill="#f0fae1"/><rect x="31" y="41" width="10" height="9" rx="1" fill="#fff"/><path d="M36 41v9"/><path d="M70 28v26"/><path d="M64 62l3-8h6l3 8z" fill="#ffe1d0"/><circle cx="84" cy="61" r="5" fill="#f0fae1"/>',
  artTallCab: '<rect x="28" y="6" width="40" height="58" rx="3" fill="#fff"/><path d="M48 6v58"/><rect x="33" y="12" width="10" height="19" rx="2"/><rect x="53" y="12" width="10" height="19" rx="2"/><rect x="33" y="38" width="10" height="19" rx="2"/><rect x="53" y="38" width="10" height="19" rx="2"/><circle cx="45" cy="35" r="1.3" fill="#9a5b2e"/><circle cx="51" cy="35" r="1.3" fill="#9a5b2e"/><path d="M32 64v4M64 64v4"/>',
  artPantry: '<rect x="26" y="5" width="44" height="61" rx="3" fill="#fff"/><path d="M26 24h44M26 44h44"/><rect x="31" y="12" width="8" height="12" rx="1.5" fill="#f0fae1"/><path d="M31 15h8"/><rect x="42" y="14" width="7" height="10" rx="1.5" fill="#ffe1d0"/><rect x="53" y="10" width="5" height="14" rx="2" fill="#f0fae1"/><rect x="61" y="14" width="6" height="10" rx="1" fill="#fff"/><rect x="31" y="34" width="7" height="10" rx="1" fill="#ffe1d0"/><path d="M31 37h7"/><rect x="41" y="34" width="7" height="10" rx="1" fill="#ffe1d0"/><path d="M41 37h7"/><rect x="52" y="31" width="11" height="13" fill="#fff"/><path d="M52 35h11"/><path d="M31 50h15l-2 12H33z" fill="#ffe1d0"/><path d="M34 54h9"/><rect x="52" y="53" width="11" height="9" rx="2" fill="#f0fae1"/><path d="M52 56h11"/>',
  artReachIn: '<rect x="18" y="5" width="60" height="61" fill="#fff"/><path d="M18 17h60"/><rect x="23" y="8" width="11" height="7" rx="1" fill="#f0fae1"/><path d="M23 11.5h11"/><rect x="38" y="9" width="10" height="6" rx="1" fill="#ffe1d0"/><path d="M22 25h52"/><path d="M32 25v4M47 25v4M62 25v4"/><path d="M32 29l-6 5v13h12V34z" fill="#ffe1d0"/><path d="M47 29l-6 5v15h12V34z" fill="#fff"/><path d="M62 29l-6 5v11h12V34z" fill="#f0fae1"/><rect x="24" y="57" width="13" height="9" rx="1" fill="#f6efe4"/><rect x="58" y="59" width="14" height="7" rx="2" fill="#ffe1d0"/><path d="M65 59v7"/>',
  artWalkIn: '<rect x="30" y="5" width="38" height="61" fill="#fff"/><path d="M30 5l-14 6v53l14-4z" fill="#ffe1d0"/><path d="M20 34v4"/><path d="M36 20h26M36 34h26M36 48h26"/><rect x="39" y="13" width="9" height="7" rx="1" fill="#f0fae1"/><rect x="51" y="14" width="8" height="6" rx="1" fill="#fff"/><rect x="39" y="27" width="8" height="7" rx="1" fill="#ffe1d0"/><rect x="50" y="28" width="9" height="6" rx="1" fill="#f0fae1"/><path d="M40 55h14l-2 8H42z" fill="#ffe1d0"/>',
  artLShape: '<rect x="10" y="14" width="30" height="50" fill="#fff"/><path d="M10 30h30M10 47h30"/><path d="M40 14l42 8v42l-42-6z" fill="#f6efe4"/><path d="M40 30l42 7M40 47l42 6"/><rect x="15" y="20" width="9" height="8" rx="1" fill="#f0fae1"/><rect x="27" y="21" width="8" height="7" rx="1" fill="#ffe1d0"/><rect x="15" y="37" width="8" height="8" rx="1" fill="#ffe1d0"/><path d="M15 56h12l-1.5 6H16.5z" fill="#f0fae1"/><path d="M48 26l8 1.5v6l-8-1.4z" fill="#f0fae1"/><path d="M62 36l9 1.6v6l-9-1.5z" fill="#ffe1d0"/>',
  artCounter: '<rect x="14" y="5" width="68" height="18" rx="2" fill="#fff"/><path d="M37 5v18M60 5v18"/><circle cx="33" cy="14" r="1.2" fill="#9a5b2e"/><circle cx="41" cy="14" r="1.2" fill="#9a5b2e"/><circle cx="56" cy="14" r="1.2" fill="#9a5b2e"/><circle cx="64" cy="14" r="1.2" fill="#9a5b2e"/><rect x="10" y="33" width="76" height="5" rx="2" fill="#f6efe4"/><rect x="14" y="38" width="68" height="26" rx="2" fill="#fff"/><path d="M37 38v26M60 38v26"/><circle cx="33" cy="50" r="1.2" fill="#9a5b2e"/><circle cx="41" cy="50" r="1.2" fill="#9a5b2e"/><circle cx="56" cy="50" r="1.2" fill="#9a5b2e"/><circle cx="64" cy="50" r="1.2" fill="#9a5b2e"/><rect x="43" y="26" width="10" height="7" rx="2" fill="#ffe1d0"/>',
  artOpenShelf: '<rect x="16" y="20" width="64" height="3.5" fill="#f6efe4"/><rect x="16" y="44" width="64" height="3.5" fill="#f6efe4"/><rect x="22" y="12" width="15" height="8" rx="2" fill="#fff"/><path d="M22 16h15"/><rect x="43" y="9" width="8" height="11" rx="2" fill="#f0fae1"/><rect x="57" y="12" width="9" height="8" rx="2" fill="#ffe1d0"/><path d="M66 14c3 0 3 4 0 4"/><rect x="24" y="38" width="13" height="6" rx="2" fill="#f0fae1"/><rect x="45" y="33" width="8" height="11" rx="1.5" fill="#ffe1d0"/><path d="M45 37h8"/><rect x="58" y="36" width="8" height="8" rx="1.5" fill="#fff"/>',
  artInCounter: '<rect x="12" y="6" width="72" height="5" rx="2" fill="#f6efe4"/><rect x="24" y="11" width="48" height="53" rx="2" fill="#fff"/><rect x="18" y="15" width="60" height="13" rx="2" fill="#fff"/><path d="M32 15v13M46 15v13M60 15v13"/><path d="M25 21.5h1M39 21.5h1M53 21.5h1M67 21.5h1"/><rect x="30" y="33" width="36" height="11" rx="2"/><path d="M41 38.5h14"/><rect x="30" y="49" width="36" height="11" rx="2"/><path d="M41 54.5h14"/>',
  artTower: '<rect x="32" y="5" width="32" height="59" rx="3" fill="#fff"/><rect x="36" y="9" width="24" height="10" rx="1.5"/><path d="M44 14h8"/><rect x="36" y="22" width="24" height="10" rx="1.5"/><path d="M44 27h8"/><rect x="36" y="35" width="24" height="10" rx="1.5"/><path d="M44 40h8"/><rect x="36" y="48" width="24" height="10" rx="1.5"/><path d="M44 53h8"/><path d="M36 64v4M60 64v4"/>',
  artSideboard: '<rect x="12" y="24" width="72" height="28" rx="3" fill="#fff"/><path d="M12 38h72"/><rect x="17" y="28" width="30" height="7" rx="1.5"/><path d="M28 31.5h8"/><rect x="49" y="28" width="30" height="7" rx="1.5"/><path d="M60 31.5h8"/><path d="M48 38v14"/><circle cx="44" cy="45" r="1.3" fill="#9a5b2e"/><circle cx="52" cy="45" r="1.3" fill="#9a5b2e"/><path d="M18 52l-2 10M78 52l2 10M34 52v10M62 52v10"/><rect x="40" y="12" width="7" height="12" rx="3" fill="#f0fae1"/><path d="M43.5 12v-5M43.5 9c-3-2-5-1-6 1M43.5 9c3-2 5-1 6 1"/>',
  artWardrobe: '<rect x="24" y="5" width="50" height="59" rx="3" fill="#fff"/><path d="M24 5l-11 5v51l11-3z" fill="#ffe1d0"/><path d="M17 32v5"/><path d="M58 5v59"/><path d="M28 16h26"/><path d="M35 16v4M47 16v4"/><path d="M35 20l-5 4v11h10V24z" fill="#f0fae1"/><path d="M47 20l-5 4v13h10V24z" fill="#fff"/><path d="M58 22h16M58 40h16"/><rect x="61" y="15" width="10" height="7" rx="1" fill="#ffe1d0"/><rect x="61" y="33" width="10" height="7" rx="1" fill="#f0fae1"/><rect x="61" y="52" width="10" height="7" rx="1" fill="#fff"/><path d="M28 64v4M70 64v4"/>',
  artDresser: '<rect x="16" y="16" width="64" height="42" rx="3" fill="#fff"/><rect x="21" y="21" width="54" height="9" rx="1.5"/><path d="M42 25.5h12"/><rect x="21" y="33" width="54" height="9" rx="1.5"/><path d="M42 37.5h12"/><rect x="21" y="45" width="54" height="9" rx="1.5"/><path d="M42 49.5h12"/><path d="M22 58v6M74 58v6"/><rect x="36" y="11" width="24" height="3.5" rx="1.5" fill="#f0fae1"/><path d="M66 16v-5"/><circle cx="66" cy="8" r="3" fill="#f0fae1"/>',
  artUnderbed: '<rect x="12" y="16" width="72" height="15" rx="4" fill="#fff"/><rect x="16" y="19" width="13" height="9" rx="3" fill="#f0fae1"/><path d="M34 16v15"/><path d="M12 31h72"/><rect x="16" y="35" width="30" height="13" rx="2" fill="#ffe1d0"/><path d="M27 41.5h8"/><rect x="50" y="35" width="30" height="13" rx="2" fill="#ffe1d0"/><path d="M61 41.5h8"/><path d="M14 48v6M82 48v6M8 60h80"/>',
  artVanity: '<rect x="34" y="4" width="28" height="17" rx="8" fill="#f0fae1"/><path d="M44 25h8M48 21v4"/><rect x="22" y="29" width="52" height="5" rx="2" fill="#f6efe4"/><rect x="26" y="34" width="44" height="26" rx="2" fill="#fff"/><path d="M48 34v26"/><circle cx="44" cy="47" r="1.3" fill="#9a5b2e"/><circle cx="52" cy="47" r="1.3" fill="#9a5b2e"/><path d="M30 60v4M66 60v4"/><rect x="25" y="21" width="5" height="8" rx="1.5" fill="#ffe1d0"/><rect x="66" y="23" width="5" height="6" rx="1.5" fill="#f0fae1"/>',
  artVanityDr: '<rect x="30" y="4" width="24" height="15" rx="7" fill="#f0fae1"/><path d="M40 23h6M43 19v4"/><rect x="18" y="27" width="60" height="5" rx="2" fill="#f6efe4"/><rect x="22" y="32" width="52" height="28" rx="2" fill="#fff"/><path d="M54 32v28"/><circle cx="49" cy="46" r="1.3" fill="#9a5b2e"/><rect x="57" y="35" width="14" height="6" rx="1"/><path d="M62 38h4"/><rect x="57" y="44" width="14" height="6" rx="1"/><path d="M62 47h4"/><rect x="57" y="53" width="14" height="6" rx="1"/><path d="M62 56h4"/><path d="M26 60v4M70 60v4"/>',
  artLinen: '<rect x="26" y="5" width="44" height="61" rx="3" fill="#fff"/><path d="M26 23h44M26 40h44M26 56h44"/><rect x="31" y="9" width="14" height="4" rx="1" fill="#ffe1d0"/><rect x="31" y="14" width="14" height="4" rx="1" fill="#fff"/><rect x="31" y="19" width="14" height="4" rx="1" fill="#f0fae1"/><rect x="51" y="12" width="12" height="5" rx="1" fill="#f0fae1"/><rect x="51" y="18" width="12" height="5" rx="1" fill="#fff"/><circle cx="37" cy="33" r="5" fill="#ffe1d0"/><path d="M37 33a2.5 2.5 0 0 1 5 0"/><circle cx="49" cy="33" r="5" fill="#f0fae1"/><path d="M49 33a2.5 2.5 0 0 1 5 0"/><rect x="57" y="28" width="9" height="10" rx="1.5" fill="#fff"/><path d="M31 45h15l-2 9H33z" fill="#ffe1d0"/><path d="M34 48h9"/><rect x="52" y="46" width="12" height="8" rx="1" fill="#f0fae1"/>',
  artGarageShelf: '<path d="M20 6v60M76 6v60"/><rect x="17" y="19" width="62" height="3" fill="#f6efe4"/><rect x="17" y="37" width="62" height="3" fill="#f6efe4"/><rect x="17" y="55" width="62" height="3" fill="#f6efe4"/><rect x="24" y="9" width="13" height="10" rx="1" fill="#ffe1d0"/><path d="M28 13h5"/><rect x="41" y="9" width="13" height="10" rx="1" fill="#f0fae1"/><path d="M45 13h5"/><rect x="58" y="9" width="12" height="10" rx="1" fill="#fff"/><path d="M64 9v10"/><rect x="24" y="27" width="15" height="10" rx="1" fill="#fff"/><path d="M31.5 27v10"/><rect x="44" y="27" width="13" height="10" rx="1" fill="#f0fae1"/><path d="M48 31h5"/><circle cx="68" cy="32" r="5" fill="#ffe1d0"/><path d="M63 32a5 5 0 0 0 10 0"/><rect x="24" y="45" width="11" height="10" rx="2" fill="#fff"/><rect x="40" y="45" width="12" height="10" fill="#f0fae1"/><path d="M40 45a6 5 0 0 1 12 0"/><rect x="57" y="47" width="15" height="8" rx="1" fill="#ffe1d0"/><path d="M60 47a4.5 3.5 0 0 1 9 0"/>',
  artWallCab: '<rect x="12" y="8" width="34" height="21" rx="2" fill="#fff"/><path d="M29 8v21"/><circle cx="25" cy="19" r="1.2" fill="#9a5b2e"/><circle cx="33" cy="19" r="1.2" fill="#9a5b2e"/><rect x="50" y="8" width="34" height="21" rx="2" fill="#fff"/><path d="M67 8v21"/><circle cx="63" cy="19" r="1.2" fill="#9a5b2e"/><circle cx="71" cy="19" r="1.2" fill="#9a5b2e"/><path d="M10 66h76"/><rect x="62" y="58" width="16" height="8" rx="1" fill="#f6efe4"/><path d="M18 40v16"/><path d="M14 62l4-6 4 6z" fill="#ffe1d0"/>',
  artOverhead: '<path d="M8 6h80"/><path d="M22 6v18M74 6v18"/><rect x="16" y="24" width="64" height="4" fill="#f6efe4"/><rect x="26" y="12" width="14" height="12" rx="1" fill="#ffe1d0"/><rect x="44" y="14" width="12" height="10" rx="1" fill="#f0fae1"/><rect x="60" y="12" width="12" height="12" rx="1" fill="#fff"/><path d="M66 12v12"/><rect x="30" y="52" width="36" height="10" rx="5" fill="#f0fae1"/><circle cx="39" cy="63" r="3.5" fill="#fff"/><circle cx="57" cy="63" r="3.5" fill="#fff"/>',
  artWorkbench: '<rect x="16" y="5" width="64" height="21" rx="2" fill="#fff"/><path d="M28 9v9"/><rect x="24" y="7" width="8" height="4" rx="1" fill="#ffe1d0"/><path d="M46 9v10"/><circle cx="46" cy="9" r="3" fill="#f0fae1"/><path d="M64 8v8"/><rect x="62" y="16" width="4" height="7" rx="1.5" fill="#f0fae1"/><rect x="12" y="32" width="72" height="5" rx="2" fill="#f6efe4"/><path d="M18 37v29M78 37v29"/><path d="M18 52h60"/><rect x="30" y="44" width="15" height="8" rx="1" fill="#ffe1d0"/><path d="M34 48h7"/><rect x="52" y="45" width="12" height="7" rx="1" fill="#fff"/>',
  artToolChest: '<path d="M36 10v-3h24v3"/><rect x="28" y="10" width="40" height="46" rx="3" fill="#ffe1d0"/><rect x="33" y="15" width="30" height="9" rx="1"/><path d="M43 19.5h10"/><rect x="33" y="27" width="30" height="9" rx="1"/><path d="M43 31.5h10"/><rect x="33" y="39" width="30" height="9" rx="1"/><path d="M43 43.5h10"/><circle cx="35" cy="60" r="4" fill="#fff"/><circle cx="61" cy="60" r="4" fill="#fff"/>',
};

const artCache = {};
export function art(key) {
  if (!artCache[key]) {
    artCache[key] = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" fill="none" stroke="#9a5b2e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + (ART[key] || '') + '</svg>');
  }
  return artCache[key];
}
