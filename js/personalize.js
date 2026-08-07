/* Deterministic personalization: every wizard answer must leave a visible,
   attributable trace in the plan, or the plan reads as a template.

   applyAnswers() runs on the RAW plan shape (what demo-scenarios build and
   what the AI returns: steps {task,time,why}, map rows {level,zone,items,…},
   productNeeds) BEFORE normalizeAi. On the AI path the model already honors
   these answers under the server-side invariants, so this layer is applied
   only to demo / fallback plans — the path that used to ignore everything
   except space, goal, and household.

   applyCategoryEdits() runs on the NORMALIZED plan whenever the user edits
   the category list on the review screen (both paths — those edits happen
   after analysis). User edits are authoritative: an unticked category
   disappears from every zone; an added one gets a home in exactly one zone.

   Rules of the layer:
   - Additive steps always cite the user's answer verbatim in `why`.
   - Personalized and safety steps are protected; effort trimming removes
     template filler first and never below the protected set.
   - One trigger per behavior: if two answers ask for the same step (e.g.
     rental=yes and "No drilling"), it's added once, citing the first. */

import { goalIdFor } from './wizard-data.js';

export const EFFORT_STEPS = {
  // design-contract effort labels (the wizard's three options)
  'Quick refresh': 6,
  'Weekend reset': 10,
  'Full overhaul': 13,
  // legacy labels kept so saved drafts and older plans stay personalized
  'Quick 30-minute reset': 6,
  '1-hour cleanup': 8,
  'Weekend project': 10,
  'Full reorganization': 13,
};

const SAFETY_RE = /kid|child|heavy|chemical|sharp|latch|medicine|safety/i;
const FILLER_RE = /photo|wipe|dust|label/i; // trimmed first when effort is low

/* Steps come in two shapes. applyAnswers runs on RAW plans ({task,time,why},
   what the scenarios and the AI emit); applyRevision runs on the NORMALIZED
   plan ({t,m,w}, what state.ai holds after normalizeAi — the Adjust screen
   has nothing else). Every helper reads both spellings and writes new steps
   in the plan's own shape; assuming raw here is how three Adjust options once
   appended a step card that rendered as "undefined / undefined". */
const stepTask = st => (st && (st.task ?? st.t)) || '';
const stepWhy = st => (st && (st.why ?? st.w)) || '';
const stepText = st => stepTask(st) + ' ' + stepWhy(st);
const isNormalized = plan => Array.isArray(plan.steps) && plan.steps.length
  ? ('t' in plan.steps[0]) : Array.isArray(plan.cats);

function hasStep(plan, re) {
  return plan.steps.some(st => re.test(stepText(st)));
}

function addStep(plan, step) {
  const s = { time: '5–10 min', ...step };
  plan.steps.push(isNormalized(plan)
    ? { t: s.task, m: s.time, w: s.why || '', _p: true }
    : { ...s, _p: true }); // _p = personalized, protected
}

/* The core promise: the user's answer is VISIBLE in the plan. If a matching
   step already exists in the scenario, cite the answer on it (and protect it
   from effort trimming); only add a new step when nothing covers the need. */
function ensureCitedStep(plan, re, step, cite) {
  const existing = plan.steps.find(st => re.test(stepText(st)));
  if (existing) {
    const key = 't' in existing ? 'w' : 'why';
    if (!stepWhy(existing).includes(cite)) existing[key] = (stepWhy(existing) + ' ' + cite).trim();
    existing._p = true;
    return existing;
  }
  addStep(plan, { ...step, why: ((step.why || '') + ' ' + cite).trim() });
  return plan.steps[plan.steps.length - 1];
}

function isProtected(st) {
  return !!st._p || SAFETY_RE.test(stepText(st));
}

/* The kid-safe zone is "low but not hazardous". Position alone (map[len-2])
   put the badge on the bathroom's latched chemicals caddy; skipping every
   flagged row entirely picked the pantry's narrow door rack. So: keep the
   original low-zone preference, then walk upward past anything already
   carrying a flag of its own. */
export function lowestUnflaggedZone(map) {
  const rows = Array.isArray(map) ? map : [];
  const order = [];
  if (rows.length >= 2) order.push(rows.length - 2);
  if (rows.length >= 1) order.push(rows.length - 1);
  for (let i = rows.length - 3; i >= 0; i--) order.push(i);
  for (const i of order) {
    const m = rows[i];
    if (m && (!m.safety || !m.safety.flag)) return m;
  }
  return null;
}

function dropNeeds(plan, keepFn) {
  plan.productNeeds = (plan.productNeeds || []).filter(keepFn);
}

