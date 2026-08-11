/* ============================================================
   Wizard screens — the design-contract 12-step flow.

   room → area → setup → measurements → photos → household →
   contents → goals → style → effort → shopping → review

   Screens whose content depends on earlier answers (area list, setup
   cards, per-space questions, review summary) are re-rendered every
   time they're entered — the router calls renderWizardScreen(id) from
   go(). All copy is lifted verbatim from TidyMap Wizard.dc.html.
   ============================================================ */
import {
  ROOMS, AREAS, SPACE_CFG, STYLESETS, SETUP_TYPES, SETUP_DIMS, ROOMY,
  KID_AGES, MOBILITY_NEEDS, PET_TYPES, EFFORT_OPTS, SHOPPING_OPTS,
  roomFor, areaFor, roomLower, goalIdFor, prefsForStyles, optionsForHousehold,
  fmtFt, measureSummary, art,
} from '../wizard-data.js';
import { state, resetPlanRecord, clearGuestMedia } from '../state.js';
import { escapeHtml } from '../ui.js';
import { updateGate } from '../router.js';
import { renderPhotoTiles } from './capture.js';

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-11"/></svg>';

/* Step order — the single source for numbering, progress, and context. */
export const WIZARD_STEPS = ['space','area','setup','measure','capture','household','contents','goals','style','effort','shopping','review'];
export function stepNumFor(id){ return WIZARD_STEPS.indexOf(id) + 1; }

/* ---------- selection state transitions ---------- */

export function setRoom(roomId){
  if(state.room === roomId) return;
  setArea(roomId, (AREAS[roomId] || [])[0].id);
}

/* Changing the area resets everything downstream that depends on it:
   setup type, measurements, categories, goals, styles, and detection — and,
   just as importantly, the plan record and the photos.

   Leaving the plan record behind was a data-loss bug: `activeSpaceId` survived
   the switch, so saving the second space UPDATEd the first space's row instead
   of inserting a new one and overwrote every column of it. The photos matter
   for the same reason — shots of a pantry must not be analysed as a closet and
   then filed against the closet's record. */
export function setArea(roomId, spaceId){
  resetPlanRecord(state);
  clearGuestMedia(state);
  state.room = roomId;
  state.space = spaceId;
  const st = (SETUP_TYPES[spaceId] || [])[0];
  state.setup = st ? st.id : 'cabinet';
  state.setupLabel = st ? st.label : 'Cabinet';
  state.setupTouched = false;   // a preselection, until the user picks one
  applySetupDims(st.id);
  state.cats = [];
  state.catsTouched = false;
  state.goals = [];
  state.goal = null;
  state.styles = [];
  state.detected = [];
  recomputePrefs();
}

export function setSetup(setupId){
  const st = (SETUP_TYPES[state.space] || []).find(t => t.id === setupId);
  if(!st) return;
  // Re-confirming the card that is already selected (coming Back, or Review's
  // Edit) must not reset measurements the user typed on the next step —
  // defaults only apply when the setup actually changes.
  const changed = state.setup !== st.id;
  state.setup = st.id;
  state.setupLabel = st.label;
  state.setupTouched = true;   // an actual choice, not the preselected default
  if(changed) applySetupDims(st.id);
}

function applySetupDims(setupId){
  const dd = SETUP_DIMS[setupId] || { w: 3, h: 6.5, d: 1.5 };
  state.dimsFt = { w: dd.w, h: dd.h, d: dd.d };
  syncDims();
}

/* dims are stored in inches (the plan/3D contract); dimsFt drives the UI. */
export function dimsFtNums(){
  const dd = SETUP_DIMS[state.setup] || { w: 3, h: 6.5, d: 1.5 };
  const f = state.dimsFt || dd;
  const n = (v, fb) => { const x = parseFloat(v); return Number.isFinite(x) && x > 0 ? x : fb; };
  return { w: n(f.w, dd.w), h: n(f.h, dd.h), d: n(f.d, dd.d) };
}
function syncDims(){
  const n = dimsFtNums();
  state.dims = {
    w_in: Math.round(n.w * 12),
    h_in: Math.round(n.h * 12),
    d_in: Math.round(n.d * 12),
    shelves: (state.dims && state.dims.shelves) || null,
  };
}

/* Styles + shopping answers feed the deterministic personalization layer
   through the existing preference vocabulary; raw labels also travel in the
   analysis context for the AI path. */
