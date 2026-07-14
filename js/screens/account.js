import { backendConfigured } from '../config.js';
import { initAuth, onSession, sendCode, verifyCode, getUser } from '../auth.js';
import { toast } from '../ui.js';

/* Appbar account state + the email-code sign-in modal. */

let pendingIntent=null;           // e.g. 'save' — replayed after a successful sign-in
let intentHandlers={};

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

export function openAuth(intent){
  pendingIntent=intent||null;
  document.getElementById('auth-step-email').classList.remove('hide');
  document.getElementById('auth-step-code').classList.add('hide');
  document.getElementById('auth-msg').textContent='';
  document.getElementById('auth-modal').classList.remove('hide');
  setTimeout(()=>document.getElementById('auth-email').focus(),50);
}
export function closeAuth(){
  pendingIntent=null;
  document.getElementById('auth-modal').classList.add('hide');
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
    msg.textContent='Code sent to '+email+' — it can take a minute to arrive.';
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
  if(code.length!==6){ msg.textContent='The code is 6 digits.'; return; }
  const btn=document.getElementById('auth-verify-btn');
  btn.disabled=true; msg.textContent='Checking…';
  try{
    await verifyCode(email, code);
    document.getElementById('auth-modal').classList.add('hide');
    toast('Signed in as '+(getUser()?getUser().email:email));
  }catch(e){
    msg.textContent=e.message;
  }finally{
    btn.disabled=false;
  }
}
