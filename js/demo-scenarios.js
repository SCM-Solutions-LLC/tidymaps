/* ============================================================
   Demo scenarios — space-specific sample data for every space type.

   getDemoScenario(spaceType, goal, household) returns a raw plan
   object ready to pass through normalizeAi() in js/plan.js.
   ============================================================ */

/* ---------- Base scenarios keyed by space id ---------- */

function pantryScenario() {
  return {
    spaceType: 'Pantry',
    summary: 'A standard five-shelf pantry with a mix of snacks, canned goods, baking supplies, and breakfast items. Two baskets are underused and one deep bin sits near the bottom. The right side of the middle shelf is open, and several inches of vertical space above the cans is wasted. A few expired items and duplicate purchases are visible.',
    categories: ['Snacks', 'Canned goods', 'Pasta & grains', 'Baking supplies', 'Spices & sauces', 'Breakfast items', 'Paper goods', 'Bulk overflow', 'Kids’ snacks', 'Loose packets'],
    features: [
      {icon: 'layers', title: '5 shelves', sub: 'Top shelf is hard to reach'},
      {icon: 'basket', title: '2 baskets', sub: 'Currently underused'},
      {icon: 'bin', title: '1 deep bin', sub: 'Good for overflow'},
      {icon: 'horizontal', title: 'Open shelf space on the right', sub: 'Unused'},
      {icon: 'vertical', title: 'Unused vertical space', sub: 'Above the cans'},
      {icon: 'down', title: 'Lower shelf', sub: 'Can hold heavier items'},
      {icon: 'x', title: 'No visible hooks', sub: 'Detected'},
      {icon: 'door', title: 'No door rack', sub: 'Detected'}
    ],
    problems: [
      'Loose snack packets fall over and mix with other categories',
      'Cans are stacked two-deep so back items are invisible',
      'Bulk purchases block access to daily-use items',
      'Several duplicates suggest items were bought because existing ones were hidden',
      'At least three expired items visible in the back row'
    ],
    opportunities: [
      'Two baskets can corral loose packets immediately',
      'A can riser would make every can visible at a glance',
      'Moving bulk overflow to the top shelf frees prime real estate',
      'Grouping by meal type (breakfast, dinner, snacks) speeds daily access',
      'Vertical space above cans can hold a shelf riser'
    ],
    map: [
      {level: 'Top shelf', icon: 'up', zone: 'Bulk overflow · Backup paper goods · Rarely used items',
        why: 'These items are used less often and do not need to be easy to reach.',
        eye: false, shelfIndex: 0,
        safety: {flag: 'keep-high', why: 'Rarely used bulk stays out of the way of daily traffic.'},
        items: [{name: 'Bulk overflow', size: 'l', flags: ['heavy']}, {name: 'Paper goods', size: 'l', flags: []}, {name: 'Rarely used', size: 'm', flags: []}]},
      {level: 'Eye level', icon: 'eye', zone: 'Daily snacks · Breakfast items · Coffee or tea',
        why: 'Frequently used items should be visible and easy to access.',
        eye: true, shelfIndex: 1,
        safety: {flag: null, why: null},
        items: [{name: 'Daily snacks', size: 'm', flags: ['kid-frequent']}, {name: 'Breakfast', size: 'm', flags: []}, {name: 'Coffee & tea', size: 's', flags: []}]},
      {level: 'Middle shelf', icon: 'middle', zone: 'Canned goods · Pasta · Grains · Dinner ingredients',
        why: 'Meal-building items should be grouped together to reduce searching.',
        eye: false, shelfIndex: 2,
        safety: {flag: null, why: null},
        items: [{name: 'Canned goods', size: 'm', flags: ['heavy']}, {name: 'Pasta & grains', size: 'm', flags: []}, {name: 'Dinner ingredients', size: 'm', flags: []}]},
      {level: 'Lower shelf', icon: 'down', zone: 'Heavy items · Kid-friendly snacks · Large containers',
        why: 'Heavy items are safer lower down, and kid snacks stay within reach.',
        eye: false, shelfIndex: 3,
        safety: {flag: 'kid-safe', why: 'Kid snacks stay reachable without climbing; heavy items cannot fall far.'},
        items: [{name: 'Heavy items', size: 'l', flags: ['heavy']}, {name: 'Kid snacks', size: 's', flags: ['kid-frequent']}, {name: 'Large containers', size: 'l', flags: []}]},
      {level: 'Door / side', icon: 'door', zone: 'Spices · Sauces · Small packets',
        why: 'Small items are easier to manage in narrow zones or small organizers.',
        eye: false, shelfIndex: 4,
        safety: {flag: null, why: null},
        items: [{name: 'Spices', size: 's', flags: []}, {name: 'Sauces', size: 's', flags: ['fragile']}, {name: 'Small packets', size: 's', flags: []}]}
    ],
    geometry: {unit: 'in', width: 30, height: 60, depth: 14, shelfCount: 5, shelfYFracs: [0.08, 0.30, 0.52, 0.72, 0.90], estimated: true},
    safetyNotes: [
      'Kid snacks live on the lower shelf so small hands can reach them without climbing.',
      'Heavy jars and cans stay at waist height or below, so nothing heavy can fall from above.'
    ],
    productNeeds: [
      {type: 'clear-bin', qty: 4, purpose: 'Corral loose snack packets so they stay visible', targetZone: 'Eye level', maxDims: {w_in: 10.5, h_in: 8, d_in: 14}, priority: 'high'},
      {type: 'can-riser', qty: 1, purpose: 'See every can without digging', targetZone: 'Middle shelf', maxDims: {w_in: 18, h_in: 14, d_in: 14}, priority: 'high'},
      {type: 'turntable', qty: 1, purpose: 'Reach sauces at the back of the deep shelf', targetZone: 'Middle shelf', maxDims: {w_in: 13, h_in: 6, d_in: 13}, priority: 'nice'},
      {type: 'shelf-riser', qty: 1, purpose: 'Turn unused vertical space into a second level', targetZone: 'Top shelf', maxDims: {w_in: 14, h_in: 9, d_in: 14}, priority: 'nice'},
      {type: 'airtight-container', qty: 2, purpose: 'Keep flour and sugar fresh and stackable', targetZone: 'Middle shelf', maxDims: {w_in: 6.5, h_in: 13, d_in: 14}, priority: 'nice'},
      {type: 'label-set', qty: 1, purpose: 'Make the zones easy for the whole household to keep', targetZone: 'Every zone', maxDims: null, priority: 'nice'}
    ],
    existingLede: 'You already have two baskets and a deep bin that can do most of the heavy lifting before you buy anything.',
    existing: [
      {icon: 'basket', title: 'Reuse: 2 baskets', detail: 'Use these for snacks and breakfast items.'},
      {icon: 'bin', title: 'Reuse: deep bin', detail: 'Use for overflow and backup items.'},
      {icon: 'horizontal', title: 'Right-side open space', detail: 'Assign to daily-use items.'},
      {icon: 'vertical', title: 'Unused vertical space', detail: 'Stack cans by type to reclaim height.'},
      {icon: 'down', title: 'Lower shelf', detail: 'Move heavy items here for stability.'},
      {icon: 'keep', title: 'Keep one zone empty', detail: 'Leave room near the front for daily access.'}
    ],
    dontBuy: 'Skip the door-mounted spice rack for now — you have enough shelf space and the door may not support the weight.',
    steps: [
      {task: 'Remove expired or duplicate items first', time: '10 min', why: 'This creates space before reorganizing anything.'},
      {task: 'Pull similar items into groups', time: '15 min', why: 'Similar items need to live together so the system is easy to maintain.'},
      {task: 'Separate daily-use items from rarely used items', time: '10 min', why: 'Daily-use items should be easier to reach.'},
      {task: 'Move bulk and backup items to the top shelf', time: '10 min', why: 'These items do not need prime shelf space.'},
      {task: 'Put heavy items on the lowest shelf', time: '5 min', why: 'This is safer and more stable.'},
      {task: 'Use existing baskets for snacks and breakfast items', time: '10 min', why: 'Loose packets create clutter unless they have a clear home.'},
      {task: 'Assign a clear zone to every category', time: '15 min', why: 'The system only works if every item has a home.'},
      {task: 'Add labels if available', time: '10 min', why: 'Labels make the system easier to maintain.'},
      {task: 'Take a final photo', time: '2 min', why: 'This helps track progress and compare before / after.'}
    ],
    time: '45–90 min',
    cost: '$0 / $45–85'
  };
}

