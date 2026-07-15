import { state } from '../state.js';
import { toast } from '../ui.js';
import { go } from '../router.js';
import { buildResults } from './results.js';

/* ---------- Demo shortcut ---------- */
export function runDemo(){
  state.space='pantry'; state.goal='find'; state.capture='demo';
  state.upgrades=true;
  buildResults();
  go('results');
  toast('Loaded the example pantry plan');
}

/* ---------- Private Registry: invitation requests ---------- */
const INVITE_KEY='tidymap_invite_email';

export function requestInvite(){
  const input=document.getElementById('lx-email');
  const email=(input.value||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    input.classList.add('err'); input.focus();
    setTimeout(()=>input.classList.remove('err'),900);
    toast('Please enter a valid email address');
    return;
  }
  try{ localStorage.setItem(INVITE_KEY,email); }catch(e){}
  showInviteConfirmed(email);
  toast('Your request has been received');
}

function showInviteConfirmed(email){
  const form=document.getElementById('lx-invite-form');
  const done=document.getElementById('lx-invite-done');
  if(!form||!done) return;
  form.classList.add('hide');
  done.classList.remove('hide');
  const slot=done.querySelector('[data-invite-email]');
  if(slot) slot.textContent=email;
}

/* ---------- Landing setup: restore invite state, scroll reveals ---------- */
export function initLanding(){
  try{
    const saved=localStorage.getItem(INVITE_KEY);
    if(saved) showInviteConfirmed(saved);
  }catch(e){}
  const els=document.querySelectorAll('#screen-landing .lx-reveal');
  if(!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches){
    els.forEach(el=>el.classList.add('in'));
    return;
  }
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  },{threshold:.12, rootMargin:'0px 0px -40px 0px'});
  els.forEach(el=>io.observe(el));
}