function raisePriority(plan, types) {
  (plan.productNeeds || []).forEach(p => { if (types.includes(p.type)) p.priority = 'high'; });
}

/* ---------- individual answer handlers ---------- */

function applyBudget(plan, answers) {
  const budget = answers.budget;
  const ownOnly = (answers.prefs || []).includes('Use only what I already own');
  if (budget === '$0' || ownOnly) {
    plan.productNeeds = [];
    plan.cost = '$0';
    const cite = ownOnly ? 'You told us to use only what you already own.' : 'You set a $0 budget.';
    plan.dontBuy = ((plan.dontBuy || '') + ' ' + cite + ' Every step below works with what is already in the space.').trim();
    if (!hasStep(plan, /shop your (own )?home|repurpose/i)) {
      addStep(plan, {
        task: 'Shop your own home for containers — shoe boxes, jars, trays, and baskets you already have',
        why: cite + ' Repurposed containers do the same job as bought ones.',
      });
    }
    return;
  }
  if (budget === 'Under $50') {
    dropNeeds(plan, p => p.priority === 'high');
    plan.productNeeds = plan.productNeeds.slice(0, 3);
  } else if (budget === 'Under $100') {
    plan.productNeeds = (plan.productNeeds || []).slice(0, 6);
  }
}

// Each pref maps to a concrete, cited change. Order matters only for text.
const PREF_HANDLERS = {
  'Keep frequent items easy to reach': (plan) => {
    const eye = plan.map.find(m => m.eye);
    if (eye) eye.why += ' You asked to keep frequent items easy to reach — this zone is at eye level for exactly that.';
    ensureCitedStep(plan, /eye level|easy to reach/i,
      { task: 'Move your most-used items to the eye-level zone' },
      'You asked to keep frequent items easy to reach.');
  },
  'Hide visual clutter': (plan) => {
    raisePriority(plan, ['basket']);
    ensureCitedStep(plan, /opaque|hidden|out of sight/i,
      { task: 'Move visual clutter into opaque bins or baskets so shelf lines stay calm' },
      'You asked to hide visual clutter.');
  },
  'Kid-friendly access': (plan) => {
    // Cite the zone that IS kid-safe; otherwise promote a low zone that
    // carries no flag of its own. Never touch a keep-high / lock-or-latch
    // row: welding "you asked for kid-friendly access" onto the latched
    // chemicals zone inverts the one warning that matters.
    const existing = plan.map.find(m => m.safety && m.safety.flag === 'kid-safe');
    if (existing) {
      if (!(existing.safety.why || '').includes('kid-friendly access')) {
        existing.safety.why = ((existing.safety.why || '') + ' You asked for kid-friendly access.').trim();
      }
      return;
    }
    const low = lowestUnflaggedZone(plan.map);
    if (low) low.safety = { flag: 'kid-safe', why: 'You asked for kid-friendly access — this lower zone stays reachable and hazard-free.' };
  },
  'No drilling or permanent installation': (plan) => {
    plan.steps = plan.steps.filter(st => !/drill|mount|screw|install hardware/i.test(stepTask(st)));
    dropNeeds(plan, p => !['door-rack', 'hook-rack'].includes(p.type));
    plan.opportunities = plan.opportunities || [];
    plan.opportunities.push('Everything in this plan is freestanding — you asked for no drilling or permanent installation.');
  },
  'Minimal look': (plan) => {
    plan.map.forEach(m => {
      if (m.items && m.items.length > 2) m.items = m.items.slice(0, 2);
    });
    // Style + Adjust can both route here; the sentence must not stack.
    const cite = ' You asked for a minimal look, so each zone keeps fewer visible categories.';
    if (!plan.summary.includes(cite)) plan.summary += cite;
  },
  'Labels and categories': (plan) => {
    raisePriority(plan, ['label-set']);
    ensureCitedStep(plan, /label/i,
      { task: 'Label every zone and container' },
      'You asked for labels and categories — labels are what make the system stick for the whole household.');
  },
  'Maximize vertical space': (plan) => {
    raisePriority(plan, ['shelf-riser', 'can-riser']);
    ensureCitedStep(plan, /riser|vertical|stack/i,
      { task: 'Add risers or stacking to reclaim the empty air above each shelf' },
      'You asked to maximize vertical space.');
  },
  'Make heavy items safer': (plan) => {
    ensureCitedStep(plan, /heavy/i,
      { task: 'Move heavy items to the lowest shelf' },
      'You asked to make heavy items safer — low placement means nothing heavy can fall from height.');
  },
  'Use clear containers': (plan) => {
    raisePriority(plan, ['clear-bin', 'airtight-container']);
    ensureCitedStep(plan, /clear (bin|container)|decant/i,
      { task: 'Decant loose items into clear containers so contents are visible at a glance' },
      'You asked for clear containers.');
  },
  'Use baskets / hidden storage': (plan) => {
    raisePriority(plan, ['basket']);
    ensureCitedStep(plan, /basket/i,
      { task: 'Corral small loose items into baskets, one category per basket' },
      'You asked for baskets and hidden storage.');
  },
  'Easy to maintain': (plan) => {
    // deliberately narrow: a "group by weekly use" step is NOT a maintenance step
    ensureCitedStep(plan, /weekly reset|maintain|5-minute/i,
      { task: 'Set a 5-minute weekly reset: return strays to their zones', time: '5 min / week' },
      'You asked for a system that is easy to maintain — a tiny weekly reset keeps the plan alive.');
  },
  /* The five below back the style cards that used to resolve to nothing. Each
     follows the rule of the layer: if the space's own checklist already does
     this, cite the answer on that step rather than adding a second one. */
  'Use dividers': (plan) => {
    raisePriority(plan, ['drawer-organizer']);
    ensureCitedStep(plan, /divider|one type per compartment|its own slot/i,
      { task: 'Add dividers so each category keeps its own slot and stacks stay upright' },
      'You asked for dividers — a divided space holds its shape without anyone maintaining it.');
  },
  'Matching hangers': (plan) => {
    ensureCitedStep(plan, /hanger/i,
      { task: 'Switch the whole rail to one hanger style, and recycle the rest' },
      'You asked for matching hangers — one hanger depth is what makes a rail read as a single line.');
  },
  'File-fold clothes': (plan) => {
    ensureCitedStep(plan, /file[- ]?fold/i,
      { task: 'File-fold so every item stands upright and shows its edge' },
      'You asked for file-folded drawers — filed upright, nothing gets pulled from under a stack.');
  },
  'Outline tools on a pegboard': (plan) => {
    raisePriority(plan, ['hook-rack']);
    ensureCitedStep(plan, /pegboard|shadow.?board/i,
      { task: 'Outline each tool on the pegboard so the gap shows what has not come back' },
      'You asked for a shadow board — the outline is what makes a missing tool obvious.');
  },
  'One category per drawer': (plan) => {
    ensureCitedStep(plan, /one (?:category|type) per drawer|a drawer per/i,
      { task: 'Give each category its own drawer, and name the front so none of them get shared' },
      'You asked for one category per drawer.');
  },
  'Open to buying storage': (plan) => {
    plan.opportunities = plan.opportunities || [];
    plan.opportunities.push('You are open to buying storage — the shopping list below is sized to your space’s measurements.');
  },
  // 'Use only what I already own' is handled in applyBudget (it zeroes purchases)
  'Use only what I already own': () => {},
};

