import { prepareDemoPlanState } from '../state.js';
import { toast } from '../ui.js';
import { go } from '../router.js';
import { buildResults } from './results.js';

/* ---------- Demo shortcut ---------- */
export function runDemo(){
  prepareDemoPlanState();
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

/* ---------- Landing setup: restore invite state, scroll reveals ---------- */
export function initLanding(){
  try{
    const saved=localStorage.getItem(INVITE_KEY);
    if(saved) showInviteConfirmed(saved);
  }catch(e){}

  initAppbarScroll();

  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const allReveal=document.querySelectorAll('#screen-landing .lx-reveal');
  const staggered=document.querySelectorAll('#screen-landing .lx-chapter, #screen-landing .lx-value, #screen-landing .lx-vitrine');

  if(!('IntersectionObserver' in window) || reducedMotion){
    allReveal.forEach(el=>el.classList.add('in'));
    staggered.forEach(el=>el.classList.add('in'));
    return;
  }

  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  },{threshold:.12, rootMargin:'0px 0px -40px 0px'});
  allReveal.forEach(el=>io.observe(el));

  const staggerIo=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('in'); staggerIo.unobserve(e.target); }
    });
  },{threshold:.08, rootMargin:'0px 0px -30px 0px'});
  staggered.forEach(el=>staggerIo.observe(el));
}
