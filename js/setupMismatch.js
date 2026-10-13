import { SETUP_TYPES } from './wizard-data.js';
import { SETUP_ARCHETYPE } from './layout.js';

/* #3: photos that contradict the setup the user picked (walk-in photos, a
   reach-in card). The model follows the pick, so the plan was drawn for a
   shape the photos do not show, twice in the owner's own runs (4 and 4c).

   analyze-space now returns `seenLayout`, the archetype the photos show. When
   it differs from the picked card's, the loading screen asks once before the
   plan opens: Switch rebuilds with the detected setup, Keep opens the plan
   already built for the pick. Only a card the user actually picked is
   questioned: an untouched preselection already yields to the photos
   (js/layout.js resolveLayout). */

/* What the photos look like, as a noun phrase. Needed because a card label
   ("Wall shelves", "Built-in + drawers") does not read after "look like a",
   and because several cards can share one archetype (a wardrobe and a
   reach-in are both closet-rod), where no single card names what was seen. */
const SEEN_PHRASE = {
  'shelves': 'set of open shelves',
  'cabinet': 'cabinet',
  'l-run': 'L-shaped run',
  'walkin-u': 'walk-in',
  'closet-rod': 'closet with a hanging rod',
  'closet-system': 'built-in closet with drawers',
  'drawer-bank': 'set of drawers',
  'under-bed': 'set of under-bed drawers',
  'under-sink': 'under-sink cabinet',
  'counter': 'counter with cabinets above',
  'garage-rack': 'utility rack',
  'overhead-rack': 'overhead rack',
  'workbench': 'workbench',
  'fridge': 'fridge',
};

const article = (phrase) => (/^(?:[aeiou]|L-)/i.test(phrase) ? 'an' : 'a');
// "Reach-in" reads as "Keep reach-in"; "L-shaped" keeps its capital.
const inline = (label) => (/^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label);

/**
 * The prompt to show, or null when there is nothing to ask.
 * @param {{space:string|null, setup:string|null, setupTouched:boolean, seenLayout:string|null|undefined}} a
 * @returns {null | {fromId:string, toId:string, question:string, switchLabel:string, keepLabel:string}}
 */
export function setupMismatch({ space, setup, setupTouched, seenLayout }) {
  if (!setupTouched || !setup || !seenLayout || !SEEN_PHRASE[seenLayout]) return null;
  const cards = SETUP_TYPES[space] || [];
  const chosen = cards.find((c) => c.id === setup);
  if (!chosen || SETUP_ARCHETYPE[setup] === seenLayout) return null;
  // Only a card this space offers can be switched to; a fridge seen in a
  // closet plan is not a setup the closet step could have picked.
  const target = cards.find((c) => SETUP_ARCHETYPE[c.id] === seenLayout);
  if (!target) return null;
  const phrase = SEEN_PHRASE[seenLayout];
  return {
    fromId: chosen.id,
    toId: target.id,
    question: `Your photos look like ${article(phrase)} ${phrase}. Switch?`,
    switchLabel: 'Switch',
    keepLabel: `Keep ${inline(chosen.label)}`,
  };
}