export function recomputePrefs(){
  const prefs = prefsForStyles(state.styles);
  if(state.shoppingPref === 'Use what I have'){
    prefs.add('Use only what I already own');
    state.budget = '$0';
    state.upgrades = false;
  }else{
    prefs.add('Open to buying storage');
    if(state.budget === '$0') state.budget = null;
    state.upgrades = true;
  }
  state.prefs = prefs;
}

/* ---------- footer context string ---------- */
export function wizardContextString(screenId){
  const step = stepNumFor(screenId);
  if(step <= 1) return '';
  const room = roomFor(state.space);
  const area = areaFor(state.space);
  const n = dimsFtNums();
  const roomy = ROOMY.includes(state.setup);
  const ctx = [room.label, area.label];
  if(step > 3 && state.setupLabel) ctx.push(state.setupLabel);
  if(step > 4) ctx.push(roomy ? fmtFt(n.w) + ' × ' + fmtFt(n.d) : fmtFt(n.w) + ' × ' + fmtFt(n.h));
  const kids = state.household.kidCount || 0;
  if(step > 6 && kids > 0) ctx.push(plural(kids, 'kid'));
  return ctx.join('  ·  ');
}

function plural(n, w){ return n + ' ' + w + (n === 1 ? '' : 's'); }

/* ---------- card / chip renderers ---------- */

function cardArt(entry){
  // The label beneath each illustration already names it, so the art is
  // decorative for assistive technology and never duplicates button copy.
  return art(entry.artKey);
}

function markSelected(wrap, active){
  [...wrap.children].forEach(card => {
    const selected = card === active;
    card.classList.toggle('sel', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
}

function renderRoom(){
  const wrap = document.getElementById('room-cards');
  if(!wrap) return;
  wrap.innerHTML = '';
  ROOMS.forEach((room, index) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'room-card' + (state.room === room.id ? ' sel' : '');
    b.setAttribute('aria-pressed', String(state.room === room.id));
    b.innerHTML = `
      <div class="rc-img card-visual tone-${index % 4}">${cardArt(room)}</div>
      <span class="rc-check">${CHECK}</span>
      <div class="rc-label"><h3>${room.label}</h3><p>${room.desc}</p></div>`;
    b.onclick = () => { setRoom(room.id); markSelected(wrap, b); updateGate(); };
    wrap.appendChild(b);
  });
}

function renderArea(){
  const wrap = document.getElementById('area-cards');
  if(!wrap) return;
  const h = document.querySelector('#screen-area h2');
  if(h) h.textContent = `Where in the ${roomLower(state.room)}?`;
  wrap.innerHTML = '';
  (AREAS[state.room] || []).forEach((a, index) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'room-card' + (state.space === a.id ? ' sel' : '');
    b.setAttribute('aria-pressed', String(state.space === a.id));
    b.innerHTML = `
      <div class="rc-img card-visual tone-${index % 4}">${cardArt(a)}</div>
      <span class="rc-check">${CHECK}</span>
      <div class="rc-label"><h3>${a.label}</h3><p>${a.desc}</p></div>`;
    b.onclick = () => {
      if(state.space !== a.id){
        /* setArea() clears the uploaded photos and resets the measurements to
           the new setup's defaults. Both are things the user typed or took, and
           losing them silently is the worst thing this wizard did — the photo
           step even went on displaying the old tiles afterwards. Ask first, and
           only when there is actually something to lose. */
        if(!confirmAreaChange(a.label)){ markSelected(wrap, wrap.querySelector('.sel')||b); return; }
        setArea(state.room, a.id);
      }
      markSelected(wrap, b); updateGate();
    };
    wrap.appendChild(b);
  });
}

/* True if it is safe to proceed: nothing to lose, or the user said go ahead.
   Note state.dimsFt is always populated — every setup seeds it with defaults —
   so "did they measure?" has to mean "does it differ from the default", not
   "is it set". Otherwise this asks on every single area change. */
function confirmAreaChange(nextLabel){
  const photos = state.uploadedFiles.length;
  const def = SETUP_DIMS[state.setup];
  const cur = dimsFtNums();
  const typed = !!def && (cur.w !== def.w || cur.h !== def.h || cur.d !== def.d);
  if(!photos && !typed) return true;
  const lost = [];
  if(photos) lost.push(photos === 1 ? 'your photo' : `your ${photos} photos`);
  if(typed)  lost.push('the measurements you entered');
  return confirm(
    `Switching to ${nextLabel} starts that space fresh, so ${lost.join(' and ')} will be cleared.\n\nSwitch anyway?`
  );
}

function renderSetup(){
  const wrap = document.getElementById('setup-cards');
  if(!wrap) return;
  const area = areaFor(state.space);
  const h = document.querySelector('#screen-setup h2');
  if(h) h.textContent = `Which one looks like your ${area.short}?`;
  wrap.innerHTML = '';
  (SETUP_TYPES[state.space] || []).forEach((t, index) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wz-setup' + (state.setup === t.id ? ' sel' : '');
    b.setAttribute('aria-pressed', String(state.setup === t.id));
    b.innerHTML = `
      <span class="wz-check">${CHECK}</span>
      <span class="ws-img card-visual tone-${index % 4}">${cardArt(t)}</span>
      <span class="ws-ttl">${t.label}</span>
      <span class="ws-sub">${t.desc}</span>`;
    b.onclick = () => { setSetup(t.id); markSelected(wrap, b); };
    wrap.appendChild(b);
  });
}

