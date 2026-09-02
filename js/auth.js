import { SUPABASE_URL, SUPABASE_ANON_KEY, backendConfigured } from './config.js';
import { setAuthTokenGetter } from './api.js';

/* Email-code (OTP) auth via supabase-js. No redirect URLs anywhere, which
   keeps GitHub Pages hosting and a future domain move config-free. */

let client = null;
let session = null;
const listeners = new Set();

export function supa(){
  return client;
}

/* supabase-js is 216KB, and every visitor used to download and initialise it
   at startup so that getSession() could report there was no session. The
   library only has work to do for someone who is signed in or about to be, so
   the client is created when a stored session says there is one to restore,
   or on the first sign-in action, and not otherwise. The library keeps its
   session under `sb-<project>-auth-token`; the scan is by shape rather than by
   computing the project ref, so a storage-key change upstream degrades to
   "sign in again" instead of to a wrong key. */
function hasStoredSession(){
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  }catch(_){ /* storage blocked: nothing to restore */ }
  return false;
}

function watchSession(){
  client.auth.onAuthStateChange((_evt, s)=>{
    session = s;
    listeners.forEach(fn=>fn(s));
  });
}

/* Creates the client on first need. `watch` is false only from initAuth,
   which reads the stored session before subscribing, the order the original
   startup used. */
export async function ensureClient({ watch=true }={}){
  if(client) return client;
  /* The vendored bundle ships no type declarations, so everything it returns
     is `{}`. Cast once, here, rather than at each of its call sites. */
  const { createClient } = /** @type {any} */ (await import('../vendor/supabase/supabase.esm.js'));
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  setAuthTokenGetter(()=> session ? session.access_token : null);
  if(watch) watchSession();
  return client;
}

export async function initAuth(){
  if(!backendConfigured()) return null;
  if(!hasStoredSession()){
    // Signed out, and nothing to load for it: the buttons still need telling.
    listeners.forEach(fn=>fn(null));
    return null;
  }
  await ensureClient({ watch:false });
  const { data } = await client.auth.getSession();
  session = data.session;
  watchSession();
  listeners.forEach(fn=>fn(session));
  return session;
}

export function getSession(){ return session; }
export function getUser(){ return session ? session.user : null; }

export function onSession(fn){
  listeners.add(fn);
  fn(session);
  return ()=>listeners.delete(fn);
}

export async function sendCode(email){
  await ensureClient();
  const { error } = await client.auth.signInWithOtp({ email, options:{ shouldCreateUser:true } });
  if(error) throw new Error(friendly(error));
}

export async function verifyCode(email, token){
  await ensureClient();
  const { error } = await client.auth.verifyOtp({ email, token, type:'email' });
  if(error) throw new Error(friendly(error));
}

export async function signOut(){
  if(client) await client.auth.signOut();
}

function friendly(error){
  const m=String(error && error.message || '');
  if(/rate/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
  if(/expired|invalid/i.test(m)) return 'That code didn’t match. Check the newest email and try again.';
  return m || 'Sign-in failed. Please try again.';
}