function cabinetScenario() {
  return {
    spaceType: 'Kitchen cabinet',
    summary: 'A 30-inch-wide kitchen cabinet with three adjustable shelves. Plates are stacked too high, mugs crowd the front blocking access to glasses behind them, and baking sheets lean at odd angles taking up floor space. A lazy-susan cutout sits empty in the corner. Food storage containers and their lids are mismatched across two shelves.',
    categories: ['Plates', 'Bowls', 'Mugs', 'Glasses', 'Cookware', 'Baking sheets', 'Food storage containers', 'Lids', 'Serving dishes'],
    features: [
      {icon: 'layers', title: '3 adjustable shelves', sub: 'Shelf heights can be changed'},
      {icon: 'horizontal', title: 'Lazy-susan space in corner', sub: 'Currently empty'},
      {icon: 'vertical', title: 'Vertical divider slots', sub: 'Built into the shelf frame'},
      {icon: 'down', title: 'Pull-out potential', sub: 'Lower shelf tracks are present'},
      {icon: 'door', title: 'Inside-door surface', sub: 'Could hold hooks or a small rack'}
    ],
    problems: [
      'Plates stacked 12+ high risk chipping and are hard to grab from the bottom',
      'Mugs in front block access to glasses behind them',
      'Baking sheets lean against the side wall and slide when the door opens',
      'Food storage containers and lids are scattered across two shelves',
      'The lazy-susan cutout is completely unused'
    ],
    opportunities: [
      'Adjustable shelves let you dial in the exact height each category needs',
      'Vertical dividers can hold baking sheets and cutting boards upright',
      'A small shelf riser would double the mug zone without stacking',
      'Nesting food containers with matched lids saves half the space they currently use',
      'The corner lazy susan is perfect for small items like spice jars or oils'
    ],
    map: [
      {level: 'Top shelf', icon: 'up', zone: 'Serving dishes · Rarely used glassware',
        why: 'Items used only for entertaining stay accessible but out of daily rotation.',
        eye: false, shelfIndex: 0,
        safety: {flag: 'keep-high', why: 'Heavy platters on the top shelf should be lifted with both hands.'},
        items: [{name: 'Serving dishes', size: 'l', flags: ['heavy', 'fragile']}, {name: 'Specialty glasses', size: 'm', flags: ['fragile']}]},
      {level: 'Eye level', icon: 'eye', zone: 'Daily plates · Bowls · Glasses',
        why: 'The dishes you reach for every meal belong at the most accessible height.',
        eye: true, shelfIndex: 1,
        safety: {flag: null, why: null},
        items: [{name: 'Dinner plates', size: 'l', flags: ['heavy']}, {name: 'Bowls', size: 'm', flags: []}, {name: 'Everyday glasses', size: 'm', flags: ['fragile']}]},
      {level: 'Lower shelf', icon: 'down', zone: 'Mugs · Food storage · Baking sheets',
        why: 'Heavier cookware and stackable containers are stable and safe at this height.',
        eye: false, shelfIndex: 2,
        safety: {flag: null, why: null},
        items: [{name: 'Mugs', size: 's', flags: ['kid-frequent']}, {name: 'Food storage', size: 'm', flags: []}, {name: 'Baking sheets', size: 'l', flags: ['heavy']}]}
    ],
    geometry: {unit: 'in', width: 30, height: 36, depth: 12, shelfCount: 3, shelfYFracs: [0.12, 0.50, 0.88], estimated: true},
    safetyNotes: [
      'Keep heavy platters on lower or middle shelves to prevent them from falling when pulled out.',
      'Stack plates no more than 8 high to avoid toppling.'
    ],
    productNeeds: [
      {type: 'shelf-riser', qty: 2, purpose: 'Create a second tier for mugs and bowls without stacking', targetZone: 'Eye level', maxDims: {w_in: 13, h_in: 6, d_in: 11}, priority: 'high'},
      {type: 'drawer-organizer', qty: 1, purpose: 'Corral food storage lids in one visible tray', targetZone: 'Lower shelf', maxDims: {w_in: 12, h_in: 3, d_in: 11}, priority: 'high'},
      {type: 'turntable', qty: 1, purpose: 'Make the corner lazy-susan space useful for oils or spices', targetZone: 'Lower shelf', maxDims: {w_in: 11, h_in: 4, d_in: 11}, priority: 'nice'},
      {type: 'door-rack', qty: 1, purpose: 'Mount a small rack for pot lids or foil and wrap', targetZone: 'Inside door', maxDims: {w_in: 12, h_in: 18, d_in: 3}, priority: 'nice'},
      {type: 'label-set', qty: 1, purpose: 'Label shelf zones so everyone puts things back correctly', targetZone: 'Every zone', maxDims: null, priority: 'nice'}
    ],
    existingLede: 'The adjustable shelves and built-in vertical slots give you a head start — no purchases needed to start.',
    existing: [
      {icon: 'layers', title: 'Adjustable shelf pins', detail: 'Move shelves to match the tallest items in each zone.'},
      {icon: 'vertical', title: 'Vertical divider slots', detail: 'Use for baking sheets and cutting boards standing upright.'},
      {icon: 'horizontal', title: 'Corner lazy-susan space', detail: 'Place a small turntable or group oils here.'},
      {icon: 'door', title: 'Inside-door surface', detail: 'Hang a small hook strip for pot holders or measuring cups.'}
    ],
    dontBuy: 'Skip plate-stacking racks — they often create more problems than they solve. Just limit stack height instead.',
    steps: [
      {task: 'Empty the cabinet completely', time: '5 min', why: 'You need to see every item to sort and reassign properly.'},
      {task: 'Match every food storage container with its lid', time: '10 min', why: 'Orphaned lids and lidless containers waste space.'},
      {task: 'Adjust shelf heights to match your tallest items per zone', time: '5 min', why: 'Wasted vertical gaps between shelves are lost capacity.'},
      {task: 'Place daily plates and bowls at eye level', time: '5 min', why: 'Most-used items need the most accessible position.'},
      {task: 'Stand baking sheets upright using vertical dividers', time: '5 min', why: 'Upright storage prevents the leaning and sliding problem.'},
      {task: 'Group mugs on the lower shelf with a riser if available', time: '5 min', why: 'A riser doubles visible space without stacking mugs.'},
      {task: 'Place serving dishes on the top shelf', time: '5 min', why: 'Rarely used items earn the least accessible spot.'},
      {task: 'Take a final photo', time: '2 min', why: 'This helps track progress and compare before / after.'}
    ],
    time: '30–60 min',
    cost: '$0 / $30–65'
  };
}