/* ---------- measurements ---------- */

const MEASURE_FIELDS = [
  { k: 'w', label: 'Width', min: 1, max: 14, aria: 'Width in feet' },
  { k: 'd', label: 'Depth', min: 0.5, max: 10, aria: 'Depth in feet' },
  { k: 'h', label: 'Height', min: 1, max: 10, aria: 'Height in feet' },
];

function renderMeasure(){
  const wrap = document.getElementById('measure-fields');
  if(!wrap) return;
  const area = areaFor(state.space);
  const h = document.querySelector('#screen-measure h2');
  if(h) h.textContent = `How big is your ${area.short}?`;
  const roomy = ROOMY.includes(state.setup);
  const n = dimsFtNums();
  const raw = state.dimsFt || n;
  wrap.innerHTML = MEASURE_FIELDS.map(f => `
    <label class="wz-measure">
      <span class="wm-row">
        <span class="wm-name">${f.k === 'd' && roomy ? 'Room depth' : f.label}</span>
        <span class="wm-input">
          <input type="number" min="${f.min}" max="${f.max}" step="0.25" value="${raw[f.k]}"
            id="m-num-${f.k}" aria-label="${f.aria}" inputmode="decimal">
          <span class="wm-unit">ft</span>
          <span class="wm-val" id="m-val-${f.k}">${fmtFt(n[f.k])}</span>
        </span>
      </span>
      <input type="range" min="${f.min}" max="${f.max}" step="0.25" value="${n[f.k]}" id="m-range-${f.k}" aria-label="${f.aria}">
    </label>`).join('');

  MEASURE_FIELDS.forEach(f => {
    const num = document.getElementById('m-num-' + f.k);
    const range = document.getElementById('m-range-' + f.k);
    num.oninput = () => {
      state.dimsFt = state.dimsFt || dimsFtNums();
      state.dimsFt[f.k] = num.value === '' ? '' : parseFloat(num.value);
      syncDims(); refreshMeasure(f.k, false);
    };
    num.onblur = () => {
      // Same guard as oninput: dimsFt is legitimately null for a plan that
      // never measured anything (the sample plan, a restored draft with no
      // dims), and blur fires on a field the user only focused.
      state.dimsFt = state.dimsFt || dimsFtNums();
      const v = Math.min(f.max, Math.max(f.min, dimsFtNums()[f.k]));
      state.dimsFt[f.k] = v; num.value = v;
      syncDims(); refreshMeasure(f.k, true);
    };
    range.oninput = () => {
      state.dimsFt = state.dimsFt || dimsFtNums();
      state.dimsFt[f.k] = parseFloat(range.value);
      num.value = range.value;
      syncDims(); refreshMeasure(f.k, false);
    };
  });
  refreshMeasureSummary();
}

function refreshMeasure(k, syncRange){
  const n = dimsFtNums();
  const val = document.getElementById('m-val-' + k);
  if(val) val.textContent = fmtFt(n[k]);
  const range = document.getElementById('m-range-' + k);
  if(range && (syncRange || Math.abs(parseFloat(range.value) - n[k]) > 0.001)) range.value = n[k];
  refreshMeasureSummary();
}

function refreshMeasureSummary(){
  const el = document.getElementById('measure-summary');
  if(el) el.innerHTML = `About <b>${escapeHtml(measureSummary(state.setup, dimsFtNums()))}</b> — sound right?`;
}

/* ---------- household ---------- */