/* The "Adjust this plan" options on the results screen. Five of them —
   minimal, kid, capacity, hide, labels — used to fall through applyCustomize
   to a re-render of the identical step list while still announcing "Plan
   revised" and a specific change, so the checklist came back byte-for-byte
   the same. Each one already had a preference handler above doing exactly
   what its copy promises, so they route there instead of describing work
   nobody did.

   Applying twice is recorded and refused: ensureCitedStep is idempotent, but
   'Minimal look' appends to the summary, so a second pass would just repeat
   itself. */
export const REVISIONS = {
  minimal:  'Minimal look',
  kid:      'Kid-friendly access',
  capacity: 'Maximize vertical space',
  hide:     'Hide visual clutter',
  labels:   'Labels and categories',
};

/* A revision the user clicked must be visible ON THE REPORT, not only in the
   "Plan revised" banner. Some handlers' whole effect otherwise lands behind
   a collapsed "Why?" disclosure or on the hidden upgrades list (citing an
   existing label step, raising a product's priority) — an invisible change
   under a "Plan revised" toast reads as the button doing nothing. */
const REVISION_NOTES = {
  minimal:  'Each zone keeps fewer visible categories — you asked for a more minimal look.',
  kid:      'A kid-reachable, hazard-free zone is called out on the shelf map — you asked for a more kid-friendly setup.',
  capacity: 'Risers and stacking reclaim the vertical space — you asked to maximize capacity.',
  hide:     'Loose items move into opaque bins and baskets — you asked to hide more clutter.',
  labels:   'Every zone and container gets a label — you asked for more labels.',
};

export function applyRevision(plan, id) {
  const pref = REVISIONS[id];
  const handler = pref && PREF_HANDLERS[pref];
  if (!plan || !handler) return false;
  plan.revisions = Array.isArray(plan.revisions) ? plan.revisions : [];
  if (plan.revisions.includes(id)) return false;
  handler(plan);
  plan.opportunities = plan.opportunities || [];
  if (!plan.opportunities.includes(REVISION_NOTES[id])) plan.opportunities.push(REVISION_NOTES[id]);
  plan.revisions.push(id);
  return true;
}

