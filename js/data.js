import { SVG } from './icons.js';

export const SPACES = [
  {id:'pantry',ico:SVG.pantry,ttl:'Pantry',rec:true},
  {id:'cabinet',ico:SVG.cabinet,ttl:'Kitchen cabinet'},
  {id:'drawers',ico:SVG.drawers,ttl:'Kitchen drawers'},
  {id:'junk',ico:SVG.junk,ttl:'Junk drawer'},
  {id:'closet',ico:SVG.closet,ttl:'Closet'},
  {id:'linen',ico:SVG.linen,ttl:'Linen closet'},
  {id:'bathroom',ico:SVG.bath,ttl:'Bathroom vanity'},
  {id:'fridge',ico:SVG.fridge,ttl:'Fridge &amp; freezer'},
  {id:'garage',ico:SVG.garage,ttl:'Garage shelf'},
  {id:'attic',ico:SVG.attic,ttl:'Attic / storage area'},
  {id:'laundry',ico:SVG.laundry,ttl:'Laundry room'},
  {id:'kids',ico:SVG.kids,ttl:'Kids’ storage'},
  {id:'other',ico:SVG.other,ttl:'Other'}
];
export const GOALS = [
  ['find','Make items easier to find'],
  ['clutter','Reduce visual clutter'],
  ['own','Use only what I already own'],
  ['capacity','Maximize storage capacity'],
  ['kid','Make it kid-friendly'],
  ['minimal','Create a minimal look'],
  ['shop','Prepare for storage product recommendations'],
  ['unsure','I’m not sure — suggest the best plan']
];
export const CAPTURE = [
  {id:'photos',ico:SVG.camera,ttl:'Upload photos',sub:'Best for most spaces — 3 to 5 photos'},
  {id:'video',ico:SVG.video,ttl:'Record or upload a short video',sub:'We extract key frames automatically'},
  {id:'demo',ico:SVG.sparkles,ttl:'Use demo example',sub:'See a finished plan with sample data'}
];
export const DETAIL_TOGGLES = [
  ['drill','Can you drill or install hardware?'],
  ['rental','Is this a rental?'],
  ['kids','Will kids access this space?'],
  ['heavy','Are there heavy items?'],
  ['hidden','Any items that must stay hidden?'],
  ['daily','Any items used daily?'],
  ['rarely','Any items used rarely?']
];
export const PREFS = [
  'Use only what I already own','Open to buying storage','Keep frequent items easy to reach',
  'Hide visual clutter','Kid-friendly access','No drilling or permanent installation',
  'Minimal look','Labels and categories','Maximize vertical space',
  'Make heavy items safer','Use clear containers','Use baskets / hidden storage','Easy to maintain'
];
export const BUDGETS = ['$0','Under $50','Under $100','Under $250','No budget selected'];
export const EFFORT = [
  ['Quick 30-minute reset','A fast tidy of the worst spots'],
  ['1-hour cleanup','Reset and regroup the main shelves'],
  ['Weekend project','Empty, sort, and rebuild the system'],
  ['Full reorganization','Every item gets a dedicated home']
];

/* Demo / mock AI output */
export const DEMO_FEATURES = [
  {ico:SVG.layers,ttl:'5 shelves',sub:'Top shelf is hard to reach'},
  {ico:SVG.shoppingBag,ttl:'2 baskets',sub:'Currently underused'},
  {ico:SVG.archive,ttl:'1 deep bin',sub:'Good for overflow'},
  {ico:SVG.arrowsH,ttl:'Open shelf space on the right',sub:'Unused'},
  {ico:SVG.arrowsV,ttl:'Unused vertical space',sub:'Above the cans'},
  {ico:SVG.arrowDown,ttl:'Lower shelf',sub:'Can hold heavier items'},
  {ico:SVG.xCircle,ttl:'No visible hooks',sub:'Detected'},
  {ico:SVG.door,ttl:'No door rack',sub:'Detected'}
];
export const DEMO_CATS = ['Snacks','Canned goods','Pasta & grains','Baking supplies','Spices & sauces','Breakfast items','Paper goods','Bulk overflow','Kids’ snacks','Loose packets','Duplicate items','Possible expired items'];

