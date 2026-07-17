import { prepareDemoPlanState } from '../state.js';
import { state } from '../state.js';
import { toast } from '../ui.js';
import { go } from '../router.js';
import { buildResults } from './results.js';
import { getDemoScenario } from '../demo-scenarios.js';
import { normalizeAi } from '../plan.js';
import { submitInviteRequest } from '../db.js';
import { affiliatesConfigured } from '../affiliates.js';

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

  initAppbarScroll();
}