/* ---------- goals ----------
   The wizard asks "What bugs you most?" and takes as many answers as the
   user wants. Only the FIRST was ever read, and it was read through
   goalIdFor(), which collapses 30 of the 57 options to 'unsure' — a branch
   that does nothing. So a third of a whole step, including every answer for
   the bathroom but one, changed the plan in no way at all.

   These match the answer's own words rather than an id, so a new option in
   SPACE_CFG is covered by whichever rule fits it, and every selected goal
   gets its own cited step instead of only the first.

   Each rule carries three things beyond its advice:
   - `dedupe`, a regex describing the BEHAVIOR, so an existing scenario step
     that already does this is found and cited instead of a near-duplicate
     being appended. Matching the advice's own first words instead — which is
     what this did — never found the scenario's phrasing of the same idea, so
     a dresser plan carried both "File-fold tops so they stand upright" and
     "File-fold so every item stands upright and shows its edge".
   - `noBuy`, the version that works with what is already in the space. A $0
     plan promises "every step below works with what is already in the
     space", so any advice naming a bin, a band or a label needs one.
   - `noOpaque`, for the one piece of advice that contradicts a style the
     wizard also offers: "Use clear containers" and "put it behind an opaque
     front" cannot both be followed. */
const GOAL_ADVICE = [
  { match: /expired|hides in back/i, dedupe: /pull everything forward|oldest at the front/i,
    task: 'Pull everything forward and put the oldest at the front, newest behind',
    why: 'Date-order beats depth-order: what is oldest is what you reach first, so nothing expires unseen.' },
  { match: /restock/i, dedupe: /restock/i,
    task: 'Write the restock level on the shelf edge — the count that means "buy more"',
    why: 'A number on the shelf turns restocking into a glance instead of a memory test.' },
  { match: /hard to keep tidy/i, dedupe: /weekly reset|five-minute/i,
    task: 'Set a five-minute weekly reset and put it in the calendar',
    why: 'Every system drifts. A short scheduled reset is what separates the ones that last from the ones that do not.' },
  { match: /counter|bench is buried|pile up on a chair|floor is a pile/i, dedupe: /named home|landing spot/i,
    task: 'Give the overflow a named home, and clear it as the last step every day',
    why: 'Things pile up in the open because they have nowhere assigned. A named landing spot is what stops the pile re-forming.' },
  { match: /lids|sets get separated/i, dedupe: /as one unit|lid on its base|inside their own pillowcase/i,
    task: 'Store each set as one unit — lid on its base, sheets inside their own pillowcase',
    why: 'A set stored as one piece cannot come apart, which is what makes the hunt disappear.' },
  { match: /junk drawer/i, dedupe: /catch-all/i,
    task: 'Empty the catch-all completely and give each thing in it a real home elsewhere',
    why: 'A catch-all stays a catch-all while it exists. The fix is to stop it being the default destination.' },
  { match: /jam|overflow/i, dedupe: /take out enough|closes with a finger/i,
    task: 'Take out enough that the drawer closes with a finger of space to spare',
    why: 'Jamming is a volume problem, not a layout one. Nothing organizes its way out of being too full.' },
  { match: /outfits take forever/i, dedupe: /group by when you wear|by occasion/i,
    task: 'Group by when you wear it — work, weekend, formal — not by garment type',
    why: 'You choose clothes by occasion, so grouping by occasion means the decision is made by walking to one section.' },
  { match: /folding never lasts/i, dedupe: /file[- ]?fold/i,
    task: 'File-fold so every item stands upright and shows its edge',
    why: 'A stack hides everything below the top. Filed upright, nothing gets pulled out of the middle.' },
  { match: /multiplying/i, dedupe: /duplicate/i,
    task: 'Gather every duplicate into one place and keep only the open one plus a single backup',
    why: 'Duplicates multiply because backstock is invisible. Once it is in one place, the count is obvious.' },
  { match: /under-sink is a jumble/i, dedupe: /around the plumbing|either side of the trap/i,
    task: 'Work around the plumbing: two shallow zones either side of the trap, nothing behind it',
    why: 'The pipe is the constraint. Zoning around it beats stacking against it.' },
  { match: /avalanche/i, dedupe: /shelf divider|front-to-back/i,
    task: 'Add shelf dividers so each stack is held upright and can be pulled without the rest following',
    noBuy: 'Split each stack in two and turn the halves front-to-back, so pulling one does not topple the rest',
    why: 'An avalanche means the stacks are leaning on each other. Dividers make each one independent.' },
  // the garage already boxes its holiday decorations; that is this behavior
  { match: /seasonal stuff gets buried/i, dedupe: /each season in its own|holiday decorations into|seasonal items and lift/i,
    task: 'Put each season in its own labelled bin and rotate the current one to the front',
    noBuy: 'Put each season in its own box or bag you already have, and rotate the current one to the front',
    why: 'Seasonal storage only works if swapping takes one motion twice a year.' },
  { match: /small parts/i, dedupe: /small parts into/i,
    task: 'Sort small parts into a compartment box, one type per compartment, and label the lid',
    noBuy: 'Sort small parts into jars or cut-down boxes, one type each, and mark the lids',
    why: 'Loose small parts cost more time to search than they cost to replace. Compartments end that.' },
  { match: /cords tangle/i, dedupe: /coil (?:each cable|cords)/i,
    task: 'Coil each cable, band it, and label what it belongs to',
    noBuy: 'Coil each cable, tie it with its own plug lead, and write what it belongs to on a tape flag',
    why: 'A coiled, labelled cable takes a quarter of the space and never needs identifying twice.' },
  /* The four goals that DO map to an id already move the summary, the
     opportunities and the product priorities — but through applyGoal, which
     never quotes the user. These give them the verbatim citation every other
     answer in this layer carries. */
  /* Any labelling step counts: nearly every space's own checklist already
     labels something ("Label each drawer by category", "Label every shelf
     edge"), and a second, more general label step next to it was the most
     common duplicate this layer produced. */
  { match: /can't find|cannot find/i, dedupe: /\blabell?(?:s|ed|ing)?\b/i,
    task: 'Label the front edge of every zone so the whole household can find things without asking',
    noBuy: 'Write each zone on a strip of tape along the front edge, so the whole household can find things without asking',
    why: 'Searching is what a labelled zone removes; the label is read from the doorway, not the shelf.' },
  { match: /running out of room|no room for the car/i, dedupe: /\briser\b/i,
    task: 'Measure the empty air above each level and add a riser or a stacking bin to claim it',
    noBuy: 'Measure the empty air above each level and reuse a sturdy box as a riser to claim it',
    why: 'Most spaces are short on usable levels, not on volume — the gap above each shelf is the room you already own.' },
  { match: /kids can't reach/i, dedupe: /reach standing flat|zone they can reach/i,
    task: 'Move the things they get for themselves down to the zone they can reach standing flat',
    why: 'Independence is a height question: what a child can reach unaided is what they will put back.' },
  { match: /looks cluttered/i, dedupe: /opaque front|onto one level and keep/i,
    task: 'Put the visually noisy things behind one opaque front, and keep the open levels sparse',
    noBuy: 'Group the visually noisy things onto one level and keep the others sparse',
    noOpaque: 'Group the visually noisy things onto one level and keep the others sparse',
    why: 'A calm space is mostly about how many different things are visible at once, not how much is stored.' },
];