function closetScenario() {
  return {
    spaceType: 'Closet',
    summary: 'A 48-inch-wide reach-in closet with a single hanging rod, one high shelf, and open floor space. Work clothes and casual wear share the same rod with no separation. Shoes are piled on the floor. The top shelf holds a jumble of bags, scarves, and seasonal items. The back of the door is unused.',
    categories: ['Work clothes', 'Casual wear', 'Seasonal outerwear', 'Shoes', 'Accessories', 'Bags & purses', 'Scarves & hats', 'Workout gear'],
    features: [
      {icon: 'horizontal', title: 'Single hanging rod', sub: '48 inches of rod space'},
      {icon: 'up', title: 'Top shelf', sub: 'High and hard to reach'},
      {icon: 'down', title: 'Open floor space', sub: 'Currently just piled shoes'},
      {icon: 'door', title: 'Door back unused', sub: 'Good for hooks or an over-door rack'},
      {icon: 'vertical', title: 'Side wall space', sub: 'Could hold hooks or a small shelf'}
    ],
    problems: [
      'Work and casual clothes share one rod with no separation, making mornings slower',
      'Shoes are piled on the floor with no system — pairs get separated',
      'The top shelf is a catch-all for anything without a home',
      'Seasonal items take up prime space year-round',
      'Accessories like belts and scarves have no dedicated spot'
    ],
    opportunities: [
      'Dividing the rod into work and casual halves speeds up daily outfit selection',
      'Floor bins or a shoe rack can hold 8–12 pairs in the same footprint',
      'The top shelf is ideal for labeled seasonal boxes',
      'Door-back hooks handle accessories, bags, and next-day outfit prep',
      'A second rod or shelf below short-hanging items reclaims dead space'
    ],
    map: [
      {level: 'Top shelf', icon: 'up', zone: 'Seasonal items · Luggage · Out-of-rotation clothes',
        why: 'Rarely accessed items belong in the hardest-to-reach zone.',
        eye: false, shelfIndex: 0,
        safety: {flag: 'keep-high', why: 'Heavy luggage should be stored carefully to avoid falling when pulled down.'},
        items: [{name: 'Seasonal boxes', size: 'l', flags: ['heavy']}, {name: 'Luggage', size: 'l', flags: ['heavy']}, {name: 'Hat boxes', size: 'm', flags: []}]},
      {level: 'Hanging rod — left', icon: 'eye', zone: 'Work clothes · Blazers · Dress shirts',
        why: 'Work outfits on one side lets you dress quickly without scanning the whole rod.',
        eye: true, shelfIndex: 1,
        safety: {flag: null, why: null},
        items: [{name: 'Work shirts & blouses', size: 'm', flags: []}, {name: 'Blazers & jackets', size: 'l', flags: []}, {name: 'Dress pants & skirts', size: 'm', flags: []}]},
      {level: 'Hanging rod — right', icon: 'middle', zone: 'Casual wear · Weekend clothes · Workout gear',
        why: 'Casual items separated from work clothes reduces visual scanning.',
        eye: false, shelfIndex: 2,
        safety: {flag: null, why: null},
        items: [{name: 'Casual tops', size: 'm', flags: ['kid-frequent']}, {name: 'Jeans & casual pants', size: 'm', flags: []}, {name: 'Workout gear', size: 's', flags: []}]},
      {level: 'Floor / door', icon: 'down', zone: 'Shoes · Bags · Accessories',
        why: 'Shoes belong at floor level; door hooks handle bags and accessories vertically.',
        eye: false, shelfIndex: 3,
        safety: {flag: null, why: null},
        items: [{name: 'Shoes', size: 'm', flags: []}, {name: 'Bags & purses', size: 'm', flags: []}, {name: 'Belts & scarves', size: 's', flags: []}]}
    ],
    geometry: {unit: 'in', width: 48, height: 84, depth: 24, shelfCount: 4, shelfYFracs: [0.08, 0.35, 0.55, 0.90], estimated: true},
    safetyNotes: [
      'Heavy luggage on the top shelf should be stored toward the back with lighter items in front.',
      'Avoid over-stacking the top shelf — items can fall when you reach blindly.'
    ],
    productNeeds: [
      {type: 'basket', qty: 3, purpose: 'Labeled bins on the top shelf for seasonal items', targetZone: 'Top shelf', maxDims: {w_in: 14, h_in: 12, d_in: 22}, priority: 'high'},
      {type: 'hook-rack', qty: 1, purpose: 'Over-door hooks for bags, belts, and next-day outfit', targetZone: 'Door back', maxDims: {w_in: 18, h_in: 60, d_in: 3}, priority: 'high'},
      {type: 'shelf-riser', qty: 1, purpose: 'Add a second level below short-hanging items', targetZone: 'Floor level', maxDims: {w_in: 24, h_in: 14, d_in: 14}, priority: 'nice'},
      {type: 'clear-bin', qty: 2, purpose: 'Floor bins for shoes — keeps pairs together and visible', targetZone: 'Floor level', maxDims: {w_in: 14, h_in: 8, d_in: 22}, priority: 'nice'},
      {type: 'label-set', qty: 1, purpose: 'Label each rod section and shelf zone', targetZone: 'Every zone', maxDims: null, priority: 'nice'}
    ],
    existingLede: 'The single rod, top shelf, and floor area are already three distinct zones — they just need assignment.',
    existing: [
      {icon: 'horizontal', title: 'Existing rod space', detail: 'Divide into work (left) and casual (right) with a simple divider or hanger color.'},
      {icon: 'up', title: 'Top shelf', detail: 'Clear and assign to seasonal-only items in labeled bins.'},
      {icon: 'down', title: 'Floor space', detail: 'Line up shoes in pairs or add a low rack.'},
      {icon: 'door', title: 'Door back', detail: 'Hang hooks for bags, scarves, and daily accessories.'}
    ],
    dontBuy: 'Skip full closet system kits — a few targeted additions (hooks, bins) usually solve 80% of the problem for a fraction of the cost.',
    steps: [
      {task: 'Pull everything out and sort into keep, donate, and trash', time: '20 min', why: 'You cannot organize what you have not edited. Reducing volume is the single biggest improvement.'},
      {task: 'Group clothing by type: work, casual, seasonal, workout', time: '10 min', why: 'Categories let you assign zones that make sense.'},
      {task: 'Hang work clothes on the left, casual on the right', time: '10 min', why: 'Splitting the rod means mornings are faster.'},
      {task: 'Box up out-of-season items and label them for the top shelf', time: '10 min', why: 'Seasonal items do not deserve prime rod space.'},
      {task: 'Arrange shoes in pairs on the floor', time: '5 min', why: 'Pairs stay together when lined up instead of piled.'},
      {task: 'Hang hooks on the door back for bags and accessories', time: '10 min', why: 'Vertical door space is free real estate in most closets.'},
      {task: 'Take a final photo', time: '2 min', why: 'This helps track progress and compare before / after.'}
    ],
    time: '60–90 min',
    cost: '$0 / $40–80'
  };
}