const PEOPLE = [
  { k: 'adults', label: 'Adults' },
  { k: 'kidCount', label: 'Kids' },
  { k: 'petCount', label: 'Pets' },
];

function renderHousehold(){
  const wrap = document.getElementById('people-rows');
  if(!wrap) return;
  const h = state.household;
  wrap.innerHTML = PEOPLE.map(p => `
    <div class="wz-count">
      <span class="wc-name">${p.label}</span>
      <div class="wc-ctl">
        <button type="button" class="wc-btn" data-k="${p.k}" data-d="-1" aria-label="Fewer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12h14"/></svg>
        </button>
        <span class="wc-val" id="count-${p.k}">${h[p.k] || 0}</span>
        <button type="button" class="wc-btn" data-k="${p.k}" data-d="1" aria-label="More">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
    </div>`).join('');
  wrap.querySelectorAll('.wc-btn').forEach(btn => {
    btn.onclick = () => {
      const k = btn.dataset.k, d = parseInt(btn.dataset.d, 10);
      h[k] = Math.max(0, Math.min(12, (h[k] || 0) + d));
      document.getElementById('count-' + k).textContent = h[k];
      syncHouseholdPresence();
      renderKidAges();
      renderPetTypes();
    };
  });
  renderKidAges();
  renderPetTypes();
  renderMobility();
  renderHouseholdNotes();
}

/* Chip pickers all follow the kid-ages shape: toggle a value in an array on
   state.household, keep aria-pressed truthful. */
function renderChipPicker(wrapId, values, list){
  const wrap = document.getElementById(wrapId);
  if(!wrap) return;
  wrap.innerHTML = '';
  values.forEach(value => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const on = () => list().includes(value);
    chip.className = 'chip' + (on() ? ' sel' : '');
    chip.setAttribute('aria-pressed', String(on()));
    chip.textContent = value;
    chip.onclick = () => {
      const arr = list();
      const i = arr.indexOf(value);
      i < 0 ? arr.push(value) : arr.splice(i, 1);
      chip.classList.toggle('sel');
      chip.setAttribute('aria-pressed', String(on()));
    };
    wrap.appendChild(chip);
  });
}

function renderPetTypes(){
  const block = document.getElementById('pet-types-block');
  if(!block) return;
  const h = state.household;
  if(!Array.isArray(h.pets.types)) h.pets.types = [];
  // Only worth asking once they've said there are pets.
  block.classList.toggle('hide', (h.petCount || 0) < 1);
  renderChipPicker('pet-type-chips', PET_TYPES, () => h.pets.types);
}

function renderMobility(){
  const h = state.household;
  if(!Array.isArray(h.mobility)) h.mobility = [];
  renderChipPicker('mobility-chips', MOBILITY_NEEDS, () => h.mobility);
}

/* Free text, already forwarded to the model by buildAnalysisContext and
   already fenced as untrusted there — it just had nowhere to be typed. */
function renderHouseholdNotes(){
  const box = document.getElementById('household-notes');
  if(!box) return;
  box.value = state.household.notes || '';
  box.oninput = () => { state.household.notes = box.value; };
}

/* Presence stays the canonical 'yes'/'no' strings the rest of the app expects. */
function syncHouseholdPresence(){
  const h = state.household;
  h.kids.present = (h.kidCount || 0) > 0 ? 'yes' : 'no';
  if(h.kids.present === 'no') h.kids.ages = [];
  h.pets.present = (h.petCount || 0) > 0 ? 'yes' : 'no';
  if(h.pets.present === 'no') h.pets.types = [];

  /* Someone can tick "Kids' snacks", walk back to household, and set kids to
     zero. Hiding the chip from then on is not enough: the earlier selection is
     still in state and would ride into the analysis context, where the model
     is told there are no children and the validator rejects any kid-safety
     flag. Prune the selections to match the answer. */
  if(Array.isArray(state.cats)) state.cats = optionsForHousehold(state.cats, h);
  if(Array.isArray(state.goals)){
    const kept = optionsForHousehold(state.goals, h);
    if(kept.length !== state.goals.length){
      state.goals = kept;
      state.goal = kept.length ? goalIdFor(kept[0]) : null;
    }
  }
}