export const MAP = [
  {lv:'Top shelf',ic:SVG.arrowUp,zone:'Bulk overflow · Backup paper goods · Rarely used items',why:'These items are used less often and do not need to be easy to reach.',
    shelfIndex:0,safety:{flag:'keep-high',why:'Rarely used bulk stays out of the way of daily traffic.'},
    items:[{name:'Bulk overflow',size:'l',flags:['heavy']},{name:'Paper goods',size:'l',flags:[]},{name:'Rarely used',size:'m',flags:[]}]},
  {lv:'Eye level',ic:SVG.eye,eye:true,zone:'Daily snacks · Breakfast items · Coffee or tea',why:'Frequently used items should be visible and easy to access.',
    shelfIndex:1,safety:{flag:null,why:null},
    items:[{name:'Daily snacks',size:'m',flags:['kid-frequent']},{name:'Breakfast',size:'m',flags:[]},{name:'Coffee & tea',size:'s',flags:[]}]},
  {lv:'Middle shelf',ic:SVG.alignCenter,zone:'Canned goods · Pasta · Grains · Dinner ingredients',why:'Meal-building items should be grouped together to reduce searching.',
    shelfIndex:2,safety:{flag:null,why:null},
    items:[{name:'Canned goods',size:'m',flags:['heavy']},{name:'Pasta & grains',size:'m',flags:[]},{name:'Dinner ingredients',size:'m',flags:[]}]},
  {lv:'Lower shelf',ic:SVG.arrowDown,zone:'Heavy items · Kid-friendly snacks · Large containers',why:'Heavy items are safer lower down, and kid snacks stay within reach.',
    shelfIndex:3,safety:{flag:'kid-safe',why:'Kid snacks stay reachable without climbing; heavy items cannot fall far.'},
    items:[{name:'Heavy items',size:'l',flags:['heavy']},{name:'Kid snacks',size:'s',flags:['kid-frequent']},{name:'Large containers',size:'l',flags:[]}]},
  {lv:'Door / side',ic:SVG.panelRight,zone:'Spices · Sauces · Small packets',why:'Small items are easier to manage in narrow zones or small organizers.',
    shelfIndex:4,safety:{flag:null,why:null},
    items:[{name:'Spices',size:'s',flags:[]},{name:'Sauces',size:'s',flags:['fragile']},{name:'Small packets',size:'s',flags:[]}]}
];
export const DEMO_GEOMETRY = {unit:'in',width:30,height:60,depth:14,shelfCount:5,shelfYFracs:[0.08,0.30,0.52,0.72,0.90],estimated:true};
export const DEMO_SAFETY_NOTES = [
  'Kid snacks live on the lower shelf so small hands can reach them without climbing.',
  'Heavy jars and cans stay at waist height or below, so nothing heavy can fall from above.'
];
export const DEMO_PRODUCT_NEEDS = [
  {type:'clear-bin',qty:4,purpose:'Corral loose snack packets so they stay visible',targetZone:'Eye level',maxDims:{w_in:10.5,h_in:8,d_in:14},priority:'high'},
  {type:'can-riser',qty:1,purpose:'See every can without digging',targetZone:'Middle shelf',maxDims:{w_in:18,h_in:14,d_in:14},priority:'high'},
  {type:'turntable',qty:1,purpose:'Reach sauces at the back of the deep shelf',targetZone:'Middle shelf',maxDims:{w_in:13,h_in:6,d_in:13},priority:'nice'},
  {type:'shelf-riser',qty:1,purpose:'Turn unused vertical space into a second level',targetZone:'Top shelf',maxDims:{w_in:14,h_in:9,d_in:14},priority:'nice'},
  {type:'airtight-container',qty:2,purpose:'Keep flour and sugar fresh and stackable',targetZone:'Middle shelf',maxDims:{w_in:6.5,h_in:13,d_in:14},priority:'nice'},
  {type:'label-set',qty:1,purpose:'Make the zones easy for the whole household to keep',targetZone:'Every zone',maxDims:null,priority:'nice'}
];
export const EXISTING = [
  {ico:SVG.shoppingBag,ft:'Reuse: 2 baskets',fd:'Use these for snacks and breakfast items.'},
  {ico:SVG.archive,ft:'Reuse: deep bin',fd:'Use for overflow and backup items.'},
  {ico:SVG.arrowsH,ft:'Right-side open space',fd:'Assign to daily-use items.'},
  {ico:SVG.arrowsV,ft:'Unused vertical space',fd:'Stack cans by type to reclaim height.'},
  {ico:SVG.arrowDownCircle,ft:'Lower shelf',fd:'Move heavy items here for stability.'},
  {ico:SVG.minusCircle,ft:'Keep one zone empty',fd:'Leave room near the front for daily access.'}
];
export const STEPS = [
  {t:'Remove expired or duplicate items first',m:'10 min',w:'This creates space before reorganizing anything.'},
  {t:'Pull similar items into groups',m:'15 min',w:'Similar items need to live together so the system is easy to maintain.'},
  {t:'Separate daily-use items from rarely used items',m:'10 min',w:'Daily-use items should be easier to reach.'},
  {t:'Move bulk and backup items to the top shelf',m:'10 min',w:'These items do not need prime shelf space.'},
  {t:'Put heavy items on the lowest shelf',m:'5 min',w:'This is safer and more stable.'},
  {t:'Use existing baskets for snacks and breakfast items',m:'10 min',w:'Loose packets create clutter unless they have a clear home.'},
  {t:'Assign a clear zone to every category',m:'15 min',w:'The system only works if every item has a home.'},
  {t:'Add labels if available',m:'10 min',w:'Labels make the system easier to maintain.'},
  {t:'Take a final photo',m:'2 min',w:'This helps track progress and compare before / after.'}
];
/* Purchase suggestions now come from productNeeds (AI or demo) matched
   against the curated catalog in data/catalog.json — see js/catalog.js. */