function garageScenario() {
  return {
    spaceType: 'Garage shelf',
    summary: 'A 48-inch-wide metal shelving unit with five shelves in the garage. Tools, automotive supplies, garden equipment, and holiday decorations share space with little organization. Chemical cleaners and paint cans sit on the same shelf as sports gear. Heavy power tools are on an upper shelf. A pegboard area next to the unit is mostly empty.',
    categories: ['Hand tools', 'Power tools', 'Automotive supplies', 'Garden equipment', 'Sports gear', 'Holiday decorations', 'Hardware & fasteners', 'Chemicals & paint', 'Extension cords'],
    features: [
      {icon: 'layers', title: '5 metal shelves', sub: 'Each rated for 100+ lbs'},
      {icon: 'horizontal', title: 'Wide shelf depth', sub: '18 inches deep'},
      {icon: 'vertical', title: 'Pegboard on adjacent wall', sub: 'Mostly empty'},
      {icon: 'down', title: 'Floor space in front', sub: 'Available for large items'},
      {icon: 'bin', title: '3 random cardboard boxes', sub: 'Unlabeled'}
    ],
    problems: [
      'Chemicals (paint thinner, cleaners) sit next to sports gear and kids’ toys',
      'Heavy power tools are on an upper shelf — risk of injury when reaching up',
      'Holiday decorations take up a full shelf year-round but are accessed twice a year',
      'Hardware and fasteners are loose in a box with no way to find what you need',
      'Extension cords are tangled in a pile'
    ],
    opportunities: [
      'The pegboard can hold most hand tools, freeing an entire shelf',
      'Chemical items can be isolated on the top shelf, away from kid and pet reach',
      'Heavy items moved low dramatically reduces injury risk',
      'Clear bins with labels make holiday decorations easy to rotate seasonally',
      'A small drawer organizer handles screws, nails, and fasteners'
    ],
    map: [
      {level: 'Top shelf', icon: 'up', zone: 'Chemicals · Paint · Solvents · Hazardous items',
        why: 'Chemicals must be stored high and away from children and pets.',
        eye: false, shelfIndex: 0,
        safety: {flag: 'keep-high', why: 'Paint thinner, cleaners, and solvents are toxic. Keep well above kid and pet reach.'},
        items: [{name: 'Paint & stain', size: 'm', flags: ['chemical']}, {name: 'Solvents & cleaners', size: 's', flags: ['chemical']}, {name: 'Spray products', size: 's', flags: ['chemical']}]},
      {level: 'Upper shelf', icon: 'layers', zone: 'Holiday decorations · Seasonal items',
        why: 'Seasonal items are accessed rarely and should not occupy prime space.',
        eye: false, shelfIndex: 1,
        safety: {flag: null, why: null},
        items: [{name: 'Holiday boxes', size: 'l', flags: []}, {name: 'Seasonal lights', size: 'm', flags: ['fragile']}, {name: 'Wreath storage', size: 'l', flags: []}]},
      {level: 'Eye level', icon: 'eye', zone: 'Frequently used tools · Hardware · Tape & glue',
        why: 'The tools and supplies you reach for most should be at arm height.',
        eye: true, shelfIndex: 2,
        safety: {flag: null, why: null},
        items: [{name: 'Tool box', size: 'l', flags: ['heavy']}, {name: 'Hardware organizer', size: 'm', flags: ['sharp']}, {name: 'Tape, glue, utility', size: 's', flags: []}]},
      {level: 'Lower shelf', icon: 'down', zone: 'Power tools · Automotive · Heavy equipment',
        why: 'Heavy power tools are safer on lower shelves where they cannot fall far.',
        eye: false, shelfIndex: 3,
        safety: {flag: 'kid-safe', why: 'Power tools should stay out of easy reach for small children.'},
        items: [{name: 'Power tools', size: 'l', flags: ['heavy', 'sharp']}, {name: 'Automotive supplies', size: 'm', flags: ['chemical']}, {name: 'Extension cords', size: 'm', flags: []}]},
      {level: 'Floor level', icon: 'down', zone: 'Sports gear · Garden equipment · Large items',
        why: 'Bulky gear stores best on the floor where it is easy to grab and return.',
        eye: false, shelfIndex: 4,
        safety: {flag: null, why: null},
        items: [{name: 'Sports equipment', size: 'l', flags: []}, {name: 'Garden tools', size: 'l', flags: ['sharp']}, {name: 'Buckets & large items', size: 'l', flags: []}]}
    ],
    geometry: {unit: 'in', width: 48, height: 72, depth: 18, shelfCount: 5, shelfYFracs: [0.08, 0.28, 0.48, 0.70, 0.92], estimated: true},
    safetyNotes: [
      'All chemicals, paint, and solvents are on the top shelf, out of reach for children and pets.',
      'Heavy power tools live on a lower shelf to prevent them from falling from height.',
      'Sharp garden tools should face inward or be stored in a sheath when possible.'
    ],
    productNeeds: [
      {type: 'clear-bin', qty: 4, purpose: 'Label and contain holiday decorations by holiday', targetZone: 'Upper shelf', maxDims: {w_in: 16, h_in: 12, d_in: 16}, priority: 'high'},
      {type: 'drawer-organizer', qty: 1, purpose: 'Sort screws, nails, and small hardware into visible compartments', targetZone: 'Eye level', maxDims: {w_in: 16, h_in: 5, d_in: 12}, priority: 'high'},
      {type: 'hook-rack', qty: 1, purpose: 'Mount hand tools on the pegboard to free shelf space', targetZone: 'Pegboard wall', maxDims: null, priority: 'high'},
      {type: 'basket', qty: 2, purpose: 'Corral automotive supplies and extension cords', targetZone: 'Lower shelf', maxDims: {w_in: 14, h_in: 10, d_in: 16}, priority: 'nice'},
      {type: 'safety-latch', qty: 1, purpose: 'Lock chemical shelf if young children access the garage', targetZone: 'Top shelf', maxDims: null, priority: 'nice'},
      {type: 'label-set', qty: 1, purpose: 'Label every bin and zone for quick identification', targetZone: 'Every zone', maxDims: null, priority: 'nice'}
    ],
    existingLede: 'The pegboard and three cardboard boxes are a starting point — replace the boxes with clear bins and put the pegboard to work.',
    existing: [
      {icon: 'vertical', title: 'Pegboard wall space', detail: 'Hang frequently used hand tools here to free a full shelf.'},
      {icon: 'bin', title: '3 cardboard boxes', detail: 'Replace with labeled clear bins or line with plastic bags for now.'},
      {icon: 'down', title: 'Floor space', detail: 'Dedicate to bulky sports and garden gear.'},
      {icon: 'layers', title: '5 heavy-duty shelves', detail: 'Every shelf can hold 100+ lbs — use the capacity strategically.'}
    ],
    dontBuy: 'Skip ceiling-mounted storage unless you have confirmed the joists can hold the weight. Wall-mounted hooks are safer and easier.',
    steps: [
      {task: 'Remove everything from the shelves and sort into categories', time: '20 min', why: 'A full empty-and-sort is the only way to find duplicates, expired chemicals, and forgotten items.'},
      {task: 'Separate chemicals, paint, and solvents into their own group', time: '5 min', why: 'Safety requires isolating hazardous materials before placing anything else.'},
      {task: 'Place chemicals on the top shelf only', time: '5 min', why: 'The highest shelf keeps toxic items away from children and pets.'},
      {task: 'Move heavy power tools to the lower shelf', time: '5 min', why: 'Heavy items at height are the top cause of garage shelf injuries.'},
      {task: 'Hang hand tools on the pegboard', time: '15 min', why: 'Every tool on the wall is one fewer item eating shelf space.'},
      {task: 'Box holiday decorations into labeled bins on the upper shelf', time: '15 min', why: 'Seasonal items accessed twice a year should not occupy mid-level real estate.'},
      {task: 'Organize hardware and fasteners into a small sorter', time: '10 min', why: 'Loose screws in a box are the garage version of a junk drawer.'},
      {task: 'Take a final photo', time: '2 min', why: 'This helps track progress and compare before / after.'}
    ],
    time: '60–120 min',
    cost: '$0 / $50–110'
  };
}

