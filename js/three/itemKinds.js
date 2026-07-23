/* Pure semantic classifier shared by the 3D renderer and tests. 3D objects
   should read as the thing named in the plan, not as interchangeable boxes. */

const RULES = [
  ['shoe', /shoe|boot|sneaker|slipper/i],
  ['linen', /towel|linen|bedding|blanket|duvet|sheet|pillow|washcloth|knit|tee|sweater|folded/i],
  ['bottle', /bottle|spray|refill|skincare|makeup|shampoo|conditioner|lotion|cleaner|drink|coffee|tea|sauce/i],
  ['can', /\bcan(?:ned|s)?\b|jar|spice|paint/i],
  ['dish', /plate|bowl|mug|glass|dish/i],
  ['tool', /tool|utensil|scissor|hammer|driver|wrench|cord|cable|batter(?:y|ies)|fastener|hardware|tape/i],
  ['food', /fruit|vegetable|produce|meat|fish|snack|breakfast|pasta|grain|meal|food/i],
  ['container', /bin|basket|box|tote|luggage|bag|purse|container|backstock|overflow/i],
  ['garment', /shirt|blouse|blazer|jacket|dress|skirt|pants|jeans|clothes|clothing|coat|top|wear|outfit/i],
];

export function semanticItemKind(name, surface) {
  if (surface === 'rod') return 'garment';
  if (surface === 'pegboard') return 'tool';
  const text = String(name || '');
  for (const [kind, pattern] of RULES) {
    if (pattern.test(text)) return kind;
  }
  return surface === 'drawer' ? 'small-item' : 'container';
}

export const ITEM_HEIGHTS = {
  garment: { s: 14, m: 20, l: 28 },
  shoe: { s: 4, m: 5, l: 6.5 },
  linen: { s: 4, m: 6, l: 8 },
  bottle: { s: 5, m: 8, l: 11 },
  can: { s: 4.5, m: 6, l: 8 },
  dish: { s: 5, m: 7, l: 9 },
  tool: { s: 6, m: 9, l: 12 },
  food: { s: 5, m: 7, l: 9 },
  container: { s: 5, m: 7, l: 10 },
  'small-item': { s: 4, m: 6, l: 8 },
};

export function semanticItemHeight(kind, size) {
  const values = ITEM_HEIGHTS[kind] || ITEM_HEIGHTS.container;
  return values[size] || values.m;
}