export const AFTER_MODES = ['Use existing containers','Minimal look','More bins','More labels','Kid-friendly setup','Hidden storage'];
export const CUSTOMIZE = [
  ['minimal','Make it more minimal','Fewer visible items, more hidden storage, calmer shelves.'],
  ['budget','Make it more budget-friendly','Drops to the $0 plan using only what you own.'],
  ['own','Use only what I already own','Removes all product recommendations.'],
  ['kid','Make it more kid-friendly','Moves snacks lower and adds clear, reachable zones.'],
  ['capacity','Maximize storage capacity','Adds risers and stacking to reclaim vertical space.'],
  ['hide','Hide more clutter','Shifts loose items into bins and baskets.'],
  ['labels','Add more labels','Every zone gets a labelled home.'],
  ['fewer','Reduce the number of steps','Condenses the plan into a quick 5-step reset.'],
  ['faster','Make it faster','Targets a 30-minute version of the plan.'],
  ['addprod','Add storage product recommendations','Turns on the optional upgrade plan.'],
  ['rmprod','Remove storage product recommendations','Turns off the optional upgrade plan.']
];
export const SAVE_OPTS = [
  [SVG.bookmark,'Save plan'],
  [SVG.download,'Download checklist'],
  [SVG.send,'Send shopping list'],
  [SVG.refreshCw,'Start another space'],
  [SVG.columns,'Compare before &amp; after'],
  [SVG.calendar,'Schedule a session'],
  [SVG.users,'Share with family / roommate']
];
export const FB_USEFUL = ['Not useful','Somewhat useful','Very useful','I would pay for this'];
export const FB_VS = ['Yes, I want instructions','I mostly want the final image','I want both','I’m not sure'];
export const FB_NEXT = ['Pantry','Closet','Garage','Attic','Kitchen cabinets','Laundry room','Kids’ room','Bathroom storage','Other'];

export const LOAD_LABELS = [
  'Reviewing uploaded photos or video','Extracting key frames','Detecting visible item categories',
  'Understanding existing space features','Finding unused vertical and shelf space','Grouping similar items',
  'Creating organization zones','Building your move-by-move plan','Preparing optional upgrades'
];

export const AFTER_PALETTE=['oklch(0.70 0.09 90)','oklch(0.74 0.11 70)','oklch(0.64 0.08 150)','oklch(0.62 0.09 235)','oklch(0.66 0.10 300)','oklch(0.68 0.11 110)'];