function applyGoals(plan, answers) {
  const goals = (answers.goals || []).filter(g => typeof g === 'string' && g.trim());
  if (!goals.length) return;
  /* Goal steps are personalized, so effort trimming protects them — which
     means an unbounded number of them evicts the whole space-specific
     checklist. A closet with all seven goals on "Quick refresh" came out as
     seven pieces of generic advice and nothing about closets. So they are
     capped at a third of the plan.

     The cap only counts answers that produce a NEW step. Attaching a
     citation to a step the plan already has costs the checklist nothing, and
     counting those spent the whole budget on one step: a garage plan given
     "Always running out of room" and "No room for the car" — one rule, one
     step, two citations — had no room left for a third answer. */
  const cap = Math.max(1, Math.floor((EFFORT_STEPS[answers.effort] || 10) / 3));
  const ownOnly = answers.budget === '$0' || (answers.prefs || []).includes('Use only what I already own');
  const clearWanted = (answers.prefs || []).includes('Use clear containers');
  /* When the cap does bite it should fall on the answer that has another way
     into the plan. Exactly one answer has one: the wizard sends goals[0]
     through goalIdFor to state.goal, and applyGoal moves the summary, the
     opportunities and the product priorities from it. Every other answer has
     its step and nothing else — so goals[0] goes last when it maps to an id
     applyGoal understands. Click order alone dropped the answers with no
     other route, which is the opposite of what the cap is for. */
  const queue = goals
    .map((goal, i) => ({ goal, i, spare: i === 0 && goalIdFor(goal) !== 'unsure' }))
    .sort((a, b) => (a.spare - b.spare) || (a.i - b.i));
  let added = 0;
  const unplanned = [];
  for (const { goal } of queue) {
    const rule = GOAL_ADVICE.find(r => r.match.test(goal));
    if (!rule) continue;
    const task = (ownOnly && rule.noBuy) || (clearWanted && rule.noOpaque) || rule.task;
    const fresh = !plan.steps.some(st => rule.dedupe.test(stepText(st)));
    if (fresh && added >= cap) { unplanned.push(goal); continue; }
    // The user's own words, verbatim — the rule of this layer.
    ensureCitedStep(plan, rule.dedupe, { task, why: rule.why }, `You told us: “${goal}”.`);
    if (fresh) added++;
  }
  /* Saying nothing was the real bug: a pantry on "Quick refresh" quietly
     dropped five of seven answers, and the plan read as though it had acted
     on all of them. Name what was left out, and what would take it in. */
  if (unplanned.length) {
    const quoted = unplanned.map(g => `“${g}”`);
    const list = quoted.length > 1
      ? quoted.slice(0, -1).join(', ') + ' and ' + quoted[quoted.length - 1]
      : quoted[0];
    plan.opportunities = plan.opportunities || [];
    plan.opportunities.push(
      `${list} ${unplanned.length > 1 ? 'are' : 'is'} not in this checklist — a `
      + `${String(answers.effort || 'short session').toLowerCase()} only fits so many changes. Choose a longer session to plan `
      + `${unplanned.length > 1 ? 'them' : 'it'} in.`);
  }
}