function laundryScenario() {
  return {
    spaceType: 'Laundry room',
    summary: 'Shelving above the washer and dryer with four levels, plus a folding surface. Detergent bottles crowd the front of the lowest shelf. Cleaning supplies are mixed with linens. Stain removal products are scattered, and the iron is wedged behind towels. Wall space beside the shelves is empty.',
    categories: ['Detergent & softener', 'Stain removal', 'Cleaning supplies', 'Towels & washcloths', 'Linens & sheets', 'Iron & steamer', 'Dryer supplies', 'Specialty wash items'],
    features: [
      {icon: 'layers', title: '4 shelves above washer/dryer', sub: 'Fixed bracket shelves'},
      {icon: 'horizontal', title: 'Folding counter space', sub: 'Top of the dryer'},
      {icon: 'bin', title: '1 laundry basket', sub: 'On the floor'},
      {icon: 'vertical', title: 'Empty wall space', sub: 'To the right of shelves'},
      {icon: 'x', title: 'No hooks or rod', sub: 'No drying bar installed'}
    ],
    problems: [
      'Detergent bottles at the front block access to everything behind them',
      'Cleaning sprays are mixed in with clean towels and linens',
      'Stain removal products are spread across three shelves with no single home',
      'The iron is buried behind towels and takes effort to retrieve',
      'Dryer sheets and specialty items have no dedicated zone'
    ],
    opportunities: [
      'A turntable on the lower shelf keeps detergent bottles accessible without moving them',
      'Separating cleaning chemicals from textiles prevents accidental spills on linens',
      'A small basket for stain products creates one go-to spot for laundry prep',
      'Wall hooks can hold the iron, a drying rack, or a steamer',
      'Rolling towels instead of stacking them uses the narrow shelf depth better'
    ],
    map: [
      {level: 'Top shelf', icon: 'up', zone: 'Backup supplies · Bulk detergent · Rarely used items',
        why: 'Bulk items and extras stay out of the way until the main bottle runs out.',
        eye: false, shelfIndex: 0,
        safety: {flag: 'keep-high', why: 'Chemical refills and bulk containers stay high and out of reach.'},
        items: [{name: 'Bulk detergent', size: 'l', flags: ['heavy', 'chemical']}, {name: 'Backup supplies', size: 'm', flags: ['chemical']}, {name: 'Specialty wash', size: 's', flags: []}]},
      {level: 'Eye level', icon: 'eye', zone: 'Active detergent · Softener · Dryer sheets · Stain kit',
        why: 'The products you grab every load belong where you can see and reach them instantly.',
        eye: true, shelfIndex: 1,
        safety: {flag: null, why: null},
        items: [{name: 'Detergent', size: 'm', flags: ['chemical']}, {name: 'Fabric softener', size: 'm', flags: ['chemical']}, {name: 'Stain removal kit', size: 's', flags: ['chemical']}]},
      {level: 'Middle shelf', icon: 'middle', zone: 'Towels · Washcloths · Cleaning rags',
        why: 'Textiles separated from chemicals keeps them clean and stain-free.',
        eye: false, shelfIndex: 2,
        safety: {flag: null, why: null},
        items: [{name: 'Towels', size: 'l', flags: []}, {name: 'Washcloths', size: 's', flags: []}, {name: 'Cleaning rags', size: 's', flags: []}]},
      {level: 'Lower shelf / wall', icon: 'down', zone: 'Iron & steamer · Cleaning sprays · Misc supplies',
        why: 'Heavier items like the iron stay low; cleaning sprays stay separate from textiles.',
        eye: false, shelfIndex: 3,
        safety: {flag: 'kid-safe', why: 'Cleaning sprays and the hot iron should be out of reach for small children.'},
        items: [{name: 'Iron & steamer', size: 'm', flags: ['heavy']}, {name: 'Cleaning sprays', size: 's', flags: ['chemical']}, {name: 'Sponges & brushes', size: 's', flags: []}]}
    ],
    geometry: {unit: 'in', width: 36, height: 48, depth: 14, shelfCount: 4, shelfYFracs: [0.08, 0.35, 0.62, 0.90], estimated: true},
    safetyNotes: [
      'Cleaning chemicals are separated from towels and linens to avoid contact and spills.',
      'Bulk chemical refills stay on the top shelf, out of reach for children.'
    ],
    productNeeds: [
      {type: 'turntable', qty: 1, purpose: 'Spin detergent and softener bottles to reach the one you need', targetZone: 'Eye level', maxDims: {w_in: 12, h_in: 5, d_in: 12}, priority: 'high'},
      {type: 'basket', qty: 2, purpose: 'One for stain removal supplies, one for dryer accessories', targetZone: 'Eye level', maxDims: {w_in: 10, h_in: 8, d_in: 13}, priority: 'high'},
      {type: 'hook-rack', qty: 1, purpose: 'Wall hooks for the iron, steamer, and a small drying rack', targetZone: 'Wall beside shelves', maxDims: null, priority: 'nice'},
      {type: 'shelf-riser', qty: 1, purpose: 'Add a second tier for towels to avoid stacking too high', targetZone: 'Middle shelf', maxDims: {w_in: 14, h_in: 7, d_in: 13}, priority: 'nice'},
      {type: 'label-set', qty: 1, purpose: 'Label shelf zones so the system stays maintained', targetZone: 'Every zone', maxDims: null, priority: 'nice'}
    ],
    existingLede: 'The laundry basket, folding surface, and the wall space beside the shelves all have organizing potential right now.',
    existing: [
      {icon: 'bin', title: 'Existing laundry basket', detail: 'Keep it on the floor below the shelves for dirty items.'},
      {icon: 'horizontal', title: 'Dryer-top folding surface', detail: 'Keep clear for active folding — do not let it become storage.'},
      {icon: 'vertical', title: 'Empty wall space', detail: 'Install a hook strip for the iron and a small drying bar.'},
      {icon: 'layers', title: '4 bracket shelves', detail: 'Assign each shelf a single purpose: supplies, daily products, textiles, tools.'}
    ],
    dontBuy: 'Skip over-washer cabinet systems unless you plan to stay in this home. Shelves and hooks do 90% of the job.',
    steps: [
      {task: 'Remove everything from the shelves', time: '5 min', why: 'A clean start lets you see what you have and discard empties.'},
      {task: 'Throw away empty bottles and expired products', time: '5 min', why: 'Empty containers are the most common source of laundry room clutter.'},
      {task: 'Group chemicals separately from textiles', time: '5 min', why: 'Chemicals and clean fabrics should never share a shelf.'},
      {task: 'Place daily-use detergent and softener at eye level', time: '5 min', why: 'These are grabbed every load and need instant access.'},
      {task: 'Roll towels and stack on the middle shelf', time: '10 min', why: 'Rolled towels fit narrow shelves better and are easy to grab.'},
      {task: 'Move bulk and backup supplies to the top shelf', time: '5 min', why: 'Bulk items are heavy and infrequently needed.'},
      {task: 'Install wall hooks for the iron if hardware is available', time: '10 min', why: 'Getting the iron off the shelf frees a full zone.'},
      {task: 'Take a final photo', time: '2 min', why: 'This helps track progress and compare before / after.'}
    ],
    time: '40–70 min',
    cost: '$0 / $25–60'
  };
}

