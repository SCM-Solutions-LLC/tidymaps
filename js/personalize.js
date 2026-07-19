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

export const EFFORT_STEPS = {
  'Quick 30-minute reset': 6,
  '1-hour cleanup': 8,
  'Weekend project': 10,
  'Full reorganization': 13,
};

const SAFETY_RE = /kid|child|heavy|chemical|sharp|latch|medicine|safety/i;
const FILLER_RE = /photo|wipe|dust|label/i; // trimmed first when effort is low

function hasStep(plan, re) {
  return plan.steps.some(st => re.test(st.task + ' ' + (st.why || '')));
}

function addStep(plan, step) {
  plan.steps.push({ time: '5–10 min', ...step, _p: true }); // _p = personalized, protected
}

/* The core promise: the user's answer is VISIBLE in the plan. If a matching
   step already exists in the scenario, cite the answer on it (and protect it
   from effort trimming); only add a new step when nothing covers the need. */
function ensureCitedStep(plan, re, step, cite) {
  const existing = plan.steps.find(st => re.test(st.task + ' ' + (st.why || '')));
  if (existing) {
    if (!(existing.why || '').includes(cite)) existing.why = ((existing.why || '') + ' ' + cite).trim();
    existing._p = true;
    return existing;
  }
  addStep(plan, { ...step, why: ((step.why || '') + ' ' + cite).trim() });
  return plan.steps[plan.steps.length - 1];
}

function isProtected(st) {
  return !!st._p || SAFETY_RE.test((st.task || '') + ' ' + (st.why || ''));
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
    const low = plan.map[plan.map.length - 2] || plan.map[plan.map.length - 1];
    if (low && (!low.safety || !low.safety.flag)) {
      low.safety = { flag: 'kid-safe', why: 'You asked for kid-friendly access — this lower zone stays reachable and hazard-free.' };
    }
  },
  'No drilling or permanent installation': (plan) => {
    plan.steps = plan.steps.filter(st => !/drill|mount|screw|install hardware/i.test(st.task));
    dropNeeds(plan, p => !['door-rack', 'hook-rack'].includes(p.type));
    plan.opportunities = plan.opportunities || [];
    plan.opportunities.push('Everything in this plan is freestanding — you asked for no drilling or permanent installation.');
  },
  'Minimal look': (plan) => {
    plan.map.forEach(m => {
      if (m.items && m.items.length > 2) m.items = m.items.slice(0, 2);
    });
    plan.summary += ' You asked for a minimal look, so each zone keeps fewer visible categories.';
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
  'Open to buying storage': (plan) => {
    plan.opportunities = plan.opportunities || [];
    plan.opportunities.push('You are open to buying storage — the shopping list below is sized to your space’s measurements.');
  },
  // 'Use only what I already own' is handled in applyBudget (it zeroes purchases)
  'Use only what I already own': () => {},
};

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
    const low = plan.map[plan.map.length - 2] || plan.map[plan.map.length - 1];
    if (low && low.safety && low.safety.flag === 'kid-safe') {
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
      ...removable.filter(x => FILLER_RE.test(x.st.task)),
      ...removable.filter(x => !FILLER_RE.test(x.st.task)).reverse(),
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
        task: `Set up the ${zoneWord} zone (${m.level})`,
        why: `${cite} A full pass gives every zone its own dedicated setup step.`,
      });
    }
  }

  const times = { 'Quick 30-minute reset': '~30 min', '1-hour cleanup': '~1 hour', 'Weekend project': '2–4 hours', 'Full reorganization': '4–8 hours' };
  if (times[answers.effort]) plan.time = times[answers.effort];
}

/* Apply the full wizard answer set to a raw plan. Mutates and returns it. */
export function applyAnswers(plan, answers) {
  if (!plan || !answers) return plan;
  plan.steps = plan.steps || [];
  plan.map = plan.map || [];
  applyBudget(plan, answers);
  applyPrefs(plan, answers);
  applyToggles(plan, answers);
  applyDims(plan, answers);
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