/* A $0 plan promises "every step below works with what is already in the
   space", and then the space's own checklist said "Bin the backstock and
   label the bins", "Put all chemicals in one caddy" and "Stand baking sheets
   upright using vertical dividers" — 27 of the 33 setups named a container to
   buy while the plan said not to buy one. Swapping the goal advice was not
   enough; the scenario content needed the same treatment.

   Every replacement is a phrase that cannot match again after it is made, so
   the rules cannot cascade into each other whatever order they run in. */
const OWN_ONLY_WORDS = [
  [/\bBin (?=[a-z])/g, 'Box up '],
  [/\bin a bin\b/gi, 'in a box you already have'],
  [/\bto bins\b/gi, 'to boxes you already have'],
  [/\bvertical dividers\b/gi, 'a box on its side as a divider'],
  [/\bshelf dividers\b/gi, 'a box turned on its side'],
  [/\bcadd(?:y|ies)\b/gi, 'tray or box'],
  [/\bbins\b/gi, 'boxes'],
  [/\bbin\b/gi, 'box'],
];

function ownOnlyVocabulary(plan) {
  /* Zone names are places, not purchases, and the checklist references them
     by name — rewriting "Set up the Beach towels bin zone" would point the
     step at a zone the map does not have. */
  const zones = (plan.map || []).map(m => m.zone).filter(z => typeof z === 'string' && z.trim());
  const fix = (text) => {
    const t = String(text || '');
    if (!t || zones.some(z => t.includes(z))) return text;
    return OWN_ONLY_WORDS.reduce((acc, [re, to]) => acc.replace(re, to), t);
  };
  plan.steps = (plan.steps || []).map(s => ('t' in s ? { ...s, t: fix(s.t) } : { ...s, task: fix(s.task) }));
}

function applyPrefs(plan, answers) {
  for (const pref of answers.prefs || []) {
    const h = PREF_HANDLERS[pref];
    if (h) h(plan);
  }
}

function applyToggles(plan, answers) {
  const t = answers.toggles || {};
  const prefs = new Set(answers.prefs || []);
  // Each toggle reuses the matching pref behavior unless that pref already ran.
  if ((t.rental === 'yes' || t.drill === 'no') && !prefs.has('No drilling or permanent installation')) {
    PREF_HANDLERS['No drilling or permanent installation'](plan);
    plan.opportunities[plan.opportunities.length - 1] =
      t.rental === 'yes'
        ? 'Everything in this plan is freestanding — you said this is a rental, so nothing needs drilling.'
        : 'Everything in this plan is freestanding — you said drilling isn’t an option.';
  }
  if (t.heavy === 'yes' && !prefs.has('Make heavy items safer')) {
    ensureCitedStep(plan, /heavy/i,
      { task: 'Move heavy items to the lowest shelf' },
      'You said this space holds heavy items — low placement keeps them safe to lift and impossible to drop from height.');
  }
  if (t.hidden === 'yes' && !prefs.has('Hide visual clutter')) {
    ensureCitedStep(plan, /opaque|hidden/i,
      { task: 'Give must-stay-hidden items a dedicated opaque bin' },
      'You said some items must stay hidden.');
  }
  if (t.daily === 'yes' && !prefs.has('Keep frequent items easy to reach')) {
    ensureCitedStep(plan, /eye level|easy to reach|daily/i,
      { task: 'Park daily-use items in the easiest-to-reach zone' },
      'You said some items are used daily — they earn the prime real estate.');
  }
  if (t.rarely === 'yes') {
    ensureCitedStep(plan, /rarely|top shelf.*(bulk|backup)|seasonal/i,
      { task: 'Move rarely used items to the highest or deepest zone' },
      'You said some items are rarely used — they shouldn’t occupy prime space.');
  }
  if (t.kids === 'yes' && !prefs.has('Kid-friendly access')) {
    PREF_HANDLERS['Kid-friendly access'](plan);
    // Re-word whichever zone the handler actually settled on, rather than
    // assuming it landed at a fixed index.
    const low = (plan.map || []).find(m => m.safety && m.safety.flag === 'kid-safe');
    if (low) {
      low.safety.why = 'You said kids will access this space — this lower zone stays reachable and hazard-free.';
    }
  }
}

