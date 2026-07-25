import { prepareDemoPlanState } from '../state.js';
import { state } from '../state.js';
import { toast } from '../ui.js';
import { go } from '../router.js';
import { buildResults } from './results.js';
import { getDemoScenario } from '../demo-scenarios.js';
import { normalizeAi } from '../plan.js';
import { submitInviteRequest } from '../db.js';
import { affiliatesConfigured } from '../affiliates.js';
import { hydrateImages } from '../images.js';
import { ROOMS, AREAS, art } from '../wizard-data.js';
import { productArt } from '../product-art.js';
import { setArea } from './wizard.js';

/* ---------- Sample plan shortcut ---------- */
export function runDemo(){
  prepareDemoPlanState();
  const scenario = getDemoScenario('pantry', 'find', state.household);
  state.ai = normalizeAi(scenario);
  state.planMeta = { model: 'demo', source: 'demo', analyzedAt: Date.now() };
  buildResults();
  go('results');
  toast('Loaded the sample pantry plan');
}

/* ---------- Email updates signup ---------- */
const INVITE_KEY='tidymap_invite_email';

export function requestInvite(){
  const input=document.getElementById('signup-email');
  const email=(input.value||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    input.classList.add('err'); input.focus();
    setTimeout(()=>input.classList.remove('err'),900);
    toast('Please enter a valid email address');
    return;
  }
  try{ localStorage.setItem(INVITE_KEY,email); }catch(e){}
  // store the request in the database so the owner actually sees it
  submitInviteRequest(email).catch(()=>{});
  showSignupConfirmed(email);
  toast('You’re signed up');
}

function showSignupConfirmed(email){
  const form=document.getElementById('signup-form');
  const done=document.getElementById('signup-done');
  if(!form||!done) return;
  form.classList.add('hide');
  done.classList.remove('hide');
  const slot=done.querySelector('[data-invite-email]');
  if(slot) slot.textContent=email;
}

/* ---------- Spaces gallery ----------
   Built from the wizard's own ROOMS/AREAS so the homepage always advertises
   exactly what the planner supports. Picking a card sets the answer and drops
   the visitor at step 3 (the setup shapes), which is the first step that shows
   them something about their own space. */
function renderSpaces(){
  const wrap = document.getElementById('space-groups');
  if(!wrap) return;
  wrap.innerHTML = '';
  ROOMS.forEach(room => {
    const group = document.createElement('div');
    group.className = 'space-group';
    const cards = (AREAS[room.id] || []).map((a, i) => `
      <button type="button" class="room-card" data-room="${room.id}" data-area="${a.id}">
        <div class="rc-img card-visual tone-${i % 4}">${art(a.artKey)}</div>
        <div class="rc-label"><h3>${a.label}</h3><p>${a.desc}</p></div>
      </button>`).join('');
    group.innerHTML = `<h3 class="space-room">${room.label}</h3><div class="room-cards">${cards}</div>`;
    wrap.appendChild(group);
  });
  wrap.addEventListener('click', e => {
    const card = e.target.closest('.room-card');
    if(!card) return;
    setArea(card.dataset.room, card.dataset.area);
    go('setup');
  });
}

/* The site nav points at sections of the landing page, which is hidden while
   another screen is showing. Route back first, then scroll — otherwise the
   anchor resolves to an invisible element and nothing appears to happen. */
export function navHome(hash){
  document.body.classList.remove('nav-open');
  if(document.body.dataset.screen !== 'landing') go('landing');
  const el = document.querySelector(hash);
  if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  return false;
}

/* The "Optional purchases" panel borrows the product library's category
   drawings rather than shipping a second set of its own. */
function fillProductArt(){
  document.querySelectorAll('#screen-landing [data-art]').forEach(el => {
    el.innerHTML = productArt(el.dataset.art);
  });
}

/* ---------- Appbar scroll shadow ---------- */
function initAppbarScroll(){
  const appbar=document.querySelector('.appbar');
  if(!appbar) return;
  let ticking=false;
  window.addEventListener('scroll',()=>{
    if(ticking) return;
    ticking=true;
    requestAnimationFrame(()=>{
      appbar.classList.toggle('scrolled',window.scrollY>10);
      ticking=false;
    });
  },{passive:true});
}

/* ---------- Landing setup: restore signup state ---------- */
export function initLanding(){
  try{
    const saved=localStorage.getItem(INVITE_KEY);
    if(saved) showSignupConfirmed(saved);
  }catch(e){}

  const affNote=document.getElementById('affil-note');
  if(affNote && affiliatesConfigured()) affNote.classList.remove('hide');

  // Drive keyed imagery from the manifest: fill ready photos, collapse the
  // slots whose art is still pending so no request 404s. Fire-and-forget;
  // the declarative <img>/onerror fallback covers a manifest load failure.
  hydrateImages().catch(()=>{});

  renderSpaces();
  fillProductArt();
  initAppbarScroll();
}
