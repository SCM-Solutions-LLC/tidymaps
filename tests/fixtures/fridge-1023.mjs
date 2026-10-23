/* The first real fridge analysis (2026-10-23): a French door with a bottom
   freezer, twelve rows in four sections, as analyze-space returned it before
   the client added the ticked categories. Raw API shape (level, task, why).
   Its two door rows carry wall:left/right and its freezer rows are drawers,
   which is what the report and the 3D view both got wrong. Shared by the unit
   tests and the e2e specs so they read one plan. */
const row = (level, icon, zone, why, surface, items, extra = {}) => ({
  level, icon, zone, why, eye: false, surface, safety: { flag: null, why: null },
  items: items.map(([name, size = 'm']) => ({ name, size, flags: [] })), ...extra,
});
const map = [
  row('Top shelf', 'arrowUp', 'Dairy · Spreads · Bread', 'Easy to see, and keeps daily staples together.', 'shelf', [['Greek yogurt'], ['Peanut butter'], ['Bread'], ['Boxed items', 'l']]),
  row('Middle shelf', 'eye', 'Leftovers bin · Ready to eat', 'Eye level means leftovers get seen and eaten first.', 'shelf', [['Takeout containers'], ['Sauce cups', 's'], ['Bagged leftovers']], { eye: true }),
  row('Lower shelf', 'alignCenter', 'Drinks · Eggs', 'Cans and cartons stay together and out of the way.', 'shelf', [['Modelo cans'], ['Sparkling water box', 'l'], ['Egg bin'], ['Wine rack bottles']]),
  row('Left crisper drawer', 'archive', 'Vegetables · Potatoes', 'Humidity control keeps veg fresh longer.', 'drawer', [['Potatoes'], ['Carrots']]),
  row('Right crisper drawer', 'archive', 'Fruit · Salad greens', 'Mostly empty, so it can hold the produce now hiding elsewhere.', 'drawer', []),
  row('Bottom deli drawer', 'archive', 'Raw meat & fish (tray)', 'Coldest and lowest spot, so drips never reach food below.', 'drawer', []),
  row('Left door', 'door', 'Coffee creamers · Hot sauces', 'Door shelves suit items that tolerate warmth swings.', 'door', [['Creamers'], ['Hot sauces', 's'], ['Pickled peppers', 's']], { wall: 'left', tier: 0 }),
  row('Right door', 'door', 'Butter · Jars · Ketchup', 'Everyday sauces and spreads stay within easy reach.', 'door', [['Butter'], ['Salsa jars'], ['Beer bottles']], { wall: 'right', tier: 0 }),
  row('Freezer: top basket', 'arrowUp', 'Frozen meals', 'Boxed meals stand upright so labels show.', 'drawer', [['Steamer meals'], ['Soup containers']]),
  row('Freezer: middle basket', 'alignCenter', 'Raw meat · Bones', 'Meat stays together in one bin, away from ready foods.', 'drawer', [['Chicken pack', 'l'], ['Bone tray']]),
  row('Freezer: back and side', 'arrowDown', 'Frozen veg · Fruit · Gnocchi', 'Bagged items sorted in one bin stop the mystery pile.', 'drawer', [['Frozen berries'], ['Gnocchi bags']]),
  row('Ice bin', 'archive', 'Ice only', 'Keep it clear so ice stays clean.', 'drawer', [['Ice', 'l']]),
].map((r, i) => ({ ...r, shelfIndex: i }));
const step = (task, time, why, rows) => ({ task, time, why, rows });
export const PLAN = {
  spaceType: 'French door fridge with bottom freezer',
  summary: 'A packed French door fridge and freezer where leftovers, produce and frozen food all lack clear zones.',
  categories: ['Leftovers', 'Fresh produce', 'Dairy & eggs', 'Drinks', 'Frozen meals'],
  problems: ['Leftovers get lost behind drinks'], opportunities: ['The right crisper is nearly empty'],
  map,
  geometry: { unit: 'in', width: 36, height: 69, depth: 18, shelfCount: 12, shelfYFracs: map.map((_, i) => 0.0767 * (i + 1)), estimated: false },
  layout: { type: 'fridge', sections: [
    { id: 'fresh', rows: [0, 1, 2], label: 'Fridge shelves', place: 'upper' },
    { id: 'drawers', rows: [3, 4, 5], label: 'Drawers', place: 'lower' },
    { id: 'doors', rows: [6, 7], label: 'Doors', place: 'wall' },
    { id: 'freezer', rows: [8, 9, 10, 11], label: 'Freezer', place: 'floor' },
  ] },
  safetyNotes: [],
  productNeeds: [
    { qty: 2, type: 'clear-bin', maxDims: { d_in: 14, h_in: 5, w_in: 12 }, purpose: 'Leftovers bin and sauce cup corral', priority: 'high', targetZone: 'Middle shelf' },
    { qty: 3, type: 'clear-bin', maxDims: { d_in: 13, h_in: 6, w_in: 10 }, purpose: 'Freezer bins for meat, veg and meals', priority: 'high', targetZone: 'Freezer: middle basket' },
    { qty: 1, type: 'drawer-organizer', maxDims: { d_in: 14, h_in: 3, w_in: 12 }, purpose: 'Tray to contain raw meat', priority: 'high', targetZone: 'Bottom deli drawer' },
    { qty: 1, type: 'label-set', maxDims: null, purpose: 'Date and name freezer and leftover items', priority: 'nice', targetZone: 'Middle shelf' },
  ],
  steps: [
    step('Empty the fridge onto the shelf', '10 min', 'A full view shows what you really have.', [0, 1, 2]),
    step('Toss expired food and old leftovers', '10 min', 'Frees space and removes hidden spoilage.', [1, 2]),
    step('Wipe shelves, drawers and door bins', '10 min', 'A clean start keeps it easy to maintain.', [0, 1, 2, 3]),
    step('Set a clear leftovers bin at eye level', '5 min', 'Leftovers stay in sight and get eaten.', [1]),
    step('Move produce into the crisper drawers', '10 min', 'Drawer humidity slows spoilage.', [3, 4]),
    step('Put raw meat in a tray below', '5 min', 'Lowest spot prevents drips onto food.', [5]),
    step('Group dairy, bread and spreads on top shelf', '5 min', 'Daily staples sit together.', [0]),
    step('Sort condiments by use into door shelves', '10 min', 'Door bins hold sauces and jars neatly.', [6, 7]),
    step('Empty the freezer and toss freezer-burned food', '15 min', 'Reveals the mystery pile and frees space.', [8, 9, 10]),
    step('Sort freezer into bins: meat, veg, meals', '15 min', 'Each food type has one home.', [8, 9, 10]),
    step('Label bins and date every leftover', '10 min', 'Dates show what to eat first.', [1, 9]),
    step('Do a weekly five-minute fridge check', '5 min', 'Small checks keep the system working.', [1]),
  ],
  time: '2 hrs', cost: '$40',
};
/* The eight categories the owner ticked on the contents step. */
export const TICKED = ['Leftovers', 'Fresh produce', 'Dairy & eggs', 'Condiments & sauces', 'Drinks', 'Raw meat & fish', 'Frozen meals', 'Frozen vegetables & fruit'];

/* The same rows in the client's shape (plan.js normalizeAi): lv for level. */
export const MAP_1023 = PLAN.map.map(({ level, icon, ...row }) => ({ ...row, lv: level, ic: icon }));
export const LAYOUT_1023 = PLAN.layout;