function kidsScenario() {
  return {
    spaceType: 'Kids’ storage',
    summary: 'A 36-inch-wide, 48-inch-tall shelving unit in a children’s room with four shelves. Toys, books, art supplies, and games are mixed together. Building blocks spill from an overflowing bin. Small game pieces and art supplies are loose on the same shelf. Books are stacked horizontally instead of upright. Everything is technically reachable by kids, but nothing has a clear home.',
    categories: ['Toys', 'Board games & puzzles', 'Art supplies', 'Books', 'Stuffed animals', 'Building blocks', 'Dress-up & costumes', 'School supplies'],
    features: [
      {icon: 'layers', title: '4 low shelves', sub: 'All within kid reach'},
      {icon: 'bin', title: '2 fabric bins', sub: 'Both overflowing'},
      {icon: 'horizontal', title: 'Wall hooks above', sub: '3 hooks installed'},
      {icon: 'vertical', title: 'Book ledge potential', sub: 'Empty wall beside the shelf'},
      {icon: 'down', title: 'Floor space in front', sub: 'Current play area'}
    ],
    problems: [
      'No category separation — toys, books, and art supplies are mixed on every shelf',
      'Small game pieces and art supplies pose a choking risk for younger children',
      'Building blocks overflow their bin and end up on the floor',
      'Books stacked horizontally make it hard to pull one out without toppling the pile',
      'The dress-up bin is stuffed so tightly that costumes get wrinkled and ignored'
    ],
    opportunities: [
      'Color-coded bins by category teach kids where things go back',
      'Books displayed spine-out or face-out on a ledge get read more often',
      'A dedicated art-supply caddy can move to the table for projects',
      'Wall hooks can hold dress-up costumes, backpacks, and frequently used items',
      'Separating small pieces into a latched container improves safety for toddlers'
    ],
    map: [
      {level: 'Top shelf', icon: 'up', zone: 'Board games · Puzzles · Small-piece items',
        why: 'Items with small pieces belong on the highest shelf, supervised by an adult.',
        eye: false, shelfIndex: 0,
        safety: {flag: 'kid-safe', why: 'Small game pieces and puzzle parts are choking hazards for children under 3.'},
        items: [{name: 'Board games', size: 'l', flags: []}, {name: 'Puzzles', size: 'm', flags: []}, {name: 'Small-piece kits', size: 's', flags: []}]},
      {level: 'Eye level (kid height)', icon: 'eye', zone: 'Books · Coloring books · Favorite toys',
        why: 'Kid eye level means they will actually choose and return these items independently.',
        eye: true, shelfIndex: 1,
        safety: {flag: null, why: null},
        items: [{name: 'Books', size: 'm', flags: ['kid-frequent']}, {name: 'Coloring & activity books', size: 'm', flags: ['kid-frequent']}, {name: 'Favorite toys', size: 's', flags: ['kid-frequent']}]},
      {level: 'Lower shelf', icon: 'down', zone: 'Building blocks · Large toys · Stuffed animals',
        why: 'Large, heavy bins of blocks stay low where kids can pull them out safely.',
        eye: false, shelfIndex: 2,
        safety: {flag: null, why: null},
        items: [{name: 'Building blocks', size: 'l', flags: ['heavy', 'kid-frequent']}, {name: 'Large toys', size: 'l', flags: ['kid-frequent']}, {name: 'Stuffed animals', size: 'l', flags: ['kid-frequent']}]},
      {level: 'Floor / hooks', icon: 'down', zone: 'Dress-up · Art caddy · School supplies',
        why: 'Floor bins and wall hooks let kids grab costumes and supplies without climbing.',
        eye: false, shelfIndex: 3,
        safety: {flag: null, why: null},
        items: [{name: 'Dress-up & costumes', size: 'l', flags: ['kid-frequent']}, {name: 'Art supply caddy', size: 'm', flags: ['kid-frequent']}, {name: 'School supplies', size: 's', flags: ['kid-frequent']}]}
    ],
    geometry: {unit: 'in', width: 36, height: 48, depth: 12, shelfCount: 4, shelfYFracs: [0.08, 0.35, 0.62, 0.90], estimated: true},
    safetyNotes: [
      'Board games and puzzles with small pieces live on the top shelf, where an adult can supervise access.',
      'All bins are open-top and lightweight so kids can pull them out without tipping heavy containers.',
      'Sharp scissors and craft knives in the art supplies are stored in a closed caddy, not loose.'
    ],
    productNeeds: [
      {type: 'basket', qty: 4, purpose: 'Color-coded bins for blocks, animals, costumes, and miscellaneous', targetZone: 'Every shelf', maxDims: {w_in: 12, h_in: 10, d_in: 11}, priority: 'high'},
      {type: 'clear-bin', qty: 1, purpose: 'Latched container for small game pieces and puzzle parts', targetZone: 'Top shelf', maxDims: {w_in: 10, h_in: 8, d_in: 11}, priority: 'high'},
      {type: 'hook-rack', qty: 1, purpose: 'Low wall hooks for dress-up costumes and backpacks', targetZone: 'Wall beside shelf', maxDims: null, priority: 'nice'},
      {type: 'shelf-riser', qty: 1, purpose: 'Create a front-facing book display ledge on the wall', targetZone: 'Wall beside shelf', maxDims: {w_in: 24, h_in: 4, d_in: 5}, priority: 'nice'},
      {type: 'label-set', qty: 1, purpose: 'Picture labels so pre-readers know where items go back', targetZone: 'Every bin', maxDims: null, priority: 'nice'}
    ],
    existingLede: 'Two fabric bins and three wall hooks are already installed — they just need better assignments.',
    existing: [
      {icon: 'bin', title: '2 fabric bins', detail: 'Empty, sort, and assign one to blocks and one to stuffed animals.'},
      {icon: 'horizontal', title: '3 wall hooks', detail: 'Assign to backpack, dress-up favorites, and a daily jacket.'},
      {icon: 'down', title: 'Floor play area', detail: 'Keep clear of storage — this is the play zone, not overflow.'},
      {icon: 'vertical', title: 'Wall space beside shelf', detail: 'Ideal for a picture-book ledge or more hooks.'}
    ],
    dontBuy: 'Skip tall storage towers — kids should reach every shelf independently. A 48-inch max height is safer and more practical.',
    steps: [
      {task: 'Pull everything off the shelves and sort into categories', time: '15 min', why: 'You will likely find broken toys, missing pieces, and items to donate. Editing first is key.'},
      {task: 'Set aside small-piece games and puzzles for the top shelf', time: '5 min', why: 'Small pieces need adult supervision and should be kept separate.'},
      {task: 'Place books upright at kid eye level', time: '5 min', why: 'Spine-out books get chosen more often than horizontal stacks.'},
      {task: 'Fill bins with blocks and stuffed animals on the lower shelf', time: '10 min', why: 'Heavy bins go low so kids pull them out safely.'},
      {task: 'Assign dress-up costumes to floor bins or low hooks', time: '5 min', why: 'Costumes on hooks stay wrinkle-free and are easy for kids to grab.'},
      {task: 'Make an art supply caddy that can move to the table', time: '5 min', why: 'A portable caddy means art happens at the table, not on the floor.'},
      {task: 'Add picture labels to every bin', time: '10 min', why: 'Picture labels let pre-readers put things back in the right spot.'},
      {task: 'Take a final photo', time: '2 min', why: 'This helps track progress and compare before / after.'}
    ],
    time: '45–75 min',
    cost: '$0 / $30–65'
  };
}

function atticScenario() {
  return {
    spaceType: 'Attic / storage area',
    summary: 'A 60-inch-wide shelving unit in an attic storage area with five shelves. Seasonal decorations, camping gear, archived documents, outgrown clothes, luggage, and memorabilia share space. Most boxes are cardboard with handwritten labels that have faded. The area has limited light and some items have been untouched for years. Rafters above the shelves offer additional hanging potential.',
    categories: ['Holiday decorations', 'Camping & outdoor gear', 'Luggage', 'Archived documents', 'Outgrown kids’ clothes', 'Memorabilia & keepsakes', 'Extra bedding & linens', 'Seasonal sports equipment'],
    features: [
      {icon: 'layers', title: '5 shelves', sub: 'Standard utility shelving'},
      {icon: 'horizontal', title: 'Wide shelves', sub: '24 inches deep'},
      {icon: 'up', title: 'Exposed rafters above', sub: 'Potential hanging storage'},
      {icon: 'down', title: 'Deep floor space', sub: 'In front of and beside the shelf unit'},
      {icon: 'x', title: 'Limited lighting', sub: 'Hard to read labels from a distance'}
    ],
    problems: [
      'Faded handwritten labels make it impossible to find items without opening every box',
      'Cardboard boxes are deteriorating and some have moisture damage',
      'Items untouched for 3+ years may no longer be needed',
      'Camping gear is buried behind holiday decorations and requires moving 4 boxes to reach',
      'No system for seasonal rotation — summer gear blocks winter decorations in November'
    ],
    opportunities: [
      'Replacing cardboard with clear bins makes contents visible even in low light',
      'A seasonal rotation system places the current season’s items at the front',
      'Hanging luggage or duffle bags from rafters frees a full shelf',
      'Bold, large-print labels compensate for low light',
      'An annual review date on each box prompts re-evaluation'
    ],
    map: [
      {level: 'Top shelf', icon: 'up', zone: 'Memorabilia · Keepsakes · Archive documents',
        why: 'Rarely touched items that need preservation belong on the highest shelf, away from floor moisture.',
        eye: false, shelfIndex: 0,
        safety: {flag: 'keep-high', why: 'Archived documents and keepsakes stay dry and undisturbed on the top shelf.'},
        items: [{name: 'Memorabilia boxes', size: 'l', flags: []}, {name: 'Archived documents', size: 'm', flags: []}, {name: 'Photo albums', size: 'm', flags: ['fragile']}]},
      {level: 'Upper shelf', icon: 'layers', zone: 'Off-season decorations · Out-of-rotation items',
        why: 'The opposite season’s decorations stay accessible but not in the front row.',
        eye: false, shelfIndex: 1,
        safety: {flag: null, why: null},
        items: [{name: 'Off-season holiday bins', size: 'l', flags: []}, {name: 'Outgrown clothes', size: 'l', flags: []}, {name: 'Extra bedding', size: 'l', flags: []}]},
      {level: 'Eye level', icon: 'eye', zone: 'Current-season decorations · Frequently accessed items',
        why: 'Items you need this season should be at the front and at arm height.',
        eye: true, shelfIndex: 2,
        safety: {flag: null, why: null},
        items: [{name: 'Current-season decorations', size: 'l', flags: []}, {name: 'Gift wrap & bags', size: 'm', flags: []}, {name: 'Party supplies', size: 'm', flags: []}]},
      {level: 'Lower shelf', icon: 'down', zone: 'Camping gear · Sports equipment · Heavy items',
        why: 'Heavy gear stays low for safe lifting and is easier to pull out from here.',
        eye: false, shelfIndex: 3,
        safety: {flag: null, why: null},
        items: [{name: 'Camping gear', size: 'l', flags: ['heavy']}, {name: 'Sports equipment', size: 'l', flags: []}, {name: 'Coolers & large items', size: 'l', flags: ['heavy']}]},
      {level: 'Floor / rafters', icon: 'down', zone: 'Luggage · Large seasonal items · Overflow',
        why: 'Luggage and oversized items fit best on the floor or hung from rafters.',
        eye: false, shelfIndex: 4,
        safety: {flag: null, why: null},
        items: [{name: 'Luggage', size: 'l', flags: ['heavy']}, {name: 'Large seasonal items', size: 'l', flags: []}, {name: 'Overflow bins', size: 'l', flags: []}]}
    ],
    geometry: {unit: 'in', width: 60, height: 72, depth: 24, shelfCount: 5, shelfYFracs: [0.08, 0.28, 0.48, 0.70, 0.92], estimated: true},
    safetyNotes: [
      'Heavy bins should always be on lower shelves to prevent injury when pulling them down.',
      'Check for moisture damage and mildew before reorganizing — damaged items may need to be discarded.'
    ],
    productNeeds: [
      {type: 'clear-bin', qty: 6, purpose: 'Replace cardboard boxes so contents are visible in low light', targetZone: 'Every shelf', maxDims: {w_in: 18, h_in: 14, d_in: 22}, priority: 'high'},
      {type: 'label-set', qty: 2, purpose: 'Bold, large-print labels readable from a distance in dim lighting', targetZone: 'Every bin', maxDims: null, priority: 'high'},
      {type: 'airtight-container', qty: 2, purpose: 'Protect archived documents and photos from moisture', targetZone: 'Top shelf', maxDims: {w_in: 16, h_in: 10, d_in: 22}, priority: 'nice'},
      {type: 'hook-rack', qty: 1, purpose: 'Hang luggage or duffle bags from rafters to free shelf space', targetZone: 'Rafters above', maxDims: null, priority: 'nice'},
      {type: 'basket', qty: 2, purpose: 'Corral loose camping accessories and sports gear', targetZone: 'Lower shelf', maxDims: {w_in: 16, h_in: 12, d_in: 22}, priority: 'nice'}
    ],
    existingLede: 'The five shelves and rafter space above give you more capacity than you think — the real issue is visibility and rotation.',
    existing: [
      {icon: 'layers', title: '5 shelves', detail: 'Assign each shelf a clear season or category — no mixing.'},
      {icon: 'up', title: 'Exposed rafters', detail: 'Hang lightweight luggage or duffle bags to free a shelf.'},
      {icon: 'down', title: 'Floor space', detail: 'Reserve for oversized items like luggage, camp chairs, and coolers.'},
      {icon: 'horizontal', title: 'Deep shelf depth', detail: 'Use the 24-inch depth by placing current-season items in front.'}
    ],
    dontBuy: 'Skip vacuum-seal bags for holiday decorations — fragile ornaments can crack under compression. Use structured bins instead.',
    steps: [
      {task: 'Pull everything out and sort into keep, donate, and trash', time: '30 min', why: 'Attics accumulate items that are no longer needed. Editing first is critical.'},
      {task: 'Check all boxes for moisture damage or mildew', time: '10 min', why: 'Damaged items can ruin neighboring boxes if not removed.'},
      {task: 'Replace deteriorating cardboard boxes with clear bins', time: '15 min', why: 'Clear bins survive attic temperature swings and let you see contents in dim light.'},
      {task: 'Label every bin with bold, large-print labels', time: '10 min', why: 'Faded handwriting was the original problem — solve it permanently.'},
      {task: 'Place current-season items at eye level, off-season behind', time: '10 min', why: 'Seasonal rotation means you never dig through out-of-season items.'},
      {task: 'Move heavy camping and sports gear to the lower shelf', time: '10 min', why: 'Heavy items at height are unsafe in any storage area.'},
      {task: 'Hang luggage from rafters if possible', time: '10 min', why: 'Luggage is bulky but lightweight — perfect for rafter hooks.'},
      {task: 'Write an annual review date on each bin', time: '5 min', why: 'A date prompts you to re-evaluate contents instead of storing them forever.'},
      {task: 'Take a final photo', time: '2 min', why: 'This helps track progress and compare before / after.'}
    ],
    time: '90–150 min',
    cost: '$0 / $60–120'
  };
}

