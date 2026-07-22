import { backendConfigured } from '../config.js';
import { initAuth, onSession, sendCode, verifyCode, getUser } from '../auth.js';
import { toast } from '../ui.js';

/* Appbar account state + the email-code sign-in modal. */

let pendingIntent=null;           // e.g. 'save' — replayed after a successful sign-in
let intentHandlers={};
let authTrigger=null;

export function registerAuthIntent(name, fn){ intentHandlers[name]=fn; }

export async function setupAccount(){
  if(!backendConfigured()) return;    // no backend: keep both buttons hidden
  await initAuth();
  onSession(session=>{
    document.getElementById('acct-signin').classList.toggle('hide', !!session);
    document.getElementById('acct-btn').classList.toggle('hide', !session);
    if(session && pendingIntent){
      const run=intentHandlers[pendingIntent]; pendingIntent=null;
      if(run) run();
    }
  });
}

function handleModalKey(e){
  if(e.key==='Escape'){ closeAuth(); return; }
  if(e.key!=='Tab') return;
  const modal=document.querySelector('#auth-modal .modal');
  if(!modal) return;
  const focusable=modal.querySelectorAll('input:not([type=hidden]),button:not([disabled]),[tabindex]:not([tabindex="-1"])');
  if(!focusable.length) return;
  const first=focusable[0], last=focusable[focusable.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
}

export function openAuth(intent){
  pendingIntent=intent||null;
  authTrigger=document.activeElement;
  document.getElementById('auth-step-email').classList.remove('hide');
  document.getElementById('auth-step-code').classList.add('hide');
  document.getElementById('auth-msg').textContent='';
  document.getElementById('auth-modal').classList.remove('hide');
  document.body.style.overflow='hidden';
  document.addEventListener('keydown', handleModalKey);
  setTimeout(()=>document.getElementById('auth-email').focus(),50);
}

function hideAuthModal(){
  document.getElementById('auth-modal').classList.add('hide');
  document.body.style.overflow='';
  document.removeEventListener('keydown', handleModalKey);
  const triggerVisible=authTrigger && authTrigger.isConnected &&
    !authTrigger.classList?.contains('hide') && authTrigger.getClientRects().length;
  if(triggerVisible && typeof authTrigger.focus==='function'){
    authTrigger.focus();
    authTrigger=null;
    return;
  }
  authTrigger=null;
  const accountButton=document.getElementById('acct-btn');
  if(accountButton && !accountButton.classList.contains('hide')){
    accountButton.focus();
    return;
  }
  const heading=document.querySelector('.screen.active h1, .screen.active h2');
  if(heading){ heading.tabIndex=-1; heading.focus(); }
}

export function closeAuth(){
  pendingIntent=null;
  hideAuthModal();
}

export async function sendAuthCode(){
  const email=document.getElementById('auth-email').value.trim();
  const msg=document.getElementById('auth-msg');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg.textContent='Enter a valid email address.'; return; }
  const btn=document.getElementById('auth-send-btn');
  btn.disabled=true; msg.textContent='Sending…';
  try{
    await sendCode(email);
    document.getElementById('auth-step-email').classList.add('hide');
    document.getElementById('auth-step-code').classList.remove('hide');
    msg.textContent='Code sent to '+email+'. It can take a minute to arrive.';
    setTimeout(()=>document.getElementById('auth-code').focus(),50);
  }catch(e){
    msg.textContent=e.message;
  }finally{
    btn.disabled=false;
  }
}

export async function verifyAuthCode(){
  const email=document.getElementById('auth-email').value.trim();
  const code=document.getElementById('auth-code').value.trim();
  const msg=document.getElementById('auth-msg');
  if(code.length<6||code.length>8){ msg.textContent='Enter the code from your email (6–8 digits).'; return; }
  const btn=document.getElementById('auth-verify-btn');
  btn.disabled=true; msg.textContent='Checking…';
  try{
    await verifyCode(email, code);
    hideAuthModal();
    toast('Signed in as '+(getUser()?getUser().email:email));
  }catch(e){
    msg.textContent=e.message;
  }finally{
    btn.disabled=false;
  }
}