function renderKidAges(){
  const block = document.getElementById('kid-ages-block');
  if(!block) return;
  const h = state.household;
  block.classList.toggle('hide', (h.kidCount || 0) < 1);
  const wrap = document.getElementById('kid-age-chips');
  wrap.innerHTML = '';
  KID_AGES.forEach(a => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip' + (h.kids.ages.includes(a) ? ' sel' : '');
    c.setAttribute('aria-pressed', h.kids.ages.includes(a));
    c.textContent = a;
    c.onclick = () => {
      const i = h.kids.ages.indexOf(a);
      i < 0 ? h.kids.ages.push(a) : h.kids.ages.splice(i, 1);
      c.classList.toggle('sel');
      c.setAttribute('aria-pressed', c.classList.contains('sel'));
    };
    wrap.appendChild(c);
  });
}

/* ---------- contents (categories) ---------- */

function renderContents(){
  const wrap = document.getElementById('contents-chips');
  if(!wrap) return;
  const cfg = SPACE_CFG[state.space] || SPACE_CFG.pantry;
  const note = document.getElementById('contents-detected');
  if(note) note.classList.toggle('hide', !state.detected.length);
  wrap.innerHTML = '';
  optionsForHousehold(cfg.categories, state.household).forEach(cat => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip wz-cat' + (state.cats.includes(cat) ? ' sel' : '');
    c.setAttribute('aria-pressed', state.cats.includes(cat));
    c.textContent = cat;
    c.onclick = () => {
      state.catsTouched = true;
      const i = state.cats.indexOf(cat);
      i < 0 ? state.cats.push(cat) : state.cats.splice(i, 1);
      c.classList.toggle('sel');
      c.setAttribute('aria-pressed', c.classList.contains('sel'));
    };
    wrap.appendChild(c);
  });
}

/* ---------- goals ---------- */

function renderGoals(){
  const wrap = document.getElementById('goal-list');
  if(!wrap) return;
  const cfg = SPACE_CFG[state.space] || SPACE_CFG.pantry;
  wrap.innerHTML = '';
  optionsForHousehold(cfg.goals, state.household).forEach(goal => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wz-goal' + (state.goals.includes(goal) ? ' sel' : '');
    b.setAttribute('aria-pressed', state.goals.includes(goal));
    b.innerHTML = `<span class="wg-box"><span class="wg-check">${CHECK}</span></span><span class="wg-txt">${escapeHtml(goal)}</span>`;
    b.onclick = () => {
      const i = state.goals.indexOf(goal);
      i < 0 ? state.goals.push(goal) : state.goals.splice(i, 1);
      b.classList.toggle('sel');
      b.setAttribute('aria-pressed', b.classList.contains('sel'));
      state.goal = goalIdFor(state.goals[0]);
    };
    wrap.appendChild(b);
  });
}

/* ---------- style ---------- */

const STYLE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="6" rx="2"/><path d="M3 10h18M8 6V4M16 6V4"/></svg>';

function renderStyle(){
  const wrap = document.getElementById('style-cards');
  if(!wrap) return;
  const styles = STYLESETS[state.space] || STYLESETS.pantry;
  wrap.innerHTML = '';
  styles.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wz-style' + (state.styles.includes(o.label) ? ' sel' : '');
    b.setAttribute('aria-pressed', state.styles.includes(o.label));
    b.innerHTML = `
      <span class="wz-check">${CHECK}</span>
      <span class="ws-ico">${STYLE_ICON}</span>
      <span class="ws-ttl">${escapeHtml(o.label)}</span>
      <span class="ws-sub">${escapeHtml(o.desc)}</span>`;
    b.onclick = () => {
      const i = state.styles.indexOf(o.label);
      i < 0 ? state.styles.push(o.label) : state.styles.splice(i, 1);
      b.classList.toggle('sel');
      b.setAttribute('aria-pressed', b.classList.contains('sel'));
      recomputePrefs();
    };
    wrap.appendChild(b);
  });
}

/* ---------- effort ---------- */

const EFFORT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

function renderEffort(){
  const wrap = document.getElementById('effort-cards');
  if(!wrap) return;
  wrap.innerHTML = '';
  EFFORT_OPTS.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wz-effort' + (state.effort === o.label ? ' sel' : '');
    // single-select: expose the choice, the way every other step in the wizard
    // does. Selection used to be conveyed by the CSS class alone.
    b.setAttribute('aria-pressed', String(state.effort === o.label));
    b.innerHTML = `
      <span class="we-ico">${EFFORT_ICON}</span>
      <span class="we-txt"><span class="ws-ttl">${o.label}</span><span class="ws-sub">${o.desc}</span></span>
      <span class="wz-check">${CHECK}</span>`;
    b.onclick = () => { state.effort = o.label; renderEffort(); };
    wrap.appendChild(b);
  });
}