function otherScenario() {
  return {
    spaceType: 'Other',
    summary: 'A general-purpose storage area with four shelves. A mix of frequently used items, backup supplies, and seasonal odds and ends share space with no clear system. Items are placed wherever they fit rather than where they belong, and a few things have been here long enough that their purpose is forgotten.',
    categories: ['Frequently used items', 'Backup supplies', 'Seasonal items', 'Miscellaneous', 'Electronics & cables', 'Office supplies', 'Craft supplies', 'Household tools'],
    features: [
      {icon: 'layers', title: '4 shelves', sub: 'Standard utility shelving'},
      {icon: 'horizontal', title: 'Moderate depth', sub: '14 inches deep'},
      {icon: 'vertical', title: 'Some unused vertical space', sub: 'Between items and the shelf above'},
      {icon: 'bin', title: '1 bin or basket', sub: 'Overflowing with miscellaneous items'},
      {icon: 'x', title: 'No labels', sub: 'Nothing is marked'}
    ],
    problems: [
      'No category system — items are placed wherever they fit at the moment',
      'Frequently used items are blocked by rarely used ones',
      'A bin of miscellaneous items has become a catch-all with no structure',
      'Some items have been here so long their purpose is unclear',
      'Vertical space between items and the next shelf is wasted'
    ],
    opportunities: [
      'Grouping by use frequency (daily, weekly, seasonal) creates natural zones',
      'A quick purge of forgotten items frees 20–30% of the space immediately',
      'Sorting the miscellaneous bin into categories gives everything a home',
      'Shelf risers can reclaim wasted vertical gaps',
      'Simple labels prevent the space from reverting to chaos'
    ],
    map: [
      {level: 'Top shelf', icon: 'up', zone: 'Seasonal items · Rarely needed supplies',
        why: 'Items used once or twice a year belong in the least accessible spot.',
        eye: false, shelfIndex: 0,
        safety: {flag: null, why: null},
        items: [{name: 'Seasonal items', size: 'l', flags: []}, {name: 'Rarely used supplies', size: 'm', flags: []}, {name: 'Archived items', size: 'm', flags: []}]},
      {level: 'Eye level', icon: 'eye', zone: 'Frequently used items · Daily essentials',
        why: 'The items you reach for most often should be at the most accessible height.',
        eye: true, shelfIndex: 1,
        safety: {flag: null, why: null},
        items: [{name: 'Daily essentials', size: 'm', flags: []}, {name: 'Office supplies', size: 's', flags: []}, {name: 'Household tools', size: 'm', flags: []}]},
      {level: 'Middle shelf', icon: 'middle', zone: 'Backup supplies · Craft items · Electronics',
        why: 'Secondary items that are used weekly or monthly live in the middle zone.',
        eye: false, shelfIndex: 2,
        safety: {flag: null, why: null},
        items: [{name: 'Backup supplies', size: 'm', flags: []}, {name: 'Craft supplies', size: 'm', flags: []}, {name: 'Cables & electronics', size: 's', flags: ['fragile']}]},
      {level: 'Lower shelf', icon: 'down', zone: 'Heavy items · Large containers · Overflow',
        why: 'Heavy and bulky items are safest at the lowest level.',
        eye: false, shelfIndex: 3,
        safety: {flag: null, why: null},
        items: [{name: 'Heavy items', size: 'l', flags: ['heavy']}, {name: 'Large containers', size: 'l', flags: []}, {name: 'Overflow bin', size: 'l', flags: []}]}
    ],
    geometry: {unit: 'in', width: 36, height: 60, depth: 14, shelfCount: 4, shelfYFracs: [0.08, 0.35, 0.62, 0.90], estimated: true},
    safetyNotes: [
      'Heavy items always belong on lower shelves to prevent falls.',
      'If this space is accessible to children, keep sharp or small items on upper shelves.'
    ],
    productNeeds: [
      {type: 'clear-bin', qty: 3, purpose: 'Sort the miscellaneous catch-all into visible categories', targetZone: 'Every shelf', maxDims: {w_in: 12, h_in: 8, d_in: 13}, priority: 'high'},
      {type: 'shelf-riser', qty: 1, purpose: 'Reclaim vertical space between short items and the shelf above', targetZone: 'Middle shelf', maxDims: {w_in: 14, h_in: 7, d_in: 13}, priority: 'nice'},
      {type: 'drawer-organizer', qty: 1, purpose: 'Sort small items like cables, batteries, and office supplies', targetZone: 'Eye level', maxDims: {w_in: 12, h_in: 4, d_in: 13}, priority: 'nice'},
      {type: 'label-set', qty: 1, purpose: 'Label every zone and bin so the system stays organized', targetZone: 'Every zone', maxDims: null, priority: 'nice'}
    ],
    existingLede: 'You already have shelves and at least one bin — the first step is sorting, not shopping.',
    existing: [
      {icon: 'layers', title: '4 shelves', detail: 'Each shelf gets one purpose: daily, weekly, monthly, seasonal.'},
      {icon: 'bin', title: '1 existing bin', detail: 'Empty and re-assign to a single category instead of miscellaneous.'},
      {icon: 'vertical', title: 'Vertical gaps', detail: 'Stack or add a riser to use the space between items and the shelf above.'},
      {icon: 'keep', title: 'Keep a donation box', detail: 'Put a box by the door for items that no longer belong here.'}
    ],
    dontBuy: 'Do not buy organizers until you have purged and sorted. Most storage problems are volume problems, not container problems.',
    steps: [
      {task: 'Pull everything off the shelves', time: '10 min', why: 'You need to see every item to decide what stays and what goes.'},
      {task: 'Sort into keep, donate, and trash', time: '15 min', why: 'Reducing volume is the single most effective organizing step.'},
      {task: 'Group remaining items by how often you use them', time: '10 min', why: 'Use frequency determines which shelf each group earns.'},
      {task: 'Place daily-use items at eye level', time: '5 min', why: 'The most accessible shelf belongs to the most-used items.'},
      {task: 'Place seasonal and rarely used items on the top shelf', time: '5 min', why: 'These items do not need easy access.'},
      {task: 'Put heavy items on the bottom shelf', time: '5 min', why: 'Heavy items are safer and more stable at the lowest level.'},
      {task: 'Label each shelf zone', time: '5 min', why: 'Labels prevent the space from reverting to a catch-all.'},
      {task: 'Take a final photo', time: '2 min', why: 'This helps track progress and compare before / after.'}
    ],
    time: '40–70 min',
    cost: '$0 / $25–55'
  };
}