function applyDims(plan, answers) {
  const d = answers.dims;
  if (!d) return;
  plan.opportunities = plan.opportunities || [];
  if (d.d_in && d.d_in >= 16) {
    // If the scenario already recommends a turntable, cite the measurement on
    // it; otherwise surface the depth advice as an opportunity.
    const tt = (plan.productNeeds || []).find(p => p.type === 'turntable');
    if (tt) tt.purpose += ` Your shelves measure ${d.d_in}″ deep, so items at the back are otherwise out of reach.`;
    else plan.opportunities.push(`Your shelves are ${d.d_in}″ deep — a turntable or pull-out tray stops things from vanishing at the back.`);
  }
  if (d.w_in && d.w_in <= 24) {
    plan.opportunities.push(`At ${d.w_in}″ wide, this space works best with one category per shelf instead of side-by-side zones.`);
  }
}

function applyEffort(plan, answers) {
  const target = EFFORT_STEPS[answers.effort];
  if (!target) return;
  const cite = `You chose “${answers.effort}”.`;

  if (plan.steps.length > target) {
    // Trim template filler first, from the end; personalized/safety survive.
    const removable = plan.steps
      .map((st, i) => ({ st, i }))
      .filter(x => !isProtected(x.st));
    const fillerFirst = [
      ...removable.filter(x => FILLER_RE.test(stepTask(x.st))),
      ...removable.filter(x => !FILLER_RE.test(stepTask(x.st))).reverse(),
    ];
    const toDrop = new Set();
    for (const x of fillerFirst) {
      if (plan.steps.length - toDrop.size <= target) break;
      toDrop.add(x.i);
    }
    plan.steps = plan.steps.filter((_, i) => !toDrop.has(i));
  } else if (plan.steps.length < target) {
    // A bigger commitment earns per-zone depth: one setup pass per uncovered zone.
    for (const m of plan.map) {
      if (plan.steps.length >= target) break;
      const zoneWord = (m.zone || '').split(/\s*·\s*|,/)[0].trim();
      if (!zoneWord || hasStep(plan, new RegExp(zoneWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))) continue;
      addStep(plan, {
        task: `Set up the ${zoneWord} zone (${m.level ?? m.lv})`,
        why: `${cite} A full pass gives every zone its own dedicated setup step.`,
      });
    }
  }

  const times = {
    'Quick refresh': '~30 min', 'Weekend reset': '2–3 hours', 'Full overhaul': '4–8 hours',
    'Quick 30-minute reset': '~30 min', '1-hour cleanup': '~1 hour', 'Weekend project': '2–4 hours', 'Full reorganization': '4–8 hours',
  };
  if (times[answers.effort]) plan.time = capTimeToPlan(times[answers.effort], plan.steps);
}

/* The effort label alone used to set the headline time, and it was wrong in
   both directions: a two-level overhead rack with six steps announced
   "Full overhaul · 4–8 hours" over about an hour of work, while every
   "Quick refresh" promised "~30 min" over a checklist that adds up to an
   hour or more.

   The effort answer chooses the SCOPE of the plan (how many steps it runs
   to — see EFFORT_STEPS). The time is then a fact about the steps that
   ended up on the page, not a restatement of the label, so the number the
   user reads always matches the checklist under it. */
const TIME_BANDS = [
  [45, '~30 min'], [100, '45–90 min'], [200, '2–3 hours'], [330, '3–5 hours'], [Infinity, '4–8 hours'],
];
const BAND_ORDER = TIME_BANDS.map(b => b[1]);