/* ---------- shopping ---------- */

function renderShopping(){
  const wrap = document.getElementById('shopping-cards');
  if(!wrap) return;
  wrap.innerHTML = '';
  SHOPPING_OPTS.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wz-shop' + (state.shoppingPref === o.label ? ' sel' : '');
    b.setAttribute('aria-pressed', String(state.shoppingPref === o.label));
    b.innerHTML = `
      <span class="wz-check">${CHECK}</span>
      <span class="ws-ttl">${o.label}</span>
      <span class="ws-sub">${o.desc}</span>`;
    b.onclick = () => { state.shoppingPref = o.label; recomputePrefs(); renderShopping(); };
    wrap.appendChild(b);
  });
}

/* ---------- review ---------- */

function renderReviewSummary(){
  const wrap = document.getElementById('review-rows');
  if(!wrap) return;
  const room = roomFor(state.space);
  const area = areaFor(state.space);
  const h = state.household;
  const people = [plural(h.adults || 0, 'adult'), plural(h.kidCount || 0, 'kid'), plural(h.petCount || 0, 'pet')].join(' · ')
    + ((h.kidCount || 0) > 0 && h.kids.ages.length ? ' (' + h.kids.ages.join(', ') + ')' : '');
  const rows = [
    ['Room', room.label, 'space'],
    ['Spot', area.label, 'area'],
    ['Setup', state.setupLabel, 'setup'],
    ['Measurements', measureSummary(state.setup, dimsFtNums()), 'measure'],
    ['Photos', plural(state.uploadedFiles.length, 'photo'), 'capture'],
    ['Who uses it', people, 'household'],
    /* Mobility, pet types and the free-text note were all collected, all
       forwarded to the model, and none of them appeared here — on the one
       screen headed "Here's what we heard". Someone who had just told us they
       use a wheelchair got a summary that never mentioned it, so there was no
       way to tell whether the answer had registered. Only shown when answered,
       so the screen does not grow for households that skipped them. */
    ...(h.pets.types && h.pets.types.length
      ? [['Pets', h.pets.types.join(', '), 'household']] : []),
    ...(h.mobility && h.mobility.length
      ? [['Reach & mobility', h.mobility.join(', '), 'household']] : []),
    ...((h.notes || '').trim()
      ? [['Your note', h.notes.trim(), 'household']] : []),
    ["What's inside", state.cats.length ? state.cats.join(', ') : 'Nothing selected yet', 'contents'],
    ['What bugs you', state.goals.length ? state.goals.join(', ') : 'Nothing selected yet', 'goals'],
    ['Style', state.styles.length ? state.styles.join(', ') : '—', 'style'],
    ['Effort', state.effort, 'effort'],
    ['Products', state.shoppingPref, 'shopping'],
  ];
  wrap.innerHTML = rows.map(([label, value, target]) => `
    <div class="wz-rev-row">
      <span class="wr-label">${escapeHtml(label)}</span>
      <span class="wr-value">${escapeHtml(String(value || '—'))}</span>
      <button type="button" class="wr-edit" data-goto="${target}">Edit</button>
    </div>`).join('');
  wrap.querySelectorAll('.wr-edit').forEach(btn => {
    btn.onclick = () => window.go(btn.dataset.goto);
  });
}

/* ---------- dispatcher ---------- */

const RENDERERS = {
  space: renderRoom,
  area: renderArea,
  setup: renderSetup,
  measure: renderMeasure,
  /* The photo step had no renderer, so its tiles were only ever drawn when a
     file was added or removed. Changing the area clears the uploaded files, and
     the step went on showing the old thumbnails — the plan was built without
     photos the user could still see on screen. Re-draw on entry. */
  capture: renderPhotoTiles,
  household: renderHousehold,
  contents: renderContents,
  goals: renderGoals,
  style: renderStyle,
  effort: renderEffort,
  shopping: renderShopping,
  review: renderReviewSummary,
};

export function renderWizardScreen(id){
  const fn = RENDERERS[id];
  if(fn) fn();
}

export function buildWizard(){
  // ensure the design defaults have dims before any screen renders
  if(!state.dims) applySetupDims(state.setup);
  recomputePrefs();
  Object.values(RENDERERS).forEach(fn => fn());
}