/* ---------- Scenario lookup ---------- */

const SCENARIO_FNS = {
  pantry:  pantryScenario,
  cabinet: cabinetScenario,
  closet:  closetScenario,
  garage:  garageScenario,
  laundry: laundryScenario,
  kids:    kidsScenario,
  attic:   atticScenario,
  other:   otherScenario
};

/* ---------- Goal-based adaptations ---------- */

function applyGoal(plan, goal) {
  if (!goal) return;

  switch (goal) {
    case 'kid':
      if (!plan.safetyNotes.some(n => /kid|child/i.test(n))) {
        plan.safetyNotes.push('All heavy and sharp items are placed above kid reach or behind latched containers.');
      }
      // Tag lower-shelf items as kid-accessible
      plan.map.forEach(m => {
        if (m.shelfIndex >= plan.geometry.shelfCount - 2) {
          m.items.forEach(it => {
            if (!it.flags.includes('kid-frequent')) it.flags.push('kid-frequent');
          });
        }
      });
      break;

    case 'minimal':
      plan.summary += ' The goal is a clean, minimal look with fewer visible items and calmer shelf lines.';
      // Reduce items per zone to 2
      plan.map.forEach(m => {
        if (m.items.length > 2) m.items = m.items.slice(0, 2);
        m.zone = m.zone.split(' · ').slice(0, 2).join(' · ');
      });
      plan.opportunities.push('Fewer visible categories per shelf creates a calmer, minimal look.');
      break;

    case 'capacity':
      plan.summary += ' The priority is maximizing every inch of available storage capacity.';
      plan.opportunities.push('Shelf risers and stacking bins double the usable space in each zone.');
      plan.opportunities.push('Vertical gaps between items and the shelf above are recoverable space.');
      // Bump shelf-riser priority
      plan.productNeeds.forEach(p => {
        if (p.type === 'shelf-riser') p.priority = 'high';
      });
      break;

    case 'clutter':
      plan.summary += ' The focus is reducing visual clutter so the space looks calm and controlled.';
      plan.opportunities.push('Opaque bins and baskets hide visual noise while keeping items accessible.');
      plan.opportunities.push('Matching container colors and sizes creates a uniform, tidy look.');
      // Swap clear-bin recs to basket where applicable
      plan.productNeeds.forEach(p => {
        if (p.type === 'clear-bin') {
          p.type = 'basket';
          p.purpose = p.purpose.replace(/visible|see\b/gi, 'contained');
        }
      });
      break;

    case 'own':
      // Drop product needs to essentials
      plan.productNeeds = plan.productNeeds.filter(p => p.priority === 'high').slice(0, 2);
      plan.cost = '$0';
      plan.dontBuy = 'This plan uses only what you already own — no purchases required.';
      break;

    case 'find':
      plan.opportunities.push('Clear labels on every zone cut search time to near zero.');
      // Ensure label-set is in the list and high priority
      if (!plan.productNeeds.some(p => p.type === 'label-set')) {
        plan.productNeeds.push({type: 'label-set', qty: 1, purpose: 'Label every zone for instant identification', targetZone: 'Every zone', maxDims: null, priority: 'high'});
      } else {
        plan.productNeeds.forEach(p => { if (p.type === 'label-set') p.priority = 'high'; });
      }
      break;

    case 'shop':
      // Bump all product needs to high priority
      plan.productNeeds.forEach(p => { p.priority = 'high'; });
      break;

    // 'unsure' and other goals: no special adaptation, base scenario is fine
  }
}

/* ---------- Household-based adaptations ---------- */

function applyHousehold(plan, household) {
  if (!household) return;

  // Kids present
  if (household.kids && household.kids.present) {
    if (!plan.safetyNotes.some(n => /kid|child/i.test(n))) {
      plan.safetyNotes.push('With children in the household, heavy and hazardous items are kept on upper shelves.');
    }
    // Ensure at least one kid-safe zone
    const hasKidSafe = plan.map.some(m => m.safety.flag === 'kid-safe');
    if (!hasKidSafe && plan.map.length >= 2) {
      const lower = plan.map[plan.map.length - 2];
      lower.safety = {flag: 'kid-safe', why: 'Lower zones stay kid-accessible and free of hazards.'};
    }
    // Add safety latch recommendation for chemical spaces
    const hasChemicals = plan.map.some(m => m.items.some(it => it.flags.includes('chemical')));
    if (hasChemicals && !plan.productNeeds.some(p => p.type === 'safety-latch')) {
      plan.productNeeds.push({type: 'safety-latch', qty: 1, purpose: 'Lock shelves containing chemicals away from children', targetZone: 'Top shelf', maxDims: null, priority: 'high'});
    }
  }

  // Pets present
  if (household.pets && household.pets.present) {
    plan.safetyNotes.push('With pets in the household, keep pet food and treats in sealed containers to prevent access.');
    // Add pet note to applicable spaces
    const petSpaces = new Set(['pantry', 'garage', 'laundry', 'other']);
    const spaceKey = plan.spaceType.toLowerCase();
    if (petSpaces.has(spaceKey) || spaceKey.includes('pantry') || spaceKey.includes('garage') || spaceKey.includes('laundry')) {
      plan.opportunities.push('Designate a specific zone for pet food and supplies, away from human food and chemicals.');
    }
  }

  // Limited mobility
  if (household.mobility && household.mobility.length) {
    const hasLimitedReach = household.mobility.some(m =>
      typeof m === 'string' && /limited.?reach/i.test(m)
    );
    if (hasLimitedReach) {
      plan.safetyNotes.push('Daily-use items are kept at mid-height to accommodate limited reach.');
      // Move eye-level zone to true center
      plan.map.forEach(m => {
        if (m.eye) {
          m.why += ' Placed at mid-height for easier reach.';
        }
      });
    }
  }
}

/* ============================================================
   Public API
   ============================================================ */

/**
 * Returns a raw plan object for the given space type, ready to pass
 * through normalizeAi().  Adapts based on goal and household context.
 *
 * @param {string} spaceType  - space id: pantry, cabinet, closet, garage, attic, laundry, kids, other
 * @param {string|null} goal  - goal id: find, clutter, own, capacity, kid, minimal, shop, unsure
 * @param {object|null} household - { kids:{present}, pets:{present}, mobility:[] }
 */
export function getDemoScenario(spaceType, goal, household) {
  const fn = SCENARIO_FNS[spaceType] || SCENARIO_FNS.other;
  const plan = fn();

  applyGoal(plan, goal);
  applyHousehold(plan, household);

  return plan;
}