export function planMinutes(steps) {
  return (steps || []).reduce((sum, st) => {
    const raw = String((st && (st.time ?? st.m)) || '');
    const m = raw.match(/(\d+)(?:\s*[–-]\s*(\d+))?/);
    if (!m) return sum;
    // "5 min / week" is a maintenance cadence, not part of the one-off job.
    if (/\/\s*week/i.test(raw)) return sum;
    return sum + (m[2] ? (Number(m[1]) + Number(m[2])) / 2 : Number(m[1]));
  }, 0);
}

export function capTimeToPlan(label, steps) {
  const mins = planMinutes(steps);
  /* Always derived from the steps, never from the label. Gating this on
     `BAND_ORDER.includes(label)` made the correction depend on whether an
     effort's canned string happened to collide with a band name: of the four
     legacy labels, "Quick 30-minute reset" and "Full reorganization" were
     corrected and "1-hour cleanup" and "Weekend project" were not, so a
     saved plan could still announce "2–4 hours" over 42 minutes of steps.
     The only case for keeping the label is a plan whose steps carry no
     times at all, where there is nothing to derive from. */
  if (!mins) return label;
  return TIME_BANDS.find(([max]) => mins < max)[1];
}

/* Apply the full wizard answer set to a raw plan. Mutates and returns it. */
export function applyAnswers(plan, answers) {
  if (!plan || !answers) return plan;
  plan.steps = plan.steps || [];
  plan.map = plan.map || [];
  applyBudget(plan, answers);
  applyGoals(plan, answers);   // before prefs, so a pref can cite a goal's step
  applyPrefs(plan, answers);
  applyToggles(plan, answers);
  applyDims(plan, answers);
  // after every layer that can add a step, so none of them slips a purchase past it
  if (answers.budget === '$0' || (answers.prefs || []).includes('Use only what I already own')) ownOnlyVocabulary(plan);
  applyEffort(plan, answers); // last: sizes the final step list
  return plan;
}

/* ---------- review-screen category edits (normalized plan, both paths) ----------
   The user's category list is authoritative. Remove unticked categories from
   every zone; give added ones a home in exactly one zone (best keyword fit,
   else the eye-level zone). */
export function applyCategoryEdits(normalized, cats) {
  if (!normalized || !Array.isArray(normalized.map) || !Array.isArray(cats)) return normalized;
  const want = cats.map(c => c.trim()).filter(Boolean);
  const stem = (s2) => String(s2 || '').toLowerCase().trim().replace(/s$/, '');
  const wantStems = new Set(want.map(stem));
  // Categories the user REMOVED this edit (were in the plan's list, not
  // wanted now). Each becomes a plural-tolerant, word-bounded phrase regex so
  // multi-word categories ("Paper goods") match zone labels and item names.
  const removed = (normalized.cats || []).filter(c => !wantStems.has(stem(c)));
  const removedRes = removed.map(c => new RegExp(
    '\\b' + c.toLowerCase().trim().split(/[^a-z0-9’']+/).filter(Boolean)
      .map(w => w.replace(/s$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?')
      .join('[^a-z0-9]+') + '\\b', 'i'));
  const mentionsRemoved = (text) => removedRes.some(re => re.test(String(text || '')));

  const allZoneNames = new Set();
  normalized.map.forEach(m => {
    // Drop items that belong to a removed category (stem match catches
    // "Snack packets" when "Snacks" was removed).
    m.items = (m.items || []).filter(it => !mentionsRemoved(it.name));
    m.items.forEach(it => allZoneNames.add(stem(it.name)));
    // Zone labels are category joins ("Snacks · Cereal") — rewrite them too,
    // or the removed word survives on the shelf map.
    const parts = String(m.zone || '').split(/\s*·\s*/).filter(p => !mentionsRemoved(p));
    m.zone = parts.length ? parts.join(' · ')
      : (m.items.length ? m.items.map(i => i.name).slice(0, 3).join(' · ') : 'Flexible space');
    // Placement rationales reference categories by name too; drop only the
    // sentences that mention a removed category, keep the rest intact.
    if (mentionsRemoved(m.why)) {
      const kept = String(m.why || '').split(/(?<=\.)\s+/).filter(s2 => !mentionsRemoved(s2));
      m.why = kept.join(' ').trim() || 'Placement updated to match your category list.';
    }
  });

  // Place added categories: best keyword fit against zone/level text, else eye level.
  for (const cat of want) {
    if (allZoneNames.has(stem(cat))) continue;
    const catRe = new RegExp(cat.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const fit = normalized.map.find(m => catRe.test(m.zone + ' ' + m.lv))
      || normalized.map.find(m => m.eye)
      || normalized.map[0];
    if (fit) {
      fit.items = fit.items || [];
      fit.items.push({ name: cat, size: 'm', flags: [] });
      allZoneNames.add(stem(cat));
    }
  }

  normalized.cats = want;
  return normalized;
}
